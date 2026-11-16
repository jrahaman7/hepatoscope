import type { SubtypeKey } from './presets';

export type EvidenceStatus = 'approved' | 'accelerated' | 'standard' | 'investigational' | 'not-proven' | 'withdrawn';
export type Setting = 'surveillance' | 'curative' | 'locoregional' | 'adjuvant' | 'first-line' | 'later-line' | 'targeted' | 'supportive';

export interface Source { label: string; url: string }

/** Per-100 comparison for icon arrays ("out of 100 people…"). */
export interface IconCompare { caption: string; a: { label: string; n: number }; b?: { label: string; n: number } }

export interface Evidence {
  id: string;
  subtype: SubtypeKey;
  setting: Setting;
  regimen: string;
  trial: string;
  nct?: string;
  population: string;
  result: string; // clinician-facing, exact published numbers
  status: EvidenceStatus;
  regulatory?: string; // e.g. "FDA May 2020"
  plain: string; // patient-facing, ~6th–8th grade
  icons?: IconCompare;
  drug?: string; // matches DRUG_PRESETS name when applicable
  gene?: string; // biomarker gene (FGFR2, IDH1…)
  sources: Source[];
}

export interface Persona {
  id: string;
  name: string; // illustrative, fictional
  age: string;
  subtype: SubtypeKey;
  gene?: string;
  headline: string;
  story: string;
  needs: string[];
  focus: string[]; // journey step ids most relevant
  stage: StageGroup; // which treatment group to show first
}

export type StageGroup = 'all' | 'early' | 'liver' | 'advanced';

export interface JourneyStep {
  id: string;
  title: string;
  plain: string;
  plainBy?: Partial<Record<SubtypeKey, string>>; // subtype-specific wording overrides
  clinician: string;
  questions: string[];
  subtypes: SubtypeKey[];
}

export interface Story {
  id: string;
  kind: 'Trial' | 'Real-world' | 'Population' | 'Case series';
  subtype: SubtypeKey;
  title: string;
  text: string;
  caveat: string;
  icons?: IconCompare;
  sources: Source[];
}

export interface UseCase {
  id: string;
  question: string;
  subtype: SubtypeKey;
  gene: string;
  drug?: string;
  answer: string;
  look: string[]; // which workbench sections to read and what for
  sources: Source[];
}

export interface GlossaryItem { term: string; def: string }
export interface Resource { name: string; url: string; offers: string; for: SubtypeKey[] }
