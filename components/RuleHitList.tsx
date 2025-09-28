import type { RuleHit } from "../lib/types";

type RuleHitListProps = {
  hits: RuleHit[];
};

export function RuleHitList({ hits }: RuleHitListProps) {
  if (!hits.length) {
    return <p className="text-sm text-slate-500">No matching rules triggered.</p>;
  }
  return (
    <ul className="space-y-2">
      {hits.map((hit) => (
        <li key={`${hit.ruleId}-${hit.reason}`} className="border border-slate-300 bg-white p-4 text-sm">
          <span className="font-semibold text-slate-700">{hit.ruleId}</span>
          <span className="text-slate-500"> — {hit.reason}</span>
        </li>
      ))}
    </ul>
  );
}
