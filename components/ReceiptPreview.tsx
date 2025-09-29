"use client";

type ReceiptPreviewProps = {
  text: string;
  filename?: string;
  maxHeightClass?: string;
  className?: string;
};

export function ReceiptPreview({ text, filename, maxHeightClass = "max-h-64", className }: ReceiptPreviewProps) {
  const wrapperBase = "flex h-full flex-col border border-slate-300 bg-white p-4";
  const wrapperClass = className ? `${wrapperBase} ${className}` : wrapperBase;

  return (
    <div className={wrapperClass}>
      <div className="mb-2 flex items-baseline justify-between text-sm font-semibold text-slate-700">
        <span>Receipt preview</span>
        {filename ? (
          <span className="text-xs font-normal text-slate-500">{filename}</span>
        ) : null}
      </div>
      <pre className={`${maxHeightClass} flex-1 overflow-y-auto whitespace-pre-wrap break-words text-xs text-slate-600`}>
        {text}
      </pre>
    </div>
  );
}
