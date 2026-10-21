const mongoose = require("mongoose");

const ArtifactSchema = new mongoose.Schema(
  {
    notebookId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    type: { type: String, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Artifact", ArtifactSchema);
