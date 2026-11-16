import type { IconCompare } from '../data/contentTypes';

/** 100-person icon array — natural-frequency format recommended for patient risk communication. */
function Grid({ n, color, label }: { n: number; color: string; label: string }) {
  const filled = Math.round(n);
  return (
    <figure className="flex min-w-[150px] flex-1 flex-col items-start gap-2">
      <svg viewBox="0 0 100 100" className="h-40 w-40 sm:h-44 sm:w-44" role="img" aria-label={`${filled} out of 100 people: ${label}`}>
        {Array.from({ length: 100 }, (_, i) => {
          const x = (i % 10) * 10 + 5, y = Math.floor(i / 10) * 10 + 5;
          const fill = i < filled ? color : '#dcd9e6';
          return (
            <g key={i} transform={`translate(${x},${y})`}>
              <circle cy={-2.3} r={2.1} fill={fill} />
              <path d="M-3.3 4.4 C-3.3 0.6 3.3 0.6 3.3 4.4 Z" fill={fill} />
            </g>
          );
        })}
      </svg>
      <figcaption className="leading-tight">
        <span className="serif text-[28px] font-medium" style={{ color }}>{filled}</span>
        <span className="text-[14px] text-ink-soft"> out of 100</span>
        <span className="block text-[14.5px] font-medium text-ink">{label}</span>
      </figcaption>
    </figure>
  );
}

export function IconArray({ data }: { data: IconCompare }) {
  return (
    <div className="rounded-lg bg-paper-tint p-3">
      <p className="mb-2 text-[14px] font-medium text-ink">{data.caption}</p>
      <div className="flex flex-wrap gap-5">
        <Grid n={data.a.n} color="#1e4fd6" label={data.a.label} />
        {data.b && <Grid n={data.b.n} color="#7a66c9" label={data.b.label} />}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-soft">Each figure is one person. Grey figures are the rest of the 100.</p>
    </div>
  );
}
