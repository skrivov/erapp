"use client";

import { useState } from "react";
import type { Rule } from "../../lib/types";
import type { PolicyQAResult } from "../../lib/policyQA";

type ViewMode = "active" | "inactive" | "all";

type Props = {
  allPolicies: Rule[];
  activePolicies: Rule[];
  requestedDate: string;
};

function formatDate(value: string) {
  return new Date(value).toISOString().split("T")[0];
}

export function PoliciesClient({ allPolicies, activePolicies, requestedDate }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [qaResult, setQaResult] = useState<PolicyQAResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeIds = new Set(activePolicies.map((p) => p.id));
  const inactivePolicies = allPolicies.filter((p) => !activeIds.has(p.id));

  const displayedPolicies =
    viewMode === "active"
      ? activePolicies
      : viewMode === "inactive"
      ? inactivePolicies
      : allPolicies;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setQaResult(null);

    try {
      const response = await fetch("/api/policy-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policies: activePolicies }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze policies");
      }

      const result: PolicyQAResult = await response.json();
      setQaResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Mode Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">View:</label>
        <div className="flex gap-2">
          {(["active", "inactive", "all"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 text-sm font-semibold transition ${
                viewMode === mode
                  ? "border border-emerald-600 bg-emerald-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* LLM Analysis Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || activePolicies.length === 0}
          className="ml-auto border border-indigo-600 bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing..." : "LLM Analysis"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* QA Results */}
      {qaResult && (
        <section className="border border-indigo-300 bg-indigo-50 p-5">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-semibold text-indigo-900">LLM Policy Analysis Results</h2>
            <button
              onClick={() => setQaResult(null)}
              className="text-indigo-700 hover:text-indigo-900 transition font-bold text-2xl leading-none"
              aria-label="Dismiss results"
              title="Dismiss results"
            >
              ×
            </button>
          </div>

          {/* Summary */}
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase text-indigo-700">Tests Run</dt>
              <dd className="text-xl font-bold text-indigo-900">{qaResult.summary.total_tests}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-indigo-700">Passed</dt>
              <dd className="text-xl font-bold text-green-700">{qaResult.summary.passed}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-indigo-700">Failed</dt>
              <dd className="text-xl font-bold text-red-700">{qaResult.summary.failed}</dd>
            </div>
          </div>

          {/* Warnings */}
          {qaResult.warnings.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-indigo-800">Warnings</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-indigo-900">
                {qaResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Conflicts */}
          {qaResult.conflicts.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-indigo-800">Conflicts</h3>
              <ul className="mt-2 space-y-2 text-sm text-indigo-900">
                {qaResult.conflicts.map((conflict, idx) => (
                  <li key={idx}>
                    <strong>{conflict.description}:</strong> {conflict.rules.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {qaResult.gaps.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-indigo-800">Coverage Gaps</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-indigo-900">
                {qaResult.gaps.map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Test Results */}
          {qaResult.test_results.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-indigo-800">Test Results</h3>
              <div className="mt-2 space-y-2">
                {qaResult.test_results.map((test, idx) => (
                  <div
                    key={idx}
                    className={`border p-3 text-sm ${
                      test.passed
                        ? "border-green-300 bg-green-50 text-green-900"
                        : "border-red-300 bg-red-50 text-red-900"
                    }`}
                  >
                    <div className="font-semibold">
                      {test.passed ? "✓" : "✗"} {test.name}
                    </div>
                    <div className="mt-1 text-xs">
                      Actual: [{test.actual.join(", ")}]
                      {test.expected && ` | Expected: [${test.expected.join(", ")}]`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Policies List */}
      <section className="border border-slate-300 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">
            {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Rules ({displayedPolicies.length})
          </div>
          <div className="text-xs text-slate-500">
            Showing for date: {formatDate(requestedDate)}
          </div>
        </div>

        {displayedPolicies.length === 0 ? (
          <p className="text-sm text-slate-500">No {viewMode} policies found for this date.</p>
        ) : (
          <div className="space-y-3">
            {displayedPolicies.map((rule) => {
              const isActive = activeIds.has(rule.id);
              return (
                <article
                  key={rule.id}
                  className={`border p-4 text-sm ${
                    isActive
                      ? "border-emerald-300 bg-emerald-50 text-slate-700"
                      : "border-slate-300 bg-slate-50 text-slate-600"
                  }`}
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-800">{rule.name}</h2>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                          ACTIVE
                        </span>
                      )}
                      <span className="bg-slate-800 px-2 py-1 text-xs font-semibold text-white">
                        priority {rule.priority}
                      </span>
                    </div>
                  </header>
                  <dl className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Effective from</dt>
                      <dd>{formatDate(rule.effective_from)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Effective to</dt>
                      <dd>{rule.effective_to ? formatDate(rule.effective_to) : "open"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Selectors</dt>
                      <dd>
                        {Object.entries(rule.selectors ?? {})
                          .map(([key, value]) => `${key}:${value}`)
                          .join(", ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Effect summary</dt>
                      <dd>
                        {(() => {
                          const segments: string[] = [];
                          if (rule.effect.always_require_steps?.length) {
                            segments.push(`require ${rule.effect.always_require_steps.join(", ")}`);
                          }
                          if (rule.effect.skip_steps_below?.length) {
                            segments.push(
                              `skip ${rule.effect.skip_steps_below
                                .map((step) => `${step.step}<${step.amount}${step.currency}`)
                                .join(", ")}`
                            );
                          }
                          if (rule.effect.require_steps_if?.length) {
                            segments.push(`conditional (${rule.effect.require_steps_if.length})`);
                          }
                          if (rule.effect.category_routes) {
                            segments.push(`routes:${Object.keys(rule.effect.category_routes).join(",")}`);
                          }
                          return segments.length ? segments.join("; ") : "—";
                        })()}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}