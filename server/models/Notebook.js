const mongoose = require("mongoose");

const NotebookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, default: "Untitled notebook" },
    description: { type: String, default: "" },
    icon: { type: String, default: "📓" },
    color: { type: String, default: "#8ab4f8" },
    userId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notebook", NotebookSchema);
