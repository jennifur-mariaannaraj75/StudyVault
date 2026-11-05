const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

let mupdfPromise = null;
function getMupdf() {
  if (!mupdfPromise) {
    mupdfPromise = import("mupdf");
  }
  return mupdfPromise;
}

const os = require("os");
const extractedImagesRoot = process.env.VERCEL
  ? path.join(os.tmpdir(), "studyvault_uploads", "extracted_images")
  : path.join(__dirname, "..", "data", "uploads", "extracted_images");
try {
  if (!fs.existsSync(extractedImagesRoot)) {
    fs.mkdirSync(extractedImagesRoot, { recursive: true });
  }
} catch (_) {}

/**
 * Cleans a raw figure caption string into a crisp Figure Name (e.g. "Figure 9.7 Variable partition").
 */
function cleanFigureTitle(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/\r\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+\d{1,4}\s*$/, "")
    .replace(/[.\s]+$/, "")
    .trim()
    .slice(0, 95);
}

/**
 * Extracts genuine Figure Captions (e.g., "Figure 9.7 Variable partition", "Figure 7.1 Resource-allocation graph")
 * from a page's text (works on both OCR text from scanned PDFs and digital PDF text).
 * Filters out in-sentence references like "shown in Figure 9.7." or "Figure 9.7 shows...".
 */
function extractFigureCaptionsFromPageText(pageText) {
  if (!pageText) return [];
  const text = String(pageText)
    .replace(/---\s*Page\s*\d+\s*---/gi, "")
    .replace(/\r\n/g, "\n");

  const results = [];
  const seenNums = new Set();

  // Match "Figure <num> <Title>" or "Fig. <num> <Title>"
  const regex = /(?:^|[\n.!?;])\s*(?:Figure|Fig\.?|FIGURE|FIG\.?)\s*(\d+(?:\s*[.\-]\s*\d+)?[a-zA-Z]?)(?:\s*[:.\-–—]\s*|\s+)([A-Z0-9][^\n.!?;]{2,95})/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const rawNum = m[1].replace(/\s+/g, "");
    let tail = m[2].trim();

    // Skip prose sentences where "Figure X.Y" is the subject followed by a verb
    if (
      /^(?:is\b|are\b|was\b|were\b|shows\b|illustrates\b|depicts\b|demonstrates\b|represents\b|gives\b|lists\b|compares\b|summarizes\b|we\b|can\b|has\b|have\b|will\b|may\b|also\b|where\b|when\b|which\b|that\b|in\b|for\b|to\b|with\b|on\b|at\b|from\b)/i.test(
        tail
      )
    ) {
      continue;
    }

    tail = cleanFigureTitle(tail);
    if (tail.length < 3 || /^\d+$/.test(tail)) continue;

    const fullTitle = cleanFigureTitle(`Figure ${rawNum} ${tail}`);
    if (!seenNums.has(rawNum)) {
      seenNums.add(rawNum);
      results.push({
        figNum: rawNum,
        name: fullTitle,
        relPos: Math.min(0.95, Math.max(0.05, m.index / Math.max(1, text.length))),
      });
    }
  }

  return results;
}

/**
 * Analyzes an RGB buffer (w x h, 3 bytes/pixel) to check if the page is sideways (rotated 90 deg).
 * On an upright page, horizontal rows alternate rapidly between dark text lines and white gaps.
 * On a sideways page (like os_unit3_part1.pdf or cat 2 os.pdf), vertical columns alternate instead.
 */
