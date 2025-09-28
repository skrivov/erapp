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

export function getExtractionModel(): string {
  return process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4o-mini";
}

export function getPolicyEvalModel(): string {
  return process.env.OPENAI_POLICY_EVAL_MODEL ?? "gpt-4o-mini";
}
