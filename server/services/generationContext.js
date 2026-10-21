const store = require("../config/store");
const vectorEngine = require("../utils/vectorEngine");

/**
 * Shared Generation Context Service
 * Retrieves grounded source chunks scoped to:
 * - "all": All ready documents across the notebook
 * - "topic": Specific topic using hybrid semantic + lexical RAG
 * - "source": One or more explicitly selected documents
 *
 * Enforces authentication, notebook ownership, and source isolation.
 */
async function getGenerationContext({
  notebookId,
  scopeType = "all",
  topic = null,
  documentIds = [],
  userId = null,
  userRole = "user",
  maxChunks = 20
}) {
  if (!notebookId) {
    const err = new Error("Notebook ID is required for generation context.");
    err.status = 400;
    throw err;
  }

  // 1. Verify notebook existence and access
  const notebook = await store.getNotebookById(notebookId);
  if (!notebook) {
    const err = new Error("Notebook not found.");
    err.status = 404;
    throw err;
  }

  // Notebook isolation: if user is not admin and notebook has an owner, ensure user owns it
  if (userId && userId !== "guest" && userRole !== "admin") {
    if (notebook.userId && String(notebook.userId) !== String(userId)) {
      const err = new Error("Access denied: You do not have permission to access this notebook.");
      err.status = 403;
      throw err;
    }
  }

  // 2. Load all documents belonging to this notebook
  const allDocs = await store.getDocuments(notebookId);
  if (!allDocs || allDocs.length === 0) {
    const err = new Error("No documents found in this notebook. Please upload study sources first.");
    err.status = 400;
    throw err;
  }

  const readyDocs = allDocs.filter(d => d.status === "ready" && (d.extractedText || (d.chunks && d.chunks.length > 0)));
  if (readyDocs.length === 0) {
    const err = new Error("No processed documents found in this notebook. Documents may still be processing or failed extraction.");
    err.status = 400;
    throw err;
  }

  let scopedChunks = [];
  const normalizedScope = (scopeType || "all").toLowerCase().trim();

  // 3. Handle Scopes
  if (normalizedScope === "topic") {
    const cleanTopic = (topic || "").trim();
    if (!cleanTopic) {
      const err = new Error("Please specify a topic name or select an existing topic for topic-scoped generation.");
      err.status = 400;
      throw err;
    }

    // Hybrid retrieval over ready documents in this notebook
    const retrieved = await vectorEngine.hybridRetrieve(cleanTopic, readyDocs, {
      topK: Math.max(Number(maxChunks) || 15, 10),
      semanticWeight: 0.65,
      lexicalWeight: 0.35,
      rrfConstant: 60
    });

    if (!retrieved || retrieved.length === 0) {
      const err = new Error(`Not enough source content found for topic "${cleanTopic}". Try selecting another topic or choose "All Topics".`);
      err.status = 400;
      throw err;
    }

    scopedChunks = retrieved.map(r => ({
      documentId: String(r.documentId || r._id || ""),
      filename: r.filename,
      pageNumber: r.pageNumber || 1,
      text: r.chunk || r.text || "",
      score: r.hybridScore || 0
    }));

  } else if (normalizedScope === "source") {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      const err = new Error("Please select at least one source document for document-scoped generation.");
      err.status = 400;
      throw err;
    }

    const selectedIdSet = new Set(documentIds.map(String));
    const targetDocs = readyDocs.filter(d => selectedIdSet.has(String(d._id)));

    // Verify all selected documentIds belong to this notebook
    if (targetDocs.length === 0) {
      const err = new Error("Selected document(s) do not belong to this notebook or have not completed processing.");
      err.status = 400;
      throw err;
    }

    // If some selected IDs do not match ready docs in this notebook
    if (targetDocs.length !== selectedIdSet.size) {
      const foundIds = new Set(targetDocs.map(d => String(d._id)));
      const invalid = Array.from(selectedIdSet).find(id => !foundIds.has(id));
      if (invalid) {
        const err = new Error(`Selected document ${invalid} does not belong to this notebook.`);
        err.status = 400;
        throw err;
      }
    }

    // Collect chunks from target documents
    targetDocs.forEach(doc => {
      const chunks = doc.chunks && doc.chunks.length > 0 ? doc.chunks : [];
      if (chunks.length > 0) {
        chunks.forEach(c => {
          scopedChunks.push({
            documentId: String(doc._id),
            filename: doc.filename,
            pageNumber: c.pageNumber || 1,
            text: c.chunk || c.text || ""
          });
        });
      } else if (doc.extractedText) {
        // Fallback if chunks array is empty but extractedText exists
        scopedChunks.push({
          documentId: String(doc._id),
          filename: doc.filename,
          pageNumber: 1,
          text: doc.extractedText.slice(0, 3000)
        });
      }
    });

    if (scopedChunks.length === 0) {
      const err = new Error("The selected document(s) contain no readable text passages.");
      err.status = 400;
      throw err;
    }

    // Cap chunks
    if (scopedChunks.length > maxChunks) {
      // Distribute evenly across selected docs
      const perDocLimit = Math.max(2, Math.floor(maxChunks / targetDocs.length));
      const balanced = [];
      targetDocs.forEach(doc => {
        const docChunks = scopedChunks.filter(c => c.documentId === String(doc._id));
        balanced.push(...docChunks.slice(0, perDocLimit));
      });
      scopedChunks = balanced.slice(0, maxChunks);
    }

  } else {
    // "all": Retrieve content representing the entire notebook
    readyDocs.forEach(doc => {
      const chunks = doc.chunks && doc.chunks.length > 0 ? doc.chunks : [];
      if (chunks.length > 0) {
        chunks.forEach(c => {
          scopedChunks.push({
            documentId: String(doc._id),
            filename: doc.filename,
            pageNumber: c.pageNumber || 1,
            text: c.chunk || c.text || ""
          });
        });
      } else if (doc.extractedText) {
        scopedChunks.push({
          documentId: String(doc._id),
          filename: doc.filename,
          pageNumber: 1,
          text: doc.extractedText.slice(0, 3000)
        });
      }
    });

    if (scopedChunks.length === 0) {
      const err = new Error("No readable source content available across documents in this notebook.");
      err.status = 400;
      throw err;
    }

    // If more chunks than maxChunks, evenly sample across documents
    if (scopedChunks.length > maxChunks) {
      const perDocLimit = Math.max(2, Math.floor(maxChunks / readyDocs.length));
      const balanced = [];
      readyDocs.forEach(doc => {
        const docChunks = scopedChunks.filter(c => c.documentId === String(doc._id));
        balanced.push(...docChunks.slice(0, perDocLimit));
      });
      scopedChunks = balanced.slice(0, maxChunks);
    }
  }

  // 4. Deduplicate chunks
  const seenTexts = new Set();
  const dedupedChunks = [];
  for (const c of scopedChunks) {
    const key = (c.filename + "_" + c.pageNumber + "_" + (c.text || "").slice(0, 80)).toLowerCase();
    if (!seenTexts.has(key) && (c.text || "").trim().length > 20) {
      seenTexts.add(key);
      dedupedChunks.push(c);
    }
  }

  if (dedupedChunks.length === 0) {
    const err = new Error("Not enough distinct text passages found for the requested scope.");
    err.status = 400;
    throw err;
  }

  // 5. Construct formatted grounded context string with exact citations
  const formattedGroundedText = dedupedChunks
    .map(c => `[Source: "${c.filename}", Page ${c.pageNumber}]\n${c.text.trim()}`)
    .join("\n\n---\n\n");

  return {
    notebookId: String(notebook._id),
    notebookTitle: notebook.title,
    scopeType: normalizedScope,
    topic: normalizedScope === "topic" ? topic : null,
    documentIds: normalizedScope === "source" ? documentIds : readyDocs.map(d => String(d._id)),
    chunks: dedupedChunks,
    groundedText: formattedGroundedText,
    sourceDocuments: readyDocs.map(d => ({
      _id: String(d._id),
      filename: d.filename,
      pageCount: d.pageCount || 1,
      status: d.status
    }))
  };
}

