const store = require("../config/store");
const { hybridRetrieve } = require("../utils/vectorEngine");

/**
 * Shared Generation Context Service for StudyVault
 * Provides source-aware, NotebookLM-style grounded context retrieval for:
 * 1. Flashcards generation
 * 2. Visual / Diagram generation
 * 3. Video lecture generation
 * 
 * Supported scopeType values:
 * - "all"     : Retrieves balanced grounded content across all ready documents in the notebook
 * - "topic"   : Uses Semantic + Lexical Hybrid RAG retrieval for a specific detected or custom topic
 * - "source"  : Restricts retrieval exclusively to user-selected documents (one or more)
 */

async function getGenerationContext({
  notebookId,
  scopeType = "all",
  topic = "",
  documentIds = [],
  user = null,
  apiKeyOverride = null,
  topK = 12,
}) {
  if (!notebookId) {
    const error = new Error("Notebook ID is required");
    error.status = 400;
    throw error;
  }

  // 1. Verify notebook exists
  const notebook = await store.getNotebookById(notebookId);
  if (!notebook) {
    const error = new Error("Notebook not found");
    error.status = 404;
    throw error;
  }

  // 2. Ownership / authorization verification
  if (user && user.role !== "admin" && user.id !== "guest" && notebook.userId) {
    const ownerId = notebook.userId.toString ? notebook.userId.toString() : String(notebook.userId);
    const requestingUserId = user.id.toString ? user.id.toString() : String(user.id);
    if (ownerId !== requestingUserId) {
      const error = new Error("Access denied. You do not own this notebook.");
      error.status = 403;
      throw error;
    }
  }

  // 3. Fetch notebook documents
  const allDocs = await store.getDocuments(notebookId);
  const readyDocs = (allDocs || []).filter((d) => d.status === "ready");

  if (readyDocs.length === 0) {
    const error = new Error("No ready documents found in this notebook. Please upload or process sources first.");
    error.status = 400;
    throw error;
  }

  const normalizedScope = (scopeType || "all").toLowerCase().trim();
  let targetDocs = [];
  let chunks = [];

  // 4. Handle Scope: SPECIFIC SOURCE
  if (normalizedScope === "source") {
    const selectedIds = Array.isArray(documentIds)
      ? documentIds.map((id) => String(id))
      : [String(documentIds)];

    if (selectedIds.length === 0 || !selectedIds[0] || selectedIds[0] === "undefined") {
      const error = new Error("Please select at least one document for source-scoped generation.");
      error.status = 400;
      throw error;
    }

    targetDocs = readyDocs.filter((d) => {
      const dId = String(d._id || d.id);
      return selectedIds.includes(dId) || selectedIds.includes(d.filename);
    });

    if (targetDocs.length === 0) {
      const error = new Error("None of the selected documents exist in this notebook or they are not ready yet.");
      error.status = 400;
      throw error;
    }

    // If an optional topic query was also provided, run hybrid RAG over only the selected documents
    if (topic && topic.trim()) {
      chunks = await hybridRetrieve({
        documents: targetDocs,
        query: topic.trim(),
        topK: topK || 12,
        alpha: 0.65,
        apiKeyOverride,
      });
    } else {
      // Gather chunks strictly from selected documents
      chunks = collectAllChunks(targetDocs, topK || 15);
    }
  }
  // 5. Handle Scope: SPECIFIC TOPIC
  else if (normalizedScope === "topic") {
    const cleanedTopic = (topic || "").trim();
    if (!cleanedTopic) {
      const error = new Error("Please specify or select a topic for topic-scoped generation.");
      error.status = 400;
      throw error;
    }

    targetDocs = readyDocs;
    // Execute Semantic + BM25 Hybrid Retrieval filtered strictly to this notebook's documents
    chunks = await hybridRetrieve({
      documents: targetDocs,
      query: cleanedTopic,
      topK: topK || 12,
      alpha: 0.65,
      apiKeyOverride,
    });

    if (!chunks || chunks.length === 0) {
      const error = new Error(`No relevant content found in notebook documents for topic "${cleanedTopic}". Try another topic or upload related documents.`);
      error.status = 400;
      throw error;
    }
  }
  // 6. Handle Scope: ALL TOPICS (Full Notebook)
  else {
    targetDocs = readyDocs;
    if (topic && topic.trim()) {
      chunks = await hybridRetrieve({
        documents: targetDocs,
        query: topic.trim(),
        topK: topK || 15,
        alpha: 0.65,
        apiKeyOverride,
      });
    } else {
      chunks = collectAllChunks(targetDocs, topK || 18);
    }
  }

function sanitizeChunkText(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/---+\s*Page\s*\d+\s*---+/gi, " ")
    .replace(/----+\s*Page\s*\d+\s*----+/gi, " ")
    .replace(/Page\s+\d+\s+of\s+\d+/gi, " ")
    .replace(/\[StudyVault Source Grounding[^\]]*\]/gi, " ")
    .replace(/StudyVault Document Engine • Exact Page Citations Grounded/gi, " ")
    .replace(/SECTION • PAGE \d+/gi, " ")
    .replace(/SLIDE \d+\s*\/\s*\d+/gi, " ")
    .replace(/Reference chunk:\s*p\.\d+\s*verified[^.]*\./gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

  // 7. Deduplicate chunks by text / chunkId
  const seenTexts = new Set();
  const dedupedChunks = [];
  for (const c of chunks) {
    const rawSnippet = (c.chunk || c.text || "").trim();
    const textSnippet = sanitizeChunkText(rawSnippet) || rawSnippet;
    if (!textSnippet || textSnippet.length < 15) continue;
    // Normalized key: first 120 chars lowercase
    const key = `${c.filename || ""}_${c.pageNumber || 1}_${textSnippet.slice(0, 100).toLowerCase()}`;
    if (!seenTexts.has(key)) {
      seenTexts.add(key);
      dedupedChunks.push({
        documentId: c.documentId || String(c._id || c.id || ""),
        filename: c.filename || "document.pdf",
        pageNumber: c.pageNumber || 1,
        text: textSnippet,
        score: c.hybridScore !== undefined ? c.hybridScore : (c.semanticScore || null),
      });
    }
  }

  if (dedupedChunks.length === 0) {
    const error = new Error("Insufficient text content extracted from the selected scope. Please ensure documents have readable text.");
    error.status = 400;
    throw error;
  }

  // 8. Build formatted context string with explicit document & page citations
  const contextText = dedupedChunks
    .map((c, i) => `[Source ${i + 1}: ${c.filename}, Page ${c.pageNumber}]:\n${c.text}`)
    .join("\n\n---\n\n");

  return {
    notebookId,
    notebookTitle: notebook.title || "Study Notebook",
    scopeType: normalizedScope,
    topic: topic ? topic.trim() : null,
    documentIds: targetDocs.map((d) => String(d._id || d.id)),
    selectedDocuments: targetDocs.map((d) => ({
      id: String(d._id || d.id),
      filename: d.filename,
      pageCount: d.pageCount || 1,
    })),
    chunks: dedupedChunks,
    contextText,
  };
}

