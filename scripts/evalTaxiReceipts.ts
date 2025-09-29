#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { config as loadEnv } from "dotenv";
import { loadGroundTruth, guessCountryCode, normalizeCountryName } from "./utils/groundTruth.ts";
import { ocrPdfToText } from "./utils/ocr.ts";
import { runExtractionLLM } from "../lib/extractionLLM.ts";
import { neededQuestions } from "../lib/clarifications.ts";
import { evaluate } from "../lib/evaluate.ts";
import { getActiveRules } from "../lib/policyLoader.ts";
import { regionFromCountry } from "../lib/region.ts";
import { buildExplanation } from "../lib/explain.ts";
import type { Region } from "../lib/types.ts";

const DATASET_ROOT = path.join(process.cwd(), "scripts", "datasets");
const PDF_ROOT = path.join(DATASET_ROOT, "taxi_pdfs");

const DEFAULT_DEPARTMENT = "engineering";
const DEFAULT_CATEGORY = "ride_hail";

type ReceiptRunResult = {
  file: string;
  durationMs: number;
  issues: string[];
  warnings: string[];
  amountDelta: number;
  currency: string;
  managerStep: "included" | "skipped";
  complianceStep: boolean;
  questions: number;
};

loadEnv({ path: path.join(process.cwd(), ".env.local"), override: false });
loadEnv({ path: path.join(process.cwd(), ".env"), override: false });

const CURRENCY_SYMBOL_TO_ISO: Record<string, string> = {
  "€": "EUR",
  "₹": "INR",
  "CN¥": "CNY",
  "¥": "JPY",
  "$": "USD",
  "C$": "CAD",
  "A$": "AUD",
  "MX$": "MXN",
  "R$": "BRL",
  R: "ZAR",
};

const SMOKE_SET = new Set(["Uber1.pdf", "synthetic_eu_berlin.pdf", "synthetic_asia_mumbai.pdf"]);
const MANAGER_SKIP_SET = new Set(["Uber1.pdf", "Uber4.pdf", "synthetic_us_nyc.pdf"]);
const MANAGER_REQUIRE_SET = new Set(["synthetic_asia_mumbai.pdf", "synthetic_asia_tokyo.pdf"]);
const COMPLIANCE_ABSENCE_SET = new Set(["synthetic_eu_berlin.pdf", "synthetic_eu_dublin.pdf"]);
const CLARIFICATION_CHECK_SET = new Set(["Uber2.pdf", "synthetic_asia_beijing.pdf", "synthetic_mx_cdmx.pdf"]);

const REGION_BY_FILE = {
  "synthetic_eu_berlin.pdf": "EU",
  "synthetic_eu_paris.pdf": "EU",
  "synthetic_eu_dublin.pdf": "EU",
  "synthetic_asia_mumbai.pdf": "APAC",
  "synthetic_asia_beijing.pdf": "APAC",
  "synthetic_asia_tokyo.pdf": "APAC",
  "synthetic_au_sydney.pdf": "APAC",
  "synthetic_us_nyc.pdf": "US",
  "synthetic_ca_toronto.pdf": "US",
  "synthetic_mx_cdmx.pdf": "US",
  "synthetic_br_sp.pdf": "US",
  "synthetic_za_cpt.pdf": "APAC",
  "Uber1.pdf": "US",
  "Uber2.pdf": "US",
  "Uber3.pdf": "US",
  "Uber4.pdf": "US",
  "Uber5.pdf": "US",
};

