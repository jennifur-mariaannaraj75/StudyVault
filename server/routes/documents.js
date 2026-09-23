const express = require("express");
const multer = require("multer");
const axios = require("axios");
const store = require("../config/store");
const { extractPdfPages } = require("../utils/pdfExtractor");
const { ocrPdfBuffer } = require("../utils/ocrExtractor");
const { analyzeDocument } = require("../utils/aiClient");
const { chunkDocument } = require("../utils/textChunker");
const { generateBatchEmbeddings, hybridRetrieve } = require("../utils/vectorEngine");

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Helper: chunk document and generate semantic vector embeddings
async function buildDocumentChunks(docId, filename, pages, text) {
  const rawChunks = chunkDocument({ _id: docId, filename, pages, extractedText: text });
  const chunkTexts = rawChunks.map((c) => c.chunk);
  const embeddings = await generateBatchEmbeddings(chunkTexts);
  return rawChunks.map((c, idx) => ({
    chunkId: c.chunkId,
    pageNumber: c.pageNumber || 1,
    chunkIndex: idx,
    text: c.chunk,
    charCount: c.chunk.length,
    embedding: embeddings[idx] || [],
    metadata: { filename, pageNumber: c.pageNumber || 1 },
  }));
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

// Re-index all documents in notebook to ensure fresh vector embeddings
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

// Upload files
router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const created = [];

    for (const file of req.files) {
      const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
      const isTxt = file.originalname.toLowerCase().endsWith(".txt") || file.originalname.toLowerCase().endsWith(".md");

      if (!isPdf && !isTxt) continue;

      const doc = await store.createDocument({
        notebookId: notebook._id,
        filename: file.originalname,
        extractedText: "",
        status: "processing",
      });
      created.push(doc);

      if (isPdf) {
        processPdfDocument(doc._id, file.buffer, file.originalname).catch((err) => {
          console.error("[documents] PDF processing failed:", err.message);
        });
      } else {
        const textContent = file.buffer.toString("utf-8");
        processTextDocument(doc._id, textContent, file.originalname).catch((err) => {
          console.error("[documents] Text processing failed:", err.message);
        });
      }
    }

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add raw text
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

async function processPdfDocument(docId, buffer, filename) {
  try {
    let { fullText, pageCount, pages } = await extractPdfPages(buffer);
    let text = fullText;

    if (!text || text.length < 20) {
      await store.updateDocument(docId, { summary: "Running OCR on scanned PDF..." });
      const ocrResult = await ocrPdfBuffer(buffer, (page, total) => {
        console.log(`[ocr] ${filename}: page ${page}/${total}`);
      });
      text = ocrResult.text;
      pageCount = ocrResult.pageCount;
      pages = [{ pageNumber: 1, text }];
    }

    if (!text || text.length < 20) {
      await store.updateDocument(docId, { status: "failed", summary: "Couldn't extract text from PDF." });
      return;
    }

    await store.updateDocument(docId, {
      extractedText: text,
      pageCount,
      pages,
      charCount: text.length,
      summary: "Vectorizing document chunks...",
    });

    const chunks = await buildDocumentChunks(docId, filename, pages, text);
    const analysis = await analyzeDocument(text, filename);

    await store.updateDocument(docId, {
      summary: analysis.summary,
      keyTopics: analysis.keyTopics,
      suggestedQuestions: analysis.suggestedQuestions,
      chunks,
      status: "ready",
    });
  } catch (err) {
    console.error("[processPdf] Error:", err.message);
    await store.updateDocument(docId, { status: "failed", summary: `Processing error: ${err.message}` });
  }
}

async function processTextDocument(docId, text, filename) {
  try {
    const charCount = text.length;
    const estimatedPages = Math.max(1, Math.ceil(charCount / 2500));
    const pages = [{ pageNumber: 1, text }];

    await store.updateDocument(docId, {
      extractedText: text,
      pageCount: estimatedPages,
      pages,
      charCount,
      summary: "Vectorizing text chunks...",
    });

    const chunks = await buildDocumentChunks(docId, filename, pages, text);
    const analysis = await analyzeDocument(text, filename);

    await store.updateDocument(docId, {
      summary: analysis.summary,
      keyTopics: analysis.keyTopics,
      suggestedQuestions: analysis.suggestedQuestions,
      chunks,
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
    await store.deleteDocument(req.params.docId, req.params.notebookId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
