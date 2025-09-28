"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ReceiptPreview } from "../../components/ReceiptPreview";

const REVIEW_KEY = "erca:review";

export default function UploadPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [processingFile, setProcessingFile] = useState(false);

  const resetOcrState = useCallback(() => {
    setProcessingFile(false);
    setOcrProgress(0);
  }, []);

  const updateText = useCallback((next: string) => {
    setText(next);
    setError(null);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file) {
      return;
    }

    setProcessingFile(true);
    setError(null);
    setOcrProgress(0);
    setFileName(file.name);

    try {
      const dataUrl = await (async () => {
        if (file.type === "application/pdf") {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
          }
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
          }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Unable to initialise canvas context for PDF rendering");
          }
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport }).promise;
          return canvas.toDataURL("image/png");
        }

        const supportedImage = file.type.startsWith("image/");
        if (!supportedImage) {
          throw new Error("Unsupported file format. Please upload an image or PDF.");
        }

        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
      })();

      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(dataUrl, "eng", {
        logger: (message) => {
          if (typeof message.progress === "number") {
            setOcrProgress(message.progress);
          }
        },
      });

      const recognisedText = result.data?.text ?? "";
      if (!recognisedText.trim()) {
        throw new Error("No text detected. Try a clearer image or adjust contrast.");
      }

      updateText(recognisedText.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to process file";
      setError(message);
      setFileName(null);
    } finally {
      resetOcrState();
    }
  }, [resetOcrState, updateText]);

  const onFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file);
        event.target.value = "";
      }
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (processingFile) {
        return;
      }
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile, processingFile]
  );

  const dropInstructions = useMemo(() => {
    if (processingFile) {
      const percent = Math.round(ocrProgress * 100);
      return `Running OCR${percent ? ` • ${percent}%` : "…"}`;
    }
    if (fileName) {
      return `Selected: ${fileName}`;
    }
    return "Drop a receipt (PDF or image) here, or click to browse";
  }, [fileName, ocrProgress, processingFile]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      setError("Provide receipt text or upload a file for OCR before extracting.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "text", payload: text }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error ?? "Extraction failed");
      }
      const extractionPayload = await response.json();
      sessionStorage.setItem(
        REVIEW_KEY,
        JSON.stringify({ ...extractionPayload, rawText: text })
      );
      router.push("/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to extract receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-800">Upload receipt</h1>
        <p className="text-sm text-slate-600">
          Upload a receipt (PDF or image) and we will run Tesseract.js OCR, or paste raw text if you already have it. The extractor asks at most two clarifying questions when needed.
        </p>
      </header>
      <section
        onDragOver={(event) => {
          event.preventDefault();
          if (!processingFile) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-sm font-medium transition ${
          processingFile
            ? "border-emerald-400 bg-emerald-50 text-emerald-700"
            : isDragging
              ? "border-emerald-400 bg-emerald-50 text-emerald-700"
              : "border-slate-300 bg-white text-slate-600 hover:border-emerald-300"
        }`}
        onClick={() => {
          if (processingFile) {
            return;
          }
          document.getElementById("receipt-file-input")?.click();
        }}
      >
        <input
          id="receipt-file-input"
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={onFileInput}
          disabled={processingFile}
        />
        <span className="text-sm uppercase tracking-wide text-slate-500">Tesseract OCR</span>
        <p className="text-center text-sm text-slate-600">{dropInstructions}</p>
      </section>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <textarea
          className="min-h-[12rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-200"
          placeholder="Paste receipt text here"
          value={text}
          onChange={(event) => updateText(event.target.value)}
          />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Extracting…" : "Extract"}
          </button>
          <button
            type="button"
            className="border border-slate-300 px-5 py-2.5 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            onClick={() => {
              setFileName(null);
              setOcrProgress(0);
              setIsDragging(false);
              updateText("");
            }}
          >
            Clear
          </button>
        </div>
      </form>
      {text ? <ReceiptPreview text={text} filename={fileName ?? undefined} /> : null}
    </div>
  );
}
