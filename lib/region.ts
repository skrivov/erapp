import { Region } from "./types";

const COUNTRY_TO_REGION: Record<string, Region> = {
  US: "US",
  USA: "US",
  UNITED_STATES: "US",
  GERMANY: "EU",
  FRANCE: "EU",
  UK: "EU",
  UNITED_KINGDOM: "EU",
  IRELAND: "EU",
  INDIA: "APAC",
  JAPAN: "APAC",
  SINGAPORE: "APAC",
  AUSTRALIA: "APAC",
};

export function regionFromCountry(country?: string): Region {
  if (!country) {
    return "US";
  }
  const normalized = country.trim().toUpperCase().replace(/\s+/g, "_");
  return COUNTRY_TO_REGION[normalized] ?? "US";
}
