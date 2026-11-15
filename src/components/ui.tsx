import type { ReactNode } from 'react';

export function Card({ title, subtitle, right, children, className = '' }: { title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function SectionHeader({ n, title, sources }: { n: string; title: string; sources: string[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-bold text-brand-600">{n}</span>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      <div className="flex flex-wrap gap-1">{sources.map((s) => <Badge key={s} tone="slate">{s}</Badge>)}</div>
    </div>
  );
}

const tones = {
  slate: 'bg-slate-100 text-slate-600', green: 'bg-emerald-100 text-emerald-800', red: 'bg-rose-100 text-rose-800',
  amber: 'bg-amber-100 text-amber-800', blue: 'bg-sky-100 text-sky-800', brand: 'bg-brand-100 text-brand-700',
} as const;
export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function Loading({ label = 'Loading live data…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />{label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
      <span className="font-medium">Live request failed.</span> {error}
      {onRetry && <button onClick={onRetry} className="ml-2 underline">Retry</button>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-xs text-slate-500">{children}</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2" title={hint}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-mono text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{children}</a>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${value === o.value ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const fmt = {
  sci: (n: number) => (n === 0 ? '0' : n < 1e-3 ? n.toExponential(2) : n.toPrecision(3)),
  num: (n: number | null | undefined, d = 2) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(d)),
};
