type ConfidenceBadgeProps = {
  score: number;
  label?: string;
};

export function ConfidenceBadge({ score, label }: ConfidenceBadgeProps) {
  const tier = score >= 0.9 ? "bg-emerald-600" : score >= 0.75 ? "bg-amber-500" : "bg-rose-600";
  const display = `${Math.round(score * 100)}%`;

  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs font-medium text-white ${tier}`}>
      {label ? <span>{label}</span> : null}
      <span>{display}</span>
    </span>
  );
}
