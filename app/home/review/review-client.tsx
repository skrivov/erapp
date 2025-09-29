"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClarifierChat } from "../../../components/ClarifierChat";
import { FieldEditor } from "../../../components/FieldEditor";
import { ReceiptPreview } from "../../../components/ReceiptPreview";
import { LineItemsEditor } from "../../../components/LineItemsEditor";
import { DateTimeEditor } from "../../../components/DateTimeEditor";
import { regionFromCountry } from "../../../lib/region";
import type { ClarificationQuestion, Extraction, Expense } from "../../../lib/types";

const REVIEW_KEY = "erca:review";
const DECISION_KEY = "erca:decision";

function parseStored():
  | { extraction: Extraction; needsQuestions: ClarificationQuestion[]; rawText?: string }
  | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = sessionStorage.getItem(REVIEW_KEY);
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored);
    return parsed;
  } catch (error) {
    console.error("Failed to parse review payload", error);
    return null;
  }
}

function sanitizeAnswers(answers: Record<string, string>) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function buildExpense(extraction: Extraction, answers: Record<string, string>): Expense {
  const resolvedCountry = answers.country ?? extraction.pickupCountry ?? "";
  const resolvedDepartment =
    (answers.department ?? extraction.inferredDepartment ?? undefined) as Expense["department"] | undefined;
  const resolvedCategory = (answers.category ?? extraction.category ?? "ride_hail") as Expense["category"];
  const region = regionFromCountry(resolvedCountry);

  return {
    dateISO: extraction.dateISO,
    region,
    department: resolvedDepartment,
    category: resolvedCategory,
    total: {
      amount: extraction.amount,
      currency: extraction.currency,
    },
  };
}

