const express = require("express");
const store = require("../config/store");
const {
  generateAudioOverviewScript,
  generateFlashcardsDeck,
  generatePracticeQuiz,
  generateMindMapData,
  generateBriefingDocReport,
  generateMultiDocumentComparison,
  generateImportantQuestions,
} = require("../utils/aiClient");

const router = express.Router({ mergeParams: true });

async function getCombinedSourcesText(notebookId) {
  const docs = await store.getDocuments(notebookId);
  const readyDocs = docs.filter((d) => d.status === "ready" && d.extractedText);
  if (readyDocs.length === 0) {
    throw new Error("No ready documents in this notebook. Upload or add a source first.");
  }
  return {
    combinedText: readyDocs.map((d) => `--- Document: ${d.filename} ---\n${d.extractedText}`).join("\n\n"),
    docs: readyDocs,
  };
}

// --- Audio Overview Podcast ---
router.get("/audio-overview", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "audio-overview");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/audio-overview", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const { combinedText } = await getCombinedSourcesText(req.params.notebookId);
    const scriptData = await generateAudioOverviewScript(combinedText, notebook.title);

    await store.saveArtifact(req.params.notebookId, "audio-overview", scriptData);
    res.json(scriptData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Multi-Document Comparison Matrix ---
router.post("/compare", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    const { docs } = await getCombinedSourcesText(req.params.notebookId);
    const matrix = await generateMultiDocumentComparison(notebook.title, docs);

    await store.saveArtifact(req.params.notebookId, "compare", matrix);
    res.json({ matrix });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Important Questions ---
router.post("/important-questions", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    const { combinedText } = await getCombinedSourcesText(req.params.notebookId);
    const questions = await generateImportantQuestions(combinedText, notebook.title);

    await store.saveArtifact(req.params.notebookId, "important-questions", questions);
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Briefing Doc ---
router.get("/briefing", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "briefing");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/briefing", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    const { combinedText } = await getCombinedSourcesText(req.params.notebookId);
    const briefingData = await generateBriefingDocReport(combinedText, notebook.title);

    await store.saveArtifact(req.params.notebookId, "briefing", briefingData);
    res.json(briefingData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Flashcards ---
router.get("/flashcards", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "flashcards");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/flashcards", async (req, res) => {
  try {
    const { combinedText } = await getCombinedSourcesText(req.params.notebookId);
    const deck = await generateFlashcardsDeck(combinedText);

    await store.saveArtifact(req.params.notebookId, "flashcards", deck);
    res.json(deck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Practice Quiz & Attempts ---
router.get("/quiz", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "quiz");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/quiz", async (req, res) => {
  try {
    const { combinedText } = await getCombinedSourcesText(req.params.notebookId);
    const quiz = await generatePracticeQuiz(combinedText);

    await store.saveArtifact(req.params.notebookId, "quiz", quiz);
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Concept Mind Map ---
router.get("/mindmap", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "mindmap");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/mindmap", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    const { combinedText } = await getCombinedSourcesText(req.params.notebookId);
    const mindMap = await generateMindMapData(combinedText, notebook.title);

    await store.saveArtifact(req.params.notebookId, "mindmap", mindMap);
    res.json(mindMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Notes Pinboard ---
router.get("/notes", async (req, res) => {
  try {
    const notes = await store.getNotes(req.params.notebookId);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/notes", async (req, res) => {
  try {
    const { title, content, tag } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: "Note content is required" });

    const note = await store.createNote(req.params.notebookId, title, content.trim(), tag || "Saved Insight");
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/notes/:noteId", async (req, res) => {
  try {
    await store.deleteNote(req.params.noteId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
