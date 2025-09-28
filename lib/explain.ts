import { Decision, RuleHit, Expense } from "./types";

export function buildExplanation(
  decision: Decision,
  expense: Expense,
  ruleHits: RuleHit[]
): string {
  const stepList = decision.steps.length ? decision.steps.join(", ") : "no approvers";
  const skippedList = decision.skipped.length ? decision.skipped.join(", ") : "none";
  const hitSummary = ruleHits
    .map((hit) => `${hit.ruleId} (${hit.reason})`)
    .join("; ");

  return `For the ${expense.region} ${expense.category} expense on ${new Date(
    expense.dateISO
  ).toLocaleDateString()}, the workflow includes ${stepList}. Skipped steps: ${skippedList}. Rule hits: ${hitSummary || "n/a"}.`;
}
