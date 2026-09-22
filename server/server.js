require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const store = require("./config/store");

const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const notebooksRouter = require("./routes/notebooks");
const documentsRouter = require("./routes/documents");
const chatRouter = require("./routes/chat");
const studioRouter = require("./routes/studio");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notebooks", notebooksRouter);
app.use("/api/notebooks/:notebookId/documents", documentsRouter);
app.use("/api/notebooks/:notebookId/chat", chatRouter);
app.use("/api/notebooks/:notebookId/studio", studioRouter);

// Serve static frontend
app.use(express.static(path.join(__dirname, "..", "public")));
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

store.connectDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`🚀 StudyVault running at http://0.0.0.0:${PORT}`);
    console.log(`   Storage Mode: ${store.isMongoMode() ? "MongoDB Connected" : "Zero-Config In-Memory Storage"}`);
    console.log(`   Default Admin: admin@studyassistant.com (Pass: AdminPass123!)`);
    console.log(`======================================================\n`);
  });
});
