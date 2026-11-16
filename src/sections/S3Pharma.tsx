import { useState } from 'react';
import type { DrugPreset, GeneProfile } from '../data/presets';
import { DRUG_PRESETS } from '../data/presets';
import { chemblActivities, chemblMoleculeByName, chemblTargetForUniprot, drugLikeness, faersTopEvents, otTarget, pubchemCid, pubchemProps, pubchemPngUrl } from '../services/scienceApi';
import { useAsync } from '../hooks/useAsync';
import { Badge, Card, Empty, ErrorBox, Ext, Loading, SectionHeader, Segmented, Stat, fmt } from '../components/ui';

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
      <span className="font-medium">{ok ? '✓' : '✕'} {label}</span><span className="font-mono text-[11px]">{detail}</span>
    </div>
  );
}

export function S3Pharma({ gene, drug, onDrug }: { gene: GeneProfile; drug: DrugPreset; onDrug: (d: DrugPreset) => void }) {
  const [actMode, setActMode] = useState<'drug' | 'target'>('drug');

  // Live ID verification (falls back to curated IDs)
  const cid = useAsync(async () => (await pubchemCid(drug.name)) ?? drug.pubchemCid, [drug.name]);
  const chemblId = useAsync(async () => (await chemblMoleculeByName(drug.name).catch(() => null)) ?? drug.chemblId, [drug.name]);
  const props = useAsync(() => pubchemProps(cid.data!), [cid.data], !!cid.data);
  const faers = useAsync(() => faersTopEvents(drug.name, 12), [drug.name]);
  const targetChembl = useAsync(async () => (await chemblTargetForUniprot(gene.uniprot).catch(() => null)) ?? gene.chemblTarget, [gene.uniprot]);
  const acts = useAsync(
    () => chemblActivities(actMode === 'drug' ? { molecules: [drug.chemblId, chemblId.data ?? drug.chemblId] } : { target: targetChembl.data! }, 25),
    [actMode, chemblId.data, targetChembl.data],
    actMode === 'drug' ? !chemblId.loading : !!targetChembl.data,
  );
  const ot = useAsync(() => otTarget(gene.ensemblId), [gene.ensemblId]);

  const dl = props.data ? drugLikeness(props.data) : null;
  const maxAe = Math.max(1, ...(faers.data ?? []).map((a) => a.count));
  const candidates = (ot.data?.knownDrugs ?? []).slice(0, 20);

  return (
    <section id="s03" className="scroll-mt-32 min-[960px]:scroll-mt-6">
      <SectionHeader n="03" title="Liver Cancer Pharmacology · ChEMBL · openFDA" sources={['PubChem PUG REST', 'openFDA FAERS', 'ChEMBL', 'Open Targets']} />
      <div className="mb-3 flex flex-wrap gap-2">
        {DRUG_PRESETS.map((d) => (
          <button key={d.name} onClick={() => onDrug(d)}
            className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${d.name === drug.name ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <div className="font-semibold text-ink">{d.name}</div>
            <div className="text-[10.5px] text-slate-500">{d.indication}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={drug.name} subtitle={drug.moa} right={<Badge tone="brand">{drug.trial.name}</Badge>}>
          <div className="flex flex-col items-center">
            {cid.data ? <img src={pubchemPngUrl(cid.data)} alt={`${drug.name} 2D structure`} className="h-48 w-48 object-contain" /> : <Loading />}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Stat label="ChEMBL" value={<Ext href={`https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId.data ?? drug.chemblId}/`}>{chemblId.data ?? drug.chemblId}</Ext>} />
            <Stat label="PubChem CID" value={<Ext href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid.data ?? drug.pubchemCid}`}>{cid.data ?? drug.pubchemCid}</Ext>} />
            <Stat label="Pivotal trial" value={<Ext href={`https://clinicaltrials.gov/study/${drug.trial.nct}`}>{drug.trial.nct}</Ext>} />
            <Stat label="Formula" value={props.data?.formula ?? '—'} />
          </div>
          {(chemblId.data && chemblId.data !== drug.chemblId) || (cid.data && cid.data !== drug.pubchemCid)
            ? <p className="mt-2 text-[11px] text-amber-700">Live lookup returned IDs that differ from the curated preset; live IDs are shown.</p> : null}
        </Card>

        <Card title="Physicochemical profile" subtitle="Lipinski Rule-of-5 · Veber oral bioavailability">
          {props.loading ? <Loading /> : props.error ? <ErrorBox error={props.error} onRetry={props.reload} /> : props.data && dl && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="MW" value={fmt.num(props.data.mw, 1)} />
                <Stat label="XLogP" value={fmt.num(props.data.xlogp, 1)} />
                <Stat label="TPSA" value={fmt.num(props.data.tpsa, 1)} />
                <Stat label="HBD" value={props.data.hbd} />
                <Stat label="HBA" value={props.data.hba} />
                <Stat label="RotB" value={props.data.rotb} />
              </div>
              <Check ok={dl.lipinskiPass} label={`Lipinski (${dl.lipinskiViolations} violation${dl.lipinskiViolations === 1 ? '' : 's'})`} detail="MW≤500 · logP≤5 · HBD≤5 · HBA≤10" />
              <Check ok={dl.veberPass} label="Veber" detail="RotB≤10 · TPSA≤140" />
            </div>
          )}
        </Card>

        <Card title="openFDA FAERS · top reported adverse events" subtitle={`Reports naming ${drug.name.toLowerCase()} as an active substance`}>
          {faers.loading ? <Loading /> : faers.error ? <ErrorBox error={faers.error} onRetry={faers.reload} /> : !faers.data?.length ? <Empty>No FAERS reports matched.</Empty> : (
            <div className="space-y-1">
              {faers.data.map((a) => (
                <div key={a.term} className="grid grid-cols-[120px_1fr_48px] items-center gap-2 text-[11px]">
                  <span className="truncate text-slate-700" title={a.term}>{a.term.toLowerCase()}</span>
                  <div className="h-3 rounded-sm bg-slate-100"><div className="h-3 rounded-sm bg-amber-500" style={{ width: `${(a.count / maxAe) * 100}%` }} /></div>
                  <span className="text-right font-mono text-slate-500">{a.count.toLocaleString()}</span>
                </div>
              ))}
              <p className="pt-1 text-[10px] text-slate-400">Spontaneous reports; counts do not establish causality or incidence.</p>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2" title="ChEMBL bioactivities" subtitle={actMode === 'drug' ? `${drug.name} (${chemblId.data ?? '…'}) across targets` : `${gene.symbol} target ${targetChembl.data ?? '(no ChEMBL target)'}`}
          right={<Segmented value={actMode} onChange={setActMode} options={[{ value: 'drug', label: `${drug.name}` }, { value: 'target', label: `${gene.symbol} target` }]} />}>
          {actMode === 'target' && !targetChembl.loading && !targetChembl.data ? <Empty>No ChEMBL single-protein target for {gene.symbol}.</Empty>
            : acts.loading ? <Loading /> : acts.error ? <ErrorBox error={acts.error} onRetry={acts.reload} /> : !acts.data?.length ? <Empty>No IC50/Ki/Kd records with pChEMBL values.</Empty> : (
              <div className="max-h-[330px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white text-[11px] uppercase text-slate-500">
                    <tr><th className="py-1.5 pr-2">{actMode === 'drug' ? 'Target' : 'Molecule'}</th><th className="pr-2">Type</th><th className="pr-2">Value</th><th className="pr-2">pChEMBL</th><th className="pr-2">Assay</th><th>Year</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {acts.data.map((a, i) => (
                      <tr key={i}>
                        <td className="max-w-[240px] truncate py-1.5 pr-2">{actMode === 'drug'
                          ? <Ext href={`https://www.ebi.ac.uk/chembl/target_report_card/${a.target}/`}>{a.targetName}</Ext>
                          : <Ext href={`https://www.ebi.ac.uk/chembl/compound_report_card/${a.molecule}/`}>{a.moleculeName ?? a.molecule}</Ext>}</td>
                        <td className="pr-2"><Badge tone="blue">{a.type}</Badge></td>
                        <td className="pr-2 font-mono">{a.value != null ? `${fmt.num(a.value, a.value < 10 ? 2 : 0)} ${a.units}` : '—'}</td>
                        <td className="pr-2 font-mono font-semibold">{fmt.num(a.pchembl)}</td>
                        <td className="pr-2 font-mono text-[11px]">{a.assay}</td>
                        <td>{a.year ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        <Card title="Open Targets clinical candidates" subtitle={ot.data ? `${ot.data.knownDrugs.length} drugs acting on ${gene.symbol}, by max clinical stage` : `Drugs acting on ${gene.symbol}`}>
          {ot.loading ? <Loading /> : ot.error ? <ErrorBox error={ot.error} onRetry={ot.reload} />
            : ot.data?.knownDrugsError && !candidates.length ? <ErrorBox error={`Known-drugs field unavailable: ${ot.data.knownDrugsError}`} />
              : !candidates.length ? <Empty>No clinical-stage drugs recorded for {gene.symbol}.</Empty> : (
                <ul className="max-h-[330px] space-y-1.5 overflow-auto">
                  {candidates.map((c) => (
                    <li key={c.drugId} className="rounded-md border border-slate-100 px-2 py-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Ext href={`https://platform.opentargets.org/drug/${c.drugId}`}>{c.drugName}</Ext>
                        <Badge tone={c.rank >= 5 ? 'green' : c.rank >= 3 ? 'brand' : c.rank < 0 ? 'red' : 'slate'}>{c.stage}</Badge>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500" title={`${c.moa}\n${c.diseases.join('; ')}`}>{c.drugType} · {c.moa || 'mechanism n/a'} · {c.diseases.slice(0, 2).join('; ')}</div>
                    </li>
                  ))}
                </ul>
              )}
        </Card>
      </div>
    </section>
  );
}
