import { useEffect, useMemo, useState } from 'react';
import { SUBTYPES, type SubtypeKey } from '../data/presets';
import { EVIDENCE, GLOSSARY, JOURNEY, PERSONAS, RESOURCES, STORIES } from '../data/content';
import type { Evidence, Persona, StageGroup } from '../data/contentTypes';
import { Btn, Hero, Section } from '../components/Shell';
import { IconArray } from '../components/IconArray';
import { Ext } from '../components/ui';

const STATUS_PLAIN: Record<Evidence['status'], { label: string; cls: string }> = {
  approved: { label: 'Approved treatment', cls: 'bg-emerald-50 text-emerald-800' },
  standard: { label: 'Standard of care', cls: 'bg-emerald-50 text-emerald-800' },
  accelerated: { label: 'Approved (early approval)', cls: 'bg-sky-50 text-sky-800' },
  investigational: { label: 'Still being studied', cls: 'bg-amber-50 text-amber-800' },
  'not-proven': { label: 'Did not help people live longer', cls: 'bg-slate-100 text-slate-700' },
  withdrawn: { label: 'Approval withdrawn', cls: 'bg-rose-50 text-rose-800' },
};

const SETTING_PLAIN: Record<Evidence['setting'], string> = {
  surveillance: 'Finding it early', curative: 'Aiming for cure', locoregional: 'Treating the tumor in the liver',
  adjuvant: 'After surgery', 'first-line': 'First medicine for advanced cancer', 'later-line': 'If the first medicine stops working',
  targeted: 'Matched to a tumor gene change', supportive: 'Protecting quality of life',
};

const STAGE_OF: Record<Evidence['setting'], Exclude<StageGroup, 'all'>> = {
  surveillance: 'early', curative: 'early', adjuvant: 'early', locoregional: 'liver',
  'first-line': 'advanced', 'later-line': 'advanced', targeted: 'advanced', supportive: 'early',
};
const STAGE_LABEL: Record<StageGroup, string> = { all: 'All stages', early: 'Found early', liver: 'Only in the liver', advanced: 'Advanced or spread' };
const PROVEN: Evidence['status'][] = ['approved', 'standard', 'accelerated'];

