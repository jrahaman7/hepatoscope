# HepatoScope — Liver Cancer Multi-Omics Workbench

React 19 · TypeScript · Tailwind CSS v4 · 3Dmol.js · D3.js · Vite

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/ (static; deploy to Vercel/Netlify/S3)
```

## Layout
- `src/services/scienceApi.ts` — every live API client. `fetchWithRetry` (timeout, exponential backoff with jitter on 429/5xx/network) plus a promise-level in-memory session cache (`cachedJson`).
- `src/data/presets.ts` — subtypes (HCC/iCCA/HB), 8 driver genes, 6 drugs, AlphaGenome biosamples/modalities.
- `src/sections/S1…S5` — the five workbench sections; `src/components/ReactomeForceGraph.tsx` — D3 bipartite pathway↔gene graph; `MolViewer.tsx` — 3Dmol viewer.

## Live sources
Open Targets v4 GraphQL · AlphaFold DB · UniProtKB · RCSB PDB Data + Search · gnomAD v4 GraphQL · NCBI ClinVar E-utilities · AlphaGenome Atlas deep links · PubChem PUG REST · openFDA FAERS · ChEMBL · Reactome AnalysisService · STRING v12 · GTEx v2 (gtex_v10, GENCODE v39) · ClinicalTrials.gov v2 · Europe PMC · Ensembl Variant Recoder.

## Self-correcting presets
Preset identifiers are checked live, and the live value wins:
- Hotspot GRCh38 coordinates → Ensembl Variant Recoder (shows *verified / corrected / curated*).
- Gene locus → Open Targets `genomicLocation`.
- ChEMBL target → ChEMBL target search by UniProt accession; best PDB entry → RCSB Search when the preset has none.
- Drug ChEMBL ID and PubChem CID → name lookups.

## Notes
- AlphaGenome Atlas: `m=variant|locus` comes from the spec; the other query keys (`variant`, `locus`, `assembly`, `biosample`, `modalities`, `tfs`) are HepatoScope conventions and should be checked against the live Atlas.
- Reactome analysis is target-focused: the target plus its STRING partners with score ≥ 0.700 are submitted. P1–P5 favor pathways that contain the target.
- Research use only.
