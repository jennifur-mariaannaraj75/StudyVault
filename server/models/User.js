const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, default: null },
  googleId: { type: String, default: null },
  avatar: { type: String, default: "" },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  status: { type: String, enum: ["active", "disabled"], default: "active" },
  plan: { type: String, enum: ["free", "plus", "pro"], default: "free" },
  planUpdatedAt: { type: Date, default: Date.now },
  usage: {
    dateKey: { type: String, default: "" },
    chatQueriesToday: { type: Number, default: 0 },
    studioGenerationsToday: { type: Number, default: 0 },
    totalChatQueries: { type: Number, default: 0 },
    totalStudioGenerations: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now }
  },
  customQuota: {
    maxNotebooks: { type: Number, default: null },
    maxDocsPerNotebook: { type: Number, default: null },
    maxDailyChatQueries: { type: Number, default: null },
    maxDailyStudioGenerations: { type: Number, default: null }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