/**
 * Helper to collect and balance chunks across documents
 */
function collectAllChunks(documents, maxChunks = 15) {
  const all = [];
  for (const doc of documents) {
    const filename = doc.filename || "document.pdf";
    const docId = String(doc._id || doc.id || filename);

    if (doc.chunks && Array.isArray(doc.chunks) && doc.chunks.length > 0) {
      for (const ch of doc.chunks) {
        all.push({
          documentId: docId,
          filename,
          pageNumber: ch.pageNumber || 1,
          chunkId: ch.chunkId || `${docId}_p${ch.pageNumber || 1}`,
          chunk: ch.text || ch.chunk || "",
        });
      }
    } else if (doc.pages && Array.isArray(doc.pages) && doc.pages.length > 0) {
      for (const p of doc.pages) {
        if (p.text && p.text.trim()) {
          all.push({
            documentId: docId,
            filename,
            pageNumber: p.pageNumber || 1,
            chunkId: `${docId}_p${p.pageNumber || 1}`,
            chunk: p.text.trim(),
          });
        }
      }
    } else if (doc.extractedText && doc.extractedText.trim()) {
      all.push({
        documentId: docId,
        filename,
        pageNumber: 1,
        chunkId: `${docId}_p1`,
        chunk: doc.extractedText.trim().slice(0, 4000),
      });
    }
  }

  // Interleave/balance chunks across different documents so one doc doesn't monopolize
  if (all.length <= maxChunks) return all;

  // Stride-based sampling for balanced representation across the notebook
  const step = all.length / maxChunks;
  const sampled = [];
  for (let i = 0; i < maxChunks; i++) {
    const idx = Math.floor(i * step);
    if (all[idx]) sampled.push(all[idx]);
  }
  return sampled;
}

module.exports = {
  getGenerationContext,
};
