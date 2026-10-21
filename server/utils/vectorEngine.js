const { GoogleGenAI } = require("@google/genai");
const nlpService = require("../services/nlpService");

/**
 * High-Performance Vector & Hybrid Retrieval Engine for StudyVault RAG
 * Implements:
 * 1. Semantic Embeddings using Google Gemini (gemini-embedding-2-preview)
 * 2. Deterministic high-dimensional projection fallback for offline/resilience
 * 3. Cosine Similarity Vector Space search
 * 4. BM25 / Lexical Sparse Search
 * 5. NLP-Enhanced Keyword, Keyphrase, Topic & Intent-aligned Retrieval
 * 6. Reciprocal Rank Fusion (RRF: Dense + Lexical + NLP) + Linear Hybrid Combination
 * 7. Diversity Re-ranking (MMR) across document pages
 */

function getAiClient(apiKeyOverride = null) {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Deterministic Semantic Feature Projection (512 dimensions)
 * Used as high-fidelity mathematical fallback when external API quotas are hit.
 */
function generateProjectionVector(text, dimensions = 512) {
  const vec = new Float32Array(dimensions);
  if (!text || typeof text !== "string") return Array.from(vec);

  const clean = text.toLowerCase();
  const words = clean.match(/[a-z0-9]+/g) || [];

  // Character n-grams & token features
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let h1 = 0;
    for (let c = 0; c < w.length; c++) {
      h1 = (h1 << 5) - h1 + w.charCodeAt(c);
      h1 |= 0;
    }
    const idx1 = Math.abs(h1) % dimensions;
    const weight = Math.log(1 + w.length);
    vec[idx1] += weight;

    // Bigram context
    if (i > 0) {
      const bigram = words[i - 1] + "_" + w;
      let h2 = 0;
      for (let c = 0; c < bigram.length; c++) {
        h2 = (h2 << 5) - h2 + bigram.charCodeAt(c);
        h2 |= 0;
      }
      const idx2 = Math.abs(h2) % dimensions;
      vec[idx2] += weight * 1.5;
    }
  }

  // L2 Normalization
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

/**
 * Computes Cosine Similarity between two numerical vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Free-tier embedding quota is 100 requests/minute. Space requests globally (~80/min) so
// bulk uploads don't exhaust it and silently degrade to non-semantic fallback vectors.
const EMBED_MIN_INTERVAL_MS = 750;
const EMBED_MAX_ATTEMPTS = 6;
let nextEmbedSlot = 0;
async function acquireEmbedSlot() {
  const now = Date.now();
  const start = Math.max(now, nextEmbedSlot);
  nextEmbedSlot = start + EMBED_MIN_INTERVAL_MS;
  if (start > now) await new Promise((r) => setTimeout(r, start - now));
}

/**
 * Generate embedding for a single string using Gemini API or fallback
 */
async function generateEmbedding(text, apiKeyOverride = null) {
  if (!text || !text.trim()) {
    return generateProjectionVector("empty", 512);
  }

  const ai = getAiClient(apiKeyOverride);
  if (ai) {
    for (let attempt = 1; attempt <= EMBED_MAX_ATTEMPTS; attempt++) {
      try {
        await acquireEmbedSlot();
        const response = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: text.slice(0, 8000),
        });

        if (response.embeddings && response.embeddings[0]?.values) {
          return response.embeddings[0].values;
        }
        if (response.embedding?.values) {
          return response.embedding.values;
        }
      } catch (err) {
        if (attempt === EMBED_MAX_ATTEMPTS) {
          const brief = String(err.message || err).slice(0, 200);
          console.warn(`[vectorEngine] Embedding API error (${brief}). Using mathematical semantic vector.`);
        } else {
          // Rate-limited (429): wait for the quota window to recover instead of degrading quality.
          const isRateLimit = /429|RESOURCE_EXHAUSTED|quota/i.test(String(err.message || err));
          const hinted = /retry in ([\d.]+)\s*(ms|s)/i.exec(String(err.message || ""));
          let waitMs = isRateLimit ? 4000 * attempt : 600;
          if (hinted) {
            const hintMs = parseFloat(hinted[1]) * (hinted[2].toLowerCase() === "ms" ? 1 : 1000);
            waitMs = Math.max(waitMs, Math.ceil(hintMs) + 500);
          }
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }
  }

  // Fallback to high-dimensional projection
  return generateProjectionVector(text, 512);
}

/**
 * Generate embeddings for an array of chunks with concurrency control
 */
async function generateBatchEmbeddings(texts, apiKeyOverride = null, batchSize = 5) {
  const results = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map((txt) => generateEmbedding(txt, apiKeyOverride));
    const batchVectors = await Promise.all(batchPromises);
    results.push(...batchVectors);
  }
  return results;
}

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "did", "do", "does", "doing", "don", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "s", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
  "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
  "why", "will", "with", "you", "your", "yours", "yourself", "yourselves"
]);

