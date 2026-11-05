const express = require("express");
const fs = require("fs");
const store = require("../config/store");
const { authenticateToken } = require("../middleware/authMiddleware");
const { getGenerationContext } = require("../services/generationContextService");
const { ensureDocumentExtractedImages, getExtractedImageFilePath } = require("../utils/imageExtractor");
const {
  searchExternalTopicImages,
  fetchExternalImageAsBase64,
  buildExternalAiGeneratedImage,
} = require("../utils/webImageSearch");
const GeneratedImage = require("../models/GeneratedImage");
const documentsRouter = require("./documents");
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

const STUDIO_GENERATION_FEATURES = new Set([
  "audio-overview",
  "compare",
  "important-questions",
  "briefing",
  "flashcards",
  "quiz",
  "mindmap",
  "slides",
  "data-table",
  "images",
  "video",
]);

// Enforce subscription plan feature access & daily Studio generation limits
router.use(async (req, res, next) => {
  if (req.method !== "POST") return next();
  const featureId = req.path.replace(/^\/+/, "").split("/")[0];
  if (!STUDIO_GENERATION_FEATURES.has(featureId)) return next();

  try {
    const quota = await store.checkQuota(req.user?.id, req.user?.role, "studio_feature", {
      feature: featureId,
    });
    if (!quota.allowed) {
      return res.status(403).json(quota);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        store.incrementUserUsage(req.user?.id, "studio").catch(() => {});
      }
      return originalJson(body);
    };
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
async function collectNotebookSourceImages(notebookId, forceReExtract = false) {
  const docs = await store.getDocuments(notebookId);
  const readyDocs = (docs || []).filter((d) => d.status === "ready");
  const allImages = [];

  for (const doc of readyDocs) {
    const docId = doc._id || doc.id;
    let docToScan = doc;
    if (forceReExtract) {
      docToScan = { ...doc, extractedImages: [] };
    }
    const isAllV2 =
      Array.isArray(doc.extractedImages) &&
      doc.extractedImages.length > 0 &&
      doc.extractedImages.every((i) => i && i.kind === "cropped_figure_v2");
    const imgs = await ensureDocumentExtractedImages(docToScan, documentsRouter.ensurePdfOnDisk);
    if (!isAllV2 || forceReExtract) {
      await store.updateDocument(docId, {
        extractedImages: imgs.map(({ url, ...rest }) => rest),
      }).catch(() => {});
    }
    allImages.push(...imgs);
  }
  return { images: allImages, documentCount: readyDocs.length };
}

router.get("/source-images", async (req, res) => {
  try {
    const result = await collectNotebookSourceImages(req.params.notebookId, false);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/extract-source-images", async (req, res) => {
  try {
    const result = await collectNotebookSourceImages(req.params.notebookId, Boolean(req.body?.force));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to gather detected topics from the notebook's uploaded sources
async function getNotebookDefaultSearchTopic(notebookId, fallbackNotebookTitle = "") {
  const docs = await store.getDocuments(notebookId);
  const readyDocs = (docs || []).filter((d) => d.status === "ready");
  const suggestedTopics = [];
  for (const d of readyDocs) {
    if (Array.isArray(d.keyTopics)) {
      for (const kt of d.keyTopics) {
        const clean = String(kt || "").trim();
        if (clean && clean.length >= 3 && !suggestedTopics.includes(clean)) {
          suggestedTopics.push(clean);
        }
      }
    }
  }
  const primaryTopic =
    suggestedTopics[0] ||
    fallbackNotebookTitle ||
    (readyDocs[0]?.filename ? readyDocs[0].filename.replace(/\.[a-z0-9]+$/i, "") : "Computer Science Architecture");
  return { primaryTopic, suggestedTopics: suggestedTopics.slice(0, 12) };
}

// Persist searched & generated external images into MongoDB Atlas (generated_images collection)
async function persistExternalImagesToMongo(notebookId, notebookTitle, topic, imagesList = [], style = "diagram") {
  if (!store.isMongoMode() || !Array.isArray(imagesList) || imagesList.length === 0) return;
  try {
    for (const img of imagesList) {
      if (!img || !img.imageUrl) continue;
      await GeneratedImage.findOneAndUpdate(
        { notebookId: String(notebookId), imageUrl: img.imageUrl },
        {
          $set: {
            notebookId: String(notebookId),
            notebookTitle: notebookTitle || "",
            imageName: img.title || img.caption || topic || "External Diagram",
            topic: topic || "",
            imageUrl: img.imageUrl,
            thumbUrl: img.thumbUrl || img.thumbnailUrl || img.imageUrl,
            sourceName: img.sourceName || "External Web",
            externalSourceUrl: img.sourceUrl || "",
            googleImagesUrl: img.googleSearchUrl || "",
            style: style || "diagram",
            summary: img.caption || "",
            kind: img.kind || "wikipedia_diagram",
          },
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.warn("[studio] Non-fatal MongoDB generated_images save notice:", err.message);
  }
}

router.get("/web-images", async (req, res) => {
  try {
    const { primaryTopic, suggestedTopics } = await getNotebookDefaultSearchTopic(
      req.params.notebookId,
      req.notebook?.title || ""
    );
    const rawQuery = String(req.query.q || req.query.topic || primaryTopic || "").trim();
    const style = String(req.query.style || "diagram").trim();
    const result = await searchExternalTopicImages(rawQuery, req.notebook?.title || "", style);
    await persistExternalImagesToMongo(
      req.params.notebookId,
      req.notebook?.title || "",
      result.query || rawQuery,
      result.images || [],
      style
    );
    res.json({
      ...result,
      suggestedTopics,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/web-images", async (req, res) => {
  try {
    const { primaryTopic, suggestedTopics } = await getNotebookDefaultSearchTopic(
      req.params.notebookId,
      req.notebook?.title || ""
    );
    const rawQuery = String(req.body?.q || req.body?.topic || primaryTopic || "").trim();
    const style = String(req.body?.style || "diagram").trim();
    const result = await searchExternalTopicImages(rawQuery, req.notebook?.title || "", style);
    await persistExternalImagesToMongo(
      req.params.notebookId,
      req.notebook?.title || "",
      result.query || rawQuery,
      result.images || [],
      style
    );
    res.json({
      ...result,
      suggestedTopics,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
      sourceImageId = null,
      externalImage = null,
    } = req.body;

    // 1. Resolve local extracted source image if sourceImageId was selected
    let resolvedSourceImage = null;
    if (sourceImageId) {
      const { images } = await collectNotebookSourceImages(req.params.notebookId, false);
      const found = images.find((img) => String(img.id) === String(sourceImageId));
      if (found) {
        const filePath = getExtractedImageFilePath(found.docId, found.fileName);
        let base64Data = null;
        if (filePath && fs.existsSync(filePath)) {
          base64Data = fs.readFileSync(filePath).toString("base64");
        }
        resolvedSourceImage = {
          ...found,
          base64Data,
        };
      }
    }

    const { primaryTopic } = await getNotebookDefaultSearchTopic(
      req.params.notebookId,
      req.notebook?.title || ""
    );

    const effectiveScopeType = resolvedSourceImage ? "source" : scopeType;
    const effectiveDocIds = resolvedSourceImage
      ? [String(resolvedSourceImage.docId)]
      : documentIds;
    const effectiveTopic =
      topic ||
      prompt ||
      (externalImage && externalImage.title ? externalImage.title : "") ||
      (resolvedSourceImage ? resolvedSourceImage.caption : "") ||
      primaryTopic;

    let genContext = {
      contextText: resolvedSourceImage?.pageContextSnippet || "",
      chunks: [],
      notebookTitle: req.notebook?.title || "StudyVault",
      scopeType: effectiveScopeType,
      topic: effectiveTopic,
      documentIds: effectiveDocIds,
    };

    try {
      genContext = await getGenerationContext({
        notebookId: req.params.notebookId,
        scopeType: effectiveScopeType,
        topic: effectiveTopic,
        documentIds: effectiveDocIds,
        user: req.user,
        apiKeyOverride: req.headers["x-gemini-key"],
        topK: 18,
      });
    } catch (ctxErr) {
      if (!resolvedSourceImage && !externalImage) throw ctxErr;
    }

    // 2. Search external web sources (Wikipedia, Wikimedia Commons, Openverse, Google Images) for the topic
    const webSearchResult = await searchExternalTopicImages(
      effectiveTopic || genContext.topic || genContext.notebookTitle,
      genContext.notebookTitle,
      style
    ).catch(() => ({ query: effectiveTopic, googleImagesUrl: "", images: [] }));

    const externalWebImages = Array.isArray(webSearchResult.images) ? webSearchResult.images : [];
    const chosenExternalImage =
      externalImage && externalImage.imageUrl
        ? externalImage
        : externalWebImages.find((img) => img.kind !== "external_ai_generated") ||
          externalWebImages[0] ||
          null;

    // 3. If an external reference image is available, fetch its base64 bytes so Gemini Vision can analyze it
    let externalReferenceWithBytes = chosenExternalImage ? { ...chosenExternalImage } : null;
    if (
      externalReferenceWithBytes &&
      externalReferenceWithBytes.imageUrl &&
      externalReferenceWithBytes.kind !== "external_ai_generated"
    ) {
      const fetched = await fetchExternalImageAsBase64(externalReferenceWithBytes.imageUrl);
      if (fetched && fetched.base64Data) {
        externalReferenceWithBytes.base64Data = fetched.base64Data;
        externalReferenceWithBytes.mimeType = fetched.mimeType;
      }
    }

    const visual = await generateGroundedStudyVisuals({
      contextText: genContext.contextText,
      chunks: genContext.chunks,
      notebookTitle: genContext.notebookTitle,
      topic: effectiveTopic || genContext.topic,
      prompt: prompt || effectiveTopic,
      style,
      aspectRatio,
      sourceImage: resolvedSourceImage,
      externalImage: externalReferenceWithBytes,
      externalWebImages,
      googleImagesUrl: webSearchResult.googleImagesUrl,
      apiKeyOverride: req.headers["x-gemini-key"],
    });

    // Ensure an AI-generated external image tailored to the synthesized visual's title & summary is attached
    const tailoredAiWebImage = buildExternalAiGeneratedImage(
      visual.title || effectiveTopic || genContext.notebookTitle,
      style,
      visual.summary || ""
    );
    visual.externalWebImages = [
      ...(chosenExternalImage && chosenExternalImage.kind !== "external_ai_generated" ? [chosenExternalImage] : []),
      ...externalWebImages.filter(
        (img) =>
          img.kind !== "external_ai_generated" &&
          (!chosenExternalImage || img.imageUrl !== chosenExternalImage.imageUrl)
      ),
      tailoredAiWebImage,
    ];
    visual.externalImage =
      chosenExternalImage && chosenExternalImage.kind !== "external_ai_generated"
        ? chosenExternalImage
        : visual.externalWebImages[0] || tailoredAiWebImage;
    visual.googleImagesUrl =
      webSearchResult.googleImagesUrl || tailoredAiWebImage.googleSearchUrl;
    if (!visual.generatedImageUrl) {
      visual.generatedImageUrl = visual.externalImage?.imageUrl || tailoredAiWebImage.imageUrl;
    }
    visual.aiGeneratedImageUrl = tailoredAiWebImage.imageUrl;

    // Persist the external & AI-generated images to MongoDB Atlas (generated_images collection)
    await persistExternalImagesToMongo(
      req.params.notebookId,
      genContext.notebookTitle,
      effectiveTopic || visual.title,
      visual.externalWebImages || [],
      style
    );

    visual.scope = {
      scopeType: genContext.scopeType,
      topic: genContext.topic,
      documentIds: genContext.documentIds,
      sourceImageId: resolvedSourceImage ? resolvedSourceImage.id : null,
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
