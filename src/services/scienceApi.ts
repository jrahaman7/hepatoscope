// scienceApi.ts — live clients for the public life-science APIs used by HepatoScope.
// No mock data: every function hits a real endpoint. Resilience comes from
// fetchWithRetry (timeout + exponential backoff with jitter on 429/5xx/network errors)
// and an in-memory, promise-level session cache (concurrent callers share one request).

import { CURATED_EXTRAS, type Biosample, type GeneProfile, type Modality } from '../data/presets';

// ───────────────────────── core transport ─────────────────────────

export class ApiError extends Error {
  status?: number;
  source: string;
  constructor(source: string, message: string, status?: number) {
    super(`${source}: ${message}`);
    this.source = source;
    this.status = status;
  }
}

interface RetryOpts {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  source?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, init: RequestInit = {}, opts: RetryOpts = {}): Promise<Response> {
  const { retries = 3, baseDelayMs = 500, timeoutMs = 20000, source = new URL(url).host } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok || res.status === 204) return res;
      if (res.status === 429 || res.status >= 500) {
        lastErr = new ApiError(source, `HTTP ${res.status}`, res.status);
      } else {
        throw new ApiError(source, `HTTP ${res.status} ${res.statusText}`, res.status);
      }
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ApiError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e instanceof ApiError ? e : new ApiError(source, e instanceof Error ? e.message : String(e));
    }
    if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt + Math.random() * 250);
  }
  throw lastErr instanceof Error ? lastErr : new ApiError(source, 'request failed');
}

const cache = new Map<string, Promise<unknown>>();

/** Session-cached JSON fetch. Failed requests are evicted so they can be retried. */
export function cachedJson<T>(url: string, init: RequestInit = {}, opts: RetryOpts = {}): Promise<T> {
  const key = `${init.method ?? 'GET'} ${url} ${typeof init.body === 'string' ? init.body : ''}`;
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const p = fetchWithRetry(url, init, opts)
    .then(async (r) => (r.status === 204 ? (null as T) : ((await r.json()) as T)))
    .catch((e) => {
      cache.delete(key);
      throw e;
    });
  cache.set(key, p);
  return p;
}

export const clearApiCache = () => cache.clear();

const enc = encodeURIComponent;

// ───────────────────────── 1. Open Targets Platform v4 ─────────────────────────

const OT_URL = 'https://api.platform.opentargets.org/api/v4/graphql';

async function otQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const json = await cachedJson<{ data?: T; errors?: { message: string }[] }>(
    OT_URL,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) },
    { source: 'Open Targets' },
  );
  if (json.errors?.length && !json.data) throw new ApiError('Open Targets', json.errors.map((e) => e.message).join('; '));
  return json.data as T;
}

/** Resolve a disease to the ID Open Targets currently uses: try the given IDs in order, then search by name. */
export async function otResolveDisease(ids: string[], name: string): Promise<{ id: string; name: string }> {
  for (const id of ids) {
    const d = await otQuery<{ disease: { id: string; name: string } | null }>('query($e:String!){ disease(efoId:$e){ id name } }', { e: id }).catch(() => null);
    if (d?.disease) return d.disease;
  }
  const s = await otQuery<{ search: { hits: { id: string; name: string }[] } }>(
    'query($q:String!){ search(queryString:$q, entityNames:["disease"], page:{index:0,size:5}){ hits{ id name } } }', { q: name });
  const hit = s.search.hits.find((h) => h.name.toLowerCase() === name.toLowerCase()) ?? s.search.hits[0];
  if (!hit) throw new ApiError('Open Targets', `disease "${name}" not found`);
  return hit;
}

export const OT_AXES = [
  'somatic_mutation', 'known_drug', 'affected_pathway', 'literature', 'rna_expression', 'animal_model', 'genetic_association',
] as const;
export type OtAxis = (typeof OT_AXES)[number];

export interface OtAssociation {
  disease: { id: string; name: string } | null;
  overall: number | null;
  axes: Record<OtAxis, number>;
}

export async function otTargetDiseaseAssociation(efoId: string, ensemblId: string): Promise<OtAssociation> {
  const q = `query($efo:String!,$ens:[String!]){
    disease(efoId:$efo){ id name
      associatedTargets(Bs:$ens, page:{index:0,size:1}){ rows{ score datatypeScores{ id score } } } } }`;
  const d = await otQuery<{ disease: { id: string; name: string; associatedTargets: { rows: { score: number; datatypeScores: { id: string; score: number }[] }[] } } | null }>(q, { efo: efoId, ens: [ensemblId] });
  const axes = Object.fromEntries(OT_AXES.map((a) => [a, 0])) as Record<OtAxis, number>;
  const row = d.disease?.associatedTargets.rows[0];
  row?.datatypeScores.forEach((s) => { if (s.id in axes) axes[s.id as OtAxis] = s.score; });
  return { disease: d.disease ? { id: d.disease.id, name: d.disease.name } : null, overall: row?.score ?? null, axes };
}

