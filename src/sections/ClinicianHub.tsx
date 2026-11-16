import { useMemo, useState } from 'react';
import { SUBTYPES, type SubtypeKey } from '../data/presets';
import { EVIDENCE, USE_CASES } from '../data/content';
import type { Evidence, UseCase } from '../data/contentTypes';
import { Hero, Section } from '../components/Shell';
import { Badge, Ext } from '../components/ui';

const STATUS: Record<Evidence['status'], { label: string; tone: 'green' | 'blue' | 'amber' | 'slate' | 'red' | 'brand' }> = {
  approved: { label: 'Approved', tone: 'green' }, standard: { label: 'Standard of care', tone: 'green' }, accelerated: { label: 'Accelerated approval', tone: 'blue' },
  investigational: { label: 'Investigational', tone: 'amber' }, 'not-proven': { label: 'No OS benefit', tone: 'slate' }, withdrawn: { label: 'Withdrawn', tone: 'red' },
};
const SETTINGS: Evidence['setting'][] = ['surveillance', 'curative', 'locoregional', 'adjuvant', 'first-line', 'later-line', 'targeted', 'supportive'];

export function ClinicianHub({ subtype, onSubtype, onUseCase }: { subtype: SubtypeKey; onSubtype: (s: SubtypeKey) => void; onUseCase: (u: UseCase) => void }) {
  const [setting, setSetting] = useState<'all' | Evidence['setting']>('all');
  const rows = useMemo(() => EVIDENCE.filter((e) => e.subtype === subtype && (setting === 'all' || e.setting === setting)), [subtype, setting]);
  const present = new Set(EVIDENCE.filter((e) => e.subtype === subtype).map((e) => e.setting));

  return (
    <div className="space-y-14">
      <section id="overview" className="scroll-mt-20">
        <Hero eyebrow={['Clinicians', 'Evidence', 'Live multi-omics']}
          title={<>From the <em className="text-brand-600">tumor board question</em> to the evidence and the molecule.</>}
          lead="Pivotal-trial outcomes with regulatory status, worked use cases, and a live workbench across 16 public data sources.">
          <div className="flex flex-wrap gap-2">
            {SUBTYPES.map((s) => (
              <button key={s.key} onClick={() => onSubtype(s.key)}
                className={`rounded-[7px] border px-3 py-2 text-[14px] font-semibold transition ${subtype === s.key ? 'border-brand-500 bg-lavender-wash text-brand-600' : 'border-rule bg-paper text-ink-soft hover:border-brand-500'}`}>
                {s.label} <span className="ml-1 font-mono text-[11px] font-normal text-ink-soft">{s.otId}</span>
              </button>
            ))}
          </div>
        </Hero>
      </section>

      <Section id="evidence" eyebrow={`Evidence table · ${SUBTYPES.find((s) => s.key === subtype)!.label}`} title={<>What has <em className="text-brand-600">proven</em> benefit — and what has not</>}
        intro="Exact published figures with sources. Negative or withdrawn results are kept visible so they are not mistaken for options.">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(['all', ...SETTINGS.filter((s) => present.has(s))] as const).map((s) => (
            <button key={s} onClick={() => setSetting(s)}
              className={`rounded-full border px-3 py-1 text-[13px] ${setting === s ? 'border-brand-500 bg-brand-500 text-white' : 'border-rule bg-paper text-ink-soft hover:border-brand-500'}`}>{s === 'all' ? 'All settings' : s.replace('-', ' ')}</button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-rule bg-paper">
          <table className="w-full min-w-[880px] text-left text-[13.5px]">
            <thead className="border-b border-rule bg-paper-tint text-[11px] uppercase tracking-wider text-ink-soft">
              <tr><th className="px-3 py-2.5">Setting</th><th className="px-3">Regimen · trial</th><th className="px-3">Population</th><th className="px-3">Result</th><th className="px-3">Status</th><th className="px-3">Source</th></tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((e) => (
                <tr key={e.id} className={`align-top ${e.status === 'not-proven' || e.status === 'withdrawn' ? 'bg-paper-tint/60' : ''}`}>
                  <td className="px-3 py-3 capitalize text-ink-soft">{e.setting.replace('-', ' ')}</td>
                  <td className="px-3 py-3"><div className="font-semibold text-ink">{e.regimen}</div><div className="text-[12.5px] text-ink-soft">{e.trial}{e.nct ? <> · <Ext href={`https://clinicaltrials.gov/study/${e.nct}`}>{e.nct}</Ext></> : null}</div></td>
                  <td className="max-w-[220px] px-3 py-3 text-ink-soft">{e.population}</td>
                  <td className="max-w-[320px] px-3 py-3 font-mono text-[12.5px] text-ink">{e.result}</td>
                  <td className="px-3 py-3"><Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>{e.regulatory && <div className="mt-1 text-[11.5px] text-ink-soft">{e.regulatory}</div>}</td>
                  <td className="px-3 py-3 text-[12px]">{e.sources.map((s) => <div key={s.url}><Ext href={s.url}>{s.label}</Ext></div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="use-cases" eyebrow="Worked clinical questions" title={<>Use cases that <em className="text-brand-600">open the workbench</em></>}
        intro="Each case sets the subtype, gene and drug, then takes you to the live data that answers it.">
        <div className="grid gap-4 lg:grid-cols-2">
          {USE_CASES.map((u) => (
            <article key={u.id} className="flex flex-col rounded-xl border border-rule bg-paper p-5">
              <div className="flex flex-wrap gap-1.5"><Badge tone="brand">{u.subtype}</Badge><Badge>{u.gene}</Badge>{u.drug && <Badge tone="blue">{u.drug}</Badge>}</div>
              <h3 className="serif mt-2 text-[20px] font-medium leading-snug text-ink">{u.question}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{u.answer}</p>
              <ul className="mt-3 space-y-1 text-[13.5px] text-ink-soft">{u.look.map((l) => <li key={l}>→ {l}</li>)}</ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                <span className="text-[12px]">{u.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<Ext href={s.url}>{s.label}</Ext></span>)}</span>
                <button onClick={() => onUseCase(u)} className="rounded-[7px] bg-brand-500 px-3.5 py-2 text-[14px] font-semibold text-white hover:bg-brand-700">Open in workbench →</button>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
