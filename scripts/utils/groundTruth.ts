import { promises as fs } from "fs";
import path from "path";

/**
 * @typedef {Object} ReceiptGroundTruth
 * @property {string} file
 * @property {number} total
 * @property {number} subtotal
 * @property {number | undefined} [booking_fee]
 * @property {string | undefined} [currency]
 * @property {string | undefined} [date]
 * @property {string} location_start
 * @property {string} location_end
 */

let cachedTruth = null;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);

  return values.map((value) => value.trim().replace(/\r$/, ""));
}

export async function loadGroundTruth() {
  if (cachedTruth) {
    return cachedTruth;
  }

  const csvPath = path.join(process.cwd(), "scripts", "datasets", "taxi_ground_truth.csv");
  const raw = await fs.readFile(csvPath, "utf8");
  const lines = raw.split(/\n+/).filter((line) => line.trim().length > 0);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) {
    throw new Error("Ground truth CSV is empty");
  }

  const headers = parseCsvLine(headerLine);
  const headerIndex = new Map();
  headers.forEach((header, index) => {
    headerIndex.set(header, index);
  });

  const requiredHeaders = ["file", "total", "subtotal", "location_start", "location_end"];
  for (const name of requiredHeaders) {
    if (!headerIndex.has(name)) {
      throw new Error(`Ground truth CSV missing required column: ${name}`);
    }
  }

  const records = dataLines.map((line) => {
    const parts = parseCsvLine(line);
    if (parts.length < headers.length) {
      throw new Error(`Malformed CSV row: ${line}`);
    }

    const getValue = (name) => {
      const index = headerIndex.get(name);
      return typeof index === "number" ? parts[index] : undefined;
    };

    const toNumber = (name) => {
      const value = getValue(name);
      if (value === undefined || value === "") {
        return undefined;
      }
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    };

    const record = {
      file: getValue("file") ?? "",
      total: toNumber("total") ?? 0,
      subtotal: toNumber("subtotal") ?? 0,
      booking_fee: toNumber("booking_fee"),
      currency: getValue("currency"),
      date: getValue("date"),
      location_start: getValue("location_start") ?? "",
      location_end: getValue("location_end") ?? "",
    };

    if (!record.file) {
      throw new Error(`Missing file name in row: ${line}`);
    }

    return record;
  });

  cachedTruth = records;
  return records;
}

export function guessCountryCode(location) {
  const match = location.match(/([A-Z]{2})\s*$/);
  return match ? match[1] : null;
}

export function normalizeCountryName(code) {
  if (!code) {
    return null;
  }

  const normalized = code.toUpperCase();

  switch (normalized) {
    case "US":
      return "United States";
    case "DE":
      return "Germany";
    case "FR":
      return "France";
    case "IE":
      return "Ireland";
    case "CA":
      return "Canada";
    case "AU":
      return "Australia";
    case "MX":
      return "Mexico";
    case "BR":
      return "Brazil";
    case "ZA":
      return "South Africa";
    case "IN":
      return "India";
    case "CN":
      return "China";
    case "JP":
      return "Japan";
    default:
      return normalized;
  }
}
