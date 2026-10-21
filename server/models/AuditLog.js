const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    adminUser: {
      id: { type: String },
      email: { type: String, required: true },
      name: { type: String, default: "Admin" }
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    affectedEntity: {
      type: String,
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
