import { promises as fs } from "fs";
import path from "path";
import Tesseract from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";
import { createRequire } from "module";

const localRequire = typeof require === "undefined" ? createRequire(import.meta.url) : require;
const TESSERACT_CORE_PATH = path.join(
  path.dirname(localRequire.resolve("tesseract.js-core/package.json")),
  "tesseract-core.wasm"
);

async function importPdfJs() {
  const loader = new Function("specifier", "return import(specifier);");
  return loader("pdfjs-dist/legacy/build/pdf.mjs");
}

function createCanvasContext(width, height) {
  const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create canvas 2D context for PDF rendering");
  }
  return { canvas, context };
}

async function renderPdfPageToPng(page, scale) {
  const viewport = page.getViewport({ scale });
  const { canvas, context } = createCanvasContext(viewport.width, viewport.height);
  const renderContext = {
    canvasContext: context,
    viewport,
    canvasFactory: {
      create: createCanvasContext,
      reset(target, nextWidth, nextHeight) {
        target.canvas.width = Math.ceil(nextWidth);
        target.canvas.height = Math.ceil(nextHeight);
      },
      destroy(target) {
        target.canvas.width = 0;
        target.canvas.height = 0;
      },
    },
  };

  await page.render(renderContext).promise;
  const buffer = canvas.toBuffer("image/png");
  renderContext.canvasFactory.destroy({ canvas, context });
  return buffer;
}

export async function ocrPdfToText(pdfPath, options = {}) {
  const { scale = 2.0, lang = "eng", onProgress } = options;
  const pdfjs = await importPdfJs();
  const data = await fs.readFile(pdfPath);
  const cacheDir = path.join(process.cwd(), ".cache", "tesseract");
  await fs.mkdir(cacheDir, { recursive: true });
  const pdfDocument = await pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    disableWorker: true,
    useSystemFonts: true,
  }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const png = await renderPdfPageToPng(page, scale);
    const workerOptions = {
      logger: (message) => {
        if (onProgress) {
          onProgress(message);
        }
      },
      cachePath: cacheDir,
      corePath: TESSERACT_CORE_PATH,
    };

    const tessdataPath = process.env.ERCA_TESSDATA_PATH;
    if (tessdataPath) {
      workerOptions.langPath = tessdataPath;
      workerOptions.cacheMethod = "readOnly";
      workerOptions.gzip = false;
    }

    const result = await Tesseract.recognize(png, lang, workerOptions);
    pages.push(result.data?.text?.trim() ?? "");
  }

  return pages.join("\n\n").trim();
}