/**
 * Extracts and aggregates detected topics across ready documents in a notebook.
 */
async function getNotebookTopics(notebookId, userId = null, userRole = "user") {
  const notebook = await store.getNotebookById(notebookId);
  if (!notebook) {
    const err = new Error("Notebook not found.");
    err.status = 404;
    throw err;
  }

  if (userId && userId !== "guest" && userRole !== "admin") {
    if (notebook.userId && String(notebook.userId) !== String(userId)) {
      const err = new Error("Access denied: You do not have permission to access this notebook.");
      err.status = 403;
      throw err;
    }
  }

  const docs = await store.getDocuments(notebookId);
  const readyDocs = docs.filter(d => d.status === "ready");

  const topicSet = new Set();

  readyDocs.forEach(doc => {
    // 1. Check existing keyTopics array
    if (Array.isArray(doc.keyTopics)) {
      doc.keyTopics.forEach(t => {
        if (t && typeof t === "string" && t.trim().length > 2) {
          topicSet.add(t.trim());
        }
      });
    }

    // 2. Check suggestedQuestions for topic hints
    if (Array.isArray(doc.suggestedQuestions)) {
      doc.suggestedQuestions.forEach(q => {
        if (q && typeof q === "string" && q.trim().length > 10) {
          // e.g., "What is Process Synchronization?" -> "Process Synchronization"
          const match = q.match(/(?:what is|explain|describe|overview of|how does)\s+([^?]+)/i);
          if (match && match[1] && match[1].trim().length < 40) {
            topicSet.add(match[1].trim());
          }
        }
      });
    }

    // 3. Extract common topic titles from chunk headings if available
    if (Array.isArray(doc.chunks)) {
      doc.chunks.slice(0, 10).forEach(c => {
        const text = c.chunk || c.text || "";
        const headingMatch = text.match(/^(?:#+\s*|[0-9]+\.[0-9]*\s*)([A-Z][A-Za-z0-9\s]{3,35})(?:\n|$)/m);
        if (headingMatch && headingMatch[1]) {
          topicSet.add(headingMatch[1].trim());
        }
      });
    }
  });

  return {
    notebookId: String(notebook._id),
    notebookTitle: notebook.title,
    topics: Array.from(topicSet),
    documents: readyDocs.map(d => ({
      _id: String(d._id),
      filename: d.filename,
      pageCount: d.pageCount || 1,
      status: d.status
    }))
  };
}

module.exports = {
  getGenerationContext,
  getNotebookTopics
};
