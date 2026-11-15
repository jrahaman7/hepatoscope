import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { GeneProfile, Subtype } from '../data/presets';
import { alphaFold, otTarget, otTargetDiseaseAssociation, OT_AXES, rcsbEntry, rcsbSearchByUniprot, uniprot, type OtAxis, type UniFeature } from '../services/scienceApi';
import { useAsync } from '../hooks/useAsync';
import { Badge, Card, Empty, ErrorBox, Ext, Loading, SectionHeader, Segmented, Stat, fmt } from '../components/ui';
import { MolViewer, PLDDT_BANDS, type RenderStyle, type StructSource } from '../components/MolViewer';

const AXIS_LABEL: Record<OtAxis, string> = {
  somatic_mutation: 'Somatic', known_drug: 'Drugs', affected_pathway: 'Pathways', literature: 'Literature',
  rna_expression: 'RNA expr.', animal_model: 'Animal model', genetic_association: 'Genetic assoc.',
};

function RadarPlot({ axes }: { axes: Record<OtAxis, number> }) {
  const size = 260, r = 95, c = size / 2;
  const n = OT_AXES.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const;
  };
  const poly = OT_AXES.map((k, i) => pt(i, axes[k]).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[280px]" role="img" aria-label="Open Targets datatype radar">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon key={g} points={OT_AXES.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="#e2e8f0" />
      ))}
      {OT_AXES.map((k, i) => {
        const [x, y] = pt(i, 1); const [lx, ly] = pt(i, 1.22);
        return (
          <g key={k}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="#e2e8f0" />
            <text x={lx} y={ly} fontSize="9.5" textAnchor="middle" dominantBaseline="middle" fill="#475569">{AXIS_LABEL[k]}</text>
          </g>
        );
      })}
      <polygon points={poly} fill="#1f8a70" fillOpacity={0.25} stroke="#1f8a70" strokeWidth={1.5} />
      {OT_AXES.map((k, i) => { const [x, y] = pt(i, axes[k]); return <circle key={k} cx={x} cy={y} r={3} fill="#17705b"><title>{`${AXIS_LABEL[k]}: ${axes[k].toFixed(3)}`}</title></circle>; })}
    </svg>
  );
}

