import { ExtractionSchema } from "../schemas/extraction.schema";
import type { ExtractionSchemaT } from "../schemas/extraction.schema";
import { callExtractionLLM } from "./openaiClient";
import { zodToJsonSchema } from "zod-to-json-schema";

type JsonSchemaNode = {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode | JsonSchemaNode[];
  additionalProperties?: boolean | JsonSchemaNode;
  required?: string[];
  definitions?: Record<string, JsonSchemaNode>;
  $defs?: Record<string, JsonSchemaNode>;
  [key: string]: unknown;
};

function enforceRequiredEverywhere<T extends JsonSchemaNode>(node: T): T {
  if (!node || typeof node !== "object") {
    return node;
  }
  if (node.type === "object" && node.properties && typeof node.properties === "object") {
    const keys = Object.keys(node.properties);
    node.required = keys;
    if (node.additionalProperties === undefined) {
      node.additionalProperties = false;
    }
    for (const key of keys) {
      node.properties[key] = enforceRequiredEverywhere(node.properties[key]);
    }
  }
  if (node.type === "array" && node.items) {
    if (Array.isArray(node.items)) {
      node.items = node.items.map((child) => enforceRequiredEverywhere(child));
    } else {
      node.items = enforceRequiredEverywhere(node.items);
    }
  }
  return node;
}

function buildExtractionJsonSchema() {
  const rawSchema = zodToJsonSchema(ExtractionSchema, { name: "ExtractionResponse" }) as JsonSchemaNode;
  const schemaCandidate =
    rawSchema.definitions?.ExtractionResponse ?? rawSchema.$defs?.ExtractionResponse ?? rawSchema;
  const strict = enforceRequiredEverywhere(structuredClone(schemaCandidate));
  return {
    name: "ExtractionResponse",
    schema: strict,
  } as const;
}

const extractionJsonSchema = buildExtractionJsonSchema();

const systemPrompt = `You are a structured data extractor for taxi/ride-hailing receipts. Return JSON only.
- Always follow the provided JSON schema.
- If a field is missing in the receipt, make a conservative best guess and lower the confidence score.
- Ensure confidences are between 0 and 1.
- Vendor should be the provider name as printed on the receipt (e.g., Uber, Lyft, Bolt, taxi company name).
- Dates must be ISO 8601 with timezone (e.g. 2024-10-01T00:00:00Z).
- Amounts must be numeric without currency symbols. Use negative amounts for discounts, credits, or refunds.
- Always include country. Use the country where the ride occurred (e.g., "United States", "Germany"). Infer from pickup/dropoff addresses, airport codes, city/state, or vendor metadata. If uncertain, pick the most plausible country and lower its confidence.
- If the receipt is itemized (e.g., base fare, taxes/fees, tip), include items and ensure their amounts sum to the total (e.g., base + fees + tip − discounts).
- Always include category; if not confidently inferred, use 'ride_hail' with low confidence.
- Always include region using one of: 'US', 'EU', 'APAC'. Keep region consistent with the resolved country. Use these hints:
  - 'US': trips within North & South America hot spots (United States, Canada, Mexico, Brazil).
  - 'EU': destinations across Europe including the United Kingdom and EU member states.
  - 'APAC': Asia-Pacific hubs such as Japan, India, Singapore, Australia, Hong Kong.
  - Never label Canada, Mexico, Brazil, or other Americas destinations as 'APAC'.
- Map currency symbols to 3-letter ISO codes before output: '€'→'EUR', '₹'→'INR', 'CN¥' or '¥' when used in China→'CNY', standalone '¥' for Japan→'JPY', '$' with US context→'USD', 'C$'→'CAD', 'A$'→'AUD', 'MX$'→'MXN', 'R$'→'BRL', trailing 'R' for South Africa→'ZAR'. If unsure, keep the currency from the receipt symbol and do not invent alternatives.
- If department cannot be inferred, use 'other' with low confidence.`;
// Additional enforcement notes for the model:
// - If you cannot confidently determine an itemized breakdown, set items to an empty array [].
// - If you include items, the sum of item amounts must equal the total amount exactly (within 0.01).

export async function runExtractionLLM(receiptText: string): Promise<ExtractionSchemaT> {
  const jsonPayload = await callExtractionLLM({
    schema: extractionJsonSchema,
    systemPrompt,
    userPrompt: `Receipt content:\n${receiptText}`,
  });

  const parsed = JSON.parse(jsonPayload);
  const validated = ExtractionSchema.parse(parsed);
  return validated;
}
