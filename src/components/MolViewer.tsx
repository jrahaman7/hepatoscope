import { useEffect, useRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import { fetchText } from '../services/scienceApi';

export type StructSource = 'alphafold' | 'pdb';
export type RenderStyle = 'cartoon' | 'stick' | 'sphere' | 'surface';

// AlphaFold DB 4-band pLDDT palette
export const PLDDT_BANDS = [
  { min: 90, color: '#0053D6', label: 'Very high (>90)' },
  { min: 70, color: '#65CBF3', label: 'Confident (70–90)' },
  { min: 50, color: '#FFDB13', label: 'Low (50–70)' },
  { min: -1, color: '#FF7D45', label: 'Very low (<50)' },
];
const plddtColor = (b: number) => PLDDT_BANDS.find((x) => b > x.min)!.color;

interface Props {
  source: StructSource;
  alphaFoldCifUrl?: string;
  pdbId?: string | null;
  style: RenderStyle;
  hotspot?: number | null;
  focus?: { resi: number; nonce: number } | null;
}

type Viewer = ReturnType<typeof $3Dmol.createViewer>;

export function MolViewer({ source, alphaFoldCifUrl, pdbId, style, hotspot, focus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loaded, setLoaded] = useState(0);

  // Create viewer once; suppress wheel-zoom by stopping wheel events in the capture phase
  // before they reach 3Dmol's canvas listener (page scroll still works).
  useEffect(() => {
    const el = host.current!;
    viewer.current = $3Dmol.createViewer(el, { backgroundColor: 'white', antialias: true } as never);
    const stopWheel = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener('wheel', stopWheel, { capture: true });
    const ro = new ResizeObserver(() => { viewer.current?.resize(); viewer.current?.render(); });
    ro.observe(el);
    return () => { el.removeEventListener('wheel', stopWheel, { capture: true }); ro.disconnect(); viewer.current?.clear(); };
  }, []);

  // Load model
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    const url = source === 'alphafold' ? alphaFoldCifUrl : pdbId ? `https://files.rcsb.org/download/${pdbId}.cif` : undefined;
    if (!url) { v.clear(); v.render(); setStatus(source === 'pdb' ? 'No experimental PDB entry for this target.' : 'Waiting for AlphaFold model…'); return; }
    let live = true;
    setStatus('Fetching coordinates…');
    fetchText(url, source === 'alphafold' ? 'AlphaFold DB' : 'RCSB PDB')
      .then((txt) => {
        if (!live) return;
        v.clear();
        v.addModel(txt, 'cif');
        setStatus('');
        setLoaded((n) => n + 1);
      })
      .catch((e) => live && setStatus(`Structure load failed: ${e.message}`));
    return () => { live = false; };
  }, [source, alphaFoldCifUrl, pdbId]);

  // Style
  useEffect(() => {
    const v = viewer.current;
    if (!v || !loaded) return;
    const colorSpec = source === 'alphafold'
      ? { colorfunc: (a: { b: number }) => plddtColor(a.b) }
      : { color: 'spectrum' };
    v.removeAllSurfaces();
    v.removeAllLabels();
    v.setStyle({}, {});
    v.setStyle({ hetflag: false } as never, (style === 'surface' ? { cartoon: { ...colorSpec, opacity: 0.6 } } : { [style]: style === 'sphere' ? { ...colorSpec, scale: 0.9 } : colorSpec }) as never);
    if (source === 'pdb') v.addStyle({ hetflag: true, not: { resn: 'HOH' } } as never, { stick: { colorscheme: 'greenCarbon', radius: 0.25 } } as never);
    if (style === 'surface') v.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.85, ...(source === 'alphafold' ? colorSpec : { color: '#d6e9e2' }) } as never, { hetflag: false } as never);
    if (hotspot) {
      const sel = { resi: hotspot, hetflag: false } as never;
      v.addStyle(sel, { stick: { color: '#e11d48', radius: 0.35 }, sphere: { color: '#e11d48', scale: 0.35 } } as never);
      const atoms = v.selectedAtoms({ resi: hotspot, atom: 'CA' } as never);
      if (atoms.length) v.addLabel(`hotspot ${atoms[0].resn}${hotspot}`, { position: atoms[0] as never, backgroundColor: '#e11d48', fontColor: 'white', fontSize: 11, backgroundOpacity: 0.85 } as never);
    }
    v.zoomTo();
    v.render();
  }, [loaded, style, hotspot, source]);

  // Fly camera to a clicked residue
  useEffect(() => {
    const v = viewer.current;
    if (!v || !loaded || !focus) return;
    const sel = { resi: focus.resi, hetflag: false } as never;
    const atoms = v.selectedAtoms(sel);
    if (!atoms.length) { setStatus(`Residue ${focus.resi} is not modelled in this structure.`); return; }
    setStatus('');
    v.removeAllLabels();
    v.addStyle(sel, { stick: { color: '#7c3aed', radius: 0.3 } } as never);
    const ca = atoms.find((a) => a.atom === 'CA') ?? atoms[0];
    v.addLabel(`${ca.resn}${focus.resi}`, { position: ca as never, backgroundColor: '#7c3aed', fontColor: 'white', fontSize: 11 } as never);
    v.zoomTo(sel, 900);
    v.render();
  }, [focus, loaded]);

  const zoom = (f: number) => { viewer.current?.zoom(f, 250); viewer.current?.render(); };
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div ref={host} className="absolute inset-0" />
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[['+', 1.25], ['−', 0.8]].map(([l, f]) => (
          <button key={l as string} onClick={() => zoom(f as number)} className="h-7 w-7 rounded-md border border-slate-200 bg-white/90 text-sm shadow-sm hover:bg-slate-50">{l}</button>
        ))}
        <button onClick={() => { viewer.current?.zoomTo(); viewer.current?.render(); }} className="h-7 w-7 rounded-md border border-slate-200 bg-white/90 text-[10px] shadow-sm hover:bg-slate-50" title="Reset view">⟲</button>
      </div>
      {status && <div className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">{status}</div>}
    </div>
  );
}