async function main() {
  const start = performance.now();
  const args = process.argv.slice(2);
  const onlyFiles = parseOnlyArg(args);
  const subsetLabel = parseSubsetLabel(args);

  const groundTruth = await loadGroundTruth();
  const filteredTruth = groundTruth.filter((record) => {
    if (onlyFiles && !onlyFiles.has(record.file)) {
      return false;
    }
    if (!subsetLabel) {
      return true;
    }
    switch (subsetLabel) {
      case "smoke":
        return SMOKE_SET.has(record.file);
      case "manager":
        return MANAGER_SKIP_SET.has(record.file) || MANAGER_REQUIRE_SET.has(record.file);
      case "currency":
        return true;
      default:
        return true;
    }
  });

  if (filteredTruth.length === 0) {
    console.error("No receipts matched the provided filters.");
    process.exitCode = 1;
    return;
  }

  const results: ReceiptRunResult[] = [];
  for (const record of filteredTruth) {
    const receiptStart = performance.now();
    const issues = [];
    const warnings = [];

    try {
      const pdfPath = path.join(PDF_ROOT, record.file);
      const ocrText = await ocrPdfToText(pdfPath, { lang: "eng" });
      if (SMOKE_SET.has(record.file) && ocrText.length <= 40) {
        issues.push("OCR text unexpectedly short");
      }

      const extraction = await runExtractionLLM(ocrText);
      const questions = neededQuestions(extraction);

      const symbol = (record.currency ?? "").trim();
      const expectedCurrency =
        (symbol && symbol in CURRENCY_SYMBOL_TO_ISO
          ? CURRENCY_SYMBOL_TO_ISO[symbol]
          : symbol.toUpperCase()) || extraction.currency;

      const amountDelta = Math.abs(extraction.amount - record.total);

      if (SMOKE_SET.has(record.file) && amountDelta >= 1) {
        issues.push(`Amount delta too high (${amountDelta.toFixed(2)})`);
      }

      if (expectedCurrency && extraction.currency.toUpperCase() !== expectedCurrency) {
        issues.push(`Currency mismatch (expected ${expectedCurrency}, got ${extraction.currency})`);
      }

      const countryCode = guessCountryCode(record.location_end);
      const countryAnswer = normalizeCountryName(countryCode) ?? countryCode ?? record.location_end;
      const expectedRegion = resolveRegion(record.file, countryAnswer);

      const extractionRegion: Region | null = extraction.region ?? null;
      if (!extractionRegion && !questions.some((question) => question.id === "region")) {
        issues.push("Region question missing despite absent Region output");
      }

      let resolvedRegion: Region = extractionRegion ?? expectedRegion;
      if (!resolvedRegion) {
        resolvedRegion = "US";
        warnings.push("Falling back to US region default");
      }

      if (extractionRegion && expectedRegion && extractionRegion !== expectedRegion) {
        issues.push(`Region mismatch (expected ${expectedRegion}, got ${extractionRegion})`);
      }

      const expense = {
        dateISO: extraction.dateISO,
        region: resolvedRegion,
        department: DEFAULT_DEPARTMENT,
        category: DEFAULT_CATEGORY,
        total: { amount: extraction.amount, currency: extraction.currency },
      };

      const { active } = await getActiveRules(expense.dateISO);
      const decision = evaluate(expense, active);
      buildExplanation(decision, expense, decision.ruleHits);

      if (MANAGER_SKIP_SET.has(record.file) && decision.steps.includes("manager")) {
        issues.push("Manager should be skipped but is present");
      }

      if (MANAGER_REQUIRE_SET.has(record.file) && !decision.steps.includes("manager")) {
        issues.push("Manager should be required but is missing");
      }

      if (COMPLIANCE_ABSENCE_SET.has(record.file) && decision.steps.includes("compliance")) {
        issues.push("Compliance should not be required for this receipt");
      }

      if (CLARIFICATION_CHECK_SET.has(record.file) && questions.length > 2) {
        issues.push(`Too many clarification prompts (${questions.length})`);
      }

      if (questions.length === 2) {
        warnings.push("Clarification reached maximum threshold");
      }

      results.push({
        file: record.file,
        durationMs: performance.now() - receiptStart,
        issues: [...issues],
        warnings: [...warnings],
        amountDelta,
        currency: extraction.currency,
        managerStep: decision.steps.includes("manager") ? "included" : "skipped",
        complianceStep: decision.steps.includes("compliance"),
        questions: questions.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`Pipeline failed: ${message}`);
      results.push({
        file: record.file,
        durationMs: performance.now() - receiptStart,
        issues: [...issues],
        warnings: [...warnings],
        amountDelta: Number.NaN,
        currency: "?",
        managerStep: "included",
        complianceStep: false,
        questions: 0,
      });
    }
  }

  const totalDuration = performance.now() - start;
  report(results, totalDuration);
}

function parseOnlyArg(args: string[]): Set<string> | null {
  const onlyArg = args.find((arg) => arg.startsWith("--only="));
  if (!onlyArg) {
    return null;
  }
  const files = onlyArg
    .replace("--only=", "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(files);
}

function parseSubsetLabel(args: string[]): string | null {
  const subsetArg = args.find((arg) => arg.startsWith("--subset="));
  if (!subsetArg) {
    return null;
  }
  return subsetArg.replace("--subset=", "");
}

function resolveRegion(fileName: string, normalizedCountry: string | null): Region {
  const direct = REGION_BY_FILE[fileName] as Region | undefined;
  if (direct) {
    return direct;
  }
  return regionFromCountry(normalizedCountry ?? undefined);
}

function report(results: ReceiptRunResult[], durationMs: number) {
  const failures = results.filter((result) => result.issues.length > 0);
  const passes = results.length - failures.length;

  for (const result of results) {
    const status = result.issues.length === 0 ? "✓" : "✗";
    const durationLabel = `${result.durationMs.toFixed(0)}ms`;
    console.log(`${status} ${result.file} (${durationLabel})`);

    if (Number.isFinite(result.amountDelta)) {
      console.log(
        `    amountΔ=${result.amountDelta.toFixed(2)} | currency=${result.currency.toUpperCase()} | manager=${result.managerStep} | questions=${result.questions}`
      );
    }

    for (const issue of result.issues) {
      console.log(`    ISSUE: ${issue}`);
    }
    for (const warning of result.warnings) {
      console.log(`    warning: ${warning}`);
    }
  }

  console.log("");
  console.log(`Processed ${results.length} receipt(s) in ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Pass: ${passes}  Fail: ${failures.length}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
