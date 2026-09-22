const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    notebookId: { type: mongoose.Schema.Types.ObjectId, ref: "Notebook", required: true, index: true },
    filename: { type: String, required: true },
    pageCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    extractedText: { type: String, default: "" }, // full raw text pulled from the PDF, filled in after processing
    summary: { type: String, default: "" },
    keyTopics: { type: [String], default: [] },
    suggestedQuestions: { type: [String], default: [] },
    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);
