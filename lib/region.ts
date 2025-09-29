import { Region } from "./types";

const COUNTRY_TO_REGION: Record<string, Region> = {
  US: "US",
  USA: "US",
  UNITED_STATES: "US",
  CANADA: "US",
  CA: "US",
  MEXICO: "US",
  MX: "US",
  BRAZIL: "US",
  BR: "US",
  GERMANY: "EU",
  FRANCE: "EU",
  UK: "EU",
  UNITED_KINGDOM: "EU",
  IRELAND: "EU",
  FR: "EU",
  DE: "EU",
  IE: "EU",
  GB: "EU",
  INDIA: "APAC",
  JAPAN: "APAC",
  SINGAPORE: "APAC",
  AUSTRALIA: "APAC",
  IN: "APAC",
  JP: "APAC",
  SG: "APAC",
  AU: "APAC",
  CN: "APAC",
  CHINA: "APAC",
  HK: "APAC",
  HONG_KONG: "APAC",
  ZA: "APAC",
  SOUTH_AFRICA: "APAC",
};

export function regionFromCountry(country?: string): Region {
  if (!country) {
    return "US";
  }
  const normalized = country.trim().toUpperCase().replace(/\s+/g, "_");
  return COUNTRY_TO_REGION[normalized] ?? "US";
}
