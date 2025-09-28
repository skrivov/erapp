import { promises as fs } from "fs";
import path from "path";

const categoriesPath = path.join(process.cwd(), "policies", "categories.json");

export type CategoryInfo = { id: string; label: string };

let cache: CategoryInfo[] | null = null;

export async function loadCategories(): Promise<CategoryInfo[]> {
  if (cache) {
    return cache;
  }
  const contents = await fs.readFile(categoriesPath, "utf8");
  const parsed = JSON.parse(contents);
  if (!Array.isArray(parsed)) {
    throw new Error("categories.json must be an array");
  }
  cache = parsed as CategoryInfo[];
  return cache;
}

export function clearCategoryCache() {
  cache = null;
}
