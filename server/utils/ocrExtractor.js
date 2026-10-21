const { createWorker } = require("tesseract.js");

// mupdf is ESM-only, so it must be loaded via dynamic import() even from
// this CommonJS file. It's pure WebAssembly — no native compilation, no
// platform-specific binaries, works the same on Windows/Mac/Linux.
const OCR_WORKERS = 3; // parallel Tesseract workers
let mupdfPromise;
function getMupdf() {
  if (!mupdfPromise) {
    mupdfPromise = import("mupdf");
  }
  return mupdfPromise;
}

/**
 * OCRs a scanned (image-only) PDF: renders each page to a PNG using mupdf, then
 * runs Tesseract on it to recover the text. Pages are processed in parallel by a
 * small pool of Tesseract workers. Used as a fallback when normal text extraction
 * (pdfExtractor.js) comes back empty for some or all pages.
 *
 * @param {Buffer} buffer
 * @param {(done: number, total: number) => void} [onProgress]
 * @param {number[]|null} [onlyPages] 1-based page numbers to OCR (default: all pages)
 * @returns {Promise<{text: string, pageCount: number, pages: Array<{pageNumber: number, text: string}>}>}
 */
async function ocrPdfBuffer(buffer, onProgress, onlyPages = null) {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  const pageCount = doc.countPages();

  const targets = (onlyPages && onlyPages.length > 0
    ? onlyPages.filter((n) => n >= 1 && n <= pageCount)
    : Array.from({ length: pageCount }, (_, i) => i + 1)
  ).sort((a, b) => a - b);

  const poolSize = Math.max(1, Math.min(OCR_WORKERS, targets.length));
  const workers = await Promise.all(Array.from({ length: poolSize }, () => createWorker("eng")));

  const results = new Map();
  let cursor = 0;
  let done = 0;

  async function runWorker(worker) {
    while (true) {
      const idx = cursor++;
      if (idx >= targets.length) return;
      const pageNumber = targets[idx];
      const page = doc.loadPage(pageNumber - 1);
      // scale(2, 2) renders at 2x resolution for better OCR accuracy
      const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB);
      const pngBuffer = pixmap.asPNG();
      let text = "";
      try {
        const res = await worker.recognize(pngBuffer);
        text = (res.data.text || "").trim();
      } catch (err) {
        console.warn(`[ocr] page ${pageNumber} failed: ${err.message}`);
      }
      results.set(pageNumber, text);
      done++;
      if (onProgress) onProgress(done, targets.length);
    }
  }

  try {
    await Promise.all(workers.map(runWorker));
  } finally {
    await Promise.all(workers.map((w) => w.terminate().catch(() => {})));
  }

  const pages = targets.map((n) => ({ pageNumber: n, text: results.get(n) || "" }));
  return { text: pages.map((p) => p.text).join("\n\n").trim(), pageCount, pages };
}
module.exports = { ocrPdfBuffer };
