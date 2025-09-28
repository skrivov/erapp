import { Expense, Rule, Decision, RuleHit } from "./types";

const STEP_ORDER = ["compliance", "hr", "it", "manager", "finance"] as const;

type Step = (typeof STEP_ORDER)[number] | string;

type SkipThreshold = { amount: number; currency: string; ruleId: string };

export function evaluate(expense: Expense, rules: Rule[]): Decision {
  const date = new Date(expense.dateISO);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid expense date: ${expense.dateISO}`);
  }

  const activeRules = rules
    .filter((rule) => ruleApplies(rule, expense, date))
    .sort((a, b) => a.priority - b.priority);

  const requiredSteps = new Set<Step>();
  const routedSteps = new Set<Step>();
  const skipThresholds = new Map<Step, SkipThreshold>();
  const ruleHits: RuleHit[] = [];

  for (const rule of activeRules) {
    const { effect } = rule;

    if (effect.always_require_steps) {
      for (const step of effect.always_require_steps) {
        requiredSteps.add(step);
        ruleHits.push({ ruleId: rule.id, reason: "always_require_steps" });
      }
    }

    if (effect.require_steps_if) {
      for (const requirement of effect.require_steps_if) {
        if (
          requirement.when.amount_gt &&
          matchesAmountGreaterThan(expense.total.amount, expense.total.currency, requirement.when.amount_gt)
        ) {
          for (const step of requirement.steps) {
            requiredSteps.add(step);
            ruleHits.push({
              ruleId: rule.id,
              reason: `require_steps_if.amount_gt(>${requirement.when.amount_gt.amount} ${requirement.when.amount_gt.currency})`,
            });
          }
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

    if (effect.skip_steps_below) {
      for (const threshold of effect.skip_steps_below) {
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
  }

  const baseSteps = new Set<Step>();
  for (const step of routedSteps) {
    baseSteps.add(step);
  }
  for (const step of requiredSteps) {
    baseSteps.add(step);
  }

  // finance included by default
  baseSteps.add("finance");
  // manager default for ride_hail flow
  baseSteps.add("manager");

  const includedSteps: Step[] = [];
  const skippedSteps: Step[] = [];

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
      skippedSteps.push(step);
      ruleHits.push({
        ruleId: threshold.ruleId,
        reason: `skip_steps_below(<=${threshold.amount} ${threshold.currency})`,
      });
      continue;
    }
    includedSteps.push(step);
  }

  // ensure any additional routed/required steps not in STEP_ORDER but present are appended.
  for (const step of baseSteps) {
    if (!STEP_ORDER.includes(step as (typeof STEP_ORDER)[number]) && !includedSteps.includes(step)) {
      includedSteps.push(step);
    }
  }

  return {
    steps: includedSteps,
    skipped: skippedSteps,
    ruleHits,
  };
}

function ruleApplies(rule: Rule, expense: Expense, date: Date): boolean {
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

  const selectors = rule.selectors || {};

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

function matchesAmountGreaterThan(
  amount: number,
  currency: string,
  threshold: { amount: number; currency: string }
) {
  if (currency !== threshold.currency) {
    return false;
  }
  return amount > threshold.amount;
}
