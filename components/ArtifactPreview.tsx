"use client";

import { useEffect, useMemo, useState } from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.25;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

type ArtifactPreviewProps = {
  url?: string | null;
  filename?: string;
  placeholder?: string;
  initialScale?: number;
  maxHeightClass?: string;
  disableControls?: boolean;
  className?: string;
};

export function ArtifactPreview({
  url,
  filename,
  placeholder,
  initialScale = 1,
  maxHeightClass = "max-h-96",
  disableControls = false,
  className,
}: ArtifactPreviewProps) {
  const clampedInitial = useMemo(() => clampScale(initialScale), [initialScale]);
  const [scale, setScale] = useState(() => (disableControls ? 1 : clampedInitial));

  useEffect(() => {
    setScale(disableControls ? 1 : clampedInitial);
  }, [clampedInitial, disableControls, url]);

  if (!url) {
    const emptyBase = "flex h-full flex-col justify-center border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500";
    const emptyClass = className ? `${emptyBase} ${className}` : emptyBase;
    return <section className={emptyClass}>{placeholder ?? "Original receipt preview will appear here once available."}</section>;
  }

  const handleZoomIn = () => setScale((prev) => clampScale(prev + ZOOM_STEP));
  const handleZoomOut = () => setScale((prev) => clampScale(prev - ZOOM_STEP));
  const handleReset = () => setScale(clampedInitial);

  const containerClass = disableControls
    ? `flex-1 overflow-hidden border border-slate-200 bg-slate-50 ${maxHeightClass}`
    : `flex-1 overflow-auto border border-slate-200 bg-slate-50 ${maxHeightClass}`;

  const wrapperBase = "flex h-full flex-col gap-2 border border-slate-300 bg-white p-4";
  const wrapperClass = className ? `${wrapperBase} ${className}` : wrapperBase;

  return (
    <section className={wrapperClass}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col text-sm font-semibold text-slate-700">
          <span>Receipt image</span>
          {filename ? (
            <span className="text-xs font-normal text-slate-500">{filename}</span>
          ) : null}
        </div>
        {disableControls ? null : (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
              className="rounded border border-slate-300 px-2 py-1 transition enabled:hover:border-emerald-300 enabled:hover:text-emerald-700 disabled:opacity-50"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
              className="rounded border border-slate-300 px-2 py-1 transition enabled:hover:border-emerald-300 enabled:hover:text-emerald-700 disabled:opacity-50"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={scale === clampedInitial}
              className="rounded border border-slate-300 px-2 py-1 transition enabled:hover:border-emerald-300 enabled:hover:text-emerald-700 disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        )}
      </div>
      <div className={containerClass}>
        {disableControls ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={filename ? `Preview of ${filename}` : "Receipt preview"}
            className="h-full w-full select-none object-contain"
            draggable={false}
          />
        ) : (
          <div className="inline-block" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={filename ? `Preview of ${filename}` : "Receipt preview"} className="block max-w-full select-none" draggable={false} />
          </div>
        )}
      </div>
    </section>
  );
}
