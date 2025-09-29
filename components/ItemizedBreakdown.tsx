"use client";

import type { LineItem } from "../lib/types";

type ItemizedBreakdownProps = {
  items: LineItem[];
  currency: string;
  total: number;
  title?: string;
};

export function ItemizedBreakdown({ items, currency, total, title = "Itemized breakdown" }: ItemizedBreakdownProps) {
  const sum = items.reduce((acc, it) => acc + (Number.isFinite(it.amount) ? it.amount : 0), 0);
  const tolerance = 0.01;
  const matches = Math.abs(sum - total) <= tolerance;

  return (
    <section className="space-y-2 border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <div
          className={
            matches
              ? "rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              : "rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
          }
        >
          {matches ? "Totals match" : "Totals do not match"}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={`${it.label}-${idx}`} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-2">{it.label}</td>
                <td className="px-2 py-2 text-right">
                  {it.amount.toFixed(2)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-2 py-2 font-semibold">Total</td>
              <td className="px-2 py-2 text-right font-semibold">
                {total.toFixed(2)} {currency}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
