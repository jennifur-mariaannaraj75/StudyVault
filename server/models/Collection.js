const mongoose = require("mongoose");

const CollectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: "New Collection" },
    description: { type: String, default: "" },
    icon: { type: String, default: "📁" },
    color: { type: String, default: "#c58af9" },
    userId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
    notebookIds: [{ type: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Collection", CollectionSchema);
