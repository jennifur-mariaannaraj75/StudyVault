const { createWorker } = require("tesseract.js");

// mupdf is ESM-only, so it must be loaded via dynamic import() even from
// this CommonJS file. It's pure WebAssembly — no native compilation, no
// platform-specific binaries, works the same on Windows/Mac/Linux.
let mupdfPromise;
function getMupdf() {
  if (!mupdfPromise) {
    mupdfPromise = import("mupdf");
  }
  return mupdfPromise;
}

/**
 * OCRs a scanned (image-only) PDF page by page: renders each page to a PNG
 * using mupdf, then runs Tesseract on it to recover the text. Used as a
 * fallback when normal text extraction (pdfExtractor.js) comes back empty.
 *
 * @param {Buffer} buffer
 * @param {(page: number, total: number) => void} [onProgress]
 * @returns {Promise<{text: string, pageCount: number}>}
 */
async function ocrPdfBuffer(buffer, onProgress) {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  const pageCount = doc.countPages();
  const worker = await createWorker("eng");

  let fullText = "";
  try {
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      // scale(2, 2) renders at 2x resolution for better OCR accuracy
      const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB);
      const pngBuffer = pixmap.asPNG();

      const {
        data: { text },
      } = await worker.recognize(pngBuffer);

      fullText += text + "\n\n";
      if (onProgress) onProgress(i + 1, pageCount);
    }
  } finally {
    await worker.terminate();
  }

  return { text: fullText.trim(), pageCount };
}

module.exports = { ocrPdfBuffer };
