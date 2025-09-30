import { Expense, Rule } from "./types";
import { PolicyEvalSchema } from "../schemas/policyEval.schema";
import type { PolicyEvalSchemaT } from "../schemas/policyEval.schema";
import { callPolicyEvalLLM } from "./openaiClient";

export type PolicyEvalConflict = { rules: string[]; description: string };

export type SuggestedTest = {
  name: string;
  expense: Expense;
  expected_steps?: string[];
};

export type TestResult = {
  name: string;
  expected?: string[];
  actual: string[];
  passed: boolean;
};

export type PolicyQAResult = {
  warnings: string[];
  conflicts: PolicyEvalConflict[];
  gaps: string[];
  suggested_tests: SuggestedTest[];
  test_results: TestResult[];
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
  };
};

const policyEvalJsonSchema = {
  name: "PolicyEvalResponse",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["warnings", "conflicts", "gaps", "suggested_tests"],
    properties: {
      warnings: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      conflicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["rules", "description"],
          properties: {
            rules: { type: "array", items: { type: "string" } },
            description: { type: "string" },
          },
        },
      },
      suggested_tests: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "expense"],
          properties: {
            name: { type: "string" },
            expense: {
              type: "object",
              additionalProperties: false,
              required: ["dateISO", "region", "category", "total"],
              properties: {
                dateISO: { type: "string" },
                region: { type: "string", enum: ["US", "EU", "APAC"] },
                category: {
                  type: "string",
                  enum: ["ride_hail", "travel", "meals", "software"],
                },
                total: {
                  type: "object",
                  additionalProperties: false,
                  required: ["amount", "currency"],
                  properties: {
                    amount: { type: "number" },
                    currency: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Ask LLM to analyze policy rules and suggest tests
 */
async function analyzePoliciesWithLLM(
  policies: Rule[],
  modelOverride?: string
): Promise<PolicyEvalSchemaT> {
  const policyJson = JSON.stringify(policies, null, 2);
  const systemPrompt = `You are a high‑reasoning Policy QA analyst.
Your job: read an array of expense policy rules (our DSL), reason about how our deterministic evaluator would fire them, and produce a concise report of potential issues in rule firing.

Focus on:
- Overlaps/contradictions (e.g., conflicting skip vs require thresholds, competing priorities)
- Effective date overlaps or unreachable rules
- Selector/currency mismatches that prevent intended firing
- Ambiguous or missing coverage across regions/categories/departments
- Step routing risks (missing mandatory finance, unintentionally skipped manager, etc.)

Do NOT simulate real approvals; do NOT fabricate decisions. Provide an issue report only.
Output must be valid JSON matching the provided JSON Schema. Keep items short and actionable.`;

  const userPrompt = `INPUT
You will receive only the policies array (no tests will be executed). Use deep reasoning to assess potential issues in how these rules might fire.

Evaluator semantics (deterministic):
- Activate rules where effective_from ≤ date ≤ effective_to? and all non‑empty selectors match exactly.
- Sort by priority ASC; more specific rules do not automatically override, but require vs skip precedence applies: required steps dominate skip thresholds.
- Base chain includes finance by default and manager by default; category_routes and always_require_steps add steps; skip_steps_below can remove a step unless it is required.
- Currency checks are exact; thresholds only apply when expense currency equals the threshold’s currency.
- If multiple skip thresholds exist for a step, use the largest matching threshold.
- Final ordering: ["compliance","hr","it","manager","finance"].

What to return:
- warnings: free‑text issue notes (ambiguous language, unexpected defaults, potential maintenance risks).
- conflicts: specific pairs/groups of rules that could conflict at runtime (rule ids + brief description).
- gaps: areas not covered by any rule (regions/categories/departments/date windows).
- suggested_tests: Optional illustrative examples to clarify edge cases for future QA. If included, omit expected_steps unless you are certain.

Example shape for a suggested test (illustrative only):
{ "name": "Edge: EU ride_hail 75€", "expense": { "dateISO": "2025-01-01T00:00:00Z", "region": "EU", "category": "ride_hail", "total": { "amount": 75, "currency": "EUR" } } }

Return JSON only that conforms to the provided JSON schema. Do not include commentary outside JSON.

Policies JSON to analyze:
${policyJson}`;

  const jsonPayload = await callPolicyEvalLLM({
    schema: policyEvalJsonSchema,
    systemPrompt,
    userPrompt,
    modelOverride,
  });

  const parsed = JSON.parse(jsonPayload);
  return PolicyEvalSchema.parse(parsed);
}

// Deterministic evaluator intentionally not used here; this module focuses solely on LLM QA.

/**
 * Run policy QA analysis using LLM to analyze rules and suggest tests
 * @param policies - Active policy rules from the policy page
 * @param options - Optional configuration
 * @param options.useLLM - Whether to use LLM for analysis (default: true)
 * @param options.modelOverride - Override the default model
 * @returns PolicyQAResult with warnings, conflicts, gaps, and test results
 */
export async function runPolicyQA(
  policies: Rule[],
  options: { useLLM?: boolean; modelOverride?: string } = {}
): Promise<PolicyQAResult> {
  const { useLLM = true, modelOverride } = options;

  if (!useLLM) {
    return {
      warnings: [],
      conflicts: [],
      gaps: [],
      suggested_tests: [],
      test_results: [],
      summary: { total_tests: 0, passed: 0, failed: 0 },
    };
  }

  // Ask LLM to analyze policies
  const llmResult = await analyzePoliciesWithLLM(policies, modelOverride);

  return {
    warnings: llmResult.warnings,
    conflicts: llmResult.conflicts,
    gaps: llmResult.gaps,
    suggested_tests: llmResult.suggested_tests,
    test_results: [],
    summary: {
      total_tests: 0,
      passed: 0,
      failed: 0,
    },
  };
}
