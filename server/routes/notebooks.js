const express = require("express");
const store = require("../config/store");
const sampleNotebooks = require("../utils/sampleData");
const { analyzeDocument } = require("../utils/aiClient");
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
    res.json(notebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Load sample notebook
router.post("/sample/:sampleKey", async (req, res) => {
  try {
    const sample = sampleNotebooks[req.params.sampleKey];
    if (!sample) return res.status(404).json({ error: "Sample notebook not found" });

    const userId = req.user ? req.user.id : null;
    const notebook = await store.createNotebook(sample.title, sample.description, userId);

    for (const d of sample.documents) {
      const charCount = d.text.length;
      const estimatedPages = Math.max(1, Math.ceil(charCount / 2500));
      const doc = await store.createDocument({
        notebookId: notebook._id,
        filename: d.filename,
        extractedText: d.text,
        pageCount: estimatedPages,
        charCount,
        status: "processing",
      });

      // Analyze document
      analyzeDocument(d.text, d.filename).then(async (analysis) => {
        await store.updateDocument(doc._id, {
          summary: analysis.summary,
          keyTopics: analysis.keyTopics,
          suggestedQuestions: analysis.suggestedQuestions,
          status: "ready",
        });
      }).catch(async (err) => {
        await store.updateDocument(doc._id, { status: "ready", summary: "Analysis complete." });
      });
    }

    res.status(201).json(notebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a notebook
router.post("/", async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = req.user ? req.user.id : null;
    const notebook = await store.createNotebook(title, description, userId);
    res.status(201).json(notebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one notebook + its documents
router.get("/:id", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.id);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });
    const documents = await store.getDocuments(notebook._id);
    res.json({ notebook, documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename / update a notebook
router.put("/:id", async (req, res) => {
  try {
    const notebook = await store.updateNotebook(req.params.id, req.body);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });
    res.json(notebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a notebook and everything inside it
router.delete("/:id", async (req, res) => {
  try {
    await store.deleteNotebook(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