function ensureUprightRgbBuffer(rgb, w, h) {
  const mx = Math.floor(w * 0.08);
  const my = Math.floor(h * 0.08);

  const rowInk = new Int32Array(h);
  const colInk = new Int32Array(w);

  for (let y = my; y < h - my; y += 2) {
    const rowOff = y * w * 3;
    for (let x = mx; x < w - mx; x += 2) {
      const idx = rowOff + x * 3;
      if (rgb[idx] < 215 || rgb[idx + 1] < 215 || rgb[idx + 2] < 215) {
        rowInk[y]++;
        colInk[x]++;
      }
    }
  }

  // Measure high-frequency transitions (text line -> white space -> text line)
  const rowThresh = Math.max(4, Math.floor((w - 2 * mx) * 0.03));
  const colThresh = Math.max(4, Math.floor((h - 2 * my) * 0.03));

  let rowTransitions = 0;
  let prevR = false;
  for (let y = my; y < h - my; y += 2) {
    const cur = rowInk[y] >= rowThresh;
    if (cur !== prevR) rowTransitions++;
    prevR = cur;
  }

  let colTransitions = 0;
  let prevC = false;
  for (let x = mx; x < w - mx; x += 2) {
    const cur = colInk[x] >= colThresh;
    if (cur !== prevC) colTransitions++;
    prevC = cur;
  }

  // If vertical columns have significantly more text-line transitions than horizontal rows,
  // the page is rotated 90 degrees counter-clockwise — rotate +90 degrees clockwise to make it upright!
  if (colTransitions > rowTransitions * 1.25 || (w > h * 1.15 && colTransitions > rowTransitions)) {
    const newW = h;
    const newH = w;
    const rotated = new Uint8Array(newW * newH * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 3;
        // +90 deg clockwise: (x, y) -> (h - 1 - y, x)
        const dstX = h - 1 - y;
        const dstY = x;
        const dstIdx = (dstY * newW + dstX) * 3;
        rotated[dstIdx] = rgb[srcIdx];
        rotated[dstIdx + 1] = rgb[srcIdx + 1];
        rotated[dstIdx + 2] = rgb[srcIdx + 2];
      }
    }
    return { rgb: rotated, width: newW, height: newH, rotated90: true };
  }

  return { rgb, width: w, height: h, rotated90: false };
}

/**
 * Segments an upright page RGB buffer (W x H) into horizontal strips, identifies and strips out
 * full-width prose paragraphs, and returns tightly cropped bounding boxes [x0, y0, x1, y1]
 * of ONLY the figure/diagram regions!
 */
