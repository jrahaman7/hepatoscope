import { useState } from 'react';
import type { DrugPreset, GeneProfile, Subtype } from '../data/presets';
import { clinicalTrials, europePmc } from '../services/scienceApi';
import { useAsync } from '../hooks/useAsync';
import { Badge, Card, Empty, ErrorBox, Ext, Loading, SectionHeader, Segmented } from '../components/ui';

type Filter = 'gene' | 'drug' | 'all';
const STATUS_TONE: Record<string, 'green' | 'blue' | 'amber' | 'slate'> = { RECRUITING: 'green', ACTIVE_NOT_RECRUITING: 'blue', NOT_YET_RECRUITING: 'amber', ENROLLING_BY_INVITATION: 'amber' };

export function S5Trials({ gene, drug, subtype }: { gene: GeneProfile; drug: DrugPreset; subtype: Subtype }) {
  const [filter, setFilter] = useState<Filter>('gene');
  const trials = useAsync(() => clinicalTrials({
    condition: subtype.ctCondition,
    term: filter === 'gene' ? gene.symbol : undefined,
    intervention: filter === 'drug' ? drug.name : undefined,
  }, 25), [filter, gene.symbol, drug.name, subtype.ctCondition]);

  const litQuery = filter === 'drug' ? `${subtype.epmcTerm} AND "${drug.name}"` : filter === 'gene' ? `${subtype.epmcTerm} AND "${gene.symbol}"` : subtype.epmcTerm;
  const lit = useAsync(() => europePmc(litQuery, 15), [litQuery]);

  return (
    <section id="s05" className="scroll-mt-32 min-[960px]:scroll-mt-6">
      <SectionHeader n="05" title="ClinicalTrials.gov v2 · Europe PMC Literature" sources={['ClinicalTrials.gov API v2', 'Europe PMC REST']} />
      <div className="mb-3">
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'gene', label: `+${gene.symbol}` }, { value: 'drug', label: `+${drug.name}` }, { value: 'all', label: `All ${subtype.key}` },
        ]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Active clinical trial protocols" subtitle={trials.data ? `${trials.data.total.toLocaleString()} open/active studies · ${subtype.ctCondition}${filter === 'gene' ? ` + ${gene.symbol}` : filter === 'drug' ? ` + ${drug.name}` : ''}` : subtype.ctCondition}>
          {trials.loading ? <Loading /> : trials.error ? <ErrorBox error={trials.error} onRetry={trials.reload} /> : !trials.data?.trials.length ? <Empty>No active trials match this filter.</Empty> : (
            <ul className="max-h-[520px] space-y-2 overflow-auto pr-1">
              {trials.data.trials.map((t) => (
                <li key={t.nct} className="rounded-lg border border-slate-100 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Ext href={`https://clinicaltrials.gov/study/${t.nct}`}><span className="font-mono text-xs font-semibold">{t.nct}</span></Ext>
                    <Badge tone={STATUS_TONE[t.status] ?? 'slate'}>{t.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                    {t.phases.filter((p) => p !== 'NA').map((p) => <Badge key={p} tone="brand">{p.replace('PHASE', 'Phase ').replace('EARLY_', 'Early ')}</Badge>)}
                  </div>
                  <p className="mt-1 text-xs font-medium text-ink">{t.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500" title={t.interventions.join('; ')}>{t.sponsor}{t.start ? ` · start ${t.start}` : ''}{t.interventions.length ? ` · ${t.interventions.slice(0, 3).join(', ')}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Europe PMC · most-cited literature" subtitle={lit.data ? `${lit.data.total.toLocaleString()} hits · sorted by citations` : litQuery}>
          {lit.loading ? <Loading /> : lit.error ? <ErrorBox error={lit.error} onRetry={lit.reload} /> : !lit.data?.articles.length ? <Empty>No articles.</Empty> : (
            <ol className="max-h-[520px] space-y-2 overflow-auto pr-1">
              {lit.data.articles.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Ext href={a.pmid ? `https://europepmc.org/article/MED/${a.pmid}` : a.doi ? `https://doi.org/${a.doi}` : `https://europepmc.org/search?query=${encodeURIComponent(a.title)}`}>
                      <span className="text-xs font-medium" dangerouslySetInnerHTML={{ __html: a.title.replace(/<(?!\/?(i|sup|sub)>)[^>]*>/g, '') }} />
                    </Ext>
                    <Badge tone="amber">{a.cited.toLocaleString()} cites</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{a.authors}</p>
                  <p className="text-[11px] italic text-slate-500">{a.journal} {a.year}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </section>
  );
}