export function PatientView({ subtype, onSubtype, onOpenClinician }: { subtype: SubtypeKey; onSubtype: (s: SubtypeKey) => void; onOpenClinician: () => void }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [stage, setStage] = useState<StageGroup>('all');
  const [q, setQ] = useState('');
  const st = SUBTYPES.find((s) => s.key === subtype)!;

  // Reset persona when the subtype is changed by hand to one that doesn't match.
  useEffect(() => { if (persona && persona.subtype !== subtype) setPersona(null); setStage((s) => (subtype === 'HB' ? 'all' : s)); }, [subtype, persona]);

  const steps = JOURNEY.filter((j) => j.subtypes.includes(subtype));
  const all = EVIDENCE.filter((e) => e.subtype === subtype);
  const stages = (['all', 'early', 'liver', 'advanced'] as StageGroup[]).filter((g) => g === 'all' || all.some((e) => STAGE_OF[e.setting] === g));
  const inStage = (e: Evidence) => stage === 'all' || STAGE_OF[e.setting] === stage;
  const proven = all.filter((e) => PROVEN.includes(e.status) && inStage(e));
  const other = all.filter((e) => !PROVEN.includes(e.status) && inStage(e));
  const stories = STORIES.filter((s) => s.subtype === subtype);
  const gloss = useMemo(() => GLOSSARY.filter((g) => !q || (g.term + g.def).toLowerCase().includes(q.toLowerCase())), [q]);

  const pickPersona = (p: Persona) => {
    setPersona(p); onSubtype(p.subtype); setStage(p.stage);
    requestAnimationFrame(() => document.getElementById('my-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const focusSteps = persona ? steps.filter((s) => persona.focus.includes(s.id)) : [];

  return (
    <div className="space-y-14">
      <section id="welcome" className="scroll-mt-32 min-[960px]:scroll-mt-6">
        <Hero eyebrow={['Patients & families', 'Liver cancer', 'Plain language']}
          title={<>Liver cancer, explained <em className="text-brand-600">one clear step</em> at a time.</>}
          lead={<>What is happening, what treatments have <em className="text-brand-600">really worked</em> in research, and what to ask your care team.</>}>
          <p className="mb-2 text-[15px] font-semibold text-ink">Which kind of liver cancer is it?</p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type of liver cancer">
            {SUBTYPES.map((s) => (
              <button key={s.key} role="radio" aria-checked={subtype === s.key} onClick={() => onSubtype(s.key)}
                className={`min-h-[64px] rounded-[9px] border px-4 py-3 text-left transition ${subtype === s.key ? 'border-brand-500 bg-lavender-wash ring-1 ring-brand-500' : 'border-rule bg-paper hover:border-brand-500'}`}>
                <div className="text-[16px] font-semibold text-ink">{s.label}</div>
                <div className="text-[13px] text-ink-soft">{s.key === 'HCC' ? 'Most common liver cancer in adults' : s.key === 'iCCA' ? 'Bile-duct cancer inside the liver' : 'Liver cancer in young children'}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ink-soft">Not sure? Your diagnosis letter or scan report will name it. Ask your care team if it doesn’t.</p>
        </Hero>
        <Notice />
      </section>

      <Section id="people" eyebrow="Start with someone like you" title={<>Whose story is <em className="text-brand-600">closest to yours?</em></>}
        intro="These are made-up examples, not real patients, based on what is typical for each kind of liver cancer. Choose one to see the steps, treatments and questions that matter most.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PERSONAS.map((p) => {
            const on = persona?.id === p.id;
            return (
              <article key={p.id} className={`flex flex-col rounded-xl border p-4 transition ${on ? 'border-brand-500 bg-lavender-wash' : 'border-rule bg-paper'}`}>
                <div className="eyebrow !text-[10.5px]">{SUBTYPES.find((s) => s.key === p.subtype)!.label}{p.gene ? ` · ${p.gene}` : ''}</div>
                <h3 className="serif mt-1 text-[22px] font-medium text-ink">{p.name}, {p.age}</h3>
                <div className="mt-0.5 text-[15px] font-medium text-brand-600">{p.headline}</div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{p.story}</p>
                <ul className="mt-3 space-y-1 text-[14px] text-ink-soft">{p.needs.map((n) => <li key={n}>• {n}</li>)}</ul>
                <button onClick={() => pickPersona(p)} aria-pressed={on}
                  className={`mt-4 min-h-[44px] rounded-[7px] px-4 text-[15px] font-semibold transition ${on ? 'bg-brand-500 text-white' : 'border border-brand-500 text-brand-600 hover:bg-lavender-wash'}`}>
                  {on ? `Showing ${p.name.split(' ')[0]}’s path ✓` : `Follow ${p.name.split(' ')[0]}’s path`}
                </button>
              </article>
            );
          })}
        </div>
        {persona && (
          <div id="my-path" className="mt-6 scroll-mt-32 min-[960px]:scroll-mt-6 rounded-xl border border-brand-500 bg-paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow !text-[10.5px]">{persona.name}’s path · {st.label}</div>
                <h3 className="serif mt-1 text-[24px] font-medium text-ink">What matters most right now</h3>
              </div>
              <button onClick={() => { setPersona(null); setStage('all'); }} className="min-h-[40px] rounded-[7px] border border-rule px-3 text-[14px] text-ink-soft hover:border-brand-500">Clear</button>
            </div>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {focusSteps.map((s) => (
                <li key={s.id}><a href={`#step-${s.id}`} className="flex min-h-[44px] items-center gap-2 rounded-lg bg-lavender-wash px-3 py-2 text-[15px] font-medium text-brand-600 hover:underline">→ {s.title}</a></li>
              ))}
              <li><a href="#what-works" className="flex min-h-[44px] items-center gap-2 rounded-lg bg-lavender-wash px-3 py-2 text-[15px] font-medium text-brand-600 hover:underline">→ Treatments for “{STAGE_LABEL[persona.stage].toLowerCase()}”</a></li>
            </ol>
          </div>
        )}
      </Section>

      <Section id="journey" eyebrow={`Your path · ${st.label}`} title={<>The journey, <em className="text-brand-600">step by step</em></>}
        intro={persona ? `Steps that matter most for ${persona.name} are open and marked ★. Tap any other step to read it.` : 'Tap a step to read what happens and what to ask. Your care team will tell you which step you are on.'}>
        <ol className="relative space-y-3 border-l-2 border-lavender-soft pl-6">
          {steps.map((s, i) => {
            const hot = !!persona?.focus.includes(s.id);
            const text = s.plainBy?.[subtype] ?? s.plain;
            return (
              <li key={`${s.id}-${persona?.id ?? 'none'}`} id={`step-${s.id}`} className="relative scroll-mt-32 min-[960px]:scroll-mt-6">
                <span className={`absolute -left-[35px] top-4 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${hot ? 'bg-brand-500 text-white' : 'bg-paper text-eyebrow ring-2 ring-lavender-soft'}`}>{i + 1}</span>
                <details open={persona ? hot : i === 0} className={`group rounded-xl border ${hot ? 'border-brand-500 bg-lavender-wash' : 'border-rule bg-paper'}`}>
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span className="serif text-[20px] font-medium text-ink">{hot && <span className="mr-1 text-brand-600" aria-label="Most relevant">★</span>}{s.title}</span>
                    <span className="text-[13px] text-ink-soft group-open:hidden">Read</span>
                    <span className="hidden text-[13px] text-ink-soft group-open:inline">Close</span>
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-[16px] leading-relaxed text-ink-soft">{text}</p>
                    <div className="mt-3 rounded-lg bg-paper p-3 ring-1 ring-rule">
                      <div className="eyebrow !text-[10px]">Questions to ask your care team</div>
                      <ul className="mt-1 space-y-1 text-[15px] text-ink">{s.questions.map((qq) => <li key={qq}>→ {qq}</li>)}</ul>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="what-works" eyebrow="Evidence, in plain words" title={<>Treatments proven to <em className="text-brand-600">help people</em></>}
        intro="Each card is based on a large clinical trial or study. “Out of 100 people” pictures describe groups, not any one person.">
        {stages.length > 2 && (
          <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Filter by stage">
            {stages.map((g) => (
              <button key={g} role="radio" aria-checked={stage === g} onClick={() => setStage(g)}
                className={`min-h-[40px] rounded-full border px-4 text-[14px] font-medium transition ${stage === g ? 'border-brand-500 bg-brand-500 text-white' : 'border-rule bg-paper text-ink-soft hover:border-brand-500'}`}>{STAGE_LABEL[g]}</button>
            ))}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">{proven.map((e) => <EvidenceCard key={e.id} e={e} />)}</div>
        {proven.length === 0 && <p className="text-[15px] text-ink-soft">No proven treatments listed for this stage — try “All stages”.</p>}
        {other.length > 0 && (
          <details className="mt-6 rounded-xl border border-rule bg-paper">
            <summary className="flex min-h-[52px] cursor-pointer items-center px-4 text-[16px] font-semibold text-ink">Studied but not proven, or not available ({other.length})</summary>
            <p className="px-4 text-[14.5px] text-ink-soft">These were tested in trials but did not help people live longer, are still being studied, or were withdrawn. They are shown so you know about them if they come up.</p>
            <div className="grid gap-4 p-4 lg:grid-cols-2">{other.map((e) => <EvidenceCard key={e.id} e={e} />)}</div>
          </details>
        )}
      </Section>

      <Section id="stories" eyebrow="Real-world success" title={<>Reasons for <em className="text-brand-600">real hope</em></>}
        intro="Results from published studies and national statistics, not testimonials. Each one says how typical it is.">
        <div className="grid gap-4 lg:grid-cols-2">
          {stories.map((s) => (
            <article key={s.id} className="rounded-xl border border-rule bg-paper p-5">
              <span className="eyebrow !text-[10px]">{s.kind}</span>
              <h3 className="serif mt-1 text-[21px] font-medium text-ink">{s.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{s.text}</p>
              {s.icons && <div className="mt-4"><IconArray data={s.icons} /></div>}
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[14px] text-amber-900"><b>How typical is this?</b> {s.caveat}</p>
              <p className="mt-2 text-[12.5px] text-ink-soft">Source: {s.sources.map((x, i) => <span key={x.url}>{i ? ' · ' : ''}<Ext href={x.url}>{x.label}</Ext></span>)}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="support" eyebrow="You are not alone" title={<>Support and <em className="text-brand-600">trusted help</em></>}>
        <div className="grid gap-3 md:grid-cols-2">
          {RESOURCES.filter((r) => r.for.includes(subtype)).map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="rounded-xl border border-rule bg-paper p-4 transition hover:border-brand-500">
              <div className="text-[16px] font-semibold text-brand-600">{r.name} ↗</div>
              <p className="mt-1 text-[15px] text-ink-soft">{r.offers}</p>
            </a>
          ))}
        </div>
      </Section>

      <Section id="glossary" eyebrow="Words you may hear" title={<>A plain-language <em className="text-brand-600">glossary</em></>}>
        <label className="mb-1 block text-[14px] font-medium text-ink" htmlFor="gloss-q">Search a word</label>
        <input id="gloss-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. AFP or TACE"
          className="mb-4 min-h-[44px] w-full max-w-md rounded-[7px] border border-rule bg-paper px-3 text-[16px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-lavender-soft" />
        {gloss.length === 0 && <p className="text-[15px] text-ink-soft">No match for “{q}”. Ask your care team — there are no silly questions.</p>}
        <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {gloss.map((g) => (
            <div key={g.term} className="border-b border-rule pb-3">
              <dt className="serif text-[18px] font-medium text-ink">{g.term}</dt>
              <dd className="mt-0.5 text-[15.5px] leading-relaxed text-ink-soft">{g.def}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section className="rounded-xl border border-rule bg-lavender-wash p-6">
        <h3 className="serif text-[24px] font-medium text-ink">Sharing this with your doctor?</h3>
        <p className="mt-1 text-[16px] text-ink-soft">The clinician view shows the same trials with full numbers, plus a live research workbench.</p>
        <div className="mt-3"><Btn onClick={onOpenClinician}>Open the clinician view</Btn></div>
      </section>
    </div>
  );
}

function EvidenceCard({ e }: { e: Evidence }) {
  return (
    <article className="rounded-xl border border-rule bg-paper p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[12.5px] font-semibold ${STATUS_PLAIN[e.status].cls}`}>{STATUS_PLAIN[e.status].label}</span>
        <span className="eyebrow !text-[10px]">{SETTING_PLAIN[e.setting]}</span>
      </div>
      <h3 className="serif mt-2 text-[22px] font-medium leading-snug text-ink">{e.regimen}</h3>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{e.plain}</p>
      {e.icons && <div className="mt-4"><IconArray data={e.icons} /></div>}
      <p className="mt-3 text-[12.5px] text-ink-soft">Source: {e.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<Ext href={s.url}>{s.label}</Ext></span>)}</p>
    </article>
  );
}

function Notice() {
  return (
    <p className="mt-2 max-w-3xl rounded-lg border border-rule bg-paper px-4 py-3 text-[14.5px] leading-relaxed text-ink-soft">
      <b className="text-ink">General education, not personal medical advice.</b> Every person’s cancer and liver health are different. Use this to prepare questions, and make treatment decisions with your care team.
    </p>
  );
}