function findFigureCropBoxesOnUprightPage(rgb, W, H, expectedCount = 1, hintRelPositions = [0.5]) {
  const marginX = Math.floor(W * 0.05);
  const marginY = Math.floor(H * 0.05);

  const rowInk = new Int32Array(H);
  const rowMinX = new Int32Array(H).fill(W);
  const rowMaxX = new Int32Array(H).fill(0);

  for (let y = marginY; y < H - marginY; y++) {
    const rowOff = y * W * 3;
    let count = 0;
    let minX = W;
    let maxX = 0;
    for (let x = marginX; x < W - marginX; x++) {
      const idx = rowOff + x * 3;
      if (rgb[idx] < 225 || rgb[idx + 1] < 225 || rgb[idx + 2] < 225) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    rowInk[y] = count;
    rowMinX[y] = minX;
    rowMaxX[y] = maxX;
  }

  // Group non-empty rows into horizontal strips (allowing up to 2px gap inside a strip)
  const strips = [];
  let inStrip = false;
  let cur = null;
  let emptyRun = 0;

  for (let y = marginY; y < H - marginY; y++) {
    const hasInk = rowInk[y] >= 4;
    if (hasInk) {
      emptyRun = 0;
      if (!inStrip) {
        inStrip = true;
        cur = { y0: y, y1: y, minX: rowMinX[y], maxX: rowMaxX[y], maxRowInk: rowInk[y] };
      } else {
        cur.y1 = y;
        if (rowMinX[y] < cur.minX) cur.minX = rowMinX[y];
        if (rowMaxX[y] > cur.maxX) cur.maxX = rowMaxX[y];
        if (rowInk[y] > cur.maxRowInk) cur.maxRowInk = rowInk[y];
      }
    } else if (inStrip) {
      emptyRun++;
      if (emptyRun >= 3) {
        cur.height = cur.y1 - cur.y0 + 1;
        cur.spanW = Math.max(0, cur.maxX - cur.minX);
        strips.push(cur);
        inStrip = false;
        cur = null;
      }
    }
  }
  if (inStrip && cur) {
    cur.height = cur.y1 - cur.y0 + 1;
    cur.spanW = Math.max(0, cur.maxX - cur.minX);
    strips.push(cur);
  }

  if (strips.length === 0) return [];

  // Determine typical prose column width and left margin
  const spans = strips.map((s) => s.spanW).sort((a, b) => a - b);
  const proseWidth = spans[Math.floor(spans.length * 0.8)] || W * 0.72;
  const maxTextLineHeight = Math.max(28, Math.floor(H * 0.024));

  // Classify each strip: is it a standard prose text line, or part of a diagram/figure?
  // A prose line is thin (<= maxTextLineHeight) and wide (>= 0.72 * proseWidth).
  strips.forEach((s, idx) => {
    const isThinLine = s.height <= maxTextLineHeight;
    const isWideLine = s.spanW >= proseWidth * 0.74;
    s.isProseLine = isThinLine && isWideLine;
  });

  // Also mark trailing last lines of prose paragraphs (a thin line immediately following >= 2 wide prose lines within 14px)
  for (let i = 2; i < strips.length; i++) {
    const s = strips[i];
    const prev1 = strips[i - 1];
    const prev2 = strips[i - 2];
    const gap = s.y0 - prev1.y1;
    if (
      !s.isProseLine &&
      s.height <= maxTextLineHeight &&
      prev1.isProseLine &&
      prev2.isProseLine &&
      gap <= 15 &&
      Math.abs(s.minX - prev1.minX) < W * 0.06
    ) {
      s.isProseLine = true;
    }
  }

  // Also mark section headings right above a prose paragraph as prose
  for (let i = 0; i < strips.length - 2; i++) {
    const s = strips[i];
    const next1 = strips[i + 1];
    const next2 = strips[i + 2];
    const gap = next1.y0 - s.y1;
    if (
      !s.isProseLine &&
      s.height <= maxTextLineHeight * 1.3 &&
      next1.isProseLine &&
      next2.isProseLine &&
      gap <= 22 &&
      Math.abs(s.minX - next1.minX) < W * 0.06
    ) {
      s.isProseLine = true;
    }
  }

  // Group contiguous non-prose strips into Candidate Figure Regions
  const figureCandidates = [];
  let curFig = null;

  for (let i = 0; i < strips.length; i++) {
    const s = strips[i];
    if (s.isProseLine) {
      if (curFig) {
        figureCandidates.push(curFig);
        curFig = null;
      }
      continue;
    }

    if (!curFig) {
      curFig = {
        y0: s.y0,
        y1: s.y1,
        x0: s.minX,
        x1: s.maxX,
        maxStripHeight: s.height,
        stripCount: 1,
      };
    } else {
      const gap = s.y0 - curFig.y1;
      if (gap <= Math.max(48, Math.floor(H * 0.045))) {
        curFig.y1 = s.y1;
        if (s.minX < curFig.x0) curFig.x0 = s.minX;
        if (s.maxX > curFig.x1) curFig.x1 = s.maxX;
        if (s.height > curFig.maxStripHeight) curFig.maxStripHeight = s.height;
        curFig.stripCount++;
      } else {
        figureCandidates.push(curFig);
        curFig = {
          y0: s.y0,
          y1: s.y1,
          x0: s.minX,
          x1: s.maxX,
          maxStripHeight: s.height,
          stripCount: 1,
        };
      }
    }
  }
  if (curFig) figureCandidates.push(curFig);

  // Filter out tiny page numbers / running headers at the very top or bottom
  const validCandidates = figureCandidates.filter((c) => {
    const h = c.y1 - c.y0;
    const w = c.x1 - c.x0;
    if (h < Math.max(55, H * 0.06) || w < Math.max(70, W * 0.14)) return false;
    // Must either have a tall graphical strip (boxes/arrows/images) or at least 3 diagram strips
    return c.maxStripHeight >= maxTextLineHeight * 0.9 || c.stripCount >= 3;
  });

  if (validCandidates.length === 0) return [];

  // Match each hintRelPosition (from Figure X.Y caption position) to the best candidate figure box
  const selected = [];
  const usedIdx = new Set();

  for (const relPos of hintRelPositions.slice(0, expectedCount)) {
    const targetY = relPos * H;
    let bestIdx = -1;
    let bestScore = -Infinity;

    validCandidates.forEach((c, idx) => {
      if (usedIdx.has(idx)) return;
      const centerY = (c.y0 + c.y1) / 2;
      const distPenalty = Math.abs(centerY - targetY) / H;
      const sizeBonus = ((c.y1 - c.y0) / H) * 1.4 + (c.maxStripHeight > maxTextLineHeight * 1.4 ? 0.5 : 0);
      const score = sizeBonus - distPenalty * 0.85;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      usedIdx.add(bestIdx);
      selected.push(validCandidates[bestIdx]);
    }
  }

  return selected.map((c) => [c.x0, c.y0, c.x1, c.y1]);
}

/**
 * Crops [x0, y0, x1, y1] from an RGB buffer (W x H) and encodes it to a PNG Buffer via mupdf.Pixmap.
 */
function cropRgbToPngBuffer(mupdf, rgb, W, H, cropBox) {
  const pad = 18;
  const x0 = Math.max(0, Math.floor(cropBox[0] - pad));
  const y0 = Math.max(0, Math.floor(cropBox[1] - pad));
  const x1 = Math.min(W, Math.ceil(cropBox[2] + pad));
  const y1 = Math.min(H, Math.ceil(cropBox[3] + pad));

  const outW = Math.max(1, x1 - x0);
  const outH = Math.max(1, y1 - y0);

  const outPix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, outW, outH], false);
  outPix.clear(255);
  const dst = outPix.getPixels();
  const stride = outPix.getStride();
  const comp = outPix.getNumberOfComponents();

  for (let y = 0; y < outH; y++) {
    const srcRowOff = ((y0 + y) * W + x0) * 3;
    const dstRowOff = y * stride;
    for (let x = 0; x < outW; x++) {
      const sIdx = srcRowOff + x * 3;
      const dIdx = dstRowOff + x * comp;
      dst[dIdx] = rgb[sIdx];
      dst[dIdx + 1] = rgb[sIdx + 1];
      dst[dIdx + 2] = rgb[sIdx + 2];
      if (comp === 4) dst[dIdx + 3] = 255;
    }
  }

  const pngBuf = Buffer.from(outPix.asPNG());
  return { pngBuf, width: outW, height: outH };
}

