import type { IconCompare } from '../data/contentTypes';

/** 100-person icon array — the risk-communication format recommended for patients (natural frequencies). */
function Grid({ n, color, label }: { n: number; color: string; label: string }) {
  const filled = Math.round(n);
  return (
    <figure className="flex flex-col items-start gap-1.5">
      <svg viewBox="0 0 100 100" className="h-28 w-28" role="img" aria-label={`${filled} out of 100 people: ${label}`}>
        {Array.from({ length: 100 }, (_, i) => {
          const x = (i % 10) * 10 + 5, y = Math.floor(i / 10) * 10 + 5;
          const on = i < filled;
          return (
            <g key={i} transform={`translate(${x},${y})`}>
              <circle cy={-2} r={1.7} fill={on ? color : '#e4e2ea'} />
              <path d="M-2.6 3.6 Q0 -0.4 2.6 3.6 Z" fill={on ? color : '#e4e2ea'} />
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[13px] leading-tight text-ink-soft"><b className="serif text-xl font-medium text-ink">{filled}</b> of 100 · {label}</figcaption>
    </figure>
  );
}

export function IconArray({ data }: { data: IconCompare }) {
  return (
    <div>
      <div className="flex flex-wrap gap-6">
        <Grid n={data.a.n} color="#1e4fd6" label={data.a.label} />
        {data.b && <Grid n={data.b.n} color="#8b78d6" label={data.b.label} />}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-soft">{data.caption}</p>
    </div>
  );
}
