import { promises as fs } from "fs";
import path from "path";

const policiesDir = path.join(process.cwd(), "policies");

function selectorsKey(rule) {
  return JSON.stringify(rule.selectors ?? {});
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const aEndVal = aEnd ? aEnd.getTime() : Number.POSITIVE_INFINITY;
  const bEndVal = bEnd ? bEnd.getTime() : Number.POSITIVE_INFINITY;
  return aStart.getTime() <= bEndVal && bStart.getTime() <= aEndVal;
}

async function loadPolicies() {
  const files = await fs.readdir(policiesDir);
  const jsonFiles = files.filter((file) => file.endsWith(".json") && file !== "categories.json");
  const contents = await Promise.all(
    jsonFiles.map(async (file) => {
      const data = await fs.readFile(path.join(policiesDir, file), "utf8");
      return JSON.parse(data);
    })
  );
  return contents.flat();
}

function overlapIssues(rules) {
  const issues = [];
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i];
      const b = rules[j];
      if (selectorsKey(a) !== selectorsKey(b)) {
        continue;
      }
      const aStart = new Date(a.effective_from);
      const bStart = new Date(b.effective_from);
      const aEnd = a.effective_to ? new Date(a.effective_to) : null;
      const bEnd = b.effective_to ? new Date(b.effective_to) : null;
      if (rangesOverlap(aStart, aEnd, bStart, bEnd)) {
        issues.push(`Overlap: ${a.id} <-> ${b.id}`);
      }
    }
  }
  return issues;
}

function currencyIssues(rules) {
  const issues = [];
  for (const rule of rules) {
    const region = rule.selectors?.region;
    for (const threshold of rule.effect?.skip_steps_below ?? []) {
      if (region === "US" && threshold.currency !== "USD") {
        issues.push(`Currency mismatch on ${rule.id}: expected USD for US region`);
      }
      if (region === "EU" && threshold.currency !== "EUR") {
        issues.push(`Currency mismatch on ${rule.id}: expected EUR for EU region`);
      }
    }
  }
  return issues;
}

async function main() {
  const rules = await loadPolicies();
  const overlaps = overlapIssues(rules);
  const currency = currencyIssues(rules);

  if (!overlaps.length && !currency.length) {
    console.log("policy:lint ✔ no issues found");
    return;
  }

  for (const message of overlaps) {
    console.error(`ERROR: ${message}`);
  }
  for (const message of currency) {
    console.warn(`WARN: ${message}`);
  }

  if (overlaps.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