export interface OtTopTarget { symbol: string; ensemblId: string; score: number }
export async function otDiseaseTopTargets(efoId: string, size = 10): Promise<{ name: string; count: number; rows: OtTopTarget[] }> {
  const q = `query($efo:String!,$size:Int!){ disease(efoId:$efo){ name associatedTargets(page:{index:0,size:$size}){ count rows{ score target{ id approvedSymbol } } } } }`;
  const d = await otQuery<{ disease: { name: string; associatedTargets: { count: number; rows: { score: number; target: { id: string; approvedSymbol: string } }[] } } | null }>(q, { efo: efoId, size });
  if (!d.disease) throw new ApiError('Open Targets', `disease ${efoId} not found`);
  return {
    name: d.disease.name,
    count: d.disease.associatedTargets.count,
    rows: d.disease.associatedTargets.rows.map((r) => ({ symbol: r.target.approvedSymbol, ensemblId: r.target.id, score: r.score })),
  };
}

export interface OtTractability { label: string; modality: string; value: boolean }
export interface OtKnownDrug { drugId: string; drugName: string; rank: number; stage: string; moa: string; diseases: string[]; drugType: string }
export interface OtTarget {
  id: string; symbol: string; name: string;
  location: { chromosome: string; start: number; end: number; strand: number } | null;
  tractability: OtTractability[];
  knownDrugs: OtKnownDrug[];
  knownDrugsError?: string;
}

// Open Targets clinical stage → sortable rank + display label
const STAGE: Record<string, [number, string]> = {
  APPROVAL: [5, 'Approved'], PHASE_4: [4, 'Phase 4'], PHASE_3: [3, 'Phase 3'], PHASE_2_3: [2.5, 'Phase 2/3'], PHASE_2: [2, 'Phase 2'],
  PHASE_1_2: [1.5, 'Phase 1/2'], PHASE_1: [1, 'Phase 1'], EARLY_PHASE_1: [0.5, 'Early Phase 1'], PHASE_0: [0.2, 'Phase 0'], WITHDRAWAL: [-1, 'Withdrawn'],
};
const stageOf = (s: string | null | undefined): [number, string] => (s && STAGE[s]) || [0, s ? s.replace(/_/g, ' ').toLowerCase() : 'preclinical'];

export async function otTarget(ensemblId: string): Promise<OtTarget> {
  const base = `id approvedSymbol approvedName genomicLocation{ chromosome start end strand } tractability{ label modality value }`;
  type Core = { id: string; approvedSymbol: string; approvedName: string; genomicLocation: OtTarget['location']; tractability: OtTractability[] };
  // Current schema (2025+): drugAndClinicalCandidates
  const qNew = `query($id:String!){ target(ensemblId:$id){ ${base}
    drugAndClinicalCandidates{ rows{ maxClinicalStage drug{ id name drugType mechanismsOfAction{ rows{ mechanismOfAction } } } diseases{ diseaseFromSource disease{ name } } } } } }`;
  // Legacy schema: knownDrugs
  const qOld = `query($id:String!){ target(ensemblId:$id){ ${base}
    knownDrugs(size:60){ rows{ drugId prefName phase mechanismOfAction drugType disease{ name } } } } }`;
  type NewRaw = { target: (Core & { drugAndClinicalCandidates: { rows: { maxClinicalStage: string; drug: { id: string; name: string; drugType: string; mechanismsOfAction?: { rows: { mechanismOfAction: string }[] } }; diseases: { diseaseFromSource: string; disease: { name: string } | null }[] }[] } }) | null };
  type OldRaw = { target: (Core & { knownDrugs: { rows: { drugId: string; prefName: string; phase: number; mechanismOfAction: string; drugType: string; disease: { name: string } }[] } }) | null };

  let core: Core | null = null;
  let knownDrugs: OtKnownDrug[] = [];
  let knownDrugsError: string | undefined;
  try {
    const d = await otQuery<NewRaw>(qNew, { id: ensemblId });
    core = d.target;
    knownDrugs = (d.target?.drugAndClinicalCandidates.rows ?? []).map((r) => {
      const [rank, stage] = stageOf(r.maxClinicalStage);
      return {
        drugId: r.drug.id, drugName: r.drug.name, rank, stage, drugType: r.drug.drugType,
        moa: [...new Set(r.drug.mechanismsOfAction?.rows.map((m) => m.mechanismOfAction) ?? [])].join('; '),
        diseases: [...new Set(r.diseases.map((x) => x.disease?.name ?? x.diseaseFromSource).filter(Boolean))],
      };
    });
  } catch (eNew) {
    try {
      const d = await otQuery<OldRaw>(qOld, { id: ensemblId });
      core = d.target;
      const byDrug = new Map<string, OtKnownDrug>();
      (d.target?.knownDrugs.rows ?? []).forEach((r) => {
        const cur = byDrug.get(r.drugId);
        const rank = r.phase >= 4 ? 5 : r.phase;
        if (!cur) byDrug.set(r.drugId, { drugId: r.drugId, drugName: r.prefName, rank, stage: rank === 5 ? 'Approved' : `Phase ${r.phase}`, moa: r.mechanismOfAction, drugType: r.drugType, diseases: [r.disease?.name].filter(Boolean) as string[] });
        else { if (r.disease?.name && !cur.diseases.includes(r.disease.name)) cur.diseases.push(r.disease.name); if (rank > cur.rank) Object.assign(cur, { rank, stage: rank === 5 ? 'Approved' : `Phase ${r.phase}` }); }
      });
      knownDrugs = [...byDrug.values()];
    } catch {
      // Schema drift guard: keep the rest of the workbench working.
      knownDrugsError = eNew instanceof Error ? eNew.message : String(eNew);
      core = (await otQuery<{ target: Core | null }>(`query($id:String!){ target(ensemblId:$id){ ${base} } }`, { id: ensemblId })).target;
    }
  }
  if (!core) throw new ApiError('Open Targets', `target ${ensemblId} not found`);
  return {
    id: core.id, symbol: core.approvedSymbol, name: core.approvedName, location: core.genomicLocation, tractability: core.tractability ?? [],
    knownDrugs: knownDrugs.sort((a, b) => b.rank - a.rank), knownDrugsError,
  };
}

