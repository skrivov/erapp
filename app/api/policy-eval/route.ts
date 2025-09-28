import { NextResponse } from "next/server";
import { runPolicyQA } from "../../../lib/policyQA";

export async function POST() {
  if (process.env.POLICY_EVAL_ENABLED !== "true") {
    return NextResponse.json({ error: "Policy eval disabled" }, { status: 403 });
  }
  try {
    const result = await runPolicyQA();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Policy eval failed", error);
    return NextResponse.json(
      { error: "Unable to evaluate policies", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
