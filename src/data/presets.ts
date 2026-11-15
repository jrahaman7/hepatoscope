// HepatoScope curated presets.
// Every identifier here is a *starting point*: the app re-resolves Ensembl locus,
// ChEMBL target, best PDB entry and hotspot GRCh38 coordinates live at runtime
// (Open Targets / ChEMBL / RCSB Search / Ensembl Variant Recoder) and flags any mismatch.

export type SubtypeKey = 'HCC' | 'iCCA' | 'HB';

export interface Subtype {
  key: SubtypeKey;
  label: string;
  efoId: string;
  ctCondition: string; // ClinicalTrials.gov condition string
  epmcTerm: string; // Europe PMC query term
}

export const SUBTYPES: Subtype[] = [
  { key: 'HCC', label: 'Hepatocellular Carcinoma', efoId: 'EFO_0000182', ctCondition: 'Hepatocellular Carcinoma', epmcTerm: '"hepatocellular carcinoma"' },
  { key: 'iCCA', label: 'Intrahepatic Cholangiocarcinoma', efoId: 'EFO_0005221', ctCondition: 'Intrahepatic Cholangiocarcinoma', epmcTerm: '"intrahepatic cholangiocarcinoma"' },
  { key: 'HB', label: 'Hepatoblastoma', efoId: 'EFO_0000526', ctCondition: 'Hepatoblastoma', epmcTerm: 'hepatoblastoma' },
];

export interface Hotspot {
  label: string; // e.g. "R249S"
  kind: 'coding' | 'regulatory' | 'truncating' | 'germline-modifier';
  residue: number | null; // protein position for 3D / lollipop highlight
  hgvs: string; // HGVS/rsID sent to Ensembl Variant Recoder for live GRCh38 resolution
  vcf: string | null; // curated GRCh38 chr:pos:ref>alt (null = resolve live)
  note: string;
}

export interface GeneProfile {
  symbol: string;
  name: string;
  ensemblId: string;
  uniprot: string;
  pdbId: string | null;
  chemblTarget: string | null;
  locus: string | null; // GRCh38 chrN:start-end
  hotspot: Hotspot | null;
  tfs: string[];
  source: 'preset' | 'resolved';
}

export const GENE_PRESETS: GeneProfile[] = [
  {
    symbol: 'TP53', name: 'Tumor protein p53', ensemblId: 'ENSG00000141510', uniprot: 'P04637', pdbId: '2OCJ',
    chemblTarget: 'CHEMBL4096', locus: 'chr17:7661779-7687538',
    hotspot: { label: 'R249S', kind: 'coding', residue: 249, hgvs: 'NM_000546.6:c.747G>T', vcf: 'chr17:7674216:C>A',
      note: 'Aflatoxin B1 signature hotspot (AGG→AGT) in HCC from high-exposure regions.' },
    tfs: ['E2F1', 'YY1', 'HOXA5'], source: 'preset',
  },
  {
    symbol: 'CTNNB1', name: 'Catenin beta 1', ensemblId: 'ENSG00000168036', uniprot: 'P35222', pdbId: '1JDH',
    chemblTarget: 'CHEMBL5866', locus: 'chr3:41194837-41260096',
    hotspot: { label: 'S45P', kind: 'coding', residue: 45, hgvs: 'NM_001904.4:c.133T>C', vcf: 'chr3:41224645:T>C',
      note: 'Exon 3 degron mutation blocking CK1α priming phosphorylation; Wnt-active HCC and hepatoblastoma.' },
    tfs: ['TCF7L2', 'LEF1', 'HNF4A'], source: 'preset',
  },
  {
    symbol: 'TERT', name: 'Telomerase reverse transcriptase', ensemblId: 'ENSG00000164362', uniprot: 'O14746', pdbId: '7BG9',
    chemblTarget: 'CHEMBL2916', locus: 'chr5:1253147-1295068',
    hotspot: { label: 'C228T (promoter)', kind: 'regulatory', residue: null, hgvs: 'NC_000005.10:g.1295113G>A', vcf: 'chr5:1295113:G>A',
      note: 'Most frequent somatic alteration in HCC (~60%); creates a de novo GABPA/ETS binding site.' },
    tfs: ['GABPA', 'MYC', 'SP1'], source: 'preset',
  },
  {
    symbol: 'MET', name: 'MET proto-oncogene, receptor tyrosine kinase', ensemblId: 'ENSG00000105976', uniprot: 'P08581', pdbId: '2WGJ',
    chemblTarget: 'CHEMBL3717', locus: 'chr7:116672196-116798377',
    hotspot: null, tfs: ['ETS1', 'SP1', 'HIF1A'], source: 'preset',
  },
  {
    symbol: 'VEGFA', name: 'Vascular endothelial growth factor A', ensemblId: 'ENSG00000112715', uniprot: 'P15692', pdbId: '2VPF',
    chemblTarget: 'CHEMBL1783', locus: 'chr6:43770209-43786487',
    hotspot: { label: 'rs699947 (−2578C>A)', kind: 'regulatory', residue: null, hgvs: 'rs699947', vcf: 'chr6:43768652:C>A',
      note: 'Promoter polymorphism linked to VEGF expression; 6p21 VEGFA amplification marks sorafenib-responsive HCC.' },
    tfs: ['HIF1A', 'EPAS1', 'SP1'], source: 'preset',
  },
  {
    symbol: 'FGFR4', name: 'Fibroblast growth factor receptor 4', ensemblId: 'ENSG00000160867', uniprot: 'P22455', pdbId: '4XCU',
    chemblTarget: 'CHEMBL3973', locus: 'chr5:177086886-177098144',
    hotspot: { label: 'G388R', kind: 'germline-modifier', residue: 388, hgvs: 'rs351855', vcf: 'chr5:177093242:G>A',
      note: 'Transmembrane variant associated with HCC progression; FGF19–FGFR4 axis is a druggable HCC dependency.' },
    tfs: ['HNF4A', 'FOXA2', 'HNF1A'], source: 'preset',
  },
  {
    symbol: 'ARID1A', name: 'AT-rich interaction domain 1A', ensemblId: 'ENSG00000117713', uniprot: 'O14497', pdbId: null,
    chemblTarget: null, locus: 'chr1:26693236-26782104',
    hotspot: { label: 'R1989*', kind: 'truncating', residue: 1989, hgvs: 'NM_006015.6:c.5965C>T', vcf: null,
      note: 'Recurrent truncating SWI/SNF mutation; ARID1A loss is frequent in HCC and iCCA.' },
    tfs: ['SP1', 'MYC', 'YY1'], source: 'preset',
  },
  {
    symbol: 'GPC3', name: 'Glypican 3', ensemblId: 'ENSG00000147257', uniprot: 'P51654', pdbId: null,
    chemblTarget: null, locus: 'chrX:133535745-133985594',
    hotspot: null, tfs: ['ZBTB20', 'HNF1A', 'TCF7L2'], source: 'preset',
  },
];

