import { NextResponse } from "next/server";
import { ExtractionSchema } from "../../../schemas/extraction.schema";
import { evaluate } from "../../../lib/evaluate";
import { getActiveRules } from "../../../lib/policyLoader";
import { buildExplanation } from "../../../lib/explain";
import { regionFromCountry } from "../../../lib/region";
import { appendAudit } from "../../../lib/audit";
import type { Decision, Expense } from "../../../lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { extraction: rawExtraction, answers = {}, overrides = {} } = body ?? {};

  const parsedExtraction = ExtractionSchema.safeParse(rawExtraction);
  if (!parsedExtraction.success) {
    return NextResponse.json(
      { error: "Invalid extraction payload", details: parsedExtraction.error.format() },
      { status: 422 }
    );
  }
  const extraction = parsedExtraction.data;

  const category = answers.category ?? extraction.category ?? "ride_hail";
  const country = answers.country ?? extraction.pickupCountry;
  const department = answers.department ?? extraction.inferredDepartment;
  const region = overrides.region ?? regionFromCountry(country);

  const expense: Expense = {
    dateISO: extraction.dateISO,
    region,
    department,
    category,
    total: {
      amount: extraction.amount,
      currency: extraction.currency,
    },
  };

  const { active } = await getActiveRules(expense.dateISO);
  const decision: Decision = evaluate(expense, active);
  const explanation = buildExplanation(decision, expense, decision.ruleHits);

  await appendAudit({
    ts: new Date().toISOString(),
    extraction: { confidence: extraction.confidence },
    clarifications: Object.keys(answers).length,
    answers,
    decision,
  });

  return NextResponse.json({
    decision,
    explanation,
  });
}
