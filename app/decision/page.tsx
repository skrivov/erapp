import { Suspense } from "react";
import { DecisionClient } from "./decision-client";

export default function DecisionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading decision…</div>}>
      <DecisionClient />
    </Suspense>
  );
}