/**
 * Tokenize and stem helper for Sparse / Lexical BM25 matching
 */
function tokenize(str, filterStop = true) {
  const tokens = (str.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 2);
  if (!filterStop) return tokens;
  const filtered = tokens.filter((w) => !STOP_WORDS.has(w));
  return filtered.length > 0 ? filtered : tokens;
}

function getStems(word) {
  const w = word.toLowerCase();
  const stems = new Set([w]);
  if (w.endsWith("ing")) stems.add(w.slice(0, -3));
  if (w.endsWith("ed")) stems.add(w.slice(0, -2));
  if (w.endsWith("es")) stems.add(w.slice(0, -2));
  if (w.endsWith("s")) stems.add(w.slice(0, -1));
  return Array.from(stems);
}

/**
 * Sparse BM25 / Lexical Scoring
 */
function calculateLexicalScore(chunkText, queryTokens, queryStems) {
  const chunkTokens = tokenize(chunkText);
  if (chunkTokens.length === 0) return 0;

  const chunkStems = new Set();
  const tokenFreq = {};

  for (const t of chunkTokens) {
    tokenFreq[t] = (tokenFreq[t] || 0) + 1;
    getStems(t).forEach((s) => chunkStems.add(s));
  }

  let score = 0;
  for (const q of queryTokens) {
    // Exact token match
    if (tokenFreq[q]) {
      score += 2.0 * Math.log(1 + tokenFreq[q]);
    }
  }

  for (const s of queryStems) {
    // Stem match
    if (chunkStems.has(s)) {
      score += 1.0;
    }
  }

  // Phrase boost
  const queryLower = queryTokens.join(" ");
  if (queryLower.length > 5 && chunkText.toLowerCase().includes(queryLower)) {
    score += 5.0;
  }

  return score;
}

/**
 * Main Hybrid RAG Retrieval function
 * Performs:
 * - Query embedding generation
 * - Dense Vector Cosine Similarity Search
 * - Sparse BM25 Lexical Keyword Search
 * - Reciprocal Rank Fusion & Linear Score Weighting
 * - Page-level diversity re-ranking
 */
