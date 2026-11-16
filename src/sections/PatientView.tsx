import { useMemo, useState } from 'react';
import { SUBTYPES, type SubtypeKey } from '../data/presets';
import { EVIDENCE, GLOSSARY, JOURNEY, PERSONAS, RESOURCES, STORIES } from '../data/content';
import type { Evidence, Persona } from '../data/contentTypes';
import { Btn, Hero, Section } from '../components/Shell';
import { IconArray } from '../components/IconArray';
import { Ext } from '../components/ui';

const STATUS_PLAIN: Record<Evidence['status'], { label: string; cls: string }> = {
  approved: { label: 'Approved treatment', cls: 'bg-emerald-50 text-emerald-800' },
  standard: { label: 'Standard of care', cls: 'bg-emerald-50 text-emerald-800' },
  accelerated: { label: 'Approved (early approval)', cls: 'bg-sky-50 text-sky-800' },
  investigational: { label: 'Still being studied', cls: 'bg-amber-50 text-amber-800' },
  'not-proven': { label: 'Did not help survival', cls: 'bg-slate-100 text-slate-600' },
  withdrawn: { label: 'Approval withdrawn', cls: 'bg-rose-50 text-rose-800' },
};

const SETTING_PLAIN: Record<Evidence['setting'], string> = {
  surveillance: 'Finding it early', curative: 'Aiming for cure', locoregional: 'Treating the tumor in the liver',
  adjuvant: 'After surgery', 'first-line': 'First medicine for advanced cancer', 'later-line': 'If the first medicine stops working',
  targeted: 'Matched to a tumor gene change', supportive: 'Protecting quality of life',
};

