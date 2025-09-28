"use client";

import { useMemo } from "react";
import type { LineItem } from "../lib/types";

type LineItemsEditorProps = {
  items: LineItem[];
  currency: string;
  total: number;
  onChange: (items: LineItem[]) => void;
  onUseSumAsTotal?: (sum: number) => void;
};

export function LineItemsEditor({ items, currency, total, onChange, onUseSumAsTotal }: LineItemsEditorProps) {
  const { sum, matches } = useMemo(() => {
    const s = items.reduce((acc, it) => acc + (Number.isFinite(it.amount) ? it.amount : 0), 0);
    return { sum: s, matches: Math.abs(s - total) <= 0.01 };
  }, [items, total]);

  const updateAt = (idx: number, patch: Partial<LineItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const removeAt = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
  };

  const addItem = () => {
    onChange([
      ...items,
      { label: "", amount: 0, currency: undefined },
    ]);
  };

  return (
    <section className="space-y-2 border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">Edit items</div>
        <div className="flex items-center gap-2">
          <div className={
            matches
              ? "rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              : "rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
          }>
            {matches ? "Sum matches total" : `Sum ${sum.toFixed(2)} ${currency}`}
          </div>
          {!matches && onUseSumAsTotal ? (
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
              onClick={() => onUseSumAsTotal(sum)}
            >
              Use sum as total
            </button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-2 py-2">Label</th>
              <th className="px-2 py-2">Currency</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-2">
                  <input
                    type="text"
                    className="w-full border border-slate-300 bg-white px-2 py-1 text-sm"
                    placeholder="Item label"
                    value={it.label}
                    onChange={(e) => updateAt(idx, { label: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    className="w-24 border border-slate-300 bg-white px-2 py-1 text-sm"
                    placeholder={currency}
                    value={it.currency ?? ""}
                    onChange={(e) => updateAt(idx, { currency: e.target.value || undefined })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className="w-32 border border-slate-300 bg-white px-2 py-1 text-right text-sm"
                    value={Number.isFinite(it.amount) ? String(it.amount) : ""}
                    onChange={(e) => updateAt(idx, { amount: Number(e.target.value || 0) })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-700"
                    onClick={() => removeAt(idx)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
          onClick={addItem}
        >
          Add item
        </button>
      </div>
    </section>
  );
}
