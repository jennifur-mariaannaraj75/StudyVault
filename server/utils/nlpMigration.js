const store = require("../config/store");
const nlpService = require("../services/nlpService");

/**
 * Safe Background Migration Utility for StudyVault NLP Layer
 * Enriches existing legacy documents and chunks with NLP metadata without disrupting database records.
 */
async function migrateExistingDocuments() {
  console.log("[nlpMigration] Checking for legacy documents needing NLP enrichment...");
  try {
    const allDocs = await store.getAllDocuments();
    if (!allDocs || allDocs.length === 0) {
      console.log("[nlpMigration] No documents found to migrate.");
      return { migratedCount: 0 };
    }

    let count = 0;
    for (const doc of allDocs) {
      // Check if already enriched with full NLP metadata
      if (doc.nlp && doc.nlp.keywords && doc.nlp.keywords.length > 0) {
        continue;
      }

      if (!doc.extractedText || doc.extractedText.length < 20) {
        continue;
      }

      console.log(`[nlpMigration] Enriching document ${doc._id} (${doc.filename})...`);
      const docNlp = nlpService.analyzeText(doc.extractedText);

      // Also enrich chunks if missing NLP
      const updatedChunks = (doc.chunks || []).map((ch) => {
        if (ch.nlp && ch.nlp.keywords && ch.nlp.keywords.length > 0) {
          return ch;
        }
        const chunkNlp = nlpService.analyzeChunk(ch.text || ch.chunk || "");
        return {
          ...ch,
          nlp: chunkNlp,
          metadata: {
            ...(ch.metadata || {}),
            nlp: chunkNlp,
          },
        };
      });

      const mergedTopics = Array.from(
        new Set([
          ...(doc.keyTopics || []),
          ...(docNlp.topics || []),
        ])
      );

      await store.updateDocument(doc._id, {
        nlp: docNlp,
        chunks: updatedChunks,
        keyTopics: mergedTopics,
      });

      count++;
    }

    console.log(`[nlpMigration] Successfully enriched ${count} document(s) with NLP metadata.`);
    return { migratedCount: count };
  } catch (err) {
    console.error("[nlpMigration] Migration error:", err.message);
    return { error: err.message };
  }
}

if (require.main === module) {
  store.connectDB().then(async () => {
    await migrateExistingDocuments();
    process.exit(0);
  });
}

module.exports = { migrateExistingDocuments };
