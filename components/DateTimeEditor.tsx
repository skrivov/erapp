"use client";

import { useMemo } from "react";
import { ConfidenceBadge } from "./ConfidenceBadge";

type DateTimeEditorProps = {
  label?: string;
  value: string; // ISO 8601 string with timezone
  onChange: (nextISO: string) => void;
  confidenceVariant?: "green" | "yellow" | "red";
  helper?: string;
  invalid?: boolean;
};

function toLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return { date: "", time: "" };
  }
  // Build YYYY-MM-DD and HH:MM in local time
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function toISO(date: string, time: string): string {
  if (!date) return "";
  const t = time || "00:00";
  const composed = new Date(`${date}T${t}:00`);
  if (isNaN(composed.getTime())) return "";
  // Normalize to Z for consistency
  return new Date(Date.UTC(
    composed.getFullYear(),
    composed.getMonth(),
    composed.getDate(),
    composed.getHours(),
    composed.getMinutes(),
    0,
    0
  )).toISOString();
}

export function DateTimeEditor({ label = "Expense date", value, onChange, confidenceVariant, helper, invalid = false }: DateTimeEditorProps) {
  const parts = useMemo(() => toLocalParts(value), [value]);

  return (
    <div className="flex flex-col gap-2 border border-slate-300 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {confidenceVariant ? <ConfidenceBadge variant={confidenceVariant} srLabel={`${label} indicator`} /> : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="date"
          className={
            `w-full border bg-white px-3 py-2 text-sm transition focus:outline-none focus:ring-1 ` +
            (invalid
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
              : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-200")
          }
          value={parts.date}
          onChange={(e) => onChange(toISO(e.target.value, parts.time))}
        />
        <input
          type="time"
          step={60}
          className={
            `w-full border bg-white px-3 py-2 text-sm transition focus:outline-none focus:ring-1 ` +
            (invalid
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
              : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-200")
          }
          value={parts.time}
          onChange={(e) => onChange(toISO(parts.date, e.target.value))}
        />
      </div>
      <p className={"text-xs " + (invalid ? "text-rose-600" : "text-slate-500")}>
        {helper ?? "Stored as ISO 8601 UTC (e.g., 2024-10-01T00:00:00Z)"}
      </p>
    </div>
  );
}
