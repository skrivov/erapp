import { promises as fs } from "fs";
import path from "path";
import { Rule } from "./types";
import { PoliciesSchema } from "../schemas/policy.schema";

const policiesDir = path.join(process.cwd(), "policies");

let cache: Rule[] | null = null;

async function readPolicyFile(file: string): Promise<Rule[]> {
  const filePath = path.join(policiesDir, file);
  const contents = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(contents);
  const result = PoliciesSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Policy file ${file} failed validation: ${result.error.message}`
    );
  }
  return result.data;
}

export async function loadPolicies({ force }: { force?: boolean } = {}): Promise<Rule[]> {
  if (cache && !force) {
    return cache;
  }

  const files = await fs.readdir(policiesDir);
  const jsonFiles = files.filter(
    (file) => file.endsWith(".json") && file !== "categories.json"
  );

  const rulesArrays = await Promise.all(
    jsonFiles.map((file) => readPolicyFile(file))
  );

  cache = rulesArrays.flat();
  return cache;
}

export async function getActiveRules(
  dateISO: string
): Promise<{ active: Rule[]; all: Rule[] }> {
  const all = await loadPolicies();
  const date = new Date(dateISO);

  const active = all.filter((rule) => {
    const from = new Date(rule.effective_from);
    if (Number.isNaN(from.getTime())) {
      return false;
    }
    if (date < from) {
      return false;
    }
    if (rule.effective_to) {
      const to = new Date(rule.effective_to);
      if (Number.isNaN(to.getTime())) {
        return false;
      }
      if (date > to) {
        return false;
      }
    }
    return true;
  });

  return { active, all };
}

export function clearPolicyCache() {
  cache = null;
}