export function ReviewClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<
    | { extraction: Extraction; needsQuestions: ClarificationQuestion[]; rawText?: string }
    | null
  >(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = parseStored();
    if (!data) {
      router.replace("/home/upload");
      return;
    }
    setPayload(data);
  }, [router]);

  const extraction = payload?.extraction;
  const needsQuestions = payload?.needsQuestions ?? [];
  const clarifierQuestions = useMemo(
    () => needsQuestions.filter((question) => question.id !== "department"),
    [needsQuestions]
  );

  const updateExtraction = <K extends keyof Extraction>(key: K, value: Extraction[K]) => {
    if (!extraction || !payload) {
      return;
    }
    const nextExtraction = { ...extraction, [key]: value };
    const nextPayload = { ...payload, extraction: nextExtraction };
    setPayload(nextPayload);
    sessionStorage.setItem(REVIEW_KEY, JSON.stringify(nextPayload));
  };

  const handleAnswer = (id: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      return next;
    });
  };

  function computeValidation(
    extraction: Extraction | undefined,
    departmentSelected: boolean
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!extraction) return { valid: false, errors: ["Missing extraction payload"] };

    if (!Number.isFinite(extraction.amount) || extraction.amount <= 0) {
      errors.push("Amount must be greater than 0.");
    }

    if (!extraction.currency || extraction.currency.length !== 3) {
      errors.push("Currency must be a 3-letter ISO code (e.g., USD).");
    }

    if (!extraction.dateISO || isNaN(new Date(extraction.dateISO).getTime())) {
      errors.push("Expense date is invalid.");
    }

    if (!departmentSelected) {
      errors.push("Select a department before submitting.");
    }

    if (extraction.items && extraction.items.length > 0) {
      const sum = extraction.items.reduce(
        (acc, it) => acc + (Number.isFinite(it.amount) ? it.amount : 0),
        0
      );
      if (Math.abs(sum - extraction.amount) > 0.01) {
        errors.push("Sum of items must equal total amount (±0.01).");
      }
    }

    return { valid: errors.length === 0, errors };
  }

  const mergedAnswers = useMemo(
    () =>
      sanitizeAnswers({
        country: answers.country ?? extraction?.pickupCountry ?? "",
        department: answers.department ?? "",
        category: answers.category ?? extraction?.category ?? "",
      }),
    [answers, extraction]
  );

  const suggestedDepartment = extraction?.inferredDepartment ?? "";
  const departmentValue = answers.department ?? "";
  const departmentSelected =
    typeof departmentValue === "string" ? departmentValue.trim().length > 0 : Boolean(departmentValue);

  const validation = useMemo(
    () => computeValidation(extraction, departmentSelected),
    [departmentSelected, extraction]
  );

  const amountInvalid = !extraction || !Number.isFinite(extraction.amount) || extraction.amount <= 0;
  const currencyInvalid = !extraction || !extraction.currency || extraction.currency.length !== 3;
  const dateInvalid = !extraction || !extraction.dateISO || isNaN(new Date(extraction.dateISO).getTime());
  const onSubmit = async () => {
    if (!extraction) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (!validation.valid) {
        throw new Error("Please resolve the highlighted issues before submitting.");
      }
      const expense = buildExpense(extraction, mergedAnswers);
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction,
          answers: mergedAnswers,
          overrides: { region: expense.region },
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error ?? "Decision failed");
      }
      const decisionPayload = await response.json();
      sessionStorage.setItem(
        DECISION_KEY,
        JSON.stringify({ ...decisionPayload, expense, extraction })
      );
      router.push("/home/decision");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit expense");
    } finally {
      setSubmitting(false);
    }
  };

  if (!extraction) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-800">Review & confirm</h1>
        <p className="text-sm text-slate-600">
          Confirm low-confidence fields and provide quick clarifications. You can always override values before submitting for routing.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <FieldEditor
            label="Amount"
            type="number"
            value={extraction.amount}
            confidence={extraction.confidence.amount}
            onChange={(value) => updateExtraction("amount", Number(value))}
            invalid={amountInvalid}
            helper={amountInvalid ? "Enter a positive amount" : undefined}
          />
          <FieldEditor
            label="Currency"
            value={extraction.currency}
            confidence={extraction.confidence.currency}
            onChange={(value) => updateExtraction("currency", value)}
            invalid={currencyInvalid}
            helper={currencyInvalid ? "3-letter code, e.g., USD" : undefined}
          />
          <DateTimeEditor
            value={extraction.dateISO}
            confidence={extraction.confidence.dateISO}
            onChange={(nextISO) => updateExtraction("dateISO", nextISO)}
            invalid={dateInvalid}
            helper={dateInvalid ? "Enter a valid date and time" : undefined}
          />
          <LineItemsEditor
            items={extraction.items ?? []}
            currency={extraction.currency}
            total={extraction.amount}
            onChange={(items) => updateExtraction("items", items)}
            onUseSumAsTotal={(sum) => updateExtraction("amount", Number(sum.toFixed(2)))}
          />
          <FieldEditor
            label="Country"
            value={extraction.pickupCountry ?? ""}
            confidence={extraction.confidence.pickupCountry}
            options={["US", "Germany", "France", "UK", "Other"]}
            onChange={(value) => {
              updateExtraction("pickupCountry", value);
              handleAnswer("country", value);
            }}
          />
          <FieldEditor
            label="Category"
            value={extraction.category ?? ""}
            confidence={extraction.confidence.category}
            options={["ride_hail", "travel", "meals", "software"]}
            onChange={(value) => {
              updateExtraction("category", value as Extraction["category"]);
              handleAnswer("category", value);
            }}
          />
        </div>
        <div className="flex flex-col gap-4">
          {payload?.rawText ? <ReceiptPreview text={payload.rawText} /> : null}
          <FieldEditor
            label="Department"
            value={departmentValue}
            options={["engineering", "sales", "hr", "other"]}
            confidence={extraction.confidence.inferredDepartment}
            invalid={!departmentSelected}
            helper={
              !departmentSelected
                ? suggestedDepartment
                  ? `Suggested: ${suggestedDepartment}. Choose the confirmed department before submitting.`
                  : "Choose the department before submitting."
                : undefined
            }
            onChange={(value) => {
              handleAnswer("department", value);
              updateExtraction("inferredDepartment", value as Extraction["inferredDepartment"]);
            }}
          />
          <ClarifierChat questions={clarifierQuestions} answers={answers} onAnswer={handleAnswer} />
        </div>
      </div>
      {!validation.valid ? (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          <div className="font-semibold">Please fix the following:</div>
          <ul className="mt-1 list-disc pl-5">
            {validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          className="border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-60"
          disabled={submitting || !validation.valid}
        >
          {submitting ? "Submitting…" : "Submit for decision"}
        </button>
        <button
          type="button"
          className="border border-slate-300 px-5 py-2.5 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
          onClick={() => router.push("/home/upload")}
        >
          Back
        </button>
      </div>
    </div>
  );
}
