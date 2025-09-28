import { NextResponse } from "next/server";
import { getActiveRules, loadPolicies } from "../../../lib/policyLoader";
import { loadCategories } from "../../../lib/categories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateISO = searchParams.get("date") ?? new Date().toISOString();
  const { active, all } = await getActiveRules(dateISO);
  const includeAll = searchParams.get("all") === "true";
  const includeCategories = searchParams.get("categories") === "true";

  const response: Record<string, unknown> = {
    requestedDate: dateISO,
    active,
    totalRules: all.length,
  };

  if (includeAll) {
    response.all = await loadPolicies();
  }

  if (includeCategories) {
    response.categories = await loadCategories();
  }

  return NextResponse.json(response);
}
