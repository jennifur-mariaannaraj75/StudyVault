const mongoose = require("mongoose");

const generatedImageSchema = new mongoose.Schema(
  {
    notebookId: {
      type: String,
      required: true,
      index: true,
    },
    notebookTitle: {
      type: String,
      default: "",
    },
    imageName: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      default: "",
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    thumbUrl: {
      type: String,
      default: "",
    },
    sourceName: {
      type: String,
      default: "External Web",
    },
    externalSourceUrl: {
      type: String,
      default: "",
    },
    googleImagesUrl: {
      type: String,
      default: "",
    },
    style: {
      type: String,
      default: "diagram",
    },
    summary: {
      type: String,
      default: "",
    },
    kind: {
      type: String,
      enum: [
        "wikipedia_diagram",
        "wikimedia_commons",
        "openverse_web",
        "external_ai_generated",
        "ai_synthesized_visual",
      ],
      default: "wikipedia_diagram",
    },
  },
  {
    timestamps: true,
    collection: "generated_images",
  }
);

module.exports = mongoose.model("GeneratedImage", generatedImageSchema);
