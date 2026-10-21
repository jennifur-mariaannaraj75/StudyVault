const express = require("express");
const nlpService = require("../services/nlpService");

const router = express.Router();

/**
 * Diagnostic and testing status endpoint for the NLP service
 */
router.get("/status", (req, res) => {
  res.json({
    status: "ok",
    nlpEngine: "StudyVault Modular NLP Service",
    libraries: ["compromise (v14)", "natural (v8)"],
    capabilities: [
      "text_cleaning",
      "sentence_segmentation",
      "tokenization_and_stemming",
      "keyword_extraction_tfidf",
      "keyphrase_extraction_noun_compounds",
      "named_entity_recognition",
      "topic_identification",
      "exam_concept_extraction",
      "query_intent_classification",
      "semantic_query_expansion",
      "nlp_enhanced_hybrid_retrieval",
    ],
  });
});

/**
 * Document text linguistic analysis endpoint
 */
router.post("/analyze", (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required as a string." });
    }

    // Security guard: limit extremely large text
    const safeText = text.slice(0, 150000);
    const analysis = nlpService.analyzeText(safeText);
    res.json(analysis);
  } catch (err) {
    console.error("[nlpRoute] Error in /analyze:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * User query analysis and intent classification endpoint
 */
router.post("/query", (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required as a string." });
    }

    const analysis = nlpService.analyzeQuery(query.slice(0, 5000));
    res.json(analysis);
  } catch (err) {
    console.error("[nlpRoute] Error in /query:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
