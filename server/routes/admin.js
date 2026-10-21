const express = require("express");
const store = require("../config/store");
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");
const vectorEngine = require("../utils/vectorEngine");

const router = express.Router();

// Apply auth & admin guards to all admin routes
// Requires valid JWT token and role === 'admin'
router.use(authenticateToken, requireAdmin);

// ─────────────────────────────────────────────────────────────
// 1. STATS & OVERVIEW
// ─────────────────────────────────────────────────────────────
// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const stats = await store.getSystemStats();
    res.json({
      success: true,
      storageMode: store.isMongoMode() ? "MongoDB Database" : "Zero-Config In-Memory Storage",
      ...stats
    });
  } catch (err) {
    console.error("[admin] Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch admin statistics from database." });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. USERS MANAGEMENT
// ─────────────────────────────────────────────────────────────
// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const users = await store.getUsers();
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    console.error("[admin] Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users list." });
  }
});

// GET /api/admin/users/:userId
router.get("/users/:userId", async (req, res) => {
  try {
    const user = await store.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("[admin] Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user details." });
  }
});

// PATCH & PUT /api/admin/users/:userId/role
async function handleUserRoleUpdate(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role must be either 'user' or 'admin'." });
    }

    const result = await store.updateUserRole(userId, role);
    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    await store.createAuditLog({
      adminUser: { id: req.user.id, email: req.user.email, name: req.user.name },
      action: "user_role_changed",
      affectedEntity: `User: ${result.email || userId}`,
      metadata: { userId, newRole: role, updatedBy: req.user.email }
    });

    res.json({ success: true, user: result });
  } catch (err) {
    console.error("[admin] Error updating user role:", err);
    res.status(500).json({ error: "Failed to update user role." });
  }
}
router.patch("/users/:userId/role", handleUserRoleUpdate);
router.put("/users/:userId/role", handleUserRoleUpdate);

// PATCH & PUT /api/admin/users/:userId/status
async function handleUserStatusUpdate(req, res) {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!status || !["active", "disabled"].includes(status)) {
      return res.status(400).json({ error: "Status must be either 'active' or 'disabled'." });
    }

    const result = await store.updateUserStatus(userId, status, req.user.id);
    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    await store.createAuditLog({
      adminUser: { id: req.user.id, email: req.user.email, name: req.user.name },
      action: status === "disabled" ? "user_disabled" : "user_enabled",
      affectedEntity: `User: ${result.email || userId}`,
      metadata: { userId, newStatus: status, updatedBy: req.user.email }
    });

    res.json({ success: true, user: result });
  } catch (err) {
    console.error("[admin] Error updating user status:", err);
    res.status(500).json({ error: "Failed to update user status." });
  }
}
router.patch("/users/:userId/status", handleUserStatusUpdate);
router.put("/users/:userId/status", handleUserStatusUpdate);

// DELETE /api/admin/users/:userId
router.delete("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await store.deleteUser(userId, req.user.id);

    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    await store.createAuditLog({
      adminUser: { id: req.user.id, email: req.user.email, name: req.user.name },
      action: "user_deleted",
      affectedEntity: `User ID: ${userId}`,
      metadata: { userId, deletedBy: req.user.email }
    });

    res.json({ success: true, message: "User and associated data deleted successfully." });
  } catch (err) {
    console.error("[admin] Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user." });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. NOTEBOOK MANAGEMENT
// ─────────────────────────────────────────────────────────────
// GET /api/admin/notebooks
router.get("/notebooks", async (req, res) => {
  try {
    const notebooks = await store.getAllNotebooksAdmin();
    res.json({ success: true, count: notebooks.length, notebooks });
  } catch (err) {
    console.error("[admin] Error fetching notebooks:", err);
    res.status(500).json({ error: "Failed to fetch notebooks list." });
  }
});

// GET /api/admin/notebooks/:notebookId
router.get("/notebooks/:notebookId", async (req, res) => {
  try {
    const notebook = await store.getNotebookDetailsAdmin(req.params.notebookId);
    if (!notebook) {
      return res.status(404).json({ error: "Notebook not found." });
    }
    res.json({ success: true, notebook });
  } catch (err) {
    console.error("[admin] Error fetching notebook details:", err);
    res.status(500).json({ error: "Failed to fetch notebook details." });
  }
});

