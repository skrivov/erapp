type ConfidenceBadgeProps = {
  variant: "green" | "yellow" | "red";
  srLabel?: string;
};

const VARIANT_CLASS: Record<ConfidenceBadgeProps["variant"], string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

export function ConfidenceBadge({ variant, srLabel }: ConfidenceBadgeProps) {
  return (
    <span
      role="img"
      aria-label={srLabel ?? `${variant} indicator`}
      className={`inline-block h-2.5 w-2.5 rounded-full ${VARIANT_CLASS[variant]}`}
    />
  );
}
