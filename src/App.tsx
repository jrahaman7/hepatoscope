import { useEffect, useState, type FormEvent } from 'react';
import { DRUG_PRESETS, GENE_PRESETS, SUBTYPES, type DrugPreset, type GeneProfile, type SubtypeKey } from './data/presets';
import type { UseCase } from './data/contentTypes';
import { otDiseaseTopTargets, otResolveDisease, resolveGene } from './services/scienceApi';
import { useAsync } from './hooks/useAsync';
import { Badge, Ext } from './components/ui';
import { Shell, type Mode, type NavGroup } from './components/Shell';
import { PatientView } from './sections/PatientView';
import { ClinicianHub } from './sections/ClinicianHub';
import { S1Structure } from './sections/S1Structure';
import { S2Genomics } from './sections/S2Genomics';
import { S3Pharma } from './sections/S3Pharma';
import { S4Network } from './sections/S4Network';
import { S5Trials } from './sections/S5Trials';

const NAV: Record<Mode, NavGroup[]> = {
  patient: [
    { label: 'Understand', items: [{ id: 'welcome', label: 'Start here' }, { id: 'people', label: 'People like you' }, { id: 'journey', label: 'Your journey' }] },
    { label: 'What works', items: [{ id: 'what-works', label: 'Proven treatments' }, { id: 'stories', label: 'Real-world success' }] },
    { label: 'Help', items: [{ id: 'support', label: 'Support & resources' }, { id: 'glossary', label: 'Glossary' }] },
  ],
  clinician: [
    { label: 'Evidence', items: [{ id: 'overview', label: 'Overview' }, { id: 'evidence', label: 'Evidence table' }, { id: 'use-cases', label: 'Use cases' }] },
    { label: 'Live workbench', items: [{ id: 'workbench', label: 'Target & context' }, { id: 's01', label: '01 Structure' }, { id: 's02', label: '02 Genomics' }, { id: 's03', label: '03 Pharmacology' }, { id: 's04', label: '04 Pathways & PPI' }, { id: 's05', label: '05 Trials & literature' }] },
  ],
};

const readMode = (): Mode => {
  if (location.hash === '#clinician') return 'clinician';
  if (location.hash === '#patient') return 'patient';
  try { return (localStorage.getItem('hs-mode') as Mode) || 'patient'; } catch { return 'patient'; }
};

