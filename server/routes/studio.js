const express = require("express");
const store = require("../config/store");
const { authenticateToken } = require("../middleware/authMiddleware");
const { getGenerationContext } = require("../services/generationContextService");
const {
  generateAudioOverviewScript,
  generateGroundedAudioOverviewScript,
  generateFlashcardsDeck,
  generateGroundedFlashcards,
  generatePracticeQuiz,
  generateGroundedPracticeQuiz,
  generateMindMapData,
  generateGroundedMindMap,
  generateBriefingDocReport,
  generateGroundedBriefingDocReport,
  generateMultiDocumentComparison,
  generateImportantQuestions,
  generateGroundedImportantQuestions,
  generateGroundedSlideDeck,
  generateGroundedDataTable,
  generateStudyVisuals,
  generateGroundedStudyVisuals,
  generateStudyVideoLecture,
  generateGroundedStudyVideoLecture,
} = require("../utils/aiClient");

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
        return res.status(403).json({ error: "Access denied. You do not have permission to access study studio in this notebook." });
      }
    }
    req.notebook = notebook;
    next();
  } catch (err) {
    next(err);
  }
});

// Helper endpoint to fetch available generation scope options (documents and detected topics)
router.get("/generation-scope", async (req, res) => {
  try {
    const notebook = await store.getNotebookById(req.params.notebookId);
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const allDocs = await store.getDocuments(req.params.notebookId);
    const readyDocs = (allDocs || []).filter((d) => d.status === "ready");

    const topicsSet = new Set();
    readyDocs.forEach((d) => {
      if (Array.isArray(d.keyTopics)) {
        d.keyTopics.forEach((t) => {
          if (t && typeof t === "string" && t.trim()) topicsSet.add(t.trim());
        });
      }
      if (d.nlp && Array.isArray(d.nlp.topics)) {
        d.nlp.topics.forEach((t) => {
          if (t && typeof t === "string" && t.trim()) topicsSet.add(t.trim());
        });
      }
    });

    res.json({
      notebookId: req.params.notebookId,
      notebookTitle: notebook.title,
      readyDocuments: readyDocs.map((d) => ({
        id: String(d._id || d.id),
        filename: d.filename,
        pageCount: d.pageCount || 1,
        charCount: d.charCount || 0,
        keyTopics: d.keyTopics || [],
        nlp: d.nlp || null,
      })),
      detectedTopics: Array.from(topicsSet),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const { scopeType = "all", topic = "", documentIds = [] } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 12,
    });

    const scriptData = await generateGroundedAudioOverviewScript({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    scriptData.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "audio-overview", scriptData);
    res.json(scriptData);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- Multi-Document Comparison Matrix ---
router.get("/compare", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "compare");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/compare", async (req, res) => {
  try {
    const { scopeType = "all", topic = "", documentIds = [] } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 14,
    });

    const matrix = await generateGroundedDataTable({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    const result = { matrix, markdown: matrix.rows ? matrix.rows.map(r => r.join(" | ")).join("\n") : "" };
    await store.saveArtifact(req.params.notebookId, "compare", result);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- Important Questions (Exam Modes: 2 Mark, 5 Mark, 10 Mark) ---
router.get("/important-questions", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "important-questions");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/important-questions", async (req, res) => {
  try {
    const { scopeType = "all", topic = "", documentIds = [] } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 15,
    });

    const questions = await generateGroundedImportantQuestions({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    questions.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "important-questions", questions);
    res.json(questions);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- Briefing Doc / Executive Report ---
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
    const { scopeType = "all", topic = "", documentIds = [] } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 15,
    });

    const briefingData = await generateGroundedBriefingDocReport({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    briefingData.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "briefing", briefingData);
    res.json(briefingData);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- Flashcards ---
router.get("/flashcards", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "flashcards");
    if (!artifact) return res.json(null);
    res.json(artifact.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/flashcards", async (req, res) => {
  try {
    const { scopeType = "all", topic = "", documentIds = [], count = 10 } = req.body;

    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 15,
    });

    const cards = await generateGroundedFlashcards({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      count,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    const payload = {
      cards,
      scope: {
        scopeType: genContext.scopeType,
        topic: genContext.topic,
        documentIds: genContext.documentIds,
      },
      count: cards.length,
      generatedAt: new Date().toISOString(),
    };

    await store.saveArtifact(req.params.notebookId, "flashcards", payload);
    res.status(201).json(payload);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- Practice Quiz ---
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
    const { scopeType = "all", topic = "", documentIds = [], count = 6 } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 14,
    });

    const quiz = await generateGroundedPracticeQuiz({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      count: Number(count) || 6,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    quiz.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "quiz", quiz);
    res.json(quiz);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
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
    const { scopeType = "all", topic = "", documentIds = [] } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 24,
    });

    const mindMap = await generateGroundedMindMap({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    mindMap.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "mindmap", mindMap);
    res.json(mindMap);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- Slide Deck ---
router.get("/slides", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "slides");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/slides", async (req, res) => {
  try {
    const { scopeType = "all", topic = "", documentIds = [] } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 15,
    });

    const slidesData = await generateGroundedSlideDeck({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    slidesData.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "slides", slidesData);
    res.json(slidesData);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- Data Table ---
router.get("/data-table", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "data-table");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/data-table", async (req, res) => {
  try {
    const { scopeType = "all", topic = "", documentIds = [] } = req.body;
    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 14,
    });

    const tableData = await generateGroundedDataTable({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    tableData.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "data-table", tableData);
    res.json(tableData);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
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

// --- AI Visual & Image Generation Studio ---
router.get("/images", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "images");
    res.json(artifact ? artifact.data : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/images", async (req, res) => {
  try {
    const {
      scopeType = "all",
      topic = "",
      documentIds = [],
      prompt = "",
      style = "diagram",
      aspectRatio = "16:9",
    } = req.body;

    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 18,
    });

    const visual = await generateGroundedStudyVisuals({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      prompt,
      style,
      aspectRatio,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    visual.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    // Fetch existing images to maintain gallery history
    const existing = await store.getArtifact(req.params.notebookId, "images");
    const list = existing && Array.isArray(existing.data) ? existing.data : [];
    list.unshift(visual);

    await store.saveArtifact(req.params.notebookId, "images", list);
    res.status(201).json({ visual, list });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// --- AI Video Explainer Lecture Studio ---
router.get("/video", async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.notebookId, "video");
    res.json(artifact ? artifact.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/video", async (req, res) => {
  try {
    const {
      scopeType = "all",
      topic = "",
      documentIds = [],
      style = "explainer",
    } = req.body;

    const genContext = await getGenerationContext({
      notebookId: req.params.notebookId,
      scopeType,
      topic,
      documentIds,
      user: req.user,
      apiKeyOverride: req.headers["x-gemini-key"],
      topK: 14,
    });

    const videoProject = await generateGroundedStudyVideoLecture({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: genContext.topic,
      style: style || "explainer",
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    videoProject.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
    };

    await store.saveArtifact(req.params.notebookId, "video", videoProject);
    res.status(201).json(videoProject);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;

