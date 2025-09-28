import { Suspense } from "react";
import { ReviewClient } from "./review-client";

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <ReviewClient />
    </Suspense>
  );
}
