import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Set it in your server environment.`);
  }
  return value;
}

export function getOpenAIClient(): OpenAI {
  if (cachedClient) {
    return cachedClient;
  }
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

/**
 * Get the default extraction model (lightweight for OCR/structured extraction)
 */
export function getExtractionModel(): string {
  return process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4o-mini";
}

/**
 * Get the policy evaluation model (can be high-reasoning model like o1)
 * Defaults to gpt-4o for better reasoning capabilities
 */
export function getPolicyEvalModel(): string {
  return process.env.OPENAI_POLICY_EVAL_MODEL ?? "gpt-5";
}

/**
 * Get model for a specific use case with optional override
 * @param useCase - The use case ('extraction' | 'policy-eval')
 * @param override - Optional model name to override the default
 */
export function getModelForUseCase(
  useCase: "extraction" | "policy-eval",
  override?: string
): string {
  if (override) {
    return override;
  }
  return useCase === "extraction" ? getExtractionModel() : getPolicyEvalModel();
}

// Common response extraction helper for OpenAI Responses API
export function extractStructuredOutput(response: unknown): string {
  type ResponsePayload = {
    output?: Array<{
      content?: Array<{
        text?: { value?: string };
      }>;
    }>;
    output_text?: string | null;
  };
  const payload = response as ResponsePayload;
  const fallback = payload.output?.[0]?.content?.[0]?.text?.value ?? null;
  const json = payload.output_text ?? fallback;
  if (!json) {
    throw new Error("OpenAI response did not include JSON output");
  }
  return json;
}

type JsonSchemaEnvelope = { name: string; schema: Record<string, unknown> };

/**
 * Create a JSON-schema formatted response using the policy-eval model.
 * Notes: high-reasoning models (gpt-5) do not accept temperature.
 */
export async function callPolicyEvalLLM(opts: {
  schema: JsonSchemaEnvelope;
  systemPrompt: string;
  userPrompt: string;
  modelOverride?: string;
}): Promise<string> {
  const client = getOpenAIClient();
  const model = getModelForUseCase("policy-eval", opts.modelOverride);
  const response = await client.responses.create({
    model,
    text: {
      format: {
        type: "json_schema",
        name: opts.schema.name,
        schema: opts.schema.schema,
      },
    },
    input: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
  });
  return extractStructuredOutput(response);
}

/**
 * Create a JSON-schema formatted response using the extraction model.
 * Extraction models accept temperature; we pin to 0 for determinism.
 */
export async function callExtractionLLM(opts: {
  schema: JsonSchemaEnvelope;
  systemPrompt: string;
  userPrompt: string;
  modelOverride?: string;
}): Promise<string> {
  const client = getOpenAIClient();
  const model = getModelForUseCase("extraction", opts.modelOverride);
  const response = await client.responses.create({
    model,
    temperature: 0,
    text: {
      format: {
        type: "json_schema",
        name: opts.schema.name,
        schema: opts.schema.schema,
      },
    },
    input: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
  });
  return extractStructuredOutput(response);
}
