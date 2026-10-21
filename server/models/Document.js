const mongoose = require("mongoose");

const ChunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true },
  pageNumber: { type: Number, default: 1 },
  chunkIndex: { type: Number, default: 0 },
  text: { type: String, required: true },
  charCount: { type: Number, default: 0 },
  embedding: { type: [Number], default: [] },
  metadata: { type: Object, default: {} },
  nlp: {
    keywords: { type: [String], default: [] },
    keyphrases: { type: [String], default: [] },
    entities: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    hasDefinition: { type: Boolean, default: false },
    hasComparison: { type: Boolean, default: false },
    hasAlgorithm: { type: Boolean, default: false },
    hasSteps: { type: Boolean, default: false },
  },
});

const DocumentSchema = new mongoose.Schema(
  {
    notebookId: { type: mongoose.Schema.Types.ObjectId, ref: "Notebook", required: true, index: true },
    filename: { type: String, required: true },
    pageCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    extractedText: { type: String, default: "" }, // full raw text pulled from the PDF
    pages: { type: [Object], default: [] },
    chunks: { type: [ChunkSchema], default: [] },
    summary: { type: String, default: "" },
    keyTopics: { type: [String], default: [] },
    suggestedQuestions: { type: [String], default: [] },
    storagePath: { type: String, default: "" },
    hasPdfFile: { type: Boolean, default: false },
    mimeType: { type: String, default: "application/pdf" },
    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
    nlp: {
      keywords: { type: [String], default: [] },
      keyphrases: { type: [String], default: [] },
      entities: { type: Object, default: {} },
      topics: { type: [String], default: [] },
      academicConcepts: { type: Object, default: {} },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);
