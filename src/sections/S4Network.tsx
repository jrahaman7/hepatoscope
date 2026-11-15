import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { GeneProfile } from '../data/presets';
import { gtexMedianExpression, reactomeEnrichment, reactomeFoundGenes, stringNetwork, stringPartners, type ReactomePathway, type StringEdge } from '../services/scienceApi';
import { useAsync } from '../hooks/useAsync';
import { Badge, Card, Empty, ErrorBox, Ext, Loading, SectionHeader, fmt } from '../components/ui';
import { ReactomeForceGraph } from '../components/ReactomeForceGraph';

type SNode = d3.SimulationNodeDatum & { id: string; score: number };
type SLink = d3.SimulationLinkDatum<SNode> & { e: StringEdge };

function StringGraph({ target, partners, network }: { target: string; partners: StringEdge[]; network: StringEdge[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<StringEdge | null>(null);
  useEffect(() => {
    const W = 420, H = 340;
    const svg = d3.select(ref.current!); svg.selectAll('*').remove();
    const nodes: SNode[] = [{ id: target, score: 1 }, ...partners.map((p) => ({ id: p.b === target ? p.a : p.b, score: p.score }))];
    const ids = new Set(nodes.map((n) => n.id));
    const seen = new Set<string>();
    const links: SLink[] = [...partners, ...network].filter((e) => ids.has(e.a) && ids.has(e.b)).filter((e) => {
      const k = [e.a, e.b].sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true;
    }).map((e) => ({ source: e.a, target: e.b, e }));
    const sim = d3.forceSimulation<SNode>(nodes)
      .force('link', d3.forceLink<SNode, SLink>(links).id((d) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide(18));
    const w = d3.scaleLinear().domain([0.7, 1]).range([0.8, 4]);
    const link = svg.append('g').selectAll('line').data(links).join('line').attr('stroke', '#94a3b8').attr('stroke-opacity', 0.7)
      .attr('stroke-width', (d) => w(d.e.score)).attr('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHover(d.e)).on('mouseleave', () => setHover(null));
    const node = svg.append('g').selectAll<SVGGElement, SNode>('g').data(nodes).join('g').attr('cursor', 'grab')
      .call(d3.drag<SVGGElement, SNode>().on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; }).on('end', (ev) => { if (!ev.active) sim.alphaTarget(0); }));
    node.append('circle').attr('r', (d) => (d.id === target ? 13 : 8)).attr('fill', (d) => (d.id === target ? '#e11d48' : '#1f8a70')).attr('stroke', 'white').attr('stroke-width', 1.5);
    node.append('text').text((d) => d.id).attr('y', (d) => (d.id === target ? 24 : 18)).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#1e293b');
    sim.on('tick', () => {
      nodes.forEach((n) => { n.x = Math.max(16, Math.min(W - 16, n.x!)); n.y = Math.max(16, Math.min(H - 24, n.y!)); });
      link.attr('x1', (d) => (d.source as SNode).x!).attr('y1', (d) => (d.source as SNode).y!).attr('x2', (d) => (d.target as SNode).x!).attr('y2', (d) => (d.target as SNode).y!);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });
    return () => { sim.stop(); };
  }, [target, partners, network]);
  return (
    <div>
      <svg ref={ref} viewBox="0 0 420 340" className="h-[340px] w-full rounded-lg bg-slate-50/50" />
      <div className="mt-1 h-8 text-[11px] text-slate-600">
        {hover ? <span><b>{hover.a}–{hover.b}</b> · combined {hover.score.toFixed(3)} · <span className="font-mono">exp {hover.escore.toFixed(2)} · db {hover.dscore.toFixed(2)} · txt {hover.tscore.toFixed(2)} · coexp {hover.ascore.toFixed(2)}</span></span>
          : <span className="text-slate-400">Hover an edge for evidence-channel scores · edge width ∝ combined score</span>}
      </div>
    </div>
  );
}

function GtexChart({ rows }: { rows: { tissue: string; tissueId: string; median: number }[] }) {
  const top = rows.slice(0, 24);
  const liver = rows.find((r) => r.tissueId === 'Liver');
  if (liver && !top.includes(liver)) top.push(liver);
  const max = d3.max(top, (r) => r.median) || 1;
  return (
    <div className="space-y-0.5">
      {top.map((r) => {
        const isLiver = r.tissueId === 'Liver';
        return (
          <div key={r.tissueId} className="grid grid-cols-[150px_1fr_52px] items-center gap-2 text-[11px]">
            <span className={`truncate ${isLiver ? 'font-semibold text-rose-700' : 'text-slate-600'}`} title={r.tissue}>{r.tissue}</span>
            <div className="h-2.5 rounded-sm bg-slate-100"><div className={`h-2.5 rounded-sm ${isLiver ? 'bg-rose-500' : 'bg-brand-500/70'}`} style={{ width: `${(r.median / max) * 100}%` }} /></div>
            <span className="text-right font-mono text-slate-500">{r.median.toFixed(1)}</span>
          </div>
        );
      })}
      <p className="pt-1 text-[10px] text-slate-400">Median TPM, GTEx v10 (GENCODE v39); Liver highlighted{liver ? ` — rank ${rows.indexOf(liver) + 1}/${rows.length}` : ''}.</p>
    </div>
  );
}

export function S4Network({ gene }: { gene: GeneProfile }) {
  const partners = useAsync(() => stringPartners(gene.symbol, 15), [gene.symbol]);
  const partnerNames = (partners.data ?? []).map((p) => (p.b === gene.symbol ? p.a : p.b));
  const network = useAsync(() => stringNetwork([gene.symbol, ...partnerNames]), [partners.data], !!partners.data?.length);

  // Target-focused ORA: target + its high-confidence STRING neighbourhood.
  const reactome = useAsync(async () => {
    const ids = [gene.symbol, ...partnerNames];
    const res = await reactomeEnrichment(ids, 40);
    const withGenes: ReactomePathway[] = await Promise.all(res.pathways.slice(0, 20).map(async (p) => ({ ...p, genes: await reactomeFoundGenes(res.token, p.stId).catch((): string[] => []) })));
    // Prefer pathways that actually contain the target, then fill by FDR.
    const hasTarget = withGenes.filter((p) => p.genes.includes(gene.symbol.toUpperCase()));
    const rest = withGenes.filter((p) => !hasTarget.includes(p));
    const table: ReactomePathway[] = [...hasTarget, ...rest].sort((a, b) => a.fdr - b.fdr);
    const top5 = [...hasTarget, ...rest].slice(0, 5).sort((a, b) => a.fdr - b.fdr);
    return { ...res, top5, table, inputIds: ids };
  }, [partners.data, gene.symbol], partners.data != null);

  const gtex = useAsync(() => gtexMedianExpression(gene.symbol), [gene.symbol]);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { setSelected(null); setActive(null); }, [gene.symbol]);
  const focus = active ?? selected;
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  useEffect(() => { if (selected) rowRefs.current[selected]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [selected]);

  return (
    <section id="s04" className="scroll-mt-28">
      <SectionHeader n="04" title="Reactome Pathway Graph · STRING PPI · GTEx v10" sources={['Reactome AnalysisService', 'STRING v12', 'GTEx Portal v2']} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="ReactomeForceGraph · top 5 pathways (P1–P5) ↔ genes"
          subtitle={reactome.data ? `Over-representation of ${gene.symbol} + ${reactome.data.inputIds.length - 1} STRING partners (${reactome.data.inputSize} mapped) · BH-FDR` : 'Target-focused over-representation analysis'}>
          {partners.loading || reactome.loading ? <Loading label="Running Reactome over-representation…" />
            : partners.error ? <ErrorBox error={partners.error} onRetry={partners.reload} />
              : reactome.error ? <ErrorBox error={reactome.error} onRetry={reactome.reload} />
                : !reactome.data?.top5.length ? <Empty>No enriched pathways.</Empty>
                  : <ReactomeForceGraph pathways={reactome.data.top5} target={gene.symbol} active={focus} onActive={setActive} onSelect={(id) => setSelected((s) => (s === id ? null : id))} />}
        </Card>

        <Card className="lg:col-span-2" title="Reactome over-representation table" subtitle="Hover or click a row to highlight it in the graph"
          right={reactome.data && <Ext href={`https://reactome.org/PathwayBrowser/#/DTAB=AN&ANALYSIS=${reactome.data.token}`}>Reactome ↗</Ext>}>
          {reactome.loading ? <Loading /> : reactome.data && (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-[11px] uppercase text-slate-500"><tr><th className="py-1.5 pr-1"></th><th className="pr-2">Pathway</th><th className="pr-2">Found</th><th className="pr-2">p</th><th>FDR</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {reactome.data.table.map((p) => {
                    const idx = reactome.data!.top5.findIndex((t) => t.stId === p.stId);
                    const on = focus === p.stId;
                    return (
                      <tr key={p.stId} ref={(el) => { rowRefs.current[p.stId] = el; }}
                        onMouseEnter={() => idx >= 0 && setActive(p.stId)} onMouseLeave={() => setActive(null)}
                        onClick={() => idx >= 0 && setSelected((s) => (s === p.stId ? null : p.stId))}
                        className={`${idx >= 0 ? 'cursor-pointer' : 'opacity-60'} ${on ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                        <td className="py-1.5 pr-1">{idx >= 0 && <Badge tone="brand">P{idx + 1}</Badge>}</td>
                        <td className="pr-2"><div className="max-w-[200px] truncate" title={`${p.name}\n${p.genes.join(', ')}`}>{p.name}</div>
                          {p.genes.includes(gene.symbol.toUpperCase()) && <span className="text-[10px] text-rose-600">contains {gene.symbol}</span>}</td>
                        <td className="pr-2 font-mono">{p.found}/{p.total}</td>
                        <td className="pr-2 font-mono">{fmt.sci(p.pValue)}</td>
                        <td className="font-mono font-semibold">{fmt.sci(p.fdr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3" title={`STRING v12 · high-confidence partners of ${gene.symbol}`} subtitle="required_score ≥ 700 · Homo sapiens"
          right={<Ext href={`https://string-db.org/network/9606/${gene.symbol}`}>STRING ↗</Ext>}>
          {partners.loading ? <Loading /> : partners.error ? <ErrorBox error={partners.error} onRetry={partners.reload} /> : !partners.data?.length ? <Empty>No partners ≥ 0.700.</Empty> : (
            <div className="grid gap-3 md:grid-cols-[1fr_190px]">
              <StringGraph target={gene.symbol} partners={partners.data} network={network.data ?? []} />
              <ul className="max-h-[360px] space-y-0.5 overflow-auto text-[11px]">
                {partners.data.map((p) => (
                  <li key={p.b} className="flex justify-between gap-2 border-b border-slate-50 py-0.5"><span className="font-medium">{p.b === gene.symbol ? p.a : p.b}</span><span className="font-mono text-slate-500">{p.score.toFixed(3)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2" title="GTEx v10 · median tissue expression" subtitle={gtex.data ? gtex.data.gencodeId : 'Resolving GENCODE v39 ID…'}
          right={<Ext href={`https://gtexportal.org/home/gene/${gene.symbol}`}>GTEx ↗</Ext>}>
          {gtex.loading ? <Loading /> : gtex.error ? <ErrorBox error={gtex.error} onRetry={gtex.reload} /> : gtex.data && <GtexChart rows={gtex.data.rows} />}
        </Card>
      </div>
    </section>
  );
}