// DELETE /api/admin/notebooks/:notebookId
router.delete("/notebooks/:notebookId", async (req, res) => {
  try {
    const { notebookId } = req.params;
    const notebook = await store.getNotebookById(notebookId);
    if (!notebook) {
      return res.status(404).json({ error: "Notebook not found." });
    }

    const title = notebook.title || "Untitled notebook";
    const deleted = await store.deleteNotebook(notebookId);
    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete notebook." });
    }

    await store.createAuditLog({
      adminUser: { id: req.user.id, email: req.user.email, name: req.user.name },
      action: "notebook_deleted",
      affectedEntity: `Notebook: "${title}" (${notebookId})`,
      metadata: { notebookId, title, deletedBy: req.user.email }
    });

    res.json({ success: true, message: `Notebook "${title}" deleted successfully.` });
  } catch (err) {
    console.error("[admin] Error deleting notebook:", err);
    res.status(500).json({ error: "Failed to delete notebook." });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. DOCUMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────
// GET /api/admin/documents
router.get("/documents", async (req, res) => {
  try {
    const documents = await store.getAllDocumentsAdmin();
    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    console.error("[admin] Error fetching documents:", err);
    res.status(500).json({ error: "Failed to fetch document list." });
  }
});

// GET /api/admin/documents/:documentId
router.get("/documents/:documentId", async (req, res) => {
  try {
    const doc = await store.getDocumentDetailsAdmin(req.params.documentId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error("[admin] Error fetching document details:", err);
    res.status(500).json({ error: "Failed to fetch document details." });
  }
});

// DELETE /api/admin/documents/:documentId
router.delete("/documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await store.getDocumentDetailsAdmin(documentId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }

    const filename = doc.filename;
    const deleted = await store.deleteDocument(documentId);
    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete document." });
    }

    await store.createAuditLog({
      adminUser: { id: req.user.id, email: req.user.email, name: req.user.name },
      action: "document_deleted",
      affectedEntity: `Document: "${filename}" (${documentId})`,
      metadata: { documentId, filename, notebookId: doc.notebookId, deletedBy: req.user.email }
    });

    res.json({ success: true, message: `Document "${filename}" deleted successfully.` });
  } catch (err) {
    console.error("[admin] Error deleting document:", err);
    res.status(500).json({ error: "Failed to delete document." });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. AI / RAG MONITORING & DIAGNOSTICS
// ─────────────────────────────────────────────────────────────
// GET /api/admin/rag
router.get("/rag", async (req, res) => {
  try {
    const ragData = await store.getRagMetrics();
    res.json({
      success: true,
      ...ragData
    });
  } catch (err) {
    console.error("[admin] Error fetching RAG info:", err);
    res.status(500).json({ error: "Failed to fetch RAG configuration." });
  }
});

// POST /api/admin/rag/test
// Diagnostic semantic & hybrid retrieval test endpoint
router.post("/rag/test", async (req, res) => {
  try {
    const { query, notebookId, topK = 5 } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "A query string is required for diagnostic retrieval." });
    }

    let documents = [];
    if (notebookId) {
      documents = await store.getDocuments(notebookId);
    } else {
      documents = await store.getAllDocuments();
    }

    const readyDocs = documents.filter(d => d.status === "ready" && d.chunks && d.chunks.length > 0);
    if (readyDocs.length === 0) {
      return res.json({
        success: true,
        query,
        message: "No ready documents with indexed chunks found to search across.",
        results: []
      });
    }

    const t0 = Date.now();
    const retrieved = await vectorEngine.hybridRetrieve(query, readyDocs, {
      topK: Math.min(Number(topK) || 5, 20),
      semanticWeight: 0.65,
      lexicalWeight: 0.35,
      rrfConstant: 60
    });
    const latencyMs = Date.now() - t0;

    res.json({
      success: true,
      query,
      latencyMs,
      totalDocumentsSearched: readyDocs.length,
      retrievedCount: retrieved.length,
      results: retrieved.map(r => ({
        chunkId: r.chunkId,
        filename: r.filename,
        pageNumber: r.pageNumber,
        semanticScore: Math.round((r.semanticScore || 0) * 10000) / 10000,
        lexicalScore: Math.round((r.lexicalScore || 0) * 10000) / 10000,
        rrfScore: Math.round((r.rrfScore || 0) * 100000) / 100000,
        hybridScore: Math.round((r.hybridScore || 0) * 10000) / 10000,
        textSnippet: (r.chunk || "").slice(0, 250) + ((r.chunk || "").length > 250 ? "..." : "")
      }))
    });
  } catch (err) {
    console.error("[admin] RAG diagnostic test error:", err);
    res.status(500).json({ error: "RAG diagnostic retrieval test failed: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. SYSTEM HEALTH
// ─────────────────────────────────────────────────────────────
// GET /api/admin/health
router.get("/health", async (req, res) => {
  try {
    const health = await store.getSystemHealth();
    res.json({ success: true, ...health });
  } catch (err) {
    console.error("[admin] Error fetching system health:", err);
    res.status(500).json({ error: "Failed to fetch system health status." });
  }
});

// ─────────────────────────────────────────────────────────────
// 7. ANALYTICS
// ─────────────────────────────────────────────────────────────
// GET /api/admin/analytics
router.get("/analytics", async (req, res) => {
  try {
    const analytics = await store.getAdminAnalytics();
    res.json({ success: true, ...analytics });
  } catch (err) {
    console.error("[admin] Error fetching analytics:", err);
    res.status(500).json({ error: "Failed to fetch analytics." });
  }
});

// ─────────────────────────────────────────────────────────────
// 8. AUDIT LOGS
// ─────────────────────────────────────────────────────────────
// GET /api/admin/audit-logs
router.get("/audit-logs", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const logs = await store.getAuditLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    console.error("[admin] Error fetching audit logs:", err);
    res.status(500).json({ error: "Failed to fetch audit logs." });
  }
});

module.exports = router;