async function hybridRetrieve({
  documents,
  query,
  topK = 8,
  alpha = 0.65, // Weight for semantic vector search vs lexical
  apiKeyOverride = null,
}) {
  if (!documents || documents.length === 0 || !query || !query.trim()) {
    return [];
  }

  // 1. Gather all chunks across all ready documents
  const allChunks = [];
  for (const doc of documents) {
    const filename = doc.filename || "document.pdf";
    const docId = doc._id || doc.id || filename;

    if (doc.chunks && Array.isArray(doc.chunks) && doc.chunks.length > 0) {
      for (const ch of doc.chunks) {
        allChunks.push({
          documentId: docId,
          filename,
          pageNumber: ch.pageNumber || 1,
          chunkId: ch.chunkId || `${docId}_p${ch.pageNumber || 1}`,
          chunk: ch.text || ch.chunk || "",
          embedding: ch.embedding || null,
        });
      }
    } else {
      // Create fallback chunks from pages or extractedText
      const { chunkDocument } = require("./textChunker");
      const generated = chunkDocument(doc);
      for (const g of generated) {
        allChunks.push({
          documentId: docId,
          filename,
          pageNumber: g.pageNumber || 1,
          chunkId: g.chunkId,
          chunk: g.chunk,
          embedding: null,
        });
      }
    }
  }

  if (allChunks.length === 0) return [];

  // 2. Ensure all chunks have embeddings
  const missingEmbeddings = allChunks.filter((c) => !c.embedding || c.embedding.length === 0);
  if (missingEmbeddings.length > 0) {
    const texts = missingEmbeddings.map((c) => c.chunk);
    const newVectors = await generateBatchEmbeddings(texts, apiKeyOverride, 10);
    missingEmbeddings.forEach((c, idx) => {
      c.embedding = newVectors[idx];
    });
  }

  // 3. Generate query embedding
  const queryEmbedding = await generateEmbedding(query, apiKeyOverride);

  // 4. NLP Query Analysis & Linguistic Signals
  let queryNlp = null;
  try {
    queryNlp = nlpService.analyzeQuery(query);
  } catch (err) {
    console.warn("[vectorEngine] NLP query analysis fallback:", err.message);
  }

  const queryTokens = tokenize(query);
  const queryStems = new Set();
  queryTokens.forEach((t) => getStems(t).forEach((s) => queryStems.add(s)));

  const qKeywords = queryNlp ? queryNlp.keywords : [];
  const qKeyphrases = queryNlp ? queryNlp.keyphrases : [];
  const qTopics = queryNlp ? queryNlp.topics : [];
  const qExpansions = queryNlp ? queryNlp.expandedTerms : [];
  const qIntent = queryNlp ? queryNlp.intent : "explanation";

  const scoredChunks = allChunks.map((item) => {
    // A. Dense Cosine Similarity
    const semanticSim = item.embedding ? cosineSimilarity(queryEmbedding, item.embedding) : 0;
    // Map cosine from [-1, 1] to [0, 1]
    const semanticScore = Math.max(0, Math.min(1, (semanticSim + 1) / 2));

    // B. Sparse Lexical Score (BM25 token + stem match)
    const rawLexical = calculateLexicalScore(item.chunk, queryTokens, queryStems);

    // C. NLP Linguistic Relevance Score
    let rawNlp = 0;
    const chunkLower = (item.chunk || "").toLowerCase();
    const chunkMetadataNlp = item.nlp || item.metadata?.nlp || null;

    // 1. NLP Keyword matching
    if (qKeywords.length > 0) {
      qKeywords.forEach((kw) => {
        if (chunkLower.includes(kw)) {
          rawNlp += 2.0;
        } else if (chunkMetadataNlp && Array.isArray(chunkMetadataNlp.keywords) && chunkMetadataNlp.keywords.includes(kw)) {
          rawNlp += 1.5;
        }
      });
    }

    // 2. Multi-word Keyphrase matching (exact phrase boost)
    if (qKeyphrases.length > 0) {
      qKeyphrases.forEach((kp) => {
        if (chunkLower.includes(kp)) {
          rawNlp += 3.5;
        } else if (chunkMetadataNlp && Array.isArray(chunkMetadataNlp.keyphrases) && chunkMetadataNlp.keyphrases.includes(kp)) {
          rawNlp += 2.5;
        }
      });
    }

    // 3. Topic Alignment match
    if (qTopics.length > 0) {
      qTopics.forEach((tp) => {
        if (chunkLower.includes(tp.toLowerCase())) {
          rawNlp += 2.0;
        }
      });
    }

    // 4. Intent-Driven Concept Pattern Bonus
    if (qIntent === "definition") {
      if (chunkMetadataNlp?.hasDefinition || /(?:is\s+defined\s+as|refers\s+to|means|is\s+a\s+[a-z]+\s+that|definition:)/i.test(item.chunk)) {
        rawNlp += 3.0;
      }
    } else if (qIntent === "comparison") {
      if (chunkMetadataNlp?.hasComparison || /(?:difference\s+between|differs\s+from|in\s+contrast|versus|\bvs\b|whereas)/i.test(item.chunk)) {
        rawNlp += 3.0;
      }
    } else if (qIntent === "procedure") {
      if (chunkMetadataNlp?.hasAlgorithm || chunkMetadataNlp?.hasSteps || /(?:algorithm|steps?\s+\d+|procedure|firstly|secondly)/i.test(item.chunk)) {
        rawNlp += 3.0;
      }
    } else if (qIntent === "advantages_disadvantages") {
      if (/(?:advantages?|disadvantages?|pros|cons|merits?|demerits?|benefits?|limitations?)/i.test(item.chunk)) {
        rawNlp += 3.0;
      }
    } else if (qIntent === "exam_question" || qIntent === "short_answer" || qIntent === "long_answer") {
      if (chunkMetadataNlp?.hasDefinition || chunkMetadataNlp?.hasSteps || /(?:key\s+points?|important|note:|summary)/i.test(item.chunk)) {
        rawNlp += 2.0;
      }
    }

    // 5. Query Expansion terms matching
    if (qExpansions.length > 0) {
      qExpansions.forEach((exp) => {
        if (chunkLower.includes(exp)) {
          rawNlp += 1.0;
        }
      });
    }

    return {
      ...item,
      rawCosine: Number(semanticSim.toFixed(4)),
      semanticScore: Number(semanticScore.toFixed(4)),
      rawLexicalScore: rawLexical,
      rawNlpScore: Number(rawNlp.toFixed(2)),
      nlpIntent: qIntent,
    };
  });

  // Filter out chunks that have zero lexical match, zero NLP match AND low semantic similarity (< 0.60)
  let candidateChunks = scoredChunks.filter(
    (c) => c.rawLexicalScore > 0 || c.rawNlpScore > 0 || c.rawCosine >= 0.60
  );
  if (candidateChunks.length === 0) {
    // Broad/overview questions (e.g. "Summarize this document", "What are the main points?")
    // have no keyword overlap with the sources. Instead of returning nothing (which makes the
    // model claim the sources are empty), fall back to a round-robin sample across documents,
    // ordered by semantic similarity within each document.
    const byDoc = new Map();
    for (const c of [...scoredChunks].sort((a, b) => b.rawCosine - a.rawCosine)) {
      if (!c.chunk || !c.chunk.trim()) continue;
      if (!byDoc.has(c.documentId)) byDoc.set(c.documentId, []);
      byDoc.get(c.documentId).push(c);
    }
    const queues = [...byDoc.values()];
    const fallback = [];
    while (fallback.length < topK && queues.some((q) => q.length > 0)) {
      for (const q of queues) {
        if (q.length > 0 && fallback.length < topK) fallback.push(q.shift());
      }
    }
    if (fallback.length === 0) return [];
    candidateChunks = fallback;
  }

  // Normalize lexical scores to [0, 1]
  const maxLexical = Math.max(1, ...candidateChunks.map((c) => c.rawLexicalScore));
  candidateChunks.forEach((c) => {
    c.lexicalScore = Number((c.rawLexicalScore / maxLexical).toFixed(4));
  });

  // Normalize NLP scores to [0, 1]
  const maxNlp = Math.max(1, ...candidateChunks.map((c) => c.rawNlpScore));
  candidateChunks.forEach((c) => {
    c.nlpScore = Number((c.rawNlpScore / maxNlp).toFixed(4));
  });

  // 5. Compute Hybrid Scores using Linear Combination & 3-Way Reciprocal Rank Fusion (RRF)
  // Dense ranking
  const denseRanked = [...candidateChunks].sort((a, b) => b.semanticScore - a.semanticScore);
  const denseRankMap = new Map();
  denseRanked.forEach((c, idx) => denseRankMap.set(c.chunkId, idx + 1));

  // Lexical ranking
  const lexicalRanked = [...candidateChunks].sort((a, b) => b.lexicalScore - a.lexicalScore);
  const lexicalRankMap = new Map();
  lexicalRanked.forEach((c, idx) => lexicalRankMap.set(c.chunkId, idx + 1));

  // NLP ranking
  const nlpRanked = [...candidateChunks].sort((a, b) => b.nlpScore - a.nlpScore);
  const nlpRankMap = new Map();
  nlpRanked.forEach((c, idx) => nlpRankMap.set(c.chunkId, idx + 1));

  const k_rrf = 60;
  candidateChunks.forEach((c) => {
    const rankDense = denseRankMap.get(c.chunkId) || 999;
    const rankLexical = lexicalRankMap.get(c.chunkId) || 999;
    const rankNlp = nlpRankMap.get(c.chunkId) || 999;

    // 3-Way RRF: Dense + Lexical + NLP
    const rrfScore =
      1.0 / (k_rrf + rankDense) +
      1.0 / (k_rrf + rankLexical) +
      1.0 / (k_rrf + rankNlp);

    // Controlled Linear combination: 50% Semantic, 25% Lexical, 25% NLP
    const linearScore =
      0.50 * c.semanticScore +
      0.25 * c.lexicalScore +
      0.25 * c.nlpScore;

    // Blended Hybrid Metric
    c.hybridScore = Number((0.6 * linearScore + 0.4 * (rrfScore * 30)).toFixed(4));
    c.rrfScore = Number(rrfScore.toFixed(5));
  });

  // Sort by hybrid score
  candidateChunks.sort((a, b) => b.hybridScore - a.hybridScore);

  // 6. Maximal Marginal Relevance / Page Diversity Filter
  // Ensure we don't return 8 chunks from the exact same page unless only 1 page exists
  const selected = [];
  const pageOccurrence = {};

  for (const cand of candidateChunks) {
    const pageKey = `${cand.filename}_p${cand.pageNumber}`;
    const count = pageOccurrence[pageKey] || 0;

    // Allow at most 2 chunks from same page in the top K for diversity
    if (count < 2 || selected.length >= topK - 2) {
      selected.push(cand);
      pageOccurrence[pageKey] = count + 1;
    }

    if (selected.length >= topK) break;
  }

  // If still need items to fill topK
  if (selected.length < topK) {
    for (const cand of candidateChunks) {
      if (!selected.some((s) => s.chunkId === cand.chunkId)) {
        selected.push(cand);
      }
      if (selected.length >= topK) break;
    }
  }

  return selected;
}

module.exports = {
  generateEmbedding,
  generateBatchEmbeddings,
  cosineSimilarity,
  generateProjectionVector,
  hybridRetrieve,
};