/**
 * Extracts ONLY cropped figures from a PDF buffer and names each image
 * with its exact Figure Name (e.g., "Figure 9.7 Variable partition").
 * Works on both scanned PDFs (like os_unit3_part1.pdf, cat 2 os.pdf) and digital PDFs!
 */
async function extractImagesFromPdf(pdfBuffer, docId, filename = "document.pdf", pagesText = []) {
  const docIdStr = String(docId);
  const docDir = path.join(extractedImagesRoot, docIdStr);
  if (fs.existsSync(docDir)) {
    try {
      for (const oldFile of fs.readdirSync(docDir)) {
        fs.unlinkSync(path.join(docDir, oldFile));
      }
    } catch (_) {}
  } else {
    fs.mkdirSync(docDir, { recursive: true });
  }

  const pageTextMap = new Map();
  if (Array.isArray(pagesText)) {
    pagesText.forEach((p) => {
      if (p && p.pageNumber) pageTextMap.set(Number(p.pageNumber), p.text || "");
    });
  }

  const extracted = [];
  const seenFigureTitles = new Set();

  try {
    const mupdf = await getMupdf();
    const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const pageCount = doc.countPages();
    const maxPages = Math.min(pageCount, 60);

    for (let i = 0; i < maxPages; i++) {
      if (extracted.length >= 25) break;
      const pageNumber = i + 1;
      const ocrOrPageText = pageTextMap.get(pageNumber) || "";

      try {
        // Also check native PDF text if ocrOrPageText is empty
        let combinedPageText = ocrOrPageText;
        let page = null;
        if (!combinedPageText || combinedPageText.length < 20) {
          page = doc.loadPage(i);
          try {
            combinedPageText = page.toStructuredText().asText() || "";
          } catch (_) {}
        }

        // 1. Check if this page has any genuine "Figure X.Y <Name>" captions!
        const captions = extractFigureCaptionsFromPageText(combinedPageText);
        if (captions.length === 0) {
          // Skip pages that do not contain a named Figure!
          continue;
        }

        if (!page) page = doc.loadPage(i);

        // 2. Render page at 1.8x resolution to RGB pixels
        const pix = page.toPixmap(mupdf.Matrix.scale(1.8, 1.8), mupdf.ColorSpace.DeviceRGB, false);
        const rawW = pix.getWidth();
        const rawH = pix.getHeight();
        const stride = pix.getStride();
        const comp = pix.getNumberOfComponents();
        const rawPixels = pix.getPixels();

        const rgb3 = new Uint8Array(rawW * rawH * 3);
        for (let y = 0; y < rawH; y++) {
          const rOff = y * stride;
          const dOff = y * rawW * 3;
          for (let x = 0; x < rawW; x++) {
            const s = rOff + x * comp;
            const d = dOff + x * 3;
            rgb3[d] = rawPixels[s];
            rgb3[d + 1] = rawPixels[s + 1];
            rgb3[d + 2] = rawPixels[s + 2];
          }
        }

        // 3. Auto-rotate sideways scanned pages upright
        const { rgb: uprightRgb, width: upW, height: upH } = ensureUprightRgbBuffer(rgb3, rawW, rawH);

        // 4. Find tightly cropped Figure-only bounding boxes (stripping out prose paragraphs)
        const cropBoxes = findFigureCropBoxesOnUprightPage(
          uprightRgb,
          upW,
          upH,
          captions.length,
          captions.map((c) => c.relPos)
        );

        for (let cIdx = 0; cIdx < captions.length; cIdx++) {
          const cap = captions[cIdx];
          const cropBox = cropBoxes[cIdx] || cropBoxes[0];
          if (!cropBox) continue;

          const dedupKey = cap.name.toLowerCase();
          if (seenFigureTitles.has(dedupKey)) continue;
          seenFigureTitles.add(dedupKey);

          const { pngBuf, width, height } = cropRgbToPngBuffer(mupdf, uprightRgb, upW, upH, cropBox);
          if (!pngBuf || pngBuf.length < 1000) continue;

          const imgId = `fig_${docIdStr}_p${pageNumber}_${cIdx + 1}`;
          const fileNameOnDisk = `${imgId}.png`;
          fs.writeFileSync(path.join(docDir, fileNameOnDisk), pngBuf);

          extracted.push({
            id: imgId,
            docId: docIdStr,
            filename,
            pageNumber,
            kind: "cropped_figure_v2",
            label: cap.name,
            caption: cap.name,
            width,
            height,
            mimeType: "image/png",
            fileName: fileNameOnDisk,
            pageContextSnippet: combinedPageText.slice(0, 800),
          });
        }
      } catch (pageErr) {
        console.warn(`[imageExtractor] Page ${pageNumber} figure crop warning:`, pageErr.message);
      }
    }
  } catch (err) {
    console.warn(`[imageExtractor] PDF figure extraction error for ${filename}:`, err.message);
  }

  return extracted;
}

