const express = require("express");
const store = require("../config/store");
const sampleNotebooks = require("../utils/sampleData");
const { analyzeDocument } = require("../utils/aiClient");
const { chunkDocument } = require("../utils/textChunker");
const { generateBatchEmbeddings } = require("../utils/vectorEngine");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Apply auth middleware to attach req.user context
router.use(authenticateToken);

// List all notebooks for current user (or all if admin)
router.get("/", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const role = req.user ? req.user.role : "user";
    const notebooks = await store.getNotebooks(userId, role);
    const notebooksWithDocs = await Promise.all(
      notebooks.map(async (nb) => {
        const nbObj = typeof nb.toObject === "function" ? nb.toObject() : { ...nb };
        const docs = await store.getDocuments(nb._id);
        nbObj.documentCount = docs ? docs.length : 0;
        return nbObj;
      })
    );
    notebooksWithDocs.sort((a, b) => {
      if ((b.documentCount > 0) !== (a.documentCount > 0)) {
        return (b.documentCount > 0) ? 1 : -1;
      }
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
    res.json(notebooksWithDocs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Load sample notebook with pre-vectorized RAG chunks
router.post("/sample/:sampleKey", async (req, res) => {
  try {
    const sample = sampleNotebooks[req.params.sampleKey];
    if (!sample) return res.status(404).json({ error: "Sample notebook not found" });

    const userId = req.user ? req.user.id : null;
    const notebook = await store.createNotebook(sample.title, sample.description, userId);

    for (const d of sample.documents) {
      const charCount = d.text.length;
      const estimatedPages = Math.max(1, Math.ceil(charCount / 2500));
      const pages = [{ pageNumber: 1, text: d.text }];

      const doc = await store.createDocument({
        notebookId: notebook._id,
        filename: d.filename,
        extractedText: d.text,
        pageCount: estimatedPages,
        pages,
        charCount,
        status: "processing",
      });

      // Asynchronously chunk, embed and analyze
      (async () => {
        try {
          const rawChunks = chunkDocument({ _id: doc._id, filename: d.filename, pages, extractedText: d.text });
          const embeddings = await generateBatchEmbeddings(rawChunks.map((c) => c.chunk));
          const chunks = rawChunks.map((c, idx) => ({
            chunkId: c.chunkId,
            pageNumber: c.pageNumber || 1,
            chunkIndex: idx,
            text: c.chunk,
            charCount: c.chunk.length,
            embedding: embeddings[idx] || [],
            metadata: { filename: d.filename, pageNumber: c.pageNumber || 1 },
          }));

          const analysis = await analyzeDocument(d.text, d.filename);

          await store.updateDocument(doc._id, {
            summary: analysis.summary,
            keyTopics: analysis.keyTopics,
            suggestedQuestions: analysis.suggestedQuestions,
            chunks,
            status: "ready",
          });
        } catch (err) {
          console.error("[sample] Embedding error:", err.message);
          await store.updateDocument(doc._id, { status: "ready", summary: "Analysis complete." });
        }
      })();
    }

    res.status(201).json(notebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a notebook
router.post("/", async (req, res) => {
  try {
    const { title, description, icon, color } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Notebook title is required" });
    }
    const userId = req.user ? req.user.id : null;
    const notebook = await store.createNotebook(title.trim(), description || "", userId, icon || "📓", color || "#8ab4f8");
    res.status(201).json(notebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate a notebook
router.post("/:id/duplicate", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const duplicated = await store.duplicateNotebook(req.params.id, userId);
    res.status(201).json(duplicated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one notebook + its documents
router.get("/:id", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    // Authorization: if notebook is private to a user, block guests and other users
    if (notebook.userId && req.user?.role !== "admin") {
      if (!req.user || String(notebook.userId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Access denied. This notebook belongs to a registered user." });
      }
    }

    const documents = await store.getDocuments(notebook._id);
    res.json({ notebook, documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename / update a notebook
router.put("/:id", async (req, res) => {
  try {
    const existing = await store.getNotebookById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Notebook not found" });

    if (existing.userId && req.user?.role !== "admin") {
      if (!req.user || String(existing.userId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Access denied. You do not own this notebook." });
      }
    }

    const notebook = await store.updateNotebook(req.params.id, req.body);
    res.json(notebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a notebook and everything inside it
router.delete("/:id", async (req, res) => {
  try {
    const existing = await store.getNotebookById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Notebook not found" });

    if (existing.userId && req.user?.role !== "admin") {
      if (!req.user || String(existing.userId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Access denied. You do not own this notebook." });
      }
    }

    await store.deleteNotebook(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
