const CHUNK_SIZE = 1400; // characters per chunk
const CHUNK_OVERLAP = 200;

/**
 * Splits text into overlapping chunks respecting sentence/paragraph boundaries.
 */
function chunkText(text) {
  if (!text) return [];
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const boundary = Math.max(lastPeriod, lastNewline);
      if (boundary > start + CHUNK_SIZE * 0.5) {
        end = boundary + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    if (end >= text.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

function tokenize(str) {
  return (str.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 2);
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
 * Chunks a document into page-aware structural chunks.
 * Every chunk contains: documentId, filename, pageNumber, chunkId, chunk text.
 */
function chunkDocument(doc) {
  const chunks = [];
  const filename = doc.filename || "document.pdf";
  const docId = doc._id || doc.id || filename;

  if (doc.pages && Array.isArray(doc.pages) && doc.pages.length > 0) {
    for (const page of doc.pages) {
      const pNum = page.pageNumber || 1;
      const textChunks = chunkText(page.text);
      textChunks.forEach((cText, idx) => {
        chunks.push({
          documentId: docId,
          filename,
          pageNumber: pNum,
          chunkId: `${docId}_p${pNum}_c${idx + 1}`,
          chunk: cText,
        });
      });
    }
  } else {
    // Parse page markers if embedded in text e.g. "--- Page 126 ---"
    const text = doc.extractedText || doc.text || "";
    const pageSplits = text.split(/--- Page (\d+) ---/g);

    if (pageSplits.length > 1) {
      let currentPage = 1;
      for (let i = 1; i < pageSplits.length; i += 2) {
        currentPage = parseInt(pageSplits[i], 10) || currentPage;
        const pageText = pageSplits[i + 1] || "";
        const textChunks = chunkText(pageText);
        textChunks.forEach((cText, idx) => {
          chunks.push({
            documentId: docId,
            filename,
            pageNumber: currentPage,
            chunkId: `${docId}_p${currentPage}_c${idx + 1}`,
            chunk: cText.trim(),
          });
        });
      }
    } else {
      // Default to page 1 chunking
      const textChunks = chunkText(text);
      textChunks.forEach((cText, idx) => {
        chunks.push({
          documentId: docId,
          filename,
          pageNumber: 1,
          chunkId: `${docId}_c${idx + 1}`,
          chunk: cText,
        });
      });
    }
  }

  return chunks;
}

/**
 * Hybrid retrieval with stem/keyword scoring and page-level metadata preservation.
 *
 * @param {Array<Object>} documents
 * @param {string} question
 * @param {number} topK
 * @returns {Array<{documentId: string, filename: string, pageNumber: number, chunkId: string, chunk: string, score: number}>}
 */
function retrieveRelevantChunks(documents, question, topK = 8) {
  const rawQWords = tokenize(question);
  const qStems = new Set();

  for (const qw of rawQWords) {
    getStems(qw).forEach((s) => qStems.add(s));
  }

  const scored = [];

  for (const doc of documents) {
    const chunks = chunkDocument(doc);
    for (const item of chunks) {
      const words = tokenize(item.chunk);
      if (words.length === 0) continue;

      let score = 0;
      const seenStems = new Set();

      for (const w of words) {
        const wordStems = getStems(w);
        for (const stem of wordStems) {
          if (qStems.has(stem) && !seenStems.has(stem)) {
            score += stem.length > 3 ? 3 : 1;
            seenStems.add(stem);
          }
        }
        if (rawQWords.includes(w)) {
          score += 2;
        }
      }

      if (score > 0) {
        scored.push({ ...item, score });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // Fall back to first chunks of each document
    const fallback = [];
    for (const d of documents) {
      const c = chunkDocument(d);
      if (c.length > 0) fallback.push({ ...c[0], score: 0 });
    }
    return fallback;
  }

  return scored.slice(0, topK);
}

module.exports = { chunkText, chunkDocument, retrieveRelevantChunks };
