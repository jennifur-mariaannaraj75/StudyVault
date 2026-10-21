const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema(
  {
    notebookId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    title: { type: String, default: "Untitled Note" },
    content: { type: String, default: "" },
    tag: { type: String, default: "General" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Note", NoteSchema);