export interface DrugPreset {
  name: string;
  chemblId: string;
  pubchemCid: number;
  moa: string;
  trial: { name: string; nct: string };
  indication: string;
}

export const DRUG_PRESETS: DrugPreset[] = [
  { name: 'Sorafenib', chemblId: 'CHEMBL1336', pubchemCid: 216239, moa: 'Multikinase inhibitor (VEGFR1–3, PDGFRβ, RAF)', trial: { name: 'SHARP', nct: 'NCT00105443' }, indication: 'Advanced HCC (1L)' },
  { name: 'Lenvatinib', chemblId: 'CHEMBL1289601', pubchemCid: 9823820, moa: 'Multikinase inhibitor (VEGFR1–3, FGFR1–4, PDGFRα, RET, KIT)', trial: { name: 'REFLECT', nct: 'NCT01761266' }, indication: 'Advanced HCC (1L)' },
  { name: 'Regorafenib', chemblId: 'CHEMBL1946170', pubchemCid: 11167602, moa: 'Multikinase inhibitor (VEGFR, TIE2, RAF, KIT)', trial: { name: 'RESORCE', nct: 'NCT01774344' }, indication: 'HCC after sorafenib (2L)' },
  { name: 'Cabozantinib', chemblId: 'CHEMBL2105717', pubchemCid: 25102847, moa: 'MET / VEGFR2 / AXL inhibitor', trial: { name: 'CELESTIAL', nct: 'NCT01908426' }, indication: 'HCC after sorafenib (2L)' },
  { name: 'Pemigatinib', chemblId: 'CHEMBL4297522', pubchemCid: 86705695, moa: 'Selective FGFR1–3 inhibitor', trial: { name: 'FIGHT-202', nct: 'NCT02924376' }, indication: 'FGFR2-fusion cholangiocarcinoma' },
  { name: 'Ivosidenib', chemblId: 'CHEMBL3989958', pubchemCid: 71657455, moa: 'Mutant IDH1 inhibitor', trial: { name: 'ClarIDHy', nct: 'NCT02989857' }, indication: 'IDH1-mutant cholangiocarcinoma' },
];

export const BIOSAMPLES = ['HepG2', 'Liver', 'K562', 'GM12878'] as const;
export const MODALITIES = ['RNA_SEQ', 'DNASE', 'CHIP_TF', 'ATAC', 'CAGE', 'SPLICE_JUNCTIONS'] as const;
export type Biosample = (typeof BIOSAMPLES)[number];
export type Modality = (typeof MODALITIES)[number];
