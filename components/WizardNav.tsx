"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type WizardStep = {
  href: string;
  label: string;
  description?: string;
};

const DEFAULT_STEPS: WizardStep[] = [
  { href: "/home/upload", label: "Upload", description: "Add receipt" },
  { href: "/home/review", label: "Review", description: "Confirm details" },
  { href: "/home/decision", label: "Decision", description: "View routing" },
];

export function WizardNav({ steps = DEFAULT_STEPS }: { steps?: WizardStep[] }) {
  const pathname = usePathname();

  const activeIndex = steps.findIndex((step) => pathname.startsWith(step.href));

  return (
    <nav aria-label="Expense workflow" className="rounded border border-slate-200 bg-white p-4">
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => {
          const isActive = index === (activeIndex === -1 ? 0 : activeIndex);
          const isCompleted = activeIndex !== -1 && index < activeIndex;
          return (
            <li key={step.href}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 rounded border px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : isCompleted
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{step.label}</span>
                  {step.description ? (
                    <span className="text-xs text-slate-500">{step.description}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