/**
 * Extracts embedded images from PPTX or DOCX Office ZIP archives (ppt/media/* or word/media/*)
 * and names each image after its figure or slide title.
 */
async function extractImagesFromOffice(buffer, docId, filename = "presentation.pptx", pagesText = []) {
  const docIdStr = String(docId);
  const docDir = path.join(extractedImagesRoot, docIdStr);
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  const pageTextMap = new Map();
  if (Array.isArray(pagesText)) {
    pagesText.forEach((p) => {
      if (p && p.pageNumber) pageTextMap.set(Number(p.pageNumber), p);
    });
  }

  const extracted = [];
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    const mediaToSlide = new Map();
    entries.forEach((entry) => {
      const m = entry.entryName.match(/^ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/i);
      if (m) {
        const slideNum = parseInt(m[1], 10);
        try {
          const xml = entry.getData().toString("utf8");
          const targets = xml.match(/Target="\.\.\/media\/([^"]+)"/gi) || [];
          targets.forEach((t) => {
            const mediaName = t.replace(/Target="\.\.\/media\//i, "").replace(/"$/, "");
            if (mediaName && !mediaToSlide.has(mediaName)) {
              mediaToSlide.set(mediaName, slideNum);
            }
          });
        } catch (_) {}
      }
    });

    const mediaEntries = entries.filter((entry) =>
      /^(?:ppt|word)\/media\/[^/]+\.(?:png|jpe?g|gif|webp)$/i.test(entry.entryName)
    );

    let counter = 0;
    for (const entry of mediaEntries) {
      if (counter >= 20) break;
      const data = entry.getData();
      if (!data || data.length < 1500) continue;

      counter++;
      const baseMediaName = path.basename(entry.entryName);
      const ext = path.extname(baseMediaName).toLowerCase() || ".png";
      const pageNumber = mediaToSlide.get(baseMediaName) || Math.min(counter, Math.max(1, pagesText.length));
      const pageObj = pageTextMap.get(pageNumber) || {};
      const pageText = pageObj.text || "";

      const caps = extractFigureCaptionsFromPageText(pageText);
      const figName =
        caps.length > 0
          ? caps[0].name
          : pageObj.title
          ? cleanFigureTitle(pageObj.title)
          : `Slide ${pageNumber} Figure`;

      const imgId = `fig_${docIdStr}_p${pageNumber}_m${counter}`;
      const fileNameOnDisk = `${imgId}${ext}`;
      const fullPath = path.join(docDir, fileNameOnDisk);
      fs.writeFileSync(fullPath, data);

      const mimeType =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
          ? "image/gif"
          : "image/png";

      extracted.push({
        id: imgId,
        docId: docIdStr,
        filename,
        pageNumber,
        kind: "cropped_figure_v2",
        label: figName,
        caption: figName,
        width: 800,
        height: 600,
        mimeType,
        fileName: fileNameOnDisk,
        pageContextSnippet: pageText.slice(0, 700),
      });
    }
  } catch (err) {
    console.warn(`[imageExtractor] Office media extraction error for ${filename}:`, err.message);
  }

  return extracted;
}

