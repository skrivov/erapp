import { promises as fs } from "fs";
import path from "path";

const auditPath = path.join(process.cwd(), "data", "audit.jsonl");

export async function appendAudit(entry: Record<string, unknown>) {
  const line = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(auditPath, line, "utf8");
}
