import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { ReactomePathway } from '../services/scienceApi';
import { fmt } from './ui';

type PNode = d3.SimulationNodeDatum & { id: string; kind: 'pathway'; label: string; p: ReactomePathway; r: number };
type GNode = d3.SimulationNodeDatum & { id: string; kind: 'gene'; label: string; isTarget: boolean; pathways: string[]; r: number };
type Node = PNode | GNode;
type Link = d3.SimulationLinkDatum<Node> & { source: Node | string; target: Node | string; p: ReactomePathway; gene: string };

interface Props {
  pathways: ReactomePathway[]; // top-5, each with .genes populated
  target: string;
  active: string | null; // highlighted pathway stId (hover or selection, shared with the table)
  onActive: (stId: string | null) => void;
  onSelect: (stId: string) => void;
}

const PCOLORS = ['#1f8a70', '#2563eb', '#d97706', '#9333ea', '#db2777'];
const W = 760, H = 460;

export function ReactomeForceGraph({ pathways, target, active, onActive, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ zoomBy: (k: number) => void; reset: () => void; highlight: (id: string | null) => void } | null>(null);
  const cb = useRef({ onActive, onSelect });
  cb.current = { onActive, onSelect };

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll('*').remove();
    const tip = d3.select(tipRef.current!);
    const rScale = d3.scaleSqrt().domain([0, d3.max(pathways, (p) => -Math.log10(Math.max(p.fdr, 1e-300))) ?? 1]).range([14, 34]);

    const pNodes: PNode[] = pathways.map((p, i) => ({ id: p.stId, kind: 'pathway', label: `P${i + 1}`, p, r: rScale(-Math.log10(Math.max(p.fdr, 1e-300))) }));
    const geneMap = new Map<string, GNode>();
    const links: Link[] = [];
    pathways.forEach((p) => p.genes.forEach((g) => {
      if (!geneMap.has(g)) geneMap.set(g, { id: `g:${g}`, kind: 'gene', label: g, isTarget: g === target.toUpperCase(), pathways: [], r: g === target.toUpperCase() ? 11 : 7 });
      geneMap.get(g)!.pathways.push(p.stId);
      links.push({ source: p.stId, target: `g:${g}`, p, gene: g });
    }));
    const nodes: Node[] = [...pNodes, ...geneMap.values()];
    const colorOf = (stId: string) => PCOLORS[pathways.findIndex((p) => p.stId === stId) % PCOLORS.length];

    const root = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .filter((e: Event & { button?: number }) => e.type !== 'wheel' && e.type !== 'dblclick' && !e.button) // scroll-wheel zoom suppressed
      .on('zoom', (e) => root.attr('transform', e.transform.toString()));
    svg.call(zoom);

    const sim = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id((d) => d.id).distance(70).strength(0.6))
      .force('charge', d3.forceManyBody<Node>().strength((d) => (d.kind === 'pathway' ? -420 : -90)))
      .force('collide', d3.forceCollide<Node>().radius((d) => d.r + 6))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('x', d3.forceX(W / 2).strength(0.04))
      .force('y', d3.forceY(H / 2).strength(0.06));

    const showTip = (ev: MouseEvent, html: string) => {
      const box = wrap.current!.getBoundingClientRect();
      tip.style('opacity', '1').html(html)
        .style('left', `${Math.min(ev.clientX - box.left + 14, box.width - 250)}px`)
        .style('top', `${ev.clientY - box.top + 12}px`);
    };
    const hideTip = () => tip.style('opacity', '0');
    const pTip = (p: ReactomePathway, label?: string) =>
      `<div class="font-semibold text-ink">${label ? `${label} · ` : ''}${p.name}</div>
       <div class="mt-1 grid grid-cols-2 gap-x-3 font-mono text-[11px]">
         <span class="text-slate-500">BH FDR</span><span>${fmt.sci(p.fdr)}</span>
         <span class="text-slate-500">p-value</span><span>${fmt.sci(p.pValue)}</span>
         <span class="text-slate-500">Enrichment</span><span>${p.enrichment.toFixed(1)}×</span>
         <span class="text-slate-500">Found / total</span><span>${p.found} / ${p.total}</span>
       </div>
       <div class="mt-1 text-[11px] text-slate-600">Genes: ${p.genes.join(', ')}</div>
       <div class="text-[10px] text-slate-400">${p.stId}</div>`;

    const linkG = root.append('g').attr('stroke-linecap', 'round');
    const link = linkG.selectAll<SVGLineElement, Link>('line.vis').data(links).join('line').attr('class', 'vis')
      .attr('stroke', (d) => colorOf(d.p.stId)).attr('stroke-opacity', 0.45).attr('stroke-width', 1.6).attr('pointer-events', 'none');
    // wide transparent hit area so edge tooltips are easy to trigger
    linkG.selectAll<SVGLineElement, Link>('line.hit').data(links).join('line').attr('class', 'hit')
      .attr('stroke', 'transparent').attr('stroke-width', 9)
      .on('mousemove', (ev, d) => showTip(ev, `<div class="text-[11px] text-slate-500">edge</div><div class="font-semibold">${d.gene} ∈ ${d.p.name}</div>
        <div class="mt-1 font-mono text-[11px]">BH FDR ${fmt.sci(d.p.fdr)} · p ${fmt.sci(d.p.pValue)} · ${d.p.enrichment.toFixed(1)}×</div>`))
      .on('mouseleave', hideTip);

    const node = root.append('g').selectAll<SVGGElement, Node>('g').data(nodes).join('g').attr('cursor', 'grab')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev) => { if (!ev.active) sim.alphaTarget(0); }));

    node.filter((d) => d.kind === 'pathway').append('circle')
      .attr('r', (d) => d.r).attr('fill', (d) => colorOf(d.id)).attr('fill-opacity', 0.9).attr('stroke', 'white').attr('stroke-width', 2);
    node.filter((d) => d.kind === 'pathway').append('text').text((d) => d.label)
      .attr('text-anchor', 'middle').attr('dy', '0.35em').attr('fill', 'white').attr('font-size', 12).attr('font-weight', 700).attr('pointer-events', 'none');
    node.filter((d) => d.kind === 'gene').append('circle')
      .attr('r', (d) => d.r).attr('fill', (d) => ((d as GNode).isTarget ? '#e11d48' : '#f8fafc')).attr('stroke', (d) => ((d as GNode).isTarget ? '#9f1239' : '#475569')).attr('stroke-width', 1.4);
    node.filter((d) => d.kind === 'gene').append('text').text((d) => d.label)
      .attr('x', (d) => d.r + 3).attr('dy', '0.35em').attr('font-size', 10).attr('fill', '#1e293b').attr('pointer-events', 'none');

    const neighbors = (id: string | null) => {
      if (!id) return null;
      const set = new Set<string>([id]);
      links.forEach((l) => {
        const s = (l.source as Node).id, t = (l.target as Node).id;
        if (s === id) set.add(t);
        if (t === id) set.add(s);
      });
      return set;
    };
    const highlight = (id: string | null) => {
      const nb = neighbors(id);
      node.attr('opacity', (d) => (!nb || nb.has(d.id) ? 1 : 0.15));
      link.attr('stroke-opacity', (l) => (!nb ? 0.45 : (l.source as Node).id === id || (l.target as Node).id === id ? 0.9 : 0.05))
        .attr('stroke-width', (l) => (id && ((l.source as Node).id === id || (l.target as Node).id === id) ? 2.6 : 1.6));
    };

    node.on('mousemove', (ev, d) => {
      if (d.kind === 'pathway') showTip(ev, pTip(d.p, d.label));
      else {
        const ps = pathways.filter((p) => d.pathways.includes(p.stId));
        showTip(ev, `<div class="font-semibold">${d.label}${d.isTarget ? ' <span class="text-rose-600">(target)</span>' : ''}</div>
          <div class="mt-1 space-y-0.5 text-[11px]">${ps.map((p) => `<div><span class="font-medium">P${pathways.indexOf(p) + 1}</span> ${p.name}<br/><span class="font-mono text-slate-500">FDR ${fmt.sci(p.fdr)} · p ${fmt.sci(p.pValue)}</span></div>`).join('')}</div>`);
      }
    })
      .on('mouseenter', (_, d) => { highlight(d.id); if (d.kind === 'pathway') cb.current.onActive(d.id); })
      .on('mouseleave', () => { hideTip(); cb.current.onActive(null); })
      .on('click', (_, d) => { if (d.kind === 'pathway') cb.current.onSelect(d.id); });

    sim.on('tick', () => {
      linkG.selectAll<SVGLineElement, Link>('line').attr('x1', (d) => (d.source as Node).x!).attr('y1', (d) => (d.source as Node).y!).attr('x2', (d) => (d.target as Node).x!).attr('y2', (d) => (d.target as Node).y!);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    api.current = {
      zoomBy: (k) => svg.transition().duration(250).call(zoom.scaleBy, k),
      reset: () => {
        nodes.forEach((n) => { n.fx = null; n.fy = null; });
        svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
        sim.alpha(1).restart();
      },
      highlight,
    };
    return () => { sim.stop(); };
  }, [pathways, target]);

  useEffect(() => { api.current?.highlight(active); }, [active]);

  return (
    <div ref={wrap} className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-[460px] w-full rounded-lg border border-slate-200 bg-slate-50/50" />
      <div className="absolute right-2 top-2 flex gap-1">
        <button onClick={() => api.current?.zoomBy(1.3)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm hover:bg-slate-50">Zoom +</button>
        <button onClick={() => api.current?.zoomBy(1 / 1.3)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm hover:bg-slate-50">Zoom −</button>
        <button onClick={() => api.current?.reset()} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm hover:bg-slate-50">Reset Layout</button>
      </div>
      <div ref={tipRef} className="tooltip-float w-60 rounded-lg border border-slate-200 bg-white/95 p-2 text-xs opacity-0 shadow-lg transition-opacity" />
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
        <span>Pathway node size ∝ −log10(FDR)</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" />target gene</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-slate-600 bg-white" />associated gene</span>
        <span className="text-slate-400">Drag nodes · drag background to pan · wheel zoom disabled</span>
      </div>
    </div>
  );
}