export default function App() {
  const [mode, setModeState] = useState<Mode>(readMode);
  const [subtypeKey, setSubtypeKey] = useState<SubtypeKey>('HCC');
  const [gene, setGene] = useState<GeneProfile>(GENE_PRESETS[0]);
  const [drug, setDrug] = useState<DrugPreset>(DRUG_PRESETS[0]);
  const [active, setActive] = useState('');
  const [geneStatus, setGeneStatus] = useState<{ loading?: string; error?: string }>({});

  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem('hs-mode', m); } catch { /* storage unavailable */ }
    window.scrollTo({ top: 0 });
  };

  // Allow #patient / #clinician links to switch modes on an open page.
  useEffect(() => {
    const onHash = () => { if (location.hash === '#patient' || location.hash === '#clinician') setMode(location.hash.slice(1) as Mode); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight the sidebar item for the section in view.
  useEffect(() => {
    const ids = NAV[mode].flatMap((g) => g.items.map((i) => i.id));
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    const t = setTimeout(() => ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); }), 50);
    return () => { clearTimeout(t); io.disconnect(); };
  }, [mode]);

  const openUseCase = (u: UseCase) => {
    setSubtypeKey(u.subtype);
    const g = GENE_PRESETS.find((p) => p.symbol === u.gene);
    if (g) { setGene(g); setGeneStatus({}); }
    else {
      setGeneStatus({ loading: u.gene });
      void resolveGene(u.gene)
        .then((r) => { setGene(r); setGeneStatus({}); })
        .catch((e: unknown) => setGeneStatus({ error: `Could not load ${u.gene}: ${e instanceof Error ? e.message : String(e)}` }));
    }
    const d = DRUG_PRESETS.find((p) => p.name === u.drug);
    if (d) setDrug(d);
    setTimeout(() => document.getElementById('workbench')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  return (
    <Shell mode={mode} onMode={setMode} groups={NAV[mode]} active={active}>
      {mode === 'patient' ? (
        <PatientView subtype={subtypeKey} onSubtype={setSubtypeKey} onOpenClinician={() => setMode('clinician')} />
      ) : (
        <div className="space-y-14">
          <ClinicianHub subtype={subtypeKey} onSubtype={setSubtypeKey} onUseCase={openUseCase} />
          <Workbench subtypeKey={subtypeKey} gene={gene} setGene={(g) => { setGene(g); setGeneStatus({}); }} drug={drug} setDrug={setDrug} status={geneStatus} />
        </div>
      )}
      <footer className="mt-16 border-t border-rule pt-5 text-[12.5px] leading-relaxed text-ink-soft">
        <p><b className="text-ink">HepatoScope</b> · General education and research use — not personal medical advice and not a substitute for your care team.</p>
        <p className="mt-1">Live data: Open Targets, AlphaFold DB, UniProtKB, RCSB PDB, gnomAD, NCBI ClinVar, Ensembl, PubChem, openFDA, ChEMBL, Reactome, STRING, GTEx, ClinicalTrials.gov, Europe PMC. Design language after <Ext href="https://drjavid.bio">drjavid.bio</Ext>.</p>
      </footer>
    </Shell>
  );
}

function Workbench({ subtypeKey, gene, setGene, drug, setDrug, status }: { subtypeKey: SubtypeKey; gene: GeneProfile; setGene: (g: GeneProfile) => void; drug: DrugPreset; setDrug: (d: DrugPreset) => void; status: { loading?: string; error?: string } }) {
  const subtype = SUBTYPES.find((s) => s.key === subtypeKey)!;
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const topTargets = useAsync(async () => {
    const dz = await otResolveDisease([subtype.otId, subtype.efoId], subtype.label);
    return { ...(await otDiseaseTopTargets(dz.id, 12)), id: dz.id };
  }, [subtype.otId]);

  const pickSymbol = async (sym: string) => {
    const preset = GENE_PRESETS.find((g) => g.symbol === sym.toUpperCase());
    if (preset) { setGene(preset); setResolveErr(null); return; }
    setResolving(true); setResolveErr(null);
    try { setGene(await resolveGene(sym)); setQuery(''); }
    catch (e) { setResolveErr(e instanceof Error ? e.message : String(e)); }
    finally { setResolving(false); }
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (query.trim()) void pickSymbol(query); };

  return (
    <>
      <section id="workbench" className="scroll-mt-20 border-t border-rule pt-10">
        <div className="eyebrow mb-2">Live workbench · {subtype.label}</div>
        <h2 className="serif text-[30px] font-medium leading-tight text-ink md:text-[36px]">Target <em className="text-brand-600">{gene.symbol}</em> — {gene.name}</h2>
        <div className="sticky top-0 z-30 -mx-2 mt-4 rounded-xl border border-rule bg-paper/95 p-3 backdrop-blur lg:top-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1 !text-[10px]">Drivers</span>
            {GENE_PRESETS.map((g) => (
              <button key={g.symbol} onClick={() => setGene(g)}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[12px] ${gene.symbol === g.symbol ? 'border-brand-500 bg-brand-500 text-white' : 'border-rule text-ink-soft hover:border-brand-500'}`}>{g.symbol}</button>
            ))}
            <form onSubmit={onSubmit} className="ml-auto flex items-center gap-1">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Any HGNC symbol (e.g. AXIN1)" aria-label="Resolve gene symbol"
                className="w-48 rounded-[7px] border border-rule px-2 py-1 text-[13px] focus:border-brand-500 focus:outline-none" />
              <button disabled={resolving} className="rounded-[7px] bg-brand-500 px-2.5 py-1 text-[13px] font-semibold text-white disabled:opacity-50">{resolving ? 'Resolving…' : 'Resolve'}</button>
            </form>
          </div>
          {resolveErr && <p className="mt-1 text-[12px] text-rose-600">{resolveErr}</p>}
          {(status.loading || resolving) && <p className="mt-1 flex items-center gap-2 text-[12.5px] text-brand-600"><span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />Resolving {status.loading ?? query.toUpperCase()} from Open Targets, UniProt, RCSB and ChEMBL… (first lookup can take ~15 s)</p>}
          {status.error && <p className="mt-1 text-[12px] text-rose-600">{status.error}</p>}
        </div>
        <div className="mt-4 grid gap-4 rounded-xl border border-rule bg-paper p-4 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              <Badge><Ext href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensemblId}`}>{gene.ensemblId}</Ext></Badge>
              <Badge><Ext href={`https://www.uniprot.org/uniprotkb/${gene.uniprot}`}>{gene.uniprot}</Ext></Badge>
              {gene.pdbId && <Badge>PDB {gene.pdbId}</Badge>}
              {gene.chemblTarget && <Badge>{gene.chemblTarget}</Badge>}
              {gene.locus && <Badge>{gene.locus}</Badge>}
              {gene.hotspot && <Badge tone="red">{gene.hotspot.label}</Badge>}
              {gene.source === 'resolved' && <Badge tone="blue">live-resolved</Badge>}
            </div>
            <p className="mt-2 text-[13px] text-ink-soft">Context: <b>{subtype.label}</b> ({topTargets.data?.id ?? subtype.otId}) · active drug <b>{drug.name}</b></p>
          </div>
          <div>
            <div className="mb-1 text-[12px] text-ink-soft">Top Open Targets associations for {topTargets.data?.name ?? subtype.label}{topTargets.data ? ` (${topTargets.data.count.toLocaleString()} targets)` : ''} — click to load</div>
            <div className="flex flex-wrap gap-1">
              {topTargets.loading && <span className="text-[12px] text-ink-soft">loading…</span>}
              {topTargets.error && <span className="text-[12px] text-rose-600">{topTargets.error}</span>}
              {topTargets.data?.rows.map((t) => (
                <button key={t.ensemblId} onClick={() => void pickSymbol(t.symbol)} className="rounded-md border border-rule px-2 py-0.5 text-[12px] hover:border-brand-500">
                  <span className="font-mono font-medium">{t.symbol}</span> <span className="text-ink-soft">{t.score.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      <S1Structure gene={gene} subtype={subtype} />
      <S2Genomics key={`g-${gene.symbol}`} gene={gene} />
      <S3Pharma gene={gene} drug={drug} onDrug={setDrug} />
      <S4Network gene={gene} />
      <S5Trials gene={gene} drug={drug} subtype={subtype} />
    </>
  );
}