export function PatientView({ subtype, onSubtype, onOpenClinician }: { subtype: SubtypeKey; onSubtype: (s: SubtypeKey) => void; onOpenClinician: () => void }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [q, setQ] = useState('');
  const st = SUBTYPES.find((s) => s.key === subtype)!;
  const steps = JOURNEY.filter((j) => j.subtypes.includes(subtype));
  const works = EVIDENCE.filter((e) => e.subtype === subtype && e.status !== 'withdrawn');
  const stories = STORIES.filter((s) => s.subtype === subtype);
  const gloss = useMemo(() => GLOSSARY.filter((g) => !q || (g.term + g.def).toLowerCase().includes(q.toLowerCase())), [q]);
  const pickPersona = (p: Persona) => { setPersona(p); onSubtype(p.subtype); document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="space-y-14">
      <section id="welcome" className="scroll-mt-20">
        <Hero eyebrow={['Patients & families', 'Liver cancer', 'Plain language']}
          title={<>Liver cancer, explained <em className="text-brand-600">one clear step</em> at a time.</>}
          lead={<>What is happening, what treatments have <em className="text-brand-600">really worked</em> in research, and what to ask your care team. Based on published trials and guidelines.</>}>
          <div className="flex flex-wrap gap-2">
            {SUBTYPES.map((s) => (
              <button key={s.key} onClick={() => onSubtype(s.key)}
                className={`rounded-[7px] border px-4 py-2.5 text-left transition ${subtype === s.key ? 'border-brand-500 bg-lavender-wash' : 'border-rule bg-paper hover:border-brand-500'}`}>
                <div className="text-[15px] font-semibold text-ink">{s.label}</div>
                <div className="text-[12px] text-ink-soft">{s.key === 'HCC' ? 'Most common liver cancer in adults' : s.key === 'iCCA' ? 'Bile-duct cancer inside the liver' : 'Liver cancer in young children'}</div>
              </button>
            ))}
          </div>
        </Hero>
        <Notice />
      </section>

      <Section id="people" eyebrow="Start with someone like you" title={<>Whose story is <em className="text-brand-600">closest to yours?</em></>}
        intro="These are illustrative people — not real patients — built from what is typical for each kind of liver cancer. Pick one to see the steps and questions that matter most.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PERSONAS.map((p) => (
            <button key={p.id} onClick={() => pickPersona(p)}
              className={`flex flex-col rounded-xl border p-4 text-left transition ${persona?.id === p.id ? 'border-brand-500 bg-lavender-wash' : 'border-rule bg-paper hover:border-lavender'}`}>
              <div className="eyebrow !text-[10.5px]">{SUBTYPES.find((s) => s.key === p.subtype)!.label}{p.gene ? ` · ${p.gene}` : ''}</div>
              <div className="serif mt-1 text-[22px] font-medium text-ink">{p.name}, {p.age}</div>
              <div className="mt-0.5 text-[15px] font-medium text-brand-600">{p.headline}</div>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{p.story}</p>
              <ul className="mt-3 space-y-1 text-[13.5px] text-ink-soft">{p.needs.map((n) => <li key={n}>• {n}</li>)}</ul>
            </button>
          ))}
        </div>
      </Section>

      <Section id="journey" eyebrow={`Your path · ${st.label}`} title={<>The journey, <em className="text-brand-600">step by step</em></>}
        intro={persona ? `Highlighted for ${persona.name}: the steps that matter most right now.` : 'Every person moves at their own pace. Your care team will tell you which step you are on.'}>
        <ol className="relative space-y-4 border-l-2 border-lavender-soft pl-6">
          {steps.map((s, i) => {
            const hot = persona?.focus.includes(s.id);
            return (
              <li key={s.id} className={`relative rounded-xl border p-4 ${hot ? 'border-brand-500 bg-lavender-wash' : 'border-rule bg-paper'}`}>
                <span className={`absolute -left-[35px] top-4 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${hot ? 'bg-brand-500 text-white' : 'bg-paper text-eyebrow ring-2 ring-lavender-soft'}`}>{i + 1}</span>
                <h3 className="serif text-[21px] font-medium text-ink">{s.title}</h3>
                <p className="mt-1 text-[16px] leading-relaxed text-ink-soft">{s.plain}</p>
                <div className="mt-3 rounded-lg bg-paper-tint p-3">
                  <div className="eyebrow !text-[10px]">Questions to ask your care team</div>
                  <ul className="mt-1 space-y-1 text-[15px] text-ink">{s.questions.map((qq) => <li key={qq}>→ {qq}</li>)}</ul>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="what-works" eyebrow="Evidence, in plain words" title={<>Treatments that have <em className="text-brand-600">helped people</em></>}
        intro="Each card is based on a large clinical trial or study. Numbers are shown as “out of 100 people” so they are easier to picture. They describe groups, not any one person.">
        <div className="grid gap-4 lg:grid-cols-2">
          {works.map((e) => (
            <article key={e.id} className="rounded-xl border border-rule bg-paper p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_PLAIN[e.status].cls}`}>{STATUS_PLAIN[e.status].label}</span>
                <span className="eyebrow !text-[10px]">{SETTING_PLAIN[e.setting]}</span>
              </div>
              <h3 className="serif mt-2 text-[22px] font-medium leading-snug text-ink">{e.regimen}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{e.plain}</p>
              {e.icons && <div className="mt-4"><IconArray data={e.icons} /></div>}
              <p className="mt-3 text-[12px] text-ink-soft">Source: {e.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<Ext href={s.url}>{s.label}</Ext></span>)}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="stories" eyebrow="Real-world success" title={<>Reasons for <em className="text-brand-600">real hope</em></>}
        intro="Outcomes from published studies and national statistics — not testimonials. Each one says how typical it is.">
        <div className="grid gap-4 lg:grid-cols-2">
          {stories.map((s) => (
            <article key={s.id} className="rounded-xl border border-rule bg-paper p-5">
              <span className="eyebrow !text-[10px]">{s.kind}</span>
              <h3 className="serif mt-1 text-[21px] font-medium text-ink">{s.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{s.text}</p>
              {s.icons && <div className="mt-4"><IconArray data={s.icons} /></div>}
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900"><b>How typical is this?</b> {s.caveat}</p>
              <p className="mt-2 text-[12px] text-ink-soft">Source: {s.sources.map((x, i) => <span key={x.url}>{i ? ' · ' : ''}<Ext href={x.url}>{x.label}</Ext></span>)}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="support" eyebrow="You are not alone" title={<>Support and <em className="text-brand-600">trusted help</em></>}>
        <div className="grid gap-3 md:grid-cols-2">
          {RESOURCES.filter((r) => r.for.includes(subtype)).map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="rounded-xl border border-rule bg-paper p-4 transition hover:border-brand-500">
              <div className="text-[16px] font-semibold text-brand-600">{r.name} ↗</div>
              <p className="mt-1 text-[14.5px] text-ink-soft">{r.offers}</p>
            </a>
          ))}
        </div>
      </Section>

      <Section id="glossary" eyebrow="Words you may hear" title={<>A plain-language <em className="text-brand-600">glossary</em></>}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a word, e.g. AFP or TACE" aria-label="Search glossary"
          className="mb-4 w-full max-w-md rounded-[7px] border border-rule bg-paper px-3 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none" />
        <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {gloss.map((g) => (
            <div key={g.term} className="border-b border-rule pb-3">
              <dt className="serif text-[18px] font-medium text-ink">{g.term}</dt>
              <dd className="mt-0.5 text-[15px] leading-relaxed text-ink-soft">{g.def}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section className="rounded-xl border border-rule bg-lavender-wash p-6">
        <h3 className="serif text-[24px] font-medium text-ink">Sharing this with your doctor?</h3>
        <p className="mt-1 text-[16px] text-ink-soft">The clinician view shows the same trials with full numbers, plus a live molecular workbench.</p>
        <div className="mt-3"><Btn onClick={onOpenClinician}>Open the clinician view</Btn></div>
      </section>
    </div>
  );
}

function Notice() {
  return (
    <p className="mt-2 max-w-3xl rounded-lg border border-rule bg-paper px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
      <b className="text-ink">General education, not personal medical advice.</b> Every person’s cancer and liver health are different. Use this to prepare questions — and make treatment decisions with your care team.
    </p>
  );
}
