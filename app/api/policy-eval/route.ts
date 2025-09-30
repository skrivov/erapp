import { NextResponse } from "next/server";
import { runPolicyQA } from "../../../lib/policyQA";
import type { Rule } from "../../../lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { policies, modelOverride } = body as {
      policies: Rule[];
      modelOverride?: string;
    };

    if (!Array.isArray(policies) || policies.length === 0) {
      return NextResponse.json(
        { error: "policies array is required and must not be empty" },
        { status: 400 }
      );
    }

    const result = await runPolicyQA(policies, { useLLM: true, modelOverride });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Policy eval failed", error);
    return NextResponse.json(
      {
        error: "Unable to evaluate policies",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}