export async function otSearchTarget(symbol: string): Promise<{ id: string; name: string } | null> {
  const q = `query($q:String!){ search(queryString:$q, entityNames:["target"], page:{index:0,size:10}){ hits{ id name entity object{ ... on Target { approvedSymbol approvedName } } } } }`;
  const d = await otQuery<{ search: { hits: { id: string; name: string; object?: { approvedSymbol?: string; approvedName?: string } }[] } }>(q, { q: symbol });
  const hits = d.search.hits;
  const exact = hits.find((h) => (h.object?.approvedSymbol ?? h.name).toUpperCase() === symbol.toUpperCase());
  const h = exact ?? hits[0];
  return h ? { id: h.id, name: h.object?.approvedName ?? h.name } : null;
}

// ───────────────────────── 2. AlphaFold DB ─────────────────────────

export interface AlphaFoldEntry { entryId: string; cifUrl: string; pdbUrl: string; paeImageUrl?: string; paeDocUrl?: string; latestVersion: number; modelCreatedDate: string; uniprotStart: number; uniprotEnd: number; globalMetricValue?: number }
export async function alphaFold(uniprot: string): Promise<AlphaFoldEntry> {
  const arr = await cachedJson<AlphaFoldEntry[]>(`https://alphafold.ebi.ac.uk/api/prediction/${enc(uniprot)}`, {}, { source: 'AlphaFold DB' });
  if (!arr?.length) throw new ApiError('AlphaFold DB', `no prediction for ${uniprot}`);
  // Prefer the canonical full-length entry (F1).
  return arr.find((a) => a.entryId?.endsWith('-F1')) ?? arr[0];
}

export async function fetchText(url: string, source: string): Promise<string> {
  const key = `TEXT ${url}`;
  const hit = cache.get(key);
  if (hit) return hit as Promise<string>;
  const p = fetchWithRetry(url, {}, { source, timeoutMs: 45000 }).then((r) => r.text()).catch((e) => { cache.delete(key); throw e; });
  cache.set(key, p);
  return p;
}

// ───────────────────────── 3. UniProtKB ─────────────────────────

export interface UniFeature { type: string; start: number; end: number; description: string; original?: string; alternatives?: string[] }
export interface UniProtSummary { accession: string; gene: string; proteinName: string; length: number; func: string; locations: string[]; domains: UniFeature[]; variants: UniFeature[] }

interface UniRaw {
  primaryAccession: string;
  genes?: { geneName?: { value: string } }[];
  proteinDescription?: { recommendedName?: { fullName?: { value: string } } };
  sequence: { length: number };
  comments?: { commentType: string; texts?: { value: string }[]; subcellularLocations?: { location: { value: string } }[] }[];
  features?: { type: string; location: { start: { value: number }; end: { value: number } }; description?: string; alternativeSequence?: { originalSequence?: string; alternativeSequences?: string[] } }[];
}

export async function uniprot(acc: string): Promise<UniProtSummary> {
  const j = await cachedJson<UniRaw>(`https://rest.uniprot.org/uniprotkb/${enc(acc)}.json`, {}, { source: 'UniProtKB' });
  const fn = j.comments?.find((c) => c.commentType === 'FUNCTION')?.texts?.[0]?.value ?? '';
  const locs = Array.from(new Set(j.comments?.filter((c) => c.commentType === 'SUBCELLULAR LOCATION').flatMap((c) => c.subcellularLocations?.map((s) => s.location.value) ?? []) ?? []));
  const feats = (j.features ?? []).map<UniFeature>((f) => ({
    type: f.type, start: f.location.start.value, end: f.location.end.value, description: f.description ?? '',
    original: f.alternativeSequence?.originalSequence, alternatives: f.alternativeSequence?.alternativeSequences,
  }));
  return {
    accession: j.primaryAccession, gene: j.genes?.[0]?.geneName?.value ?? '', proteinName: j.proteinDescription?.recommendedName?.fullName?.value ?? '',
    length: j.sequence.length, func: fn, locations: locs,
    domains: feats.filter((f) => ['Domain', 'Region', 'Zinc finger', 'DNA binding', 'Transmembrane', 'Repeat'].includes(f.type) && Number.isFinite(f.start)),
    variants: feats.filter((f) => f.type === 'Natural variant' && Number.isFinite(f.start)),
  };
}

