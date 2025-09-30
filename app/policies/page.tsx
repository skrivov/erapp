import { getActiveRules, loadPolicies } from "../../lib/policyLoader";
import { loadCategories } from "../../lib/categories";
import { PoliciesClient } from "./policies-client";

export const dynamic = "force-dynamic";

type PageProps = {
  // Next.js dynamic APIs: searchParams is async in newer versions
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Date(value).toISOString().split("T")[0];
}

export default async function PoliciesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const requestedDate = typeof params.date === "string" ? params.date : new Date().toISOString();
  const { active } = await getActiveRules(requestedDate);
  const all = await loadPolicies();
  const categories = await loadCategories();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-8 px-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-800">Policy Explorer</h1>
        <p className="text-sm text-slate-600">
          Inspect active and inactive rules for a specific effective date. All policies are file-backed and versioned in /policies.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col text-sm text-slate-600">
          Effective date
          <input
            type="date"
            name="date"
            defaultValue={formatDate(requestedDate)}
            className="border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-200"
          />
        </label>
        <button
          className="border border-slate-800 bg-slate-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
          type="submit"
        >
          Refresh
        </button>
      </form>

      <section className="border border-slate-300 bg-white p-5">
        <div className="text-sm font-semibold text-slate-700">Summary</div>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm text-slate-600 md:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-slate-500">Active rules</dt>
            <dd className="text-xl font-bold text-emerald-700">{active.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Inactive rules</dt>
            <dd className="text-xl font-bold text-slate-600">{all.length - active.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Total rules</dt>
            <dd className="text-xl font-bold text-slate-800">{all.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Categories</dt>
            <dd className="text-xl font-bold text-slate-800">{categories.length}</dd>
          </div>
        </dl>
      </section>

      <PoliciesClient
        allPolicies={all}
        activePolicies={active}
        requestedDate={requestedDate}
      />
    </div>
  );
}
