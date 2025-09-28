"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApprovalStepper } from "../../components/ApprovalStepper";
import { RuleHitList } from "../../components/RuleHitList";
import { ItemizedBreakdown } from "../../components/ItemizedBreakdown";
import type { Decision, Extraction, Expense } from "../../lib/types";

const DECISION_KEY = "erca:decision";

function parseStored():
  | { decision: Decision; explanation: string; expense: Expense; extraction?: Extraction }
  | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = sessionStorage.getItem(DECISION_KEY);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to parse decision payload", error);
    return null;
  }
}

export function DecisionClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<
    | { decision: Decision; explanation: string; expense: Expense; extraction?: Extraction }
    | null
  >(null);

  useEffect(() => {
    const data = parseStored();
    if (!data) {
      router.replace("/upload");
      return;
    }
    setPayload(data);
  }, [router]);

  if (!payload) {
    return null;
  }

  const { decision, explanation, expense, extraction } = payload;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-800">Decision</h1>
        <p className="text-sm text-slate-600">Here is the deterministic approval routing for your expense.</p>
      </header>

      <section className="space-y-2 border border-slate-300 bg-white p-5">
        <div className="text-sm font-semibold text-slate-700">Approval steps</div>
        <ApprovalStepper steps={decision.steps} skipped={decision.skipped} />
      </section>

      <section className="space-y-2 border border-slate-300 bg-white p-5">
        <div className="text-sm font-semibold text-slate-700">Rule hits</div>
        <RuleHitList hits={decision.ruleHits} />
      </section>

      <section className="border border-slate-300 bg-white p-5 text-sm text-slate-700">
        <h2 className="mb-2 font-semibold text-slate-800">Explanation</h2>
        <p>{explanation}</p>
      </section>

      {extraction?.items && extraction.items.length > 0 ? (
        <ItemizedBreakdown
          items={extraction.items}
          currency={expense.total.currency}
          total={expense.total.amount}
        />
      ) : null}

      <section className="border border-slate-300 bg-white p-5 text-sm text-slate-600">
        <div className="font-semibold text-slate-700">Expense details</div>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Region</dt>
            <dd>{expense.region}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Department</dt>
            <dd>{expense.department ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Category</dt>
            <dd>{expense.category}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Total</dt>
            <dd>
              {expense.total.amount} {expense.total.currency}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="border border-emerald-600 bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          onClick={() => router.push("/upload")}
        >
          Start new receipt
        </button>
        <button
          type="button"
          className="border border-slate-300 px-5 py-2 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
          onClick={() => router.push("/admin/policies")}
        >
          View policies
        </button>
      </div>
    </div>
  );
}
