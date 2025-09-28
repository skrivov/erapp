import { NextResponse } from "next/server";
import { ExtractionSchema } from "../../../schemas/extraction.schema";
import { neededQuestions } from "../../../lib/clarifications";
import type { Extraction } from "../../../lib/types";
import { runExtractionLLM } from "../../../lib/extractionLLM";

export async function POST(request: Request) {
  const body = await request.json();
  const { source, payload } = body ?? {};

  if (!payload || source !== "text") {
    return NextResponse.json(
      { error: "Expected { source: 'text', payload }" },
      { status: 400 }
    );
  }

  let candidate: unknown;
  try {
    candidate = await runExtractionLLM(payload);
  } catch (error) {
    console.error("LLM extraction failed", error);
    return NextResponse.json(
      { error: "LLM extraction failed" },
      { status: 502 }
    );
  }

  const parseResult = ExtractionSchema.safeParse(candidate);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Extraction failed validation", details: parseResult.error.format() },
      { status: 422 }
    );
  }

  const extraction = parseResult.data as Extraction;
  const questions = neededQuestions(extraction);

  return NextResponse.json({
    extraction,
    needsQuestions: questions,
    meta: { engine: "llm" },
  });
}
