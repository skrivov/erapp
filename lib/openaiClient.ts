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
  return process.env.OPENAI_POLICY_EVAL_MODEL ?? "gpt-4o";
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
