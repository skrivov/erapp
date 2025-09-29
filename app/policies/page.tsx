import { getActiveRules, loadPolicies } from "../../lib/policyLoader";
import { loadCategories } from "../../lib/categories";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function formatDate(value: string) {
  return new Date(value).toISOString().split("T")[0];
}

export default async function PoliciesPage({ searchParams }: PageProps) {
  const requestedDate = typeof searchParams?.date === "string" ? searchParams.date : new Date().toISOString();
  const { active } = await getActiveRules(requestedDate);
  const all = await loadPolicies();
  const categories = await loadCategories();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-800">Policy Explorer</h1>
        <p className="text-sm text-slate-600">
          Inspect the active rule set for a specific effective date. All policies are file-backed and versioned in /policies.
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
            <dd>{active.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Total rules</dt>
            <dd>{all.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Categories</dt>
            <dd>{categories.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Requested date</dt>
            <dd>{formatDate(requestedDate)}</dd>
          </div>
        </dl>
      </section>

      <section className="border border-slate-300 bg-white p-5">
        <div className="text-sm font-semibold text-slate-700">Active rule details</div>
        <div className="mt-3 space-y-3">
          {active.map((rule) => (
            <article key={rule.id} className="border border-slate-300 bg-white p-4 text-sm text-slate-700">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-800">{rule.name}</h2>
                <span className="bg-slate-800 px-2 py-1 text-xs font-semibold text-white">
                  priority {rule.priority}
                </span>
              </header>
              <dl className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Effective from</dt>
                  <dd>{formatDate(rule.effective_from)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Effective to</dt>
                  <dd>{rule.effective_to ? formatDate(rule.effective_to) : "open"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Selectors</dt>
                  <dd>{Object.entries(rule.selectors ?? {}).map(([key, value]) => `${key}:${value}`).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Effect summary</dt>
                  <dd>
                    {(() => {
                      const segments: string[] = [];
                      if (rule.effect.always_require_steps?.length) {
                        segments.push(`require ${rule.effect.always_require_steps.join(", ")}`);
                      }
                      if (rule.effect.skip_steps_below?.length) {
                        segments.push(
                          `skip ${rule.effect.skip_steps_below
                            .map((step) => `${step.step}<${step.amount}${step.currency}`)
                            .join(", ")}`
                        );
                      }
                      if (rule.effect.require_steps_if?.length) {
                        segments.push(`conditional (${rule.effect.require_steps_if.length})`);
                      }
                      if (rule.effect.category_routes) {
                        segments.push(`routes:${Object.keys(rule.effect.category_routes).join(",")}`);
                      }
                      return segments.length ? segments.join("; ") : "—";
                    })()}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