function LollipopTrack({ length, domains, variants, hotspot, onPick }: { length: number; domains: UniFeature[]; variants: UniFeature[]; hotspot: number | null; onPick: (resi: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const x = d3.scaleLinear().domain([1, length]).range([12, w - 12]);
  const byPos = d3.rollups(variants, (v) => v, (v) => v.start).sort((a, b) => a[0] - b[0]);
  const maxStack = d3.max(byPos, (d) => d[1].length) ?? 1;
  const h = d3.scaleLinear().domain([1, Math.max(maxStack, 2)]).range([22, 62]);
  const color = d3.scaleOrdinal<string, string>().domain([...new Set(domains.map((d) => d.description))]).range(['#99d5c4', '#a5c8ff', '#f8c9a0', '#d7b9f5', '#f5a8b8', '#c6e48b', '#ffe08a']);
  const base = 92;
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={128} className="block">
        <rect x={x(1)} y={base} width={x(length) - x(1)} height={14} rx={3} fill="#e2e8f0" />
        {domains.map((d, i) => (
          <g key={i} className="cursor-pointer" onClick={() => onPick(Math.round((d.start + d.end) / 2))}>
            <rect x={x(d.start)} y={base - 2} width={Math.max(2, x(d.end) - x(d.start))} height={18} rx={3} fill={color(d.description)} stroke="#64748b" strokeWidth={0.5}>
              <title>{`${d.type}: ${d.description} (${d.start}–${d.end})`}</title>
            </rect>
            {x(d.end) - x(d.start) > 60 && <text x={(x(d.start) + x(d.end)) / 2} y={base + 10} fontSize="9" textAnchor="middle" fill="#1e293b" pointerEvents="none">{d.description.slice(0, 22)}</text>}
          </g>
        ))}
        {byPos.map(([pos, vs]) => (
          <g key={pos} className="cursor-pointer" onClick={() => onPick(pos)}>
            <line x1={x(pos)} x2={x(pos)} y1={base - 2} y2={base - h(vs.length)} stroke="#94a3b8" />
            <circle cx={x(pos)} cy={base - h(vs.length)} r={3.5} fill="#0ea5e9" stroke="white">
              <title>{`p.${pos}: ${vs.map((v) => `${v.original ?? ''}→${v.alternatives?.join('/') ?? ''}`).join(', ')}\n${vs[0].description.slice(0, 140)}`}</title>
            </circle>
          </g>
        ))}
        {hotspot && hotspot <= length && (
          <g className="cursor-pointer" onClick={() => onPick(hotspot)}>
            <line x1={x(hotspot)} x2={x(hotspot)} y1={base - 2} y2={18} stroke="#e11d48" strokeWidth={1.5} />
            <path d={d3.symbol(d3.symbolDiamond, 90)() ?? ''} transform={`translate(${x(hotspot)},16)`} fill="#e11d48" />
            <text x={x(hotspot) + 7} y={12} fontSize="10" fill="#e11d48" fontWeight={600}>hotspot {hotspot}</text>
          </g>
        )}
        {d3.ticks(1, length, 8).map((t) => (
          <text key={t} x={x(t)} y={base + 30} fontSize="9" textAnchor="middle" fill="#64748b">{t}</text>
        ))}
      </svg>
    </div>
  );
}

export function S1Structure({ gene, subtype }: { gene: GeneProfile; subtype: Subtype }) {
  const [source, setSource] = useState<StructSource>('alphafold');
  const [style, setStyle] = useState<RenderStyle>('cartoon');
  const [focus, setFocus] = useState<{ resi: number; nonce: number } | null>(null);
  useEffect(() => { setFocus(null); }, [gene.uniprot]);

  const af = useAsync(() => alphaFold(gene.uniprot), [gene.uniprot]);
  const up = useAsync(() => uniprot(gene.uniprot), [gene.uniprot]);
  const pdbId = useAsync(async () => gene.pdbId ?? (await rcsbSearchByUniprot(gene.uniprot, 1))[0] ?? null, [gene.uniprot, gene.pdbId]);
  const pdb = useAsync(() => rcsbEntry(pdbId.data!), [pdbId.data], !!pdbId.data);
  const assoc = useAsync(() => otTargetDiseaseAssociation(subtype.efoId, gene.ensemblId), [subtype.efoId, gene.ensemblId]);
  const tgt = useAsync(() => otTarget(gene.ensemblId), [gene.ensemblId]);

  const tract = useMemo(() => {
    const rows = tgt.data?.tractability ?? [];
    const mods = [...new Set(rows.map((r) => r.modality))];
    return mods.map((m) => ({ modality: m, items: rows.filter((r) => r.modality === m) }));
  }, [tgt.data]);
  const MOD_LABEL: Record<string, string> = { SM: 'Small molecule', AB: 'Antibody', PR: 'PROTAC', OC: 'Other clinical' };
  const hotspotResi = gene.hotspot?.residue ?? null;

  return (
    <section id="s01" className="scroll-mt-28">
      <SectionHeader n="01" title="3D Macromolecular Structure & Target Tractability" sources={['AlphaFold DB', 'RCSB PDB', 'UniProtKB', 'Open Targets']} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={`${gene.symbol} · ${source === 'alphafold' ? `AlphaFold ${af.data ? `v${af.data.latestVersion}` : ''} model` : `PDB ${pdbId.data ?? '—'}`}`}
          subtitle={source === 'alphafold' ? (af.data ? `${af.data.entryId} · residues ${af.data.uniprotStart}–${af.data.uniprotEnd}${af.data.globalMetricValue ? ` · mean pLDDT ${af.data.globalMetricValue.toFixed(1)}` : ''}` : af.error ?? 'resolving…')
            : pdb.data ? `${pdb.data.method} · ${pdb.data.resolution ? `${pdb.data.resolution.toFixed(2)} Å` : 'n/a'} · ${pdb.data.title}` : pdbId.loading ? 'resolving…' : 'No experimental structure'}
          right={<div className="flex flex-wrap justify-end gap-2">
            <Segmented value={source} onChange={setSource} options={[{ value: 'alphafold', label: 'AlphaFold' }, { value: 'pdb', label: 'PDB' }]} />
            <Segmented value={style} onChange={setStyle} options={(['cartoon', 'stick', 'sphere', 'surface'] as const).map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
          </div>}>
          <MolViewer source={source} alphaFoldCifUrl={af.data?.cifUrl} pdbId={pdbId.data} style={style} hotspot={hotspotResi} focus={focus} />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            {source === 'alphafold' ? PLDDT_BANDS.map((b) => <span key={b.label} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />{b.label}</span>)
              : <span>Chain spectrum coloring · ligands in green sticks</span>}
            {hotspotResi && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-600" />Hotspot residue {hotspotResi}</span>}
            <span className="ml-auto text-slate-400">Wheel zoom disabled — use +/− · drag to rotate</span>
            {af.data && <Ext href={af.data.paeImageUrl ?? `https://alphafold.ebi.ac.uk/entry/${gene.uniprot}`}>PAE</Ext>}
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="Open Targets association" subtitle={assoc.data?.disease ? `${gene.symbol} ↔ ${assoc.data.disease.name} (${subtype.efoId})` : subtype.efoId}
            right={assoc.data?.overall != null ? <Badge tone="brand">overall {assoc.data.overall.toFixed(3)}</Badge> : undefined}>
            {assoc.loading ? <Loading /> : assoc.error ? <ErrorBox error={assoc.error} onRetry={assoc.reload} /> : assoc.data && (
              assoc.data.disease == null ? <Empty>Disease {subtype.efoId} not found in Open Targets.</Empty>
                : assoc.data.overall == null ? <Empty>No direct association scored for {gene.symbol} in {assoc.data.disease.name}.</Empty>
                  : <RadarPlot axes={assoc.data.axes} />)}
          </Card>
          <Card title="Tractability matrix" subtitle="Open Targets buckets per modality">
            {tgt.loading ? <Loading /> : tgt.error ? <ErrorBox error={tgt.error} onRetry={tgt.reload} /> : tract.length === 0 ? <Empty>No tractability data.</Empty> : (
              <div className="space-y-2">
                {tract.map((m) => (
                  <div key={m.modality}>
                    <div className="mb-1 text-[11px] font-semibold text-slate-600">{MOD_LABEL[m.modality] ?? m.modality}</div>
                    <div className="flex flex-wrap gap-1">
                      {m.items.map((it) => (
                        <span key={it.label} title={it.label} className={`rounded px-1.5 py-0.5 text-[10.5px] ${it.value ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{it.label}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="lg:col-span-5" title="Linear protein domains & variant lollipops" subtitle="Click any domain, lollipop or the hotspot to fly the 3D camera to that residue">
          {up.loading ? <Loading /> : up.error ? <ErrorBox error={up.error} onRetry={up.reload} /> : up.data && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="UniProt" value={<Ext href={`https://www.uniprot.org/uniprotkb/${up.data.accession}`}>{up.data.accession}</Ext>} />
                <Stat label="Length" value={`${up.data.length} aa`} />
                <Stat label="Natural variants" value={up.data.variants.length} />
                <Stat label="Location" value={<span className="text-xs">{up.data.locations.slice(0, 2).join(', ') || '—'}</span>} />
              </div>
              <LollipopTrack length={up.data.length} domains={up.data.domains} variants={up.data.variants} hotspot={hotspotResi} onPick={(resi) => setFocus({ resi, nonce: Date.now() })} />
              <p className="mt-2 line-clamp-3 text-xs text-slate-600" title={up.data.func}>{up.data.func}</p>
              {focus && <p className="mt-1 text-xs text-violet-700">Camera focused on residue {focus.resi}.</p>}
            </>
          )}
          {!up.loading && !up.error && pdb.data && <p className="mt-1 text-[11px] text-slate-400">Experimental reference: <Ext href={`https://www.rcsb.org/structure/${pdb.data.id}`}>{pdb.data.id}</Ext> · {fmt.num(pdb.data.resolution)} Å</p>}
        </Card>
      </div>
    </section>
  );
}
