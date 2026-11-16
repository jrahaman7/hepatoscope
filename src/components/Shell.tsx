import { useEffect, useRef, type ReactNode } from 'react';

export type Mode = 'patient' | 'clinician';

export interface NavGroup { label: string; items: { id: string; label: string }[] }

/** drjavid.bio-style frame: fixed left sidebar with monogram, mode switch and grouped section nav. */
export function Shell({ mode, onMode, groups, active, children, topBar }: {
  mode: Mode; onMode: (m: Mode) => void; groups: NavGroup[]; active: string; children: ReactNode; topBar?: ReactNode;
}) {
  const chips = useRef<HTMLElement>(null);
  useEffect(() => {
    chips.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [active]);
  return (
    <div className="min-h-screen bg-paper-tint">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-rule bg-paper min-[960px]:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <Monogram />
          <div>
            <div className="serif text-[19px] font-medium leading-tight text-ink">HepatoScope</div>
            <div className="eyebrow !text-[10px] !tracking-[0.16em]">Liver cancer · evidence</div>
          </div>
        </div>
        <div className="px-5 pb-3"><ModeSwitch mode={mode} onMode={onMode} /></div>
        <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Sections">
          {groups.map((g) => (
            <div key={g.label} className="mt-4">
              <div className="eyebrow mb-1 px-3 !text-[10.5px]">{g.label}</div>
              {g.items.map((it) => (
                <a key={it.id} href={`#${it.id}`}
                  className={`block rounded-r-[7px] border-l-2 px-3 py-1.5 text-[15px] transition ${active === it.id ? 'border-brand-500 bg-lavender-wash font-medium text-brand-600' : 'border-transparent text-ink-soft hover:bg-paper-tint hover:text-ink'}`}>
                  {it.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <p className="border-t border-rule px-5 py-3 text-[11px] leading-snug text-ink-soft">
          General education, not personal medical advice. Always decide treatment with your care team.
        </p>
      </aside>

      {/* Small-screen top bar with mode switch and section chips */}
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur min-[960px]:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <a href="#top" className="flex items-center gap-2"><Monogram small /><span className="serif text-lg">HepatoScope</span></a>
          <ModeSwitch mode={mode} onMode={onMode} compact />
        </div>
        <nav ref={chips} aria-label="Sections" className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]">
          {groups.flatMap((g) => g.items).map((it) => (
            <a key={it.id} href={`#${it.id}`} data-id={it.id} aria-current={active === it.id ? 'location' : undefined}
              className={`flex min-h-[36px] shrink-0 items-center rounded-full border px-3 text-[13.5px] ${active === it.id ? 'border-brand-500 bg-lavender-wash font-semibold text-brand-600' : 'border-rule text-ink-soft'}`}>{it.label}</a>
          ))}
        </nav>
      </header>

      <div id="top" className="min-[960px]:pl-[264px]">
        {topBar}
        <main className="mx-auto max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 lg:px-10">{children}</main>
      </div>
      <Ornament />
    </div>
  );
}

export function ModeSwitch({ mode, onMode, compact }: { mode: Mode; onMode: (m: Mode) => void; compact?: boolean }) {
  const opts: { v: Mode; label: string; hint: string }[] = [
    { v: 'patient', label: compact ? 'Patients' : 'Patients & families', hint: 'Plain-language guide' },
    { v: 'clinician', label: 'Clinicians', hint: 'Evidence & live workbench' },
  ];
  return (
    <div role="radiogroup" aria-label="Choose your view" className={`grid grid-cols-2 gap-1 rounded-[9px] bg-lavender-wash p-1 ${compact ? 'w-52' : ''}`}>
      {opts.map((o) => (
        <button key={o.v} role="radio" aria-checked={mode === o.v} onClick={() => onMode(o.v)}
          className={`min-h-[36px] rounded-[7px] px-2 py-1.5 text-left text-[13px] font-semibold leading-tight transition ${mode === o.v ? 'bg-paper text-brand-600 shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
          {o.label}
          {!compact && <span className="block text-[10.5px] font-normal text-ink-soft">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Monogram({ small }: { small?: boolean }) {
  const s = small ? 30 : 40;
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="#8b78d6" strokeWidth="1" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#b9abe8" strokeWidth="0.75" strokeDasharray="2 2" />
      <text x="20" y="24.5" textAnchor="middle" fontFamily="Newsreader, Georgia, serif" fontSize="13" fill="#1e4fd6">HS</text>
    </svg>
  );
}

/** Decorative line-art in the drjavid.bio idiom (top-right). */
function Ornament() {
  return (
    <svg className="pointer-events-none fixed right-0 top-0 hidden h-56 w-56 opacity-60 xl:block" viewBox="0 0 200 200" aria-hidden>
      {[90, 70, 50, 30].map((r) => <circle key={r} cx="150" cy="50" r={r} fill="none" stroke="#b9abe8" strokeWidth="0.6" />)}
      {[0, 30, 60, 90, 120, 150].map((a) => (
        <line key={a} x1={150 - 90 * Math.cos((a * Math.PI) / 180)} y1={50 - 90 * Math.sin((a * Math.PI) / 180)} x2={150 + 90 * Math.cos((a * Math.PI) / 180)} y2={50 + 90 * Math.sin((a * Math.PI) / 180)} stroke="#e4e2ea" strokeWidth="0.6" />
      ))}
    </svg>
  );
}

export function Hero({ eyebrow, title, lead, children }: { eyebrow: string[]; title: ReactNode; lead: ReactNode; children?: ReactNode }) {
  return (
    <section className="pb-6 pt-4">
      <div className="mb-5 inline-block border-y border-rule py-1.5"><span className="eyebrow">{eyebrow.join(' · ')}</span></div>
      <h1 className="serif max-w-4xl text-[40px] font-medium leading-[1.08] tracking-[-0.02em] text-ink md:text-[56px]">{title}</h1>
      <p className="serif mt-4 max-w-3xl text-[21px] leading-snug text-ink-soft md:text-[23px]">{lead}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 min-[960px]:scroll-mt-6 border-t border-rule pt-10">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <h2 className="serif text-[30px] font-medium leading-tight tracking-[-0.01em] text-ink md:text-[36px]">{title}</h2>
      {intro && <p className="mt-3 max-w-3xl text-[17px] leading-relaxed text-ink-soft">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Btn({ children, onClick, href, variant = 'primary' }: { children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'ghost' }) {
  const cls = variant === 'primary'
    ? 'bg-brand-500 text-white hover:bg-brand-700'
    : 'border border-rule bg-paper text-ink hover:border-brand-500';
  const c = `inline-flex items-center gap-1 rounded-[7px] px-4 py-2.5 text-[15px] font-semibold transition ${cls}`;
  return href ? <a href={href} className={c} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{children}</a> : <button onClick={onClick} className={c}>{children}</button>;
}
