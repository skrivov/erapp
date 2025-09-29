export type Money = { amount: number; currency: string };
export type Region = "US" | "EU" | "APAC";
export type Department = "engineering" | "sales" | "hr" | "other";
export type Category = "ride_hail" | "travel" | "meals" | "software";

export type LineItem = {
  label: string;
  amount: number;
  currency?: string; // defaults to parent currency
};

export type Expense = {
  dateISO: string;
  country?: string;
  region: Region;
  department?: Department;
  category: Category;
  total: Money;
};

export type RuleEffect = {
  always_require_steps?: string[];
  require_steps_if?: { when: { amount_gt?: Money }; steps: string[] }[];
  skip_steps_below?: { step: string; amount: number; currency: string }[];
  category_routes?: Record<string, string[]>;
};

export type Rule = {
  id: string;
  name: string;
  priority: number;
  effective_from: string;
  effective_to?: string;
  selectors: Partial<{ region: Region; department: Department; category: Category }>;
  effect: RuleEffect;
  comment?: string;
};

export type RuleHit = { ruleId: string; reason: string };

export type Decision = {
  steps: string[];
  skipped: string[];
  ruleHits: RuleHit[];
};

export type ClarificationQuestion =
  | { id: "region"; type: "single"; prompt: string; options: string[] }
  | { id: "department"; type: "single"; prompt: string; options: string[] }
  | { id: "purpose"; type: "single"; prompt: string; options: string[] };

export type ExtractionConfidence = {
  amount: number;
  currency: number;
  dateISO: number;
  country?: number;
  region?: number;
  category?: number;
  inferredDepartment?: number;
};

export type Extraction = {
  amount: number;
  currency: string;
  dateISO: string;
  vendor: string;
  country?: string;
  region?: Region;
  pickupCity?: string;
  category?: Category;
  inferredDepartment?: Department;
  items?: LineItem[];
  confidence: ExtractionConfidence;
};
