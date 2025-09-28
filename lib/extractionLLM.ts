import { ExtractionSchema } from "../schemas/extraction.schema";
import type { ExtractionSchemaT } from "../schemas/extraction.schema";
import { getOpenAIClient, getExtractionModel } from "./openaiClient";
import { zodToJsonSchema } from "zod-to-json-schema";

function enforceRequiredEverywhere(node: any): any {
  if (!node || typeof node !== "object") return node;
  if (node.type === "object" && node.properties && typeof node.properties === "object") {
    const keys = Object.keys(node.properties);
    // Responses API requires required to exist and include every key in properties
    node.required = keys;
    if (node.additionalProperties === undefined) node.additionalProperties = false;
    for (const k of keys) {
      node.properties[k] = enforceRequiredEverywhere(node.properties[k]);
    }
  }
  if (node.type === "array" && node.items) {
    node.items = enforceRequiredEverywhere(node.items);
  }
  return node;
}

function buildExtractionJsonSchema() {
  // Generate JSON Schema once from the Zod source of truth
  const raw = zodToJsonSchema(ExtractionSchema as any, { name: "ExtractionResponse" } as any) as any;
  // zod-to-json-schema may return either the schema directly or via definitions/$defs
  const schema = raw?.definitions?.ExtractionResponse ?? raw?.$defs?.ExtractionResponse ?? raw;
  const strict = enforceRequiredEverywhere(structuredClone(schema));
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
- If the receipt is itemized (e.g., base fare, taxes/fees, tip), include items and ensure their amounts sum to the total (e.g., base + fees + tip − discounts).
- Always include category; if not confidently inferred, use 'ride_hail' with low confidence.
- If department cannot be inferred, use 'other' with low confidence.`;
// Additional enforcement notes for the model:
// - If you cannot confidently determine an itemized breakdown, set items to an empty array [].
// - If you include items, the sum of item amounts must equal the total amount exactly (within 0.01).

export async function runExtractionLLM(receiptText: string): Promise<ExtractionSchemaT> {
  const client = getOpenAIClient();
  const model = getExtractionModel();

  const response = await client.responses.create({
    model,
    temperature: 0,
    text: {
      format: {
        type: "json_schema",
        name: extractionJsonSchema.name,
        schema: extractionJsonSchema.schema,
      },
    },
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Receipt content:\n${receiptText}`,
      },
    ],
  });

  const fallbackOutput = (response as any)?.output?.[0]?.content?.[0]?.text?.value;
  const jsonPayload = response.output_text ?? fallbackOutput;
  if (!jsonPayload) {
    throw new Error("OpenAI response did not include JSON output");
  }

  const parsed = JSON.parse(jsonPayload);
  const validated = ExtractionSchema.parse(parsed);
  return validated;
}
