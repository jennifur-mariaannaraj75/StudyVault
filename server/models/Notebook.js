const mongoose = require("mongoose");

const NotebookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, default: "Untitled notebook" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notebook", NotebookSchema);
