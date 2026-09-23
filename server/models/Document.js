const mongoose = require("mongoose");

const ChunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true },
  pageNumber: { type: Number, default: 1 },
  chunkIndex: { type: Number, default: 0 },
  text: { type: String, required: true },
  charCount: { type: Number, default: 0 },
  embedding: { type: [Number], default: [] },
  metadata: { type: Object, default: {} },
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
    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);
