"use client";

type ApprovalStepperProps = {
  steps: string[];
  skipped: string[];
};

const STEP_LABELS: Record<string, string> = {
  compliance: "Compliance",
  hr: "HR",
  it: "IT",
  manager: "Manager",
  finance: "Finance",
};

export function ApprovalStepper({ steps, skipped }: ApprovalStepperProps) {
  const ordered = ["compliance", "hr", "it", "manager", "finance"];
  const finalSteps = ordered.filter((step) => steps.includes(step));

  return (
    <div className="flex flex-wrap items-center gap-3">
      {finalSteps.map((step, index) => {
        const isLast = index === finalSteps.length - 1;
        return (
          <div key={step} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="border border-emerald-600 bg-emerald-600 px-3 py-1 text-sm font-medium text-white">
                {STEP_LABELS[step] ?? step}
              </span>
              {skipped.includes(step) ? (
                <span className="text-xs text-amber-600">(skipped)</span>
              ) : null}
            </div>
            {!isLast ? <span className="text-slate-400">→</span> : null}
          </div>
        );
      })}
    </div>
  );
}
