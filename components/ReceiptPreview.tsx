"use client";

type ReceiptPreviewProps = {
  text: string;
  filename?: string;
};

export function ReceiptPreview({ text, filename }: ReceiptPreviewProps) {
  return (
    <div className="border border-slate-300 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between text-sm font-semibold text-slate-700">
        <span>Receipt preview</span>
        {filename ? (
          <span className="text-xs font-normal text-slate-500">{filename}</span>
        ) : null}
      </div>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs text-slate-600">
        {text}
      </pre>
    </div>
  );
}
