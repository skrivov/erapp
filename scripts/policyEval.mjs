import { promises as fs } from "fs";
import path from "path";

const policiesDir = path.join(process.cwd(), "policies");
const reportPath = path.join(process.cwd(), "data", "policy_report.md");

const STEP_ORDER = ["compliance", "hr", "it", "manager", "finance"];

async function loadPolicies() {
  const files = await fs.readdir(policiesDir);
  const jsonFiles = files.filter((file) => file.endsWith(".json") && file !== "categories.json");
  const contents = await Promise.all(
    jsonFiles.map(async (file) => {
      const data = await fs.readFile(path.join(policiesDir, file), "utf8");
      return JSON.parse(data);
    })
  );
  return contents.flat();
}

function ruleApplies(rule, expense, date) {
  const from = new Date(rule.effective_from);
  if (Number.isNaN(from.getTime()) || date < from) {
    return false;
  }
  if (rule.effective_to) {
    const to = new Date(rule.effective_to);
    if (Number.isNaN(to.getTime()) || date > to) {
      return false;
    }
  }
  const selectors = rule.selectors ?? {};
  if (selectors.region && selectors.region !== expense.region) {
    return false;
  }
  if (selectors.department && selectors.department !== expense.department) {
    return false;
  }
  if (selectors.category && selectors.category !== expense.category) {
    return false;
  }
  return true;
}

function matchesAmountGreaterThan(amount, currency, threshold) {
  if (!threshold) {
    return false;
  }
  if (currency !== threshold.currency) {
    return false;
  }
  return amount > threshold.amount;
}

function evaluate(expense, rules) {
  const date = new Date(expense.dateISO);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid expense date: ${expense.dateISO}`);
  }
  const activeRules = rules
    .filter((rule) => ruleApplies(rule, expense, date))
    .sort((a, b) => a.priority - b.priority);

  const requiredSteps = new Set();
  const routedSteps = new Set();
  const skipThresholds = new Map();
  const ruleHits = [];

  for (const rule of activeRules) {
    const effect = rule.effect ?? {};
    for (const step of effect.always_require_steps ?? []) {
      requiredSteps.add(step);
      ruleHits.push({ ruleId: rule.id, reason: "always_require_steps" });
    }
    for (const requirement of effect.require_steps_if ?? []) {
      if (matchesAmountGreaterThan(expense.total.amount, expense.total.currency, requirement.when?.amount_gt)) {
        for (const step of requirement.steps ?? []) {
          requiredSteps.add(step);
          ruleHits.push({
            ruleId: rule.id,
            reason: `require_steps_if.amount_gt(>${requirement.when.amount_gt.amount} ${requirement.when.amount_gt.currency})`,
          });
        }
      }
    }
    if (effect.category_routes) {
      const steps = effect.category_routes[expense.category];
      if (steps) {
        for (const step of steps) {
          routedSteps.add(step);
          ruleHits.push({ ruleId: rule.id, reason: `category_routes.${expense.category}` });
        }
      }
    }
    for (const threshold of effect.skip_steps_below ?? []) {
      if (threshold.currency !== expense.total.currency) {
        continue;
      }
      const existing = skipThresholds.get(threshold.step);
      if (!existing || threshold.amount > existing.amount) {
        skipThresholds.set(threshold.step, {
          amount: threshold.amount,
          currency: threshold.currency,
          ruleId: rule.id,
        });
      }
    }
  }

  const baseSteps = new Set([...requiredSteps, ...routedSteps, "finance", "manager"]);
  const included = [];
  const skipped = [];

  for (const step of STEP_ORDER) {
    if (!baseSteps.has(step)) {
      continue;
    }
    const threshold = skipThresholds.get(step);
    if (
      threshold &&
      !requiredSteps.has(step) &&
      expense.total.currency === threshold.currency &&
      expense.total.amount <= threshold.amount
    ) {
      skipped.push(step);
      ruleHits.push({
        ruleId: threshold.ruleId,
        reason: `skip_steps_below(<=${threshold.amount} ${threshold.currency})`,
      });
      continue;
    }
    included.push(step);
  }

  for (const step of baseSteps) {
    if (!STEP_ORDER.includes(step) && !included.includes(step)) {
      included.push(step);
    }
  }

  return { steps: included, skipped, ruleHits };
}

function collectOverlaps(rules) {
  const conflicts = [];
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i];
      const b = rules[j];
      if (JSON.stringify(a.selectors ?? {}) !== JSON.stringify(b.selectors ?? {})) {
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

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const aEndVal = aEnd ? aEnd.getTime() : Number.POSITIVE_INFINITY;
  const bEndVal = bEnd ? bEnd.getTime() : Number.POSITIVE_INFINITY;
  return aStart.getTime() <= bEndVal && bStart.getTime() <= aEndVal;
}

function suggestedTests() {
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

async function main() {
  const policies = await loadPolicies();
  const conflicts = collectOverlaps(policies);
  const warnings = conflicts.length ? ["Resolve overlapping rule ranges"] : [];
  const gaps = [];
  const tests = suggestedTests();
  const results = [];

  for (const test of tests) {
    const active = policies.filter((rule) => ruleApplies(rule, test.expense, new Date(test.expense.dateISO)));
    const decision = evaluate(test.expense, active);
    results.push({ name: test.name, expected: test.expected_steps, actual: decision.steps });
  }

  const reportLines = [
    "# Policy QA Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Conflicts",
    conflicts.length
      ? conflicts.map((conflict) => `- ${conflict.description}: ${conflict.rules.join(", ")}`).join("\n")
      : "- None",
    "",
    "## Suggested Tests",
    ...results.map((result) => {
      const expected = result.expected ? ` expected ${result.expected.join(", ")}` : "";
      return `- ${result.name}: actual ${result.actual.join(", ")}${expected}`;
    }),
  ];

  await fs.writeFile(reportPath, `${reportLines.join("\n")}\n`, "utf8");

  console.log("policy:eval warnings", warnings.length);
  console.log("policy:eval conflicts", conflicts.length);
  console.log("policy:eval suggested tests", tests.length);
  console.log(`Report written to /data/policy_report.md`);
}

main().catch((error) => {
  console.error("policy:eval failed", error);
  process.exit(1);
});