/**
 * Resolves the physical file path of an extracted image on disk.
 */
function getExtractedImageFilePath(docId, fileName) {
  const safeDocId = String(docId).replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFile = path.basename(String(fileName));
  const fullPath = path.join(extractedImagesRoot, safeDocId, safeFile);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

/**
 * Ensures a document has v2 cropped figures on disk and returns them with public `url` fields.
 * Automatically replaces any v1 images ("embedded_figure", "page_diagram", "cropped_figure") with v2 cropped figures.
 */
async function ensureDocumentExtractedImages(doc, ensurePdfOnDiskFn = null) {
  if (!doc) return [];
  const docIdStr = String(doc._id || doc.id);
  const filename = doc.filename || "Document.pdf";

  const isAllV2 =
    Array.isArray(doc.extractedImages) &&
    doc.extractedImages.length > 0 &&
    doc.extractedImages.every((img) => img && img.kind === "cropped_figure_v2");

  if (isAllV2) {
    const valid = doc.extractedImages.filter((img) => img && img.fileName && getExtractedImageFilePath(docIdStr, img.fileName));
    if (valid.length > 0) {
      return valid.map((img) => ({
        ...img,
        url: `/uploads/extracted_images/${docIdStr}/${img.fileName}?v=${encodeURIComponent(img.id)}`,
      }));
    }
  }

  let extracted = [];
  const lower = filename.toLowerCase();
  const isOffice =
    lower.endsWith(".pptx") ||
    lower.endsWith(".docx") ||
    (doc.mimeType && (doc.mimeType.includes("presentation") || doc.mimeType.includes("word")));

  if (isOffice && doc.storagePath && fs.existsSync(doc.storagePath) && !doc.storagePath.toLowerCase().endsWith(".pdf")) {
    try {
      const buf = fs.readFileSync(doc.storagePath);
      extracted = await extractImagesFromOffice(buf, docIdStr, filename, doc.pages || []);
    } catch (_) {}
  }

  if (extracted.length === 0) {
    let pdfPath = null;
    if (doc.storagePath && fs.existsSync(doc.storagePath) && doc.storagePath.toLowerCase().endsWith(".pdf")) {
      pdfPath = doc.storagePath;
    } else if (typeof ensurePdfOnDiskFn === "function") {
      try {
        pdfPath = await ensurePdfOnDiskFn(doc);
      } catch (_) {}
    }

    if (pdfPath && fs.existsSync(pdfPath)) {
      try {
        const pdfBuf = fs.readFileSync(pdfPath);
        extracted = await extractImagesFromPdf(pdfBuf, docIdStr, filename, doc.pages || []);
      } catch (_) {}
    }
  }

  return extracted.map((img) => ({
    ...img,
    url: `/uploads/extracted_images/${docIdStr}/${img.fileName}?v=${encodeURIComponent(img.id)}`,
  }));
}

module.exports = {
  extractImagesFromPdf,
  extractImagesFromOffice,
  getExtractedImageFilePath,
  ensureDocumentExtractedImages,
  extractedImagesRoot,
};
