const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const store = require("../config/store");
const nlpService = require("../services/nlpService");
const { extractPdfPages } = require("../utils/pdfExtractor");
const { extractPptx, extractDocx } = require("../utils/officeExtractor");
const { ocrPdfBuffer } = require("../utils/ocrExtractor");
const { analyzeDocument } = require("../utils/aiClient");
const { chunkDocument } = require("../utils/textChunker");
const { generateBatchEmbeddings, hybridRetrieve } = require("../utils/vectorEngine");

const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

// Verify user has access to notebook
router.use(async (req, res, next) => {
  const notebookId = req.params.notebookId;
  if (!notebookId) return next();
  try {
    const notebook = await store.getNotebookById(notebookId);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });
    if (notebook.userId && req.user?.role !== "admin") {
      if (!req.user || String(notebook.userId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Access denied. You do not have permission to access documents in this notebook." });
      }
    }
    req.notebook = notebook;
    next();
  } catch (err) {
    next(err);
  }
});

const uploadsDir = path.join(__dirname, "..", "data", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function sanitizePdfText(str) {
  if (!str) return "";
  return String(str)
    .replace(/[^\x20-\x7E\t\n]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function wrapText(text, maxChars = 75) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

/**
 * Ensures a physical visual PDF file exists on disk for PDF.js canvas rendering.
 * If the original PDF was uploaded, it is served directly.
 * If PPTX, DOCX, TXT, or web note, synthesizes a high-fidelity visual PDF layout with the REAL content.
 */
async function ensurePdfOnDisk(doc) {
  if (!doc) return null;
  const docIdStr = String(doc._id || doc.id);

  // 1. Check existing storagePath if it is an existing PDF file
  if (doc.storagePath && fs.existsSync(doc.storagePath)) {
    if (doc.storagePath.toLowerCase().endsWith(".pdf")) {
      return doc.storagePath;
    }
  }

  // 2. Check default uploads location for PDF
  const defaultPdfPath = path.join(uploadsDir, `${docIdStr}.pdf`);
  if (fs.existsSync(defaultPdfPath)) {
    return defaultPdfPath;
  }

  // 3. Synthesize a clean, paginated PDF with REAL content from doc
  try {
    const filename = doc.filename || "Document";
    const lower = filename.toLowerCase();
    const isPresentation = lower.endsWith(".ppt") ||
      lower.endsWith(".pptx") ||
      (doc.mimeType && doc.mimeType.includes("presentation"));

    let pagesData = Array.isArray(doc.pages) && doc.pages.length > 0 ? [...doc.pages] : [];

    // If pagesData is empty, populate from doc.extractedText
    if (pagesData.length === 0 && doc.extractedText) {
      const rawText = doc.extractedText;
      const estPages = Math.max(1, doc.pageCount || Math.ceil(rawText.length / 1800));
      const charsPerPage = Math.ceil(rawText.length / estPages);
      for (let i = 0; i < estPages; i++) {
        pagesData.push({
          pageNumber: i + 1,
          text: rawText.slice(i * charsPerPage, (i + 1) * charsPerPage).trim(),
        });
      }
    }

    const totalPages = Math.max(1, doc.pageCount || pagesData.length || 1);
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    if (isPresentation) {
      // 16:9 Presentation Slide Canvas Layout
      for (let i = 1; i <= totalPages; i++) {
        const page = pdfDoc.addPage([841.89, 473.56]);
        const pageObj = pagesData[i - 1] || {};
        const slideTitle = pageObj.title || `Slide ${i}: ${filename.replace(/\.[^/.]+$/, "")}`;
        const slideText = pageObj.text || "";
        const slideNotes = pageObj.notes || "";

        // Background
        page.drawRectangle({
          x: 0,
          y: 0,
          width: 841.89,
          height: 473.56,
          color: rgb(0.97, 0.98, 0.99),
        });

        // Top Header Accent Bar
        page.drawRectangle({
          x: 0,
          y: 432,
          width: 841.89,
          height: 41.56,
          color: rgb(0.12, 0.16, 0.24),
        });

        // Filename in header
        page.drawText(sanitizePdfText(filename.slice(0, 55)), {
          x: 35,
          y: 448,
          size: 11,
          font: boldFont,
          color: rgb(0.9, 0.94, 1.0),
        });

        // Slide Badge
        page.drawRectangle({
          x: 710,
          y: 440,
          width: 95,
          height: 25,
          color: rgb(0.2, 0.38, 0.72),
        });
        page.drawText(`SLIDE ${i} / ${totalPages}`, {
          x: 722,
          y: 448,
          size: 9,
          font: boldFont,
          color: rgb(1, 1, 1),
        });

        // Slide Title
        page.drawText(sanitizePdfText(slideTitle.slice(0, 70)), {
          x: 40,
          y: 395,
          size: 17,
          font: boldFont,
          color: rgb(0.1, 0.15, 0.25),
        });

        page.drawLine({
          start: { x: 40, y: 380 },
          end: { x: 800, y: 380 },
          thickness: 1,
          color: rgb(0.8, 0.85, 0.9),
        });

        // Slide Bullets
        const cleanLines = slideText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"));

        let yPos = 345;
        const bodyItems = cleanLines.length > 0 ? cleanLines : [
          doc.summary || "Source content extracted for verified AI Q&A and study tools.",
        ];

        for (const item of bodyItems.slice(0, 8)) {
          const sanitized = sanitizePdfText(item.replace(/^[•\-\*]\s*/, ""));
          const wrapped = wrapText(sanitized, 85);
          for (const wl of wrapped.slice(0, 2)) {
            page.drawRectangle({
              x: 45,
              y: yPos + 3,
              width: 5,
              height: 5,
              color: rgb(0.2, 0.45, 0.85),
            });
            page.drawText(wl, {
              x: 58,
              y: yPos,
              size: 11,
              font,
              color: rgb(0.18, 0.22, 0.28),
            });
            yPos -= 18;
          }
          yPos -= 6;
          if (yPos < 95) break;
        }

        // Speaker notes
        if (slideNotes) {
          page.drawRectangle({
            x: 40,
            y: 42,
            width: 760,
            height: 32,
            color: rgb(0.92, 0.94, 0.97),
            borderColor: rgb(0.8, 0.84, 0.9),
            borderWidth: 0.5,
          });
          page.drawText(`Notes: ${sanitizePdfText(slideNotes.slice(0, 110))}`, {
            x: 50,
            y: 53,
            size: 9,
            font,
            color: rgb(0.35, 0.4, 0.48),
          });
        }

        // Footer
        page.drawText(`StudyVault Presentation Engine • Citing ${sanitizePdfText(filename)}`, {
          x: 40,
          y: 20,
          size: 8,
          font,
          color: rgb(0.55, 0.6, 0.68),
        });
      }
    } else {
      // Standard A4 Document Layout
      for (let i = 1; i <= totalPages; i++) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const pageObj = pagesData[i - 1] || {};
        const pageText = pageObj.text || "";

        // Header Bar
        page.drawText(sanitizePdfText(filename.slice(0, 45)), {
          x: 50,
          y: 800,
          size: 13,
          font: boldFont,
          color: rgb(0.12, 0.15, 0.22),
        });
        page.drawText(`Page ${i} of ${totalPages}`, {
          x: 470,
          y: 800,
          size: 10,
          font,
          color: rgb(0.4, 0.45, 0.55),
        });
        page.drawLine({
          start: { x: 50, y: 790 },
          end: { x: 545, y: 790 },
          thickness: 1,
          color: rgb(0.85, 0.88, 0.94),
        });

        // Section badge
        page.drawRectangle({
          x: 50,
          y: 755,
          width: 130,
          height: 22,
          color: rgb(0.92, 0.95, 1.0),
          borderColor: rgb(0.6, 0.75, 0.95),
          borderWidth: 0.8,
        });
        page.drawText(`SECTION • PAGE ${i}`, {
          x: 58,
          y: 762,
          size: 8,
          font: boldFont,
          color: rgb(0.1, 0.35, 0.75),
        });

        let linesToDraw = [];
        if (pageText && pageText.trim()) {
          const rawParagraphs = pageText.split("\n").filter((l) => l.trim().length > 0);
          for (const p of rawParagraphs) {
            const wrapped = wrapText(sanitizePdfText(p), 75);
            linesToDraw.push(...wrapped);
            linesToDraw.push("");
            if (linesToDraw.length > 38) break;
          }
        } else if (doc.summary) {
          linesToDraw = wrapText(sanitizePdfText(doc.summary), 75);
        } else {
          linesToDraw = [`Extracted source content for ${sanitizePdfText(filename)}`];
        }

        let yPos = 730;
        for (const line of linesToDraw.slice(0, 36)) {
          if (line) {
            page.drawText(line, {
              x: 50,
              y: yPos,
              size: 9.5,
              font,
              color: rgb(0.18, 0.2, 0.25),
            });
          }
          yPos -= 17;
          if (yPos < 70) break;
        }

        // Footer
        page.drawLine({
          start: { x: 50, y: 55 },
          end: { x: 545, y: 55 },
          thickness: 0.5,
          color: rgb(0.85, 0.88, 0.92),
        });
        page.drawText("StudyVault Document Engine • Exact Page Citations Grounded", {
          x: 50,
          y: 42,
          size: 8,
          font,
          color: rgb(0.5, 0.55, 0.6),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(defaultPdfPath, pdfBytes);
    await store.updateDocument(docIdStr, { storagePath: defaultPdfPath, hasPdfFile: true });
    return defaultPdfPath;
  } catch (err) {
    console.error("[ensurePdfOnDisk] Failed to synthesize PDF:", err.message);
    return null;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Helper: chunk document, run chunk-level NLP enrichment, and generate semantic vector embeddings
async function buildDocumentChunks(docId, filename, pages, text) {
  const rawChunks = chunkDocument({ _id: docId, filename, pages, extractedText: text });
  const chunkTexts = rawChunks.map((c) => c.chunk);
  const embeddings = await generateBatchEmbeddings(chunkTexts);

  return rawChunks.map((c, idx) => {
    let chunkNlp = null;
    try {
      chunkNlp = nlpService.analyzeChunk(c.chunk);
    } catch (_) {}

    return {
      chunkId: c.chunkId,
      pageNumber: c.pageNumber || 1,
      chunkIndex: idx,
      text: c.chunk,
      charCount: c.chunk.length,
      embedding: embeddings[idx] || [],
      metadata: {
        filename,
        pageNumber: c.pageNumber || 1,
        ...(chunkNlp ? { nlp: chunkNlp } : {}),
      },
      nlp: chunkNlp,
    };
  });
}

// Search across all sources in notebook using Semantic + Vector Hybrid Retrieval
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) return res.json([]);
    const docs = await store.getDocuments(req.params.notebookId);
    const readyDocs = docs.filter((d) => d.status === "ready");
    if (readyDocs.length === 0) return res.json([]);

    const results = await hybridRetrieve({
      documents: readyDocs,
      query: q.trim(),
      topK: 15,
      alpha: 0.6,
    });

    res.json(
      results.map((item) => ({
        filename: item.filename,
        pageNumber: item.pageNumber,
        chunkId: item.chunkId,
        snippet: item.chunk.slice(0, 300),
        semanticScore: item.semanticScore,
        lexicalScore: item.lexicalScore,
        hybridScore: item.hybridScore,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RAG Retrieval inspection & diagnostic endpoint
router.post("/rag/retrieve", async (req, res) => {
  try {
    const { query, topK = 8, alpha = 0.65 } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }
    const docs = await store.getDocuments(req.params.notebookId);
    const readyDocs = docs.filter((d) => d.status === "ready");
    if (readyDocs.length === 0) {
      return res.json({
        query,
        totalSources: 0,
        chunksRetrieved: [],
        message: "No ready sources in notebook.",
      });
    }

    const retrieved = await hybridRetrieve({
      documents: readyDocs,
      query: query.trim(),
      topK: Number(topK) || 8,
      alpha: Number(alpha) || 0.65,
    });

    res.json({
      query: query.trim(),
      totalSources: readyDocs.length,
      chunksRetrieved: retrieved.map((c) => ({
        chunkId: c.chunkId,
        filename: c.filename,
        pageNumber: c.pageNumber,
        semanticScore: c.semanticScore,
        lexicalScore: c.lexicalScore,
        hybridScore: c.hybridScore,
        snippet: c.chunk.slice(0, 250),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-index all documents in notebook
router.post("/rag/reindex", async (req, res) => {
  try {
    const docs = await store.getDocuments(req.params.notebookId);
    const updated = [];
    for (const doc of docs) {
      if (!doc.extractedText) continue;
      const chunks = await buildDocumentChunks(
        doc._id,
        doc.filename,
        doc.pages || [{ pageNumber: 1, text: doc.extractedText }],
        doc.extractedText
      );
      await store.updateDocument(doc._id, { chunks });
      updated.push({ id: doc._id, filename: doc.filename, chunkCount: chunks.length });
    }
    res.json({ success: true, reindexed: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Universal Multi-Format Document Upload (PDF, PPTX, PPT, DOCX, DOC, TXT, MD, RTF, CSV, JSON)
router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const created = [];
    for (const file of req.files) {
      const lower = file.originalname.toLowerCase();
      const isPdf = file.mimetype === "application/pdf" || lower.endsWith(".pdf");
      const isPpt = lower.endsWith(".pptx") || lower.endsWith(".ppt") || (file.mimetype && file.mimetype.includes("presentation"));
      const isDoc = lower.endsWith(".docx") || lower.endsWith(".doc") || (file.mimetype && file.mimetype.includes("word"));
      const isTxt = lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".rtf") || lower.endsWith(".csv") || lower.endsWith(".json");

      if (!isPdf && !isPpt && !isDoc && !isTxt) {
        console.warn(`[documents] Skipping unsupported file: ${file.originalname} (${file.mimetype})`);
        continue;
      }

      let mimeType = "application/octet-stream";
      if (isPdf) mimeType = "application/pdf";
      else if (isPpt) mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      else if (isDoc) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (isTxt) mimeType = "text/plain";

      const doc = await store.createDocument({
        notebookId: notebook._id,
        filename: file.originalname,
        extractedText: "",
        hasPdfFile: isPdf,
        mimeType,
        status: "processing",
        summary: "Uploading & initializing...",
      });

      const docIdStr = String(doc._id || doc.id);

      // Save original uploaded file on disk immediately
      const ext = path.extname(file.originalname).toLowerCase() || (isPdf ? ".pdf" : isPpt ? ".pptx" : isDoc ? ".docx" : ".txt");
      const originalPath = path.join(uploadsDir, `${docIdStr}${ext}`);
      fs.writeFileSync(originalPath, file.buffer);

      if (isPdf) {
        const pdfPath = path.join(uploadsDir, `${docIdStr}.pdf`);
        if (originalPath !== pdfPath) {
          fs.writeFileSync(pdfPath, file.buffer);
        }
        await store.updateDocument(doc._id, {
          storagePath: pdfPath,
          hasPdfFile: true,
          summary: "Extracting pages & text...",
        });
        processPdfDocument(doc._id, file.buffer, file.originalname).catch((err) => {
          console.error("[documents] PDF processing failed:", err.message);
        });
      } else if (isPpt) {
        await store.updateDocument(doc._id, {
          storagePath: originalPath,
          hasPdfFile: false,
          summary: "Extracting presentation slides...",
        });
        processPresentationDocument(doc._id, file.buffer, file.originalname).catch((err) => {
          console.error("[documents] Presentation processing failed:", err.message);
        });
      } else if (isDoc) {
        await store.updateDocument(doc._id, {
          storagePath: originalPath,
          hasPdfFile: false,
          summary: "Extracting document chapters & text...",
        });
        processWordDocument(doc._id, file.buffer, file.originalname).catch((err) => {
          console.error("[documents] Word processing failed:", err.message);
        });
      } else {
        const textContent = file.buffer.toString("utf-8");
        await store.updateDocument(doc._id, {
          storagePath: originalPath,
          hasPdfFile: false,
          summary: "Extracting text content...",
        });
        processTextDocument(doc._id, textContent, file.originalname).catch((err) => {
          console.error("[documents] Text processing failed:", err.message);
        });
      }

      created.push(doc);
    }
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add raw text note
router.post("/text", async (req, res) => {
  try {
    const { title, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Text content is required" });
    const notebook = await store.getNotebookById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const filename = (title && title.trim()) ? title.trim() : `Note_${Date.now()}.txt`;
    const doc = await store.createDocument({
      notebookId: notebook._id,
      filename,
      extractedText: "",
      mimeType: "text/plain",
      status: "processing",
    });

    processTextDocument(doc._id, text.trim(), filename).catch((err) => {
      console.error("[documents] Text paste failed:", err.message);
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Web URL
router.post("/url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) return res.status(400).json({ error: "URL is required" });
    const notebook = await store.getNotebookById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const targetUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    const domain = new URL(targetUrl).hostname.replace("www.", "");
    const filename = `Web_${domain}_${Date.now().toString(36)}.txt`;

    const doc = await store.createDocument({
      notebookId: notebook._id,
      filename,
      extractedText: "",
      mimeType: "text/plain",
      status: "processing",
    });

    fetchAndProcessUrl(doc._id, targetUrl, filename).catch((err) => {
      console.error("[documents] URL fetch failed:", err.message);
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROCESSING ENGINES ---

async function processPdfDocument(docId, buffer, filename) {
  try {
    await store.updateDocument(docId, { summary: "Extracting pages & text..." });
    let { fullText, pageCount, pages } = await extractPdfPages(buffer);
    let text = fullText;

    // fullText includes "--- Page N ---" headers, so judge emptiness by the real page text.
    // OCR only the pages that have no extractable text (handles fully scanned PDFs as well as
    // mixed PDFs where just some pages are images); pages with real text are kept as-is.
    const blankPages = (pages || [])
      .filter((p) => (p.text || "").trim().length < 10)
      .map((p) => p.pageNumber);
    if (!text || blankPages.length > 0) {
      await store.updateDocument(docId, { summary: "Running OCR on scanned pages..." });
      const ocrResult = await ocrPdfBuffer(
        buffer,
        (done, total) => console.log(`[ocr] ${filename}: ${done}/${total} pages`),
        blankPages.length > 0 && pages && pages.length > 0 ? blankPages : null
      );
      pageCount = ocrResult.pageCount;
      if (blankPages.length > 0 && pages && pages.length > 0) {
        const ocrByPage = new Map(ocrResult.pages.map((p) => [p.pageNumber, p.text]));
        pages = pages.map((p) => (ocrByPage.has(p.pageNumber) ? { ...p, text: ocrByPage.get(p.pageNumber) } : p));
      } else {
        pages = ocrResult.pages && ocrResult.pages.length > 0 ? ocrResult.pages : [{ pageNumber: 1, text: ocrResult.text }];
      }
      text = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join("\n\n");
    }

    const realTextLength = (pages || []).reduce((n, p) => n + ((p.text || "").trim().length), 0);
    if (realTextLength < 20) {
      throw new Error("No readable text could be extracted from this PDF (even with OCR).");
    }

    if (!text || text.length < 20) {
      text = `PDF document: ${filename} (${pageCount} pages)`;
      pages = Array.from({ length: pageCount }, (_, i) => ({
        pageNumber: i + 1,
        text: `Page ${i + 1} of ${filename}`,
      }));
    }

    text = nlpService.cleanText(text);

    let docNlp = null;
    try {
      docNlp = nlpService.analyzeText(text);
    } catch (e) {
      console.warn("[documents] NLP analysis fallback:", e.message);
    }

    await store.updateDocument(docId, {
      extractedText: text,
      pageCount,
      pages,
      charCount: text.length,
      nlp: docNlp,
      hasPdfFile: true,
      summary: "Chunking & generating vector embeddings...",
    });

    const chunks = await buildDocumentChunks(docId, filename, pages, text);
    await store.updateDocument(docId, {
      chunks,
      nlp: docNlp,
      summary: "Analyzing key topics & summary...",
    });

    let analysis = { summary: "Ready for grounded AI exploration.", keyTopics: [], suggestedQuestions: [] };
    try {
      analysis = await analyzeDocument(text, filename);
    } catch (aErr) {
      console.warn("[documents] AI topic analysis fallback:", aErr.message);
    }

    const mergedTopics = Array.from(
      new Set([
        ...(analysis.keyTopics || []),
        ...(docNlp && Array.isArray(docNlp.topics) ? docNlp.topics : []),
      ])
    );

    await store.updateDocument(docId, {
      summary: analysis.summary || "Ready for grounded AI exploration.",
      keyTopics: mergedTopics,
      suggestedQuestions: analysis.suggestedQuestions || [],
      chunks,
      nlp: docNlp,
      hasPdfFile: true,
      status: "ready",
    });
  } catch (err) {
    console.error("[processPdf] Error:", err.message);
    await store.updateDocument(docId, { status: "failed", summary: `Processing error: ${err.message}` });
  }
}

async function processPresentationDocument(docId, buffer, filename) {
  try {
    await store.updateDocument(docId, { summary: "Extracting presentation slides..." });
    const { pages, pageCount, fullText } = await extractPptx(buffer, filename);
    let text = fullText;

    if (!text || text.length < 10) {
      await store.updateDocument(docId, { status: "failed", summary: "Couldn't extract slides from presentation." });
      return;
    }

    text = nlpService.cleanText(text);
    let docNlp = null;
    try {
      docNlp = nlpService.analyzeText(text);
    } catch (_) {}

    await store.updateDocument(docId, {
      extractedText: text,
      pageCount,
      pages,
      charCount: text.length,
      nlp: docNlp,
      summary: "Synthesizing visual slides & vector embeddings...",
    });

    const docObj = await store.getDocumentById(docId);
    if (docObj) {
      await ensurePdfOnDisk(docObj);
    }

    const chunks = await buildDocumentChunks(docId, filename, pages, text);
    await store.updateDocument(docId, {
      chunks,
      nlp: docNlp,
      summary: "Analyzing key topics...",
    });

    let analysis = { summary: `Presentation containing ${pageCount} slides.`, keyTopics: [], suggestedQuestions: [] };
    try {
      analysis = await analyzeDocument(text, filename);
    } catch (_) {}

    const mergedTopics = Array.from(
      new Set([
        ...(analysis.keyTopics || []),
        ...(docNlp && Array.isArray(docNlp.topics) ? docNlp.topics : []),
      ])
    );

    await store.updateDocument(docId, {
      summary: analysis.summary || `Presentation containing ${pageCount} slides ready for exploration.`,
      keyTopics: mergedTopics,
      suggestedQuestions: analysis.suggestedQuestions || [],
      chunks,
      nlp: docNlp,
      hasPdfFile: true,
      status: "ready",
    });
  } catch (err) {
    console.error("[processPresentation] Error:", err.message);
    await store.updateDocument(docId, { status: "failed", summary: `Processing error: ${err.message}` });
  }
}

async function processWordDocument(docId, buffer, filename) {
  try {
    await store.updateDocument(docId, { summary: "Extracting document chapters & text..." });
    const { pages, pageCount, fullText } = await extractDocx(buffer, filename);
    let text = fullText;

    if (!text || text.length < 10) {
      await store.updateDocument(docId, { status: "failed", summary: "Couldn't extract text from Word document." });
      return;
    }

    text = nlpService.cleanText(text);
    let docNlp = null;
    try {
      docNlp = nlpService.analyzeText(text);
    } catch (_) {}

    await store.updateDocument(docId, {
      extractedText: text,
      pageCount,
      pages,
      charCount: text.length,
      nlp: docNlp,
      summary: "Synthesizing visual pages & vector embeddings...",
    });

    const docObj = await store.getDocumentById(docId);
    if (docObj) {
      await ensurePdfOnDisk(docObj);
    }

    const chunks = await buildDocumentChunks(docId, filename, pages, text);
    await store.updateDocument(docId, {
      chunks,
      nlp: docNlp,
      summary: "Analyzing key topics...",
    });

    let analysis = { summary: `Document containing ${pageCount} pages.`, keyTopics: [], suggestedQuestions: [] };
    try {
      analysis = await analyzeDocument(text, filename);
    } catch (_) {}

    const mergedTopics = Array.from(
      new Set([
        ...(analysis.keyTopics || []),
        ...(docNlp && Array.isArray(docNlp.topics) ? docNlp.topics : []),
      ])
    );

    await store.updateDocument(docId, {
      summary: analysis.summary || "Document ready for grounded AI exploration.",
      keyTopics: mergedTopics,
      suggestedQuestions: analysis.suggestedQuestions || [],
      chunks,
      nlp: docNlp,
      hasPdfFile: true,
      status: "ready",
    });
  } catch (err) {
    console.error("[processWord] Error:", err.message);
    await store.updateDocument(docId, { status: "failed", summary: `Processing error: ${err.message}` });
  }
}

async function processTextDocument(docId, text, filename) {
  try {
    text = nlpService.cleanText(text);
    let docNlp = null;
    try {
      docNlp = nlpService.analyzeText(text);
    } catch (e) {
      console.warn("[documents] Text NLP analysis fallback:", e.message);
    }

    const charCount = text.length;
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const pages = [];
    let currentWords = [];
    let curCount = 0;

    for (const p of paragraphs) {
      const wc = p.split(/\s+/).length;
      if (curCount + wc > 350 && currentWords.length > 0) {
        pages.push({ pageNumber: pages.length + 1, text: currentWords.join("\n\n") });
        currentWords = [p];
        curCount = wc;
      } else {
        currentWords.push(p);
        curCount += wc;
      }
    }

    if (currentWords.length > 0 || pages.length === 0) {
      pages.push({ pageNumber: pages.length + 1, text: currentWords.join("\n\n") || text });
    }

    const pageCount = pages.length;

    await store.updateDocument(docId, {
      extractedText: text,
      pageCount,
      pages,
      charCount,
      nlp: docNlp,
      summary: "Synthesizing visual layout & vector embeddings...",
    });

    const docObj = await store.getDocumentById(docId);
    if (docObj) {
      await ensurePdfOnDisk(docObj);
    }

    const chunks = await buildDocumentChunks(docId, filename, pages, text);
    await store.updateDocument(docId, {
      chunks,
      nlp: docNlp,
      summary: "Analyzing key topics...",
    });

    let analysis = { summary: "Ready for grounded AI exploration.", keyTopics: [], suggestedQuestions: [] };
    try {
      analysis = await analyzeDocument(text, filename);
    } catch (aErr) {
      console.warn("[documents] Text AI topic analysis fallback:", aErr.message);
    }

    const mergedTopics = Array.from(
      new Set([
        ...(analysis.keyTopics || []),
        ...(docNlp && Array.isArray(docNlp.topics) ? docNlp.topics : []),
      ])
    );

    await store.updateDocument(docId, {
      summary: analysis.summary || "Ready for grounded AI exploration.",
      keyTopics: mergedTopics,
      suggestedQuestions: analysis.suggestedQuestions || [],
      chunks,
      nlp: docNlp,
      hasPdfFile: true,
      status: "ready",
    });
  } catch (err) {
    console.error("[processText] Error:", err.message);
    await store.updateDocument(docId, { status: "failed", summary: `Processing error: ${err.message}` });
  }
}

async function fetchAndProcessUrl(docId, url, filename) {
  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 15000,
    });
    const html = res.data || "";
    let cleanText = html
      .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanText.length > 50000) cleanText = cleanText.slice(0, 50000);
    if (!cleanText || cleanText.length < 50) {
      await store.updateDocument(docId, { status: "failed", summary: "Failed to extract text from URL." });
      return;
    }
    await processTextDocument(docId, cleanText, filename);
  } catch (err) {
    console.error("[fetchUrl] Error:", err.message);
    await store.updateDocument(docId, { status: "failed", summary: `URL fetch failed: ${err.message}` });
  }
}

// Full document details endpoint
router.get("/:docId", async (req, res) => {
  try {
    const doc = await store.getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (String(doc.notebookId) !== String(req.params.notebookId)) {
      return res.status(403).json({ error: "Document does not belong to this notebook" });
    }
    res.json({
      _id: doc._id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      pageCount: doc.pageCount,
      charCount: doc.charCount,
      pages: doc.pages || [],
      extractedText: doc.extractedText || "",
      summary: doc.summary || "",
      keyTopics: doc.keyTopics || [],
      suggestedQuestions: doc.suggestedQuestions || [],
      status: doc.status,
      hasPdfFile: Boolean(doc.hasPdfFile),
      createdAt: doc.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated source content inspection endpoint
router.get("/:docId/content", async (req, res) => {
  try {
    const doc = await store.getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (String(doc.notebookId) !== String(req.params.notebookId)) {
      return res.status(403).json({ error: "Document does not belong to this notebook" });
    }
    res.json({
      docId: doc._id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      pageCount: doc.pageCount,
      pages: doc.pages || [],
      fullText: doc.extractedText || "",
      summary: doc.summary || "",
      keyTopics: doc.keyTopics || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve physical PDF file for visual rendering in PDF.js
// Re-run extraction (incl. OCR for scanned PDFs) on an already-uploaded PDF
router.post("/:docId/reprocess", async (req, res) => {
  try {
    const doc = await store.getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (String(doc.notebookId) !== String(req.params.notebookId)) {
      return res.status(403).json({ error: "Document does not belong to this notebook" });
    }
    const pdfPath = await ensurePdfOnDisk(doc);
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: "Original PDF file is not available to reprocess" });
    }
    await store.updateDocument(doc._id || doc.id, { status: "processing", summary: "Re-processing document..." });
    processPdfDocument(doc._id || doc.id, fs.readFileSync(pdfPath), doc.filename).catch((err) => {
      console.error("[reprocess] Error:", err.message);
    });
    res.json({ success: true, message: "Reprocessing started" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:docId/file", async (req, res) => {
  try {
    const doc = await store.getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Validate notebook scope isolation
    if (String(doc.notebookId) !== String(req.params.notebookId)) {
      return res.status(403).json({ error: "Document does not belong to this notebook" });
    }

    const pdfPath = await ensurePdfOnDisk(doc);
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: "PDF visual file is not available" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.filename)}"`);
    res.setHeader("Accept-Ranges", "bytes");
    return res.sendFile(path.resolve(pdfPath));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download original uploaded file
router.get("/:docId/raw", async (req, res) => {
  try {
    const doc = await store.getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (String(doc.notebookId) !== String(req.params.notebookId)) {
      return res.status(403).json({ error: "Document does not belong to this notebook" });
    }

    let filePath = doc.storagePath;
    if (!filePath || !fs.existsSync(filePath)) {
      const defaultPdf = path.join(uploadsDir, `${doc._id}.pdf`);
      if (fs.existsSync(defaultPdf)) {
        filePath = defaultPdf;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not available for download" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.filename)}"`);
    if (doc.mimeType) res.setHeader("Content-Type", doc.mimeType);
    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List documents
router.get("/", async (req, res) => {
  try {
    const docs = await store.getDocuments(req.params.notebookId);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
router.delete("/:docId", async (req, res) => {
  try {
    const doc = await store.getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Remove files from disk
    const docIdStr = String(doc._id || doc.id);
    const pdfPath = path.join(uploadsDir, `${docIdStr}.pdf`);
    if (fs.existsSync(pdfPath)) {
      try { fs.unlinkSync(pdfPath); } catch (_) {}
    }
    if (doc.storagePath && fs.existsSync(doc.storagePath)) {
      try { fs.unlinkSync(doc.storagePath); } catch (_) {}
    }

    const targetNbId = req.params.notebookId || (doc.notebookId ? String(doc.notebookId) : null);
    await store.deleteDocument(req.params.docId, targetNbId);
    res.json({ success: true, message: "Document removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Resume documents whose processing was interrupted (e.g. server restarted mid-OCR) so they
 * never stay stuck on "Processing". Re-runs the original pipeline from the file saved on disk.
 * Documents that are already ready are never touched.
 */
async function resumeInterruptedDocuments() {
  const all = await store.getAllDocuments();
  const stuck = (all || []).filter((d) => d.status === "processing");
  if (stuck.length === 0) return { resumed: 0 };

  console.log(`[documents] Resuming ${stuck.length} interrupted document(s)...`);
  let resumed = 0;
  for (const d of stuck) {
    const id = d._id || d.id;
    const filePath = d.storagePath && fs.existsSync(d.storagePath)
      ? d.storagePath
      : path.join(uploadsDir, `${String(id)}.pdf`);
    if (!fs.existsSync(filePath)) {
      await store.updateDocument(id, {
        status: "failed",
        summary: "Processing was interrupted and the original file is missing. Please re-upload this source.",
      });
      continue;
    }
    const lower = String(d.filename || filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);
    let job;
    if (lower.endsWith(".pdf") || filePath.toLowerCase().endsWith(".pdf")) {
      job = processPdfDocument(id, buffer, d.filename);
    } else if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) {
      job = processPresentationDocument(id, buffer, d.filename);
    } else if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
      job = processWordDocument(id, buffer, d.filename);
    } else {
      job = processTextDocument(id, buffer.toString("utf-8"), d.filename);
    }
    job.catch((err) => console.error(`[documents] Resume failed for ${d.filename}:`, err.message));
    resumed++;
  }
  return { resumed };
}

module.exports = router;
module.exports.resumeInterruptedDocuments = resumeInterruptedDocuments;
