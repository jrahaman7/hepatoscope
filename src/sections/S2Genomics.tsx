import { useEffect, useMemo, useState } from 'react';
import { BIOSAMPLES, MODALITIES, type Biosample, type GeneProfile, type Modality } from '../data/presets';
import { buildAlphaGenomeLink, clinvarPathogenic, ensemblVcf, gnomadConstraint, otTarget } from '../services/scienceApi';
import { useAsync } from '../hooks/useAsync';
import { Badge, Card, Empty, ErrorBox, Ext, Loading, SectionHeader, Segmented, Stat, fmt } from '../components/ui';

function Stars({ n }: { n: number }) {
  return <span className="whitespace-nowrap text-amber-500" title={`${n}/4 review stars`}>{'★'.repeat(n)}<span className="text-slate-300">{'★'.repeat(4 - n)}</span></span>;
}

export function S2Genomics({ gene }: { gene: GeneProfile }) {
  const hs = gene.hotspot;
  const verify = useAsync(() => ensemblVcf(hs!.hgvs), [hs?.hgvs], !!hs);
  const tgt = useAsync(() => otTarget(gene.ensemblId), [gene.ensemblId]);
  const liveLocus = tgt.data?.location ? `chr${tgt.data.location.chromosome}:${tgt.data.location.start}-${tgt.data.location.end}` : null;
  const resolvedVcf = useMemo(() => {
    if (!hs) return null;
    const live = verify.data ?? [];
    if (hs.vcf && live.includes(hs.vcf)) return { value: hs.vcf, state: 'verified' as const };
    if (live.length) return { value: live[0], state: hs.vcf ? ('corrected' as const) : ('resolved' as const) };
    return hs.vcf ? { value: hs.vcf, state: 'curated' as const } : null;
  }, [hs, verify.data]);

  // AlphaGenome builder state
  const [mode, setMode] = useState<'variant' | 'locus'>(hs ? 'variant' : 'locus');
  const [value, setValue] = useState('');
  const [biosample, setBiosample] = useState<Biosample>('HepG2');
  const [mods, setMods] = useState<Modality[]>(['RNA_SEQ', 'DNASE']);
  useEffect(() => { setMode(gene.hotspot ? 'variant' : 'locus'); }, [gene.symbol, gene.hotspot]);
  useEffect(() => {
    setValue(mode === 'variant' ? resolvedVcf?.value ?? '' : liveLocus ?? gene.locus ?? '');
  }, [mode, resolvedVcf?.value, liveLocus, gene.locus]);
  const link = useMemo(() => {
    try { return { url: buildAlphaGenomeLink({ mode, value: value.trim(), biosample, modalities: mods, tfs: gene.tfs }), err: null }; }
    catch (e) { return { url: null, err: (e as Error).message }; }
  }, [mode, value, biosample, mods, gene.tfs]);

  const gn = useAsync(() => gnomadConstraint(gene.symbol), [gene.symbol]);
  const cv = useAsync(() => clinvarPathogenic(gene.symbol, 30), [gene.symbol]);

  const loeufTone = (v: number) => (v < 0.35 ? 'red' : v < 0.6 ? 'amber' : 'green');

  return (
    <section id="s02" className="scroll-mt-32 min-[960px]:scroll-mt-6">
      <SectionHeader n="02" title="Somatic & Germline Genomics · AlphaGenome Atlas · ClinVar" sources={['Ensembl', 'AlphaGenome Atlas', 'gnomAD v4', 'NCBI ClinVar']} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Canonical driver hotspot" subtitle={`${gene.symbol} · ${gene.ensemblId}`}>
          {!hs ? <Empty>{gene.alterationNote ?? `No curated hotspot for ${gene.symbol} in HepatoScope yet — check ClinVar below.`} Use locus mode for the AlphaGenome Atlas.</Empty> : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-rose-600">{hs.label}</span>
                <Badge tone={hs.kind === 'coding' ? 'red' : hs.kind === 'regulatory' ? 'blue' : hs.kind === 'truncating' ? 'amber' : 'slate'}>{hs.kind}</Badge>
              </div>
              <p className="text-xs text-slate-600">{hs.note}</p>
              <div className="rounded-md bg-slate-50 p-2 font-mono text-xs">
                <div>HGVS: {hs.hgvs}</div>
                <div className="mt-1 flex items-center gap-2">GRCh38: {resolvedVcf?.value ?? '—'}
                  {verify.loading ? <Badge>checking Ensembl…</Badge>
                    : resolvedVcf?.state === 'verified' ? <Badge tone="green">verified by Ensembl</Badge>
                      : resolvedVcf?.state === 'corrected' ? <Badge tone="amber">corrected by Ensembl (curated {hs.vcf})</Badge>
                        : resolvedVcf?.state === 'resolved' ? <Badge tone="green">resolved by Ensembl</Badge>
                          : verify.error ? <Badge tone="amber">curated · Ensembl unreachable</Badge> : null}
                </div>
                <div className="mt-1">Locus: {liveLocus ?? gene.locus ?? '—'}</div>
              </div>
              <div className="text-[11px] text-slate-500">Key regulators: {gene.tfs.join(', ') || '—'}</div>
            </div>
          )}
        </Card>

        <Card title="AlphaGenome Atlas deep-link builder" subtitle="Validated URLSearchParams link (GRCh38)">
          <div className="space-y-3 text-xs">
            <Segmented value={mode} onChange={setMode} options={[{ value: 'variant', label: 'Variant (m=variant)' }, { value: 'locus', label: 'Locus (m=locus)' }]} />
            <input value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false}
              placeholder={mode === 'variant' ? 'chr17:7674216:C>A' : 'chr17:7661779-7687538'}
              className={`w-full rounded-md border px-2 py-1.5 font-mono ${link.err ? 'border-rose-300' : 'border-slate-200'}`} />
            <div className="flex flex-wrap gap-1">
              {BIOSAMPLES.map((b) => (
                <button key={b} onClick={() => setBiosample(b)} className={`rounded-md border px-2 py-1 ${biosample === b ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>{b}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {MODALITIES.map((m) => {
                const on = mods.includes(m);
                return <button key={m} onClick={() => setMods(on ? mods.filter((x) => x !== m) : [...mods, m])} className={`rounded-md px-2 py-1 font-mono text-[10.5px] ${on ? 'bg-ink text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>;
              })}
            </div>
            {link.err ? <p className="text-rose-600">{link.err}</p> : (
              <div className="space-y-2">
                <code className="block break-all rounded bg-slate-50 p-2 text-[10.5px] text-slate-600">{link.url}</code>
                <div className="flex gap-2">
                  <a href={link.url!} target="_blank" rel="noreferrer" className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">Open in AlphaGenome Atlas ↗</a>
                  <button onClick={() => navigator.clipboard?.writeText(link.url!).catch(() => undefined)} className="rounded-md border border-slate-200 px-3 py-1.5">Copy</button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="gnomAD v4 constraint" subtitle="GRCh38 · loss-of-function intolerance">
          {gn.loading ? <Loading /> : gn.error ? <ErrorBox error={gn.error} onRetry={gn.reload} /> : !gn.data ? <Empty>No constraint metrics for {gene.symbol}.</Empty> : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">LOEUF</span>
                <span className="font-mono text-2xl font-bold">{fmt.num(gn.data.oe_lof_upper)}</span>
                <Badge tone={loeufTone(gn.data.oe_lof_upper)}>{gn.data.oe_lof_upper < 0.35 ? 'LoF-intolerant' : gn.data.oe_lof_upper < 0.6 ? 'moderately constrained' : 'tolerant'}</Badge>
              </div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500">
                <span className="absolute -top-1 h-4 w-1 rounded bg-ink" style={{ left: `${Math.min(100, (gn.data.oe_lof_upper / 2) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="pLI" value={fmt.num(gn.data.pli, 3)} />
                <Stat label="o/e LoF" value={`${fmt.num(gn.data.oe_lof)} (${fmt.num(gn.data.oe_lof_lower)}–${fmt.num(gn.data.oe_lof_upper)})`} />
                <Stat label="Obs / Exp LoF" value={`${gn.data.obs_lof} / ${fmt.num(gn.data.exp_lof, 1)}`} />
                <Stat label="Missense Z" value={fmt.num(gn.data.mis_z)} />
                <Stat label="Synonymous Z" value={fmt.num(gn.data.syn_z)} />
                <Stat label="o/e missense" value={fmt.num(gn.data.oe_mis)} />
              </div>
              <Ext href={`https://gnomad.broadinstitute.org/gene/${gene.ensemblId}?dataset=gnomad_r4`}>Open in gnomAD ↗</Ext>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3" title="NCBI ClinVar · pathogenic / likely pathogenic" subtitle={cv.data ? `${cv.data.total.toLocaleString()} records for ${gene.symbol}; showing ${cv.data.variants.length}` : gene.symbol}
          right={<Ext href={`https://www.ncbi.nlm.nih.gov/clinvar/?term=${gene.symbol}%5Bgene%5D`}>ClinVar ↗</Ext>}>
          {cv.loading ? <Loading /> : cv.error ? <ErrorBox error={cv.error} onRetry={cv.reload} /> : !cv.data?.variants.length ? <Empty>No P/LP records.</Empty> : (
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-[11px] uppercase text-slate-500">
                  <tr><th className="py-1.5 pr-2">Variant</th><th className="pr-2">Protein</th><th className="pr-2">GRCh38</th><th className="pr-2">Classification</th><th className="pr-2">Review</th><th>Traits</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cv.data.variants.map((v) => (
                    <tr key={v.uid} className={v.residue != null && v.residue === hs?.residue ? 'bg-rose-50' : ''}>
                      <td className="max-w-[260px] truncate py-1.5 pr-2" title={v.title}><Ext href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${v.uid}/`}>{v.title}</Ext></td>
                      <td className="pr-2 font-mono">{v.proteinChange || '—'}</td>
                      <td className="pr-2 font-mono text-[11px]">{v.grch38 || '—'}</td>
                      <td className="pr-2"><Badge tone={/likely/i.test(v.significance) ? 'amber' : 'red'}>{v.significance}</Badge></td>
                      <td className="pr-2" title={v.reviewStatus}><Stars n={v.stars} /></td>
                      <td className="max-w-[240px] truncate text-slate-600" title={v.traits.join('; ')}>{v.traits.slice(0, 2).join('; ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
