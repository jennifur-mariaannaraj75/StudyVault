const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    notebookId: { type: mongoose.Schema.Types.ObjectId, ref: "Notebook", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [String], default: [] }, // filenames the answer drew from
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
