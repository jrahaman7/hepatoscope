import { useState, type FormEvent } from 'react';
import { DRUG_PRESETS, GENE_PRESETS, SUBTYPES, type DrugPreset, type GeneProfile, type Subtype } from './data/presets';
import { otDiseaseTopTargets, resolveGene } from './services/scienceApi';
import { useAsync } from './hooks/useAsync';
import { Badge, Ext } from './components/ui';
import { S1Structure } from './sections/S1Structure';
import { S2Genomics } from './sections/S2Genomics';
import { S3Pharma } from './sections/S3Pharma';
import { S4Network } from './sections/S4Network';
import { S5Trials } from './sections/S5Trials';

const NAV = [['s01', 'Structure'], ['s02', 'Genomics'], ['s03', 'Pharmacology'], ['s04', 'Pathways & PPI'], ['s05', 'Trials & Literature']];

export default function App() {
  const [subtype, setSubtype] = useState<Subtype>(SUBTYPES[0]);
  const [gene, setGene] = useState<GeneProfile>(GENE_PRESETS[0]);
  const [drug, setDrug] = useState<DrugPreset>(DRUG_PRESETS[0]);
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const topTargets = useAsync(() => otDiseaseTopTargets(subtype.efoId, 12), [subtype.efoId]);

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
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-[1440px] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden><path d="M4 14c0-6 6-10 14-10 6 0 10 3 10 8 0 9-9 16-17 16-4 0-7-4-7-14z" fill="#1f8a70" /><circle cx="19" cy="12" r="3" fill="white" /></svg>
              <div>
                <div className="text-sm font-bold leading-tight text-ink">HepatoScope</div>
                <div className="text-[10.5px] leading-tight text-slate-500">Liver Cancer Multi-Omics Workbench</div>
              </div>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {SUBTYPES.map((s) => (
                <button key={s.key} onClick={() => setSubtype(s)} title={`${s.label} · ${s.efoId}`}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${subtype.key === s.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}>
                  {s.key}<span className="ml-1 hidden font-mono text-[10px] text-slate-400 xl:inline">{s.efoId}</span>
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex items-center gap-1">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Any HGNC symbol (e.g. AXIN1)"
                className="w-52 rounded-md border border-slate-200 px-2 py-1 text-xs" aria-label="Resolve gene symbol" />
              <button disabled={resolving} className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">{resolving ? 'Resolving…' : 'Resolve'}</button>
            </form>
            <nav className="ml-auto hidden gap-3 text-xs text-slate-500 lg:flex">
              {NAV.map(([id, l]) => <a key={id} href={`#${id}`} className="hover:text-brand-600">{l}</a>)}
            </nav>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Drivers:</span>
            {GENE_PRESETS.map((g) => (
              <button key={g.symbol} onClick={() => setGene(g)}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${gene.symbol === g.symbol ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-500'}`}>{g.symbol}</button>
            ))}
            {resolveErr && <span className="text-[11px] text-rose-600">{resolveErr}</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-10 px-4 py-6">
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{gene.symbol}</h1>
              <span className="text-sm text-slate-600">{gene.name}</span>
              {gene.source === 'resolved' && <Badge tone="blue">live-resolved</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[11px]">
              <Badge><Ext href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensemblId}`}>{gene.ensemblId}</Ext></Badge>
              <Badge><Ext href={`https://www.uniprot.org/uniprotkb/${gene.uniprot}`}>{gene.uniprot}</Ext></Badge>
              {gene.pdbId && <Badge>PDB {gene.pdbId}</Badge>}
              {gene.chemblTarget && <Badge>{gene.chemblTarget}</Badge>}
              {gene.locus && <Badge>{gene.locus}</Badge>}
              {gene.hotspot && <Badge tone="red">{gene.hotspot.label}</Badge>}
            </div>
            <p className="mt-2 text-xs text-slate-500">Context: <b>{subtype.label}</b> ({subtype.efoId}) · active drug <b>{drug.name}</b></p>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-slate-500">
              Top Open Targets associations for {topTargets.data?.name ?? subtype.label}{topTargets.data ? ` (${topTargets.data.count.toLocaleString()} targets)` : ''} — click to load
            </div>
            <div className="flex flex-wrap gap-1">
              {topTargets.loading && <span className="text-[11px] text-slate-400">loading…</span>}
              {topTargets.error && <span className="text-[11px] text-rose-600">{topTargets.error}</span>}
              {topTargets.data?.rows.map((t) => (
                <button key={t.ensemblId} onClick={() => void pickSymbol(t.symbol)}
                  className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] hover:border-brand-500">
                  <span className="font-mono font-medium">{t.symbol}</span> <span className="text-slate-400">{t.score.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <S1Structure gene={gene} subtype={subtype} />
        <S2Genomics key={`g-${gene.symbol}`} gene={gene} />
        <S3Pharma gene={gene} drug={drug} onDrug={setDrug} />
        <S4Network gene={gene} />
        <S5Trials gene={gene} drug={drug} subtype={subtype} />

        <footer className="border-t border-slate-200 pt-4 text-[11px] text-slate-400">
          Live data from Open Targets Platform v4, AlphaFold DB, UniProtKB, RCSB PDB, gnomAD v4, NCBI ClinVar, Ensembl, PubChem, openFDA FAERS, ChEMBL, Reactome, STRING v12, GTEx v10, ClinicalTrials.gov v2 and Europe PMC.
          Research use only — not for clinical decision-making.
        </footer>
      </main>
    </div>
  );
}