export async function uniprotSearchGene(symbol: string): Promise<{ accession: string; proteinName: string; ensemblGene?: string } | null> {
  const url = `https://rest.uniprot.org/uniprotkb/search?query=${enc(`gene_exact:${symbol} AND organism_id:9606 AND reviewed:true`)}&fields=accession,protein_name,gene_primary,xref_ensembl&format=json&size=1`;
  const j = await cachedJson<{ results: { primaryAccession: string; proteinDescription?: { recommendedName?: { fullName?: { value: string } } }; uniProtKBCrossReferences?: { database: string; properties?: { key: string; value: string }[] }[] }[] }>(url, {}, { source: 'UniProtKB' });
  const r = j.results?.[0];
  if (!r) return null;
  const ens = r.uniProtKBCrossReferences?.find((x) => x.database === 'Ensembl')?.properties?.find((p) => p.key === 'GeneId')?.value?.split('.')[0];
  return { accession: r.primaryAccession, proteinName: r.proteinDescription?.recommendedName?.fullName?.value ?? '', ensemblGene: ens };
}

// ───────────────────────── 4. RCSB PDB ─────────────────────────

export interface PdbEntry { id: string; title: string; method: string; resolution: number | null; releaseDate?: string }
export async function rcsbEntry(pdbId: string): Promise<PdbEntry> {
  const j = await cachedJson<{ struct?: { title: string }; exptl?: { method: string }[]; rcsb_entry_info?: { resolution_combined?: number[] }; rcsb_accession_info?: { initial_release_date?: string } }>(
    `https://data.rcsb.org/rest/v1/core/entry/${enc(pdbId)}`, {}, { source: 'RCSB PDB' });
  return { id: pdbId.toUpperCase(), title: j.struct?.title ?? '', method: j.exptl?.[0]?.method ?? '', resolution: j.rcsb_entry_info?.resolution_combined?.[0] ?? null, releaseDate: j.rcsb_accession_info?.initial_release_date };
}

