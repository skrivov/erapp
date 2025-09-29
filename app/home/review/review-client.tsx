"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClarifierChat } from "../../../components/ClarifierChat";
import { FieldEditor } from "../../../components/FieldEditor";
import { ArtifactPreview } from "../../../components/ArtifactPreview";
import { LineItemsEditor } from "../../../components/LineItemsEditor";
import type { ClarificationQuestion, Extraction, Expense, Region } from "../../../lib/types";

const REVIEW_KEY = "erca:review";
const DECISION_KEY = "erca:decision";

const REGION_CURRENCY: Record<Region, string> = {
  US: "USD",
  EU: "EUR",
  APAC: "INR",
};

type ReviewSessionPayload = {
  extraction: Extraction;
  needsQuestions: ClarificationQuestion[];
  rawText?: string;
  artifactUrl?: string;
  artifactName?: string;
};

function parseStored(): ReviewSessionPayload | null {
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
  const resolvedRegion = (answers.region ?? extraction.region ?? "US") as Expense["region"];
  const resolvedDepartment =
    (answers.department ?? extraction.inferredDepartment ?? undefined) as Expense["department"] | undefined;
  const resolvedCategory = (answers.category ?? extraction.category ?? "ride_hail") as Expense["category"];
  const resolvedCountry = answers.country ?? extraction.country;

  return {
    dateISO: extraction.dateISO,
    country: resolvedCountry,
    region: resolvedRegion,
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
  const [payload, setPayload] = useState<ReviewSessionPayload | null>(null);
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
  const needsQuestions = useMemo(
    () => payload?.needsQuestions ?? [],
    [payload]
  );
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
  regionSelected: boolean,
  departmentSelected: boolean,
  currencyError?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!extraction) return { valid: false, errors: ["Missing extraction payload"] };

  if (!Number.isFinite(extraction.amount) || extraction.amount <= 0) {
    errors.push("Amount must be greater than 0.");
  }

  if (!extraction.dateISO || isNaN(new Date(extraction.dateISO).getTime())) {
    errors.push("Expense date is invalid.");
  }

  if (!regionSelected) {
    errors.push("Select a region before submitting.");
  }

  if (!departmentSelected) {
    errors.push("Select a department before submitting.");
  }

  if (currencyError) {
    errors.push(currencyError);
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
        country: answers.country ?? extraction?.country ?? "",
        region: answers.region ?? extraction?.region ?? "",
        department: answers.department ?? "",
        category: answers.category ?? extraction?.category ?? "",
      }),
    [answers, extraction]
  );

  const departmentValue = answers.department ?? "";
  const departmentSelected =
    typeof departmentValue === "string" ? departmentValue.trim().length > 0 : Boolean(departmentValue);
  const regionValue = answers.region ?? extraction?.region ?? "";
  const regionSelected = typeof regionValue === "string" ? regionValue.trim().length > 0 : Boolean(regionValue);
  const requiredCurrency = regionSelected ? REGION_CURRENCY[regionValue as Region] : undefined;
  const currencyValue = extraction?.currency ?? "";
  const normalizedCurrency = currencyValue.toUpperCase();
  const baseCurrencyInvalid = !extraction || !currencyValue || currencyValue.length !== 3;
  const currencyMismatch = Boolean(
    !baseCurrencyInvalid && requiredCurrency && normalizedCurrency !== requiredCurrency
  );
  const currencyError = baseCurrencyInvalid
    ? "Currency must be a 3-letter ISO code (e.g., USD)."
    : currencyMismatch && requiredCurrency
    ? `Convert all amounts to ${requiredCurrency} for the ${regionValue} office before submitting.`
    : undefined;
  const currencyInvalid = Boolean(currencyError);

  const validation = useMemo(() => {
    if (!departmentSelected) {
      return { valid: false, errors: [] };
    }
    return computeValidation(extraction, regionSelected, departmentSelected, currencyError);
  }, [currencyError, departmentSelected, extraction, regionSelected]);

  const amountInvalid = !extraction || !Number.isFinite(extraction.amount) || extraction.amount <= 0;
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
        <h1 className="text-2xl font-semibold text-slate-800">Expense Reimbursement Form</h1>
        <div className="text-sm text-slate-600">
          <p>Review your receipt details before submitting.</p>
          <p className="font-medium text-amber-600">Always set the Department and double-check the Country of Expense, the Currency, the Region Office, and the Expense Category.</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[50%_50%] md:items-stretch">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldEditor
              label="Date"
              value={new Date(extraction.dateISO).toISOString().split("T")[0]}
              confidenceVariant="green"
              type="date"
              onChange={(value) => updateExtraction("dateISO", `${value}T00:00:00.000Z`)}
              invalid={dateInvalid}
              helper={dateInvalid ? "Enter a valid date" : undefined}
            />
            <FieldEditor
              label="Country of Expense"
              value={extraction.country ?? ""}
              confidenceVariant="yellow"
              helper={!extraction.country ? "Confirm the country shown on the receipt" : undefined}
              onChange={(value) => {
                updateExtraction("country", value as Extraction["country"]);
                handleAnswer("country", value);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldEditor
              label="Currency"
              value={extraction.currency}
              confidenceVariant="yellow"
              options={["AUD", "BRL", "CAD", "CNY", "EUR", "INR", "JPY", "MXN", "USD", "ZAR"]}
              onChange={(value) => updateExtraction("currency", value)}
              invalid={currencyInvalid}
              helper={currencyError}
            />
            <FieldEditor
              label="Total amount"
              type="number"
              value={extraction.amount}
              confidenceVariant="green"
              onChange={(value) => updateExtraction("amount", Number(value))}
              invalid={amountInvalid}
              helper={amountInvalid ? "Enter a positive amount" : undefined}
            />
          </div>
          <LineItemsEditor
            items={extraction.items ?? []}
            currency={extraction.currency}
            total={extraction.amount}
            onChange={(items) => updateExtraction("items", items)}
            onUseSumAsTotal={(sum) => updateExtraction("amount", Number(sum.toFixed(2)))}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[0.9fr_1.15fr_0.95fr]">
            <FieldEditor
              label="Category"
              value={extraction.category ?? ""}
              confidenceVariant="yellow"
              options={["ride_hail", "travel", "meals", "software"]}
              onChange={(value) => {
                updateExtraction("category", value as Extraction["category"]);
                handleAnswer("category", value);
              }}
            />
            <FieldEditor
              label="Department"
              value={departmentValue}
              options={["engineering", "sales", "hr", "other"]}
              confidenceVariant="red"
              invalid={!departmentSelected}
              helper={
                !departmentSelected ? "Select Department" : undefined
              }
              onChange={(value) => {
                handleAnswer("department", value);
                updateExtraction("inferredDepartment", value as Extraction["inferredDepartment"]);
              }}
            />
            <FieldEditor
              label="Region Office"
              value={extraction.region ?? ""}
              confidenceVariant="yellow"
              options={["US", "EU", "APAC"]}
              invalid={!regionSelected}
              helper={!regionSelected ? "Choose the region for routing" : undefined}
              onChange={(value) => {
                updateExtraction("region", value as Extraction["region"]);
                handleAnswer("region", value);
              }}
            />
          </div>
        </div>
        <div className="flex h-full flex-col gap-4">
          <ArtifactPreview
            url={payload?.artifactUrl}
            filename={payload?.artifactName}
            placeholder="Receipt image will appear here once uploaded."
            initialScale={1}
            maxHeightClass="h-full"
            className="flex-1"
          />
          <ClarifierChat questions={clarifierQuestions} answers={answers} onAnswer={handleAnswer} />
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          className="border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-60"
          disabled={submitting || !departmentSelected || !validation.valid}
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
