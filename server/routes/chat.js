const express = require("express");
const store = require("../config/store");
const { retrieveRelevantChunks } = require("../utils/textChunker");
const { answerFromSources } = require("../utils/aiClient");

const router = express.Router({ mergeParams: true });

// Get chat history
router.get("/", async (req, res) => {
  try {
    const messages = await store.getMessages(req.params.notebookId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ask question
router.post("/", async (req, res) => {
  try {
    const { question, mode } = req.body;
    const apiKeyOverride = req.headers["x-gemini-key"] || req.body.apiKey;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    const allDocs = await store.getDocuments(req.params.notebookId);
    const docs = allDocs.filter((d) => d.status === "ready");
    if (docs.length === 0) {
      return res.status(400).json({ error: "I couldn't find any processed documents in this notebook. Upload a study material first." });
    }

    const userMsg = await store.createMessage({
      notebookId: req.params.notebookId,
      role: "user",
      content: question.trim(),
    });

    const history = await store.getMessages(req.params.notebookId);

    const relevantChunks = retrieveRelevantChunks(
      docs.map((d) => ({ _id: d._id, filename: d.filename, text: d.extractedText, pages: d.pages })),
      question,
      8
    );

    const answer = await answerFromSources(question, relevantChunks, history.slice(0, -1), mode || "chat", apiKeyOverride);
    const sources = [...new Set(relevantChunks.map((c) => `${c.filename} (p.${c.pageNumber || 1})`))];

    const assistantMsg = await store.createMessage({
      notebookId: req.params.notebookId,
      role: "assistant",
      content: answer,
      sources,
    });

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    console.error("[chat] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear chat history
router.delete("/", async (req, res) => {
  try {
    await store.clearMessages(req.params.notebookId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