/** Best (highest-resolution) experimental entries mapped to a UniProt accession. */
export async function rcsbSearchByUniprot(acc: string, rows = 5): Promise<string[]> {
  const body = {
    query: { type: 'terminal', service: 'text', parameters: { attribute: 'rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession', operator: 'exact_match', value: acc } },
    return_type: 'entry',
    request_options: { sort: [{ sort_by: 'rcsb_entry_info.resolution_combined', direction: 'asc' }], paginate: { start: 0, rows } },
  };
  const j = await cachedJson<{ result_set?: { identifier: string }[] } | null>('https://search.rcsb.org/rcsbsearch/v2/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { source: 'RCSB Search' });
  return j?.result_set?.map((r) => r.identifier) ?? [];
}

// ───────────────────────── 5. gnomAD v4 constraint ─────────────────────────

export interface Constraint { exp_lof: number; obs_lof: number; oe_lof: number; oe_lof_lower: number; oe_lof_upper: number; pli: number; mis_z: number; syn_z: number; oe_mis: number }
export async function gnomadConstraint(symbol: string): Promise<Constraint | null> {
  const mk = (pli: string) => `query($s:String!){ gene(gene_symbol:$s, reference_genome:GRCh38){ gnomad_constraint{ exp_lof obs_lof oe_lof oe_lof_lower oe_lof_upper ${pli} mis_z syn_z oe_mis } } }`;
  type R = { data?: { gene: { gnomad_constraint: Record<string, number> | null } | null }; errors?: { message: string }[] };
  const run = (q: string) => cachedJson<R>('https://gnomad.broadinstitute.org/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: { s: symbol } }) }, { source: 'gnomAD' });
  let j = await run(mk('pli'));
  if (j.errors?.length && !j.data?.gene) j = await run(mk('pLI')); // field-casing guard across API versions
  if (j.errors?.length && !j.data?.gene) throw new ApiError('gnomAD', j.errors[0].message);
  const c = j.data?.gene?.gnomad_constraint;
  if (!c) return null;
  return { ...(c as unknown as Constraint), pli: c.pli ?? c.pLI };
}

// ───────────────────────── 6. NCBI ClinVar ─────────────────────────

export interface ClinVarVariant { uid: string; title: string; significance: string; reviewStatus: string; stars: number; traits: string[]; grch38: string; proteinChange: string; residue: number | null }

export function reviewStars(status: string): number {
  const s = status.toLowerCase();
  if (s.includes('practice guideline')) return 4;
  if (s.includes('expert panel')) return 3;
  if (s.includes('multiple submitters') && s.includes('no conflicts')) return 2;
  if (s.includes('single submitter') || s.includes('conflicting')) return 1;
  return 0;
}

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const AA3: Record<string, string> = { Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C', Gln: 'Q', Glu: 'E', Gly: 'G', His: 'H', Ile: 'I', Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P', Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V', Ter: '*' };

export async function clinvarPathogenic(symbol: string, retmax = 25): Promise<{ total: number; variants: ClinVarVariant[] }> {
  const term = `${symbol}[gene] AND ("clinsig pathogenic"[Properties] OR "clinsig likely pathogenic"[Properties]) AND "single gene"[Properties]`;
  const s = await cachedJson<{ esearchresult: { count: string; idlist: string[] } }>(`${EUTILS}/esearch.fcgi?db=clinvar&retmode=json&retmax=${retmax}&term=${enc(term)}`, {}, { source: 'NCBI ClinVar' });
  const ids = s.esearchresult.idlist;
  if (!ids.length) return { total: 0, variants: [] };
  type Doc = {
    uid: string; title: string; protein_change?: string;
    germline_classification?: { description: string; review_status: string; trait_set?: { trait_name: string }[] };
    clinical_significance?: { description: string; review_status: string };
    trait_set?: { trait_name: string }[];
    variation_set?: { canonical_spdi?: string; variation_loc?: { assembly_name: string; chr: string; start: string; stop: string; status?: string }[] }[];
  };
  const sum = await cachedJson<{ result: Record<string, Doc> & { uids: string[] } }>(`${EUTILS}/esummary.fcgi?db=clinvar&retmode=json&id=${ids.join(',')}`, {}, { source: 'NCBI ClinVar' });
  const variants = sum.result.uids.map((uid) => {
    const d = sum.result[uid] as Doc;
    const cls = d.germline_classification ?? d.clinical_significance ?? { description: '', review_status: '' };
    const traits = (d.germline_classification?.trait_set ?? d.trait_set ?? []).map((t) => t.trait_name).filter(Boolean);
    const vs = d.variation_set?.[0];
    let grch38 = '';
    const spdi = vs?.canonical_spdi?.match(/^NC_0000(\d{2})\.\d+:(\d+):([ACGTN]*):([ACGTN]*)$/);
    if (spdi) {
      const chr = String(Number(spdi[1])).replace('23', 'X').replace('24', 'Y');
      grch38 = `chr${chr}:${Number(spdi[2]) + 1}:${spdi[3] || '-'}>${spdi[4] || '-'}`;
    } else {
      const loc = vs?.variation_loc?.find((l) => l.assembly_name === 'GRCh38' && (l.status ?? 'current') === 'current');
      if (loc) grch38 = `chr${loc.chr}:${loc.start}${loc.stop !== loc.start ? `-${loc.stop}` : ''}`;
    }
    const pm = d.title.match(/\(p\.([A-Z][a-z]{2})(\d+)([A-Z][a-z]{2}|Ter|=|fs|\*)/);
    const residue = pm ? Number(pm[2]) : null;
    const proteinChange = pm ? `${AA3[pm[1]] ?? pm[1]}${pm[2]}${AA3[pm[3]] ?? pm[3]}` : d.protein_change?.split(',')[0] ?? '';
    return { uid, title: d.title, significance: cls.description, reviewStatus: cls.review_status, stars: reviewStars(cls.review_status), traits, grch38, proteinChange, residue };
  });
  return { total: Number(s.esearchresult.count), variants };
}

// ───────────────────────── 7. AlphaGenome Atlas deep links ─────────────────────────

export const ALPHAGENOME_ATLAS = 'https://deepmind.google.com/science/alphagenome/atlas';
const VCF_RE = /^chr([0-9]{1,2}|X|Y|M):(\d+):([ACGTN]+)>([ACGTN]+)$/;
const LOCUS_RE = /^chr([0-9]{1,2}|X|Y|M):(\d+)-(\d+)$/;

export function validateVariant(v: string) { return VCF_RE.test(v); }
export function validateLocus(l: string) { const m = l.match(LOCUS_RE); return !!m && Number(m[3]) > Number(m[2]); }

export interface AtlasLinkInput { mode: 'variant' | 'locus'; value: string; biosample: Biosample; modalities: Modality[]; tfs?: string[] }

/** Build a validated AlphaGenome Atlas deep link. Throws on malformed coordinates. */
export function buildAlphaGenomeLink(i: AtlasLinkInput): string {
  if (i.mode === 'variant' && !validateVariant(i.value)) throw new Error('Variant must look like chr17:7674216:C>A (GRCh38)');
  if (i.mode === 'locus' && !validateLocus(i.value)) throw new Error('Locus must look like chr17:7661779-7687538 (GRCh38, start < end)');
  if (!i.modalities.length) throw new Error('Pick at least one modality');
  const p = new URLSearchParams();
  p.set('m', i.mode);
  p.set(i.mode === 'variant' ? 'variant' : 'locus', i.value);
  p.set('assembly', 'hg38');
  p.set('biosample', i.biosample);
  p.set('modalities', i.modalities.join(','));
  if (i.modalities.includes('CHIP_TF') && i.tfs?.length) p.set('tfs', i.tfs.join(','));
  return `${ALPHAGENOME_ATLAS}?${p.toString()}`;
}

// ───────────────────────── Ensembl Variant Recoder (hotspot coordinate verification) ─────────────────────────

export async function ensemblVcf(hgvsOrRsid: string): Promise<string[]> {
  const j = await cachedJson<Record<string, { vcf_string?: string[] }>[]>(
    `https://rest.ensembl.org/variant_recoder/human/${enc(hgvsOrRsid)}?vcf_string=1&content-type=application/json`, {}, { source: 'Ensembl' });
  const out = new Set<string>();
  j.forEach((entry) => Object.values(entry).forEach((v) => v?.vcf_string?.forEach((s) => {
    const m = s.match(/^([0-9]{1,2}|X|Y|MT)-(\d+)-([ACGTN]+)-([ACGTN]+)$/); // primary-assembly chromosomes only (skip LRG_* coordinates)
    if (m) out.add(`chr${m[1] === 'MT' ? 'M' : m[1]}:${m[2]}:${m[3]}>${m[4]}`);
  })));
  return [...out];
}

// ───────────────────────── 8. PubChem PUG REST + openFDA FAERS ─────────────────────────

export interface ChemProps { cid: number; formula: string; mw: number; xlogp: number | null; tpsa: number; hbd: number; hba: number; rotb: number; iupac: string; smiles?: string }
export interface DrugLikeness { lipinskiViolations: number; lipinskiPass: boolean; veberPass: boolean }

export async function pubchemCid(name: string): Promise<number | null> {
  try {
    const j = await cachedJson<{ IdentifierList?: { CID: number[] } }>(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${enc(name)}/cids/JSON`, {}, { source: 'PubChem' });
    return j.IdentifierList?.CID?.[0] ?? null;
  } catch { return null; }
}

export async function pubchemProps(cid: number): Promise<ChemProps> {
  const fields = 'MolecularFormula,MolecularWeight,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,IUPACName,SMILES';
  const j = await cachedJson<{ PropertyTable: { Properties: Record<string, string | number>[] } }>(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${fields}/JSON`, {}, { source: 'PubChem' });
  const p = j.PropertyTable.Properties[0];
  return {
    cid, formula: String(p.MolecularFormula ?? ''), mw: Number(p.MolecularWeight), xlogp: p.XLogP != null ? Number(p.XLogP) : null, tpsa: Number(p.TPSA),
    hbd: Number(p.HBondDonorCount), hba: Number(p.HBondAcceptorCount), rotb: Number(p.RotatableBondCount), iupac: String(p.IUPACName ?? ''), smiles: p.SMILES ? String(p.SMILES) : undefined,
  };
}

export const pubchemPngUrl = (cid: number, size = 320) => `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=${size}x${size}`;

export function drugLikeness(c: ChemProps): DrugLikeness {
  const v = [c.mw > 500, (c.xlogp ?? 0) > 5, c.hbd > 5, c.hba > 10].filter(Boolean).length;
  return { lipinskiViolations: v, lipinskiPass: v <= 1, veberPass: c.rotb <= 10 && c.tpsa <= 140 };
}

export interface AdverseEvent { term: string; count: number }
export async function faersTopEvents(drug: string, limit = 12): Promise<AdverseEvent[]> {
  // Many reports lack openfda harmonization (e.g. lenvatinib), so also match the active substance.
  const d = drug.toLowerCase();
  const q = `(patient.drug.activesubstance.activesubstancename:"${d}" patient.drug.openfda.generic_name:"${d}")`;
  const url = `https://api.fda.gov/drug/event.json?search=${enc(q)}&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`;
  try {
    const j = await cachedJson<{ results: { term: string; count: number }[] }>(url, {}, { source: 'openFDA' });
    return j.results;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return []; // openFDA returns 404 for "no matches"
    throw e;
  }
}

// ───────────────────────── 9. ChEMBL ─────────────────────────

export interface ChemblActivity { molecule: string; moleculeName: string | null; target: string; targetName: string; type: string; value: number | null; units: string; pchembl: number | null; assay: string; year: number | null }

export async function chemblActivities(filter: { target?: string; molecules?: string[] }, limit = 25): Promise<ChemblActivity[]> {
  const p = new URLSearchParams({ format: 'json', limit: String(limit), pchembl_value__isnull: 'false', standard_type__in: 'IC50,Ki,Kd', order_by: '-pchembl_value' });
  if (filter.target) p.set('target_chembl_id', filter.target);
  if (filter.molecules?.length) p.set('molecule_chembl_id__in', [...new Set(filter.molecules)].join(','));
  type Raw = { activities: { molecule_chembl_id: string; molecule_pref_name: string | null; target_chembl_id: string; target_pref_name: string; standard_type: string; standard_value: string | null; standard_units: string; pchembl_value: string | null; assay_chembl_id: string; document_year: number | null }[] };
  const j = await cachedJson<Raw>(`https://www.ebi.ac.uk/chembl/api/data/activity.json?${p}`, {}, { source: 'ChEMBL', timeoutMs: 30000 });
  return j.activities.map((a) => ({
    molecule: a.molecule_chembl_id, moleculeName: a.molecule_pref_name, target: a.target_chembl_id, targetName: a.target_pref_name, type: a.standard_type,
    value: a.standard_value != null ? Number(a.standard_value) : null, units: a.standard_units ?? '', pchembl: a.pchembl_value != null ? Number(a.pchembl_value) : null,
    assay: a.assay_chembl_id, year: a.document_year,
  }));
}

export async function chemblTargetForUniprot(acc: string): Promise<string | null> {
  const j = await cachedJson<{ targets: { target_chembl_id: string; target_type: string; organism: string }[] }>(
    `https://www.ebi.ac.uk/chembl/api/data/target.json?format=json&target_components__accession=${enc(acc)}&target_type=SINGLE%20PROTEIN`, {}, { source: 'ChEMBL', retries: 1, timeoutMs: 8000 });
  return j.targets.find((t) => t.organism === 'Homo sapiens')?.target_chembl_id ?? j.targets[0]?.target_chembl_id ?? null;
}

export async function chemblMoleculeByName(name: string): Promise<string | null> {
  const j = await cachedJson<{ molecules: { molecule_chembl_id: string }[] }>(`https://www.ebi.ac.uk/chembl/api/data/molecule.json?format=json&pref_name__iexact=${enc(name)}`, {}, { source: 'ChEMBL', retries: 1, timeoutMs: 8000 });
  return j.molecules[0]?.molecule_chembl_id ?? null;
}

// ───────────────────────── 10. Reactome AnalysisService ─────────────────────────

export interface ReactomePathway { stId: string; name: string; found: number; total: number; ratio: number; pValue: number; fdr: number; enrichment: number; genes: string[] }

export async function reactomeEnrichment(identifiers: string[], top = 15): Promise<{ token: string; inputSize: number; notFound: number; pathways: ReactomePathway[] }> {
  const url = 'https://reactome.org/AnalysisService/identifiers/projection?interactors=false&pageSize=' + top + '&page=1&sortBy=ENTITIES_FDR&order=ASC&resource=TOTAL&species=Homo%20sapiens';
  type Raw = { summary: { token: string }; identifiersNotFound?: number; pathwaysFound?: number; pathways: { stId: string; name: string; entities: { found: number; total: number; ratio: number; pValue: number; fdr: number } }[] };
  const j = await cachedJson<Raw>(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: identifiers.join('\n') }, { source: 'Reactome' });
  const inputSize = identifiers.length - (j.identifiersNotFound ?? 0);
  const pathways = j.pathways.map((p) => ({
    stId: p.stId, name: p.name, found: p.entities.found, total: p.entities.total, ratio: p.entities.ratio, pValue: p.entities.pValue, fdr: p.entities.fdr,
    enrichment: p.entities.ratio > 0 && inputSize > 0 ? p.entities.found / inputSize / p.entities.ratio : 0, genes: [] as string[],
  }));
  return { token: j.summary.token, inputSize, notFound: j.identifiersNotFound ?? 0, pathways };
}

export async function reactomeFoundGenes(token: string, stId: string): Promise<string[]> {
  const j = await cachedJson<{ entities?: { id: string }[] }>(`https://reactome.org/AnalysisService/token/${enc(token)}/found/all/${enc(stId)}?resource=TOTAL`, {}, { source: 'Reactome' });
  return Array.from(new Set((j.entities ?? []).map((e) => e.id.toUpperCase())));
}

// ───────────────────────── 11. STRING v12 ─────────────────────────

export interface StringEdge { a: string; b: string; score: number; escore: number; dscore: number; tscore: number; ascore: number }
type StringRaw = { preferredName_A: string; preferredName_B: string; score: number; escore: number; dscore: number; tscore: number; ascore: number }[];
const toEdges = (r: StringRaw): StringEdge[] => r.map((x) => ({ a: x.preferredName_A, b: x.preferredName_B, score: x.score, escore: x.escore, dscore: x.dscore, tscore: x.tscore, ascore: x.ascore }));

export async function stringPartners(symbol: string, limit = 15): Promise<StringEdge[]> {
  const url = `https://string-db.org/api/json/interaction_partners?identifiers=${enc(symbol)}&species=9606&required_score=700&limit=${limit}&caller_identity=hepatoscope`;
  return toEdges(await cachedJson<StringRaw>(url, {}, { source: 'STRING' }));
}

export async function stringNetwork(symbols: string[]): Promise<StringEdge[]> {
  const url = `https://string-db.org/api/json/network?identifiers=${enc(symbols.join('\r'))}&species=9606&required_score=700&caller_identity=hepatoscope`;
  return toEdges(await cachedJson<StringRaw>(url, {}, { source: 'STRING' }));
}

// ───────────────────────── 12a. GTEx Portal v2 ─────────────────────────

export interface TissueExpr { tissue: string; tissueId: string; median: number }
export async function gtexMedianExpression(symbol: string): Promise<{ gencodeId: string; rows: TissueExpr[] }> {
  const g = await cachedJson<{ data: { gencodeId: string; geneSymbol: string }[] }>(`https://gtexportal.org/api/v2/reference/gene?geneId=${enc(symbol)}&gencodeVersion=v39&genomeBuild=GRCh38%2Fhg38`, {}, { source: 'GTEx' });
  const gencodeId = g.data.find((d) => d.geneSymbol.toUpperCase() === symbol.toUpperCase())?.gencodeId ?? g.data[0]?.gencodeId;
  if (!gencodeId) throw new ApiError('GTEx', `no GENCODE v39 id for ${symbol}`);
  const e = await cachedJson<{ data: { tissueSiteDetailId: string; median: number }[] }>(`https://gtexportal.org/api/v2/expression/medianGeneExpression?gencodeId=${enc(gencodeId)}&datasetId=gtex_v10`, {}, { source: 'GTEx' });
  const rows = e.data.map((d) => ({ tissueId: d.tissueSiteDetailId, tissue: d.tissueSiteDetailId.replace(/_/g, ' ').replace(/ - /g, ' – '), median: d.median })).sort((a, b) => b.median - a.median);
  return { gencodeId, rows };
}

// ───────────────────────── 12b. ClinicalTrials.gov v2 ─────────────────────────

export interface Trial { nct: string; title: string; status: string; phases: string[]; sponsor: string; start?: string; conditions: string[]; interventions: string[] }
export async function clinicalTrials(q: { condition: string; term?: string; intervention?: string }, pageSize = 20): Promise<{ total: number; trials: Trial[] }> {
  const p = new URLSearchParams({ 'query.cond': q.condition, pageSize: String(pageSize), countTotal: 'true', 'filter.overallStatus': 'RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING,ENROLLING_BY_INVITATION', sort: 'LastUpdatePostDate:desc' });
  if (q.term) p.set('query.term', q.term);
  if (q.intervention) p.set('query.intr', q.intervention);
  type Raw = { totalCount?: number; studies: { protocolSection: { identificationModule: { nctId: string; briefTitle: string }; statusModule: { overallStatus: string; startDateStruct?: { date: string } }; designModule?: { phases?: string[] }; sponsorCollaboratorsModule?: { leadSponsor?: { name: string } }; conditionsModule?: { conditions?: string[] }; armsInterventionsModule?: { interventions?: { name: string }[] } } }[] };
  const j = await cachedJson<Raw>(`https://clinicaltrials.gov/api/v2/studies?${p}`, {}, { source: 'ClinicalTrials.gov' });
  return {
    total: j.totalCount ?? j.studies.length,
    trials: j.studies.map(({ protocolSection: s }) => ({
      nct: s.identificationModule.nctId, title: s.identificationModule.briefTitle, status: s.statusModule.overallStatus, phases: s.designModule?.phases ?? [],
      sponsor: s.sponsorCollaboratorsModule?.leadSponsor?.name ?? '', start: s.statusModule.startDateStruct?.date, conditions: s.conditionsModule?.conditions ?? [],
      interventions: (s.armsInterventionsModule?.interventions ?? []).map((i) => i.name),
    })),
  };
}

// ───────────────────────── 12c. Europe PMC ─────────────────────────

export interface Article { id: string; title: string; authors: string; journal: string; year: string; cited: number; pmid?: string; doi?: string }
export async function europePmc(query: string, pageSize = 15): Promise<{ total: number; articles: Article[] }> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${enc(query)}&format=json&resultType=lite&pageSize=${pageSize}&sort=${enc('CITED desc')}`;
  type Raw = { hitCount: number; resultList: { result: { id: string; title: string; authorString?: string; journalTitle?: string; pubYear?: string; citedByCount?: number; pmid?: string; doi?: string }[] } };
  const j = await cachedJson<Raw>(url, {}, { source: 'Europe PMC' });
  return {
    total: j.hitCount,
    articles: j.resultList.result.map((r) => ({ id: r.id, title: r.title, authors: r.authorString ?? '', journal: r.journalTitle ?? '', year: r.pubYear ?? '', cited: r.citedByCount ?? 0, pmid: r.pmid, doi: r.doi })),
  };
}

// ───────────────────────── Live gene resolver ─────────────────────────

/** Resolve any HGNC symbol into a full GeneProfile using Open Targets + UniProtKB (+ RCSB/ChEMBL). */
export async function resolveGene(symbolRaw: string): Promise<GeneProfile> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(symbol)) throw new Error('Enter a valid HGNC symbol (e.g. AXIN1)');
  const [ot, up] = await Promise.all([otSearchTarget(symbol).catch(() => null), uniprotSearchGene(symbol)]);
  // (OT search + UniProt are the only blocking lookups)
  if (!up) throw new ApiError('UniProtKB', `no reviewed human entry for ${symbol}`);
  const ensemblId = ot?.id ?? up.ensemblGene;
  if (!ensemblId) throw new ApiError('Open Targets', `no Ensembl gene for ${symbol}`);
  // PDB and ChEMBL IDs are optional here (sections re-resolve them), so never let them block the resolver.
  const within = <T,>(p: Promise<T>, ms: number, fallback: T) =>
    Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
  const [target, pdbs, chembl] = await Promise.all([
    within(otTarget(ensemblId), 12000, null),
    within(rcsbSearchByUniprot(up.accession, 1), 5000, [] as string[]),
    within(chemblTargetForUniprot(up.accession), 5000, null as string | null),
  ]);
  const loc = target?.location;
  const extra = CURATED_EXTRAS[target?.symbol ?? symbol] as (typeof CURATED_EXTRAS)[string] | undefined;
  return {
    symbol: target?.symbol ?? symbol, name: target?.name ?? up.proteinName, ensemblId, uniprot: up.accession, pdbId: pdbs[0] ?? null, chemblTarget: chembl,
    locus: loc ? `chr${loc.chromosome}:${loc.start}-${loc.end}` : null, source: 'resolved',
    hotspot: extra?.hotspot ?? null, tfs: extra?.tfs ?? [], alterationNote: extra?.alterationNote,
  };
}
