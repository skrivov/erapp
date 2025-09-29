"use client";

import { ChangeEvent } from "react";
import { ConfidenceBadge } from "./ConfidenceBadge";

type FieldEditorProps = {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  confidenceVariant?: "green" | "yellow" | "red";
  options?: string[];
  helper?: string;
  type?: "text" | "number" | "date";
  invalid?: boolean;
};

export function FieldEditor({
  label,
  value,
  onChange,
  confidenceVariant,
  options,
  helper,
  type = "text",
  invalid = false,
}: FieldEditorProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-2 border border-slate-300 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {confidenceVariant ? <ConfidenceBadge variant={confidenceVariant} srLabel={`${label} indicator`} /> : null}
      </div>
      {options ? (
        <select
          className={
            `w-full border bg-white px-3 py-2 text-sm transition focus:outline-none focus:ring-1 ` +
            (invalid
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
              : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-200")
          }
          value={value ?? ""}
          onChange={handleChange}
        >
          <option value="" disabled>
            Select…
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          className={
            `w-full border bg-white px-3 py-2 text-sm transition focus:outline-none focus:ring-1 ` +
            (invalid
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
              : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-200")
          }
          value={value ?? ""}
          onChange={handleChange}
        />
      )}
      {helper ? (
        <p className={"text-xs " + (invalid ? "text-rose-600" : "text-slate-500")}>{helper}</p>
      ) : null}
    </div>
  );
}
