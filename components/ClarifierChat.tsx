"use client";

import { ClarificationQuestion } from "../lib/types";

type ClarifierChatProps = {
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
};

export function ClarifierChat({ questions, answers, onAnswer }: ClarifierChatProps) {
  if (!questions.length) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        All set — no clarifications needed.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((question) => (
        <div key={question.id} className="border border-slate-300 bg-white p-4">
          <p className="text-sm font-medium text-slate-700">{question.prompt}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                className={`border px-3 py-1.5 text-sm transition ${
                  answers[question.id] === option
                    ? "border-emerald-600 bg-emerald-100 text-emerald-700"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400"
                }`}
                onClick={() => onAnswer(question.id, option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
