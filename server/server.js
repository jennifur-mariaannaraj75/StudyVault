require("dotenv").config({ override: true });
const path = require("path");
const express = require("express");
const cors = require("cors");
const store = require("./config/store");

const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const notebooksRouter = require("./routes/notebooks");
const collectionsRouter = require("./routes/collections");
const documentsRouter = require("./routes/documents");
const chatRouter = require("./routes/chat");
const studioRouter = require("./routes/studio");
const systemRouter = require("./routes/system");
const nlpRouter = require("./routes/nlp");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// API routes
app.use("/api/nlp", nlpRouter);
app.use("/api/system", systemRouter);
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    dbConnected: true,
    dbMode: store.isMongoMode() ? "mongodb" : "local_json",
    label: store.isMongoMode() ? "MongoDB Connected" : "Local DB Connected",
    details: store.isMongoMode() ? (process.env.MONGO_URI || "mongodb://127.0.0.1:27017").replace(/:([^:@]+)@/, ":****@") : "server/data/local_db.json"
  });
});
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notebooks", notebooksRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/notebooks/:notebookId/documents", documentsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/notebooks/:notebookId/chat", chatRouter);
app.use("/api/notebooks/:notebookId/studio", studioRouter);

// Serve vendor assets (KaTeX)
app.use("/vendor/katex", express.static(path.join(__dirname, "..", "node_modules", "katex", "dist")));

// Serve static frontend
app.use(express.static(path.join(__dirname, "..", "public")));

// Dedicated route for Admin Dashboard
app.get(["/admin", "/admin/*"], (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Database and basic error handler
app.use((err, req, res, next) => {
  if (err.name === "MongooseError" || err.name === "MongoNetworkError" || (err.message && err.message.includes("buffering timed out"))) {
    console.warn("[AI Studio] Database offline — returning fallback response");
    if (req.method === "GET") {
      return res.json(req.path.endsWith("s") || req.path.endsWith("s/") ? [] : {});
    }
    return res.status(503).json({ error: "Service temporarily unavailable (database offline)" });
  }
  console.error("[server] Unhandled error:", err);
  res.status(400).json({ error: err.message || "Something went wrong" });
});

const PORT = 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🚀 StudyVault running at http://0.0.0.0:${PORT}`);
  console.log(`======================================================\n`);
});

store.connectDB().then(() => {
  console.log(`   Storage Mode: ${store.isMongoMode() ? "MongoDB Connected" : "Zero-Config In-Memory Storage"}`);
  console.log(`   Default Admin: admin@studyassistant.com (Pass: AdminPass123!)`);

  const { migrateExistingDocuments } = require("./utils/nlpMigration");
  migrateExistingDocuments().catch((e) => console.warn("[server] NLP migration non-fatal warning:", e.message));

  documentsRouter.resumeInterruptedDocuments().catch((e) => console.warn("[server] Resume interrupted docs warning:", e.message));
}).catch((err) => {
  console.error("[server] Database connection error:", err.message);
});
