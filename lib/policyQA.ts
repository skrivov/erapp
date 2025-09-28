import { promises as fs } from "fs";
import path from "path";
import { evaluate } from "./evaluate";
import { getActiveRules, loadPolicies } from "./policyLoader";
import { Expense, Rule } from "./types";
import { PolicyEvalSchema } from "../schemas/policyEval.schema";
import type { PolicyEvalSchemaT } from "../schemas/policyEval.schema";
import { getOpenAIClient, getPolicyEvalModel } from "./openaiClient";

const REPORT_PATH = path.join(process.cwd(), "data", "policy_report.md");

export type PolicyEvalConflict = { rules: string[]; description: string };

export type SuggestedTest = {
  name: string;
  expense: Expense;
  expected_steps?: string[];
};

export type PolicyQAResult = {
  warnings: string[];
  conflicts: PolicyEvalConflict[];
  gaps: string[];
  suggested_tests: SuggestedTest[];
  reportPath: string;
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
            expected_steps: {
              type: "array",
              items: { type: "string" },
            },
            expense: {
              type: "object",
              additionalProperties: false,
              required: ["dateISO", "region", "category", "total"],
              properties: {
                dateISO: { type: "string" },
                region: { type: "string", enum: ["US", "EU", "APAC"] },
                department: {
                  type: "string",
                  enum: ["engineering", "sales", "hr", "other"],
                },
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

async function callPolicyEvalLLM(policies: Rule[]): Promise<PolicyEvalSchemaT> {
  const client = getOpenAIClient();
  const model = getPolicyEvalModel();

  const policyJson = JSON.stringify(policies, null, 2);
  const systemPrompt = `You are a finance policy QA reviewer. Analyse file-backed expense approval rules defined in a deterministic engine.
- Identify overlaps, conflicts, or missing cases using the provided DSL summary.
- Suggest edge-case tests that exercise date boundaries and regional overrides.
- Only respond with JSON matching the supplied schema.
- Keep warnings short and actionable.`;

  const userPrompt = `Policy DSL summary:
Selectors: region (US|EU|APAC), department (engineering|sales|hr|other), category (ride_hail|travel|meals|software).
Effects: always_require_steps, require_steps_if (amount_gt), skip_steps_below, category_routes.
Priority: lower number means higher precedence. Later rules can be more specific overrides. effective_from/to set active range.

Policies JSON:
${policyJson}`;

  const response = await client.responses.create({
    model,
    temperature: 0,
    text: {
      format: {
        type: "json_schema",
        name: policyEvalJsonSchema.name,
        schema: policyEvalJsonSchema.schema,
      },
    },
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const fallbackOutput = (response as any)?.output?.[0]?.content?.[0]?.text?.value;
  const jsonPayload = response.output_text ?? fallbackOutput;
  if (!jsonPayload) {
    throw new Error("OpenAI policy eval returned no JSON output");
  }

  const parsed = JSON.parse(jsonPayload);
  return PolicyEvalSchema.parse(parsed);
}

function rangesOverlap(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null) {
  const aEndVal = aEnd ? aEnd.getTime() : Number.POSITIVE_INFINITY;
  const bEndVal = bEnd ? bEnd.getTime() : Number.POSITIVE_INFINITY;
  return aStart.getTime() <= bEndVal && bStart.getTime() <= aEndVal;
}

function selectorsKey(rule: Rule) {
  return JSON.stringify(rule.selectors ?? {});
}

function collectOverlaps(rules: Rule[]) {
  const conflicts: PolicyEvalConflict[] = [];
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i];
      const b = rules[j];
      if (selectorsKey(a) !== selectorsKey(b)) {
        continue;
      }
      const aStart = new Date(a.effective_from);
      const bStart = new Date(b.effective_from);
      const aEnd = a.effective_to ? new Date(a.effective_to) : null;
      const bEnd = b.effective_to ? new Date(b.effective_to) : null;
      if (rangesOverlap(aStart, aEnd, bStart, bEnd)) {
        conflicts.push({
          rules: [a.id, b.id],
          description: "Overlapping effective range for identical selectors",
        });
      }
    }
  }
  return conflicts;
}

function suggestedTests(): SuggestedTest[] {
  return [
    {
      name: "US ride_hail 2024-09-15 should skip manager",
      expense: {
        dateISO: "2024-09-15T12:00:00.000Z",
        region: "US",
        department: "engineering",
        category: "ride_hail",
        total: { amount: 49, currency: "USD" },
      },
      expected_steps: ["finance"],
    },
    {
      name: "US ride_hail 2024-10-10 should skip manager",
      expense: {
        dateISO: "2024-10-10T12:00:00.000Z",
        region: "US",
        department: "sales",
        category: "ride_hail",
        total: { amount: 74, currency: "USD" },
      },
      expected_steps: ["finance"],
    },
    {
      name: "EU ride_hail €60 should add compliance",
      expense: {
        dateISO: "2025-01-10T12:00:00.000Z",
        region: "EU",
        department: "engineering",
        category: "ride_hail",
        total: { amount: 60, currency: "EUR" },
      },
      expected_steps: ["compliance", "finance"],
    },
  ];
}

export async function runPolicyQA(): Promise<PolicyQAResult> {
  const policies = await loadPolicies();

  let llmResult: PolicyEvalSchemaT | null = null;
  try {
    llmResult = await callPolicyEvalLLM(policies);
  } catch (error) {
    console.error("Policy QA LLM call failed", error);
  }

  const deterministicConflicts = collectOverlaps(policies);
  const deterministicWarnings = deterministicConflicts.length
    ? ["Resolve overlapping rule ranges"]
    : [];

  const warnings = Array.from(
    new Set([...(llmResult?.warnings ?? []), ...deterministicWarnings])
  );

  const conflicts = [...(llmResult?.conflicts ?? []), ...deterministicConflicts];
  const gaps = llmResult?.gaps ?? [];

  const baselineTests = suggestedTests();
  const llmTests = llmResult?.suggested_tests ?? [];
  const combinedTestsMap = new Map<string, SuggestedTest>();

  for (const test of [...baselineTests, ...llmTests]) {
    combinedTestsMap.set(test.name, test);
  }

  const combinedTests = Array.from(combinedTestsMap.values());

  const results = [] as {
    name: string;
    expected?: string[];
    actual: string[];
  }[];

  for (const test of combinedTests) {
    const { active } = await getActiveRules(test.expense.dateISO);
    const decision = evaluate(test.expense, active);
    results.push({ name: test.name, expected: test.expected_steps, actual: decision.steps });
  }

  const reportLines: string[] = [
    "# Policy QA Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Conflicts",
    conflicts.length
      ? conflicts
          .map((conflict) => `- ${conflict.description}: ${conflict.rules.join(", ")}`)
          .join("\n")
      : "- None",
    "",
    "## Suggested Tests",
    ...results.map((result) => {
      const expected = result.expected ? ` expected ${result.expected.join(", ")}` : "";
      return `- ${result.name}: actual ${result.actual.join(", ")}${expected}`;
    }),
  ];

  await fs.writeFile(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");

  return {
    warnings,
    conflicts,
    gaps,
    suggested_tests: combinedTests,
    reportPath: "/data/policy_report.md",
  };
}
