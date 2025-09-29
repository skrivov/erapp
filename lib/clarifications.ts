import { ClarificationQuestion, Extraction } from "./types";

const REGION_THRESHOLD = 0.8;
const DEPARTMENT_THRESHOLD = 0.7;
const CATEGORY_THRESHOLD = 0.7;

export function neededQuestions(extraction: Extraction): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  const confidence = extraction.confidence;

  const regionConfidence = confidence.region ?? 0;
  if (!extraction.region || regionConfidence < REGION_THRESHOLD) {
    questions.push({
      id: "region",
      type: "single",
      prompt: "Which region should this expense use?",
      options: ["US", "EU", "APAC"],
    });
  }

  const departmentConfidence = confidence.inferredDepartment ?? 0;
  if (
    (!extraction.inferredDepartment || departmentConfidence < DEPARTMENT_THRESHOLD) &&
    questions.length < 2
  ) {
    questions.push({
      id: "department",
      type: "single",
      prompt: "Which department should we charge this to?",
      options: ["engineering", "sales", "hr", "other"],
    });
  }

  if (questions.length >= 2) {
    return questions.slice(0, 2);
  }

  const categoryConfidence = confidence.category ?? 0;
  if (categoryConfidence < CATEGORY_THRESHOLD && questions.length < 2) {
    questions.push({
      id: "purpose",
      type: "single",
      prompt: "Primary purpose?",
      options: ["Client Meeting", "Office Commute", "Airport Transfer", "Other"],
    });
  }

  return questions.slice(0, 2);
}
