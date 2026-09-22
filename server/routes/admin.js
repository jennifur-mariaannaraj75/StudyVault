const express = require("express");
const store = require("../config/store");
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Apply auth & admin guards to all admin routes
router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const stats = await store.getSystemStats();
    res.json({
      success: true,
      storageMode: store.isMongoMode() ? "MongoDB Database" : "Zero-Config In-Memory Database",
      ...stats
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin stats." });
  }
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const users = await store.getUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users list." });
  }
});

// PUT /api/admin/users/:userId/role
router.put("/users/:userId/role", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role must be either 'user' or 'admin'." });
    }

    const updated = await store.updateUserRole(userId, role);
    if (!updated) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user role." });
  }
});

// DELETE /api/admin/users/:userId
router.delete("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own admin account while logged in." });
    }

    const deleted = await store.deleteUser(userId);
    if (!deleted) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ success: true, message: "User deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user." });
  }
});

// GET /api/admin/documents
router.get("/documents", async (req, res) => {
  try {
    const documents = await store.getAllDocuments();
    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch document list." });
  }
});

module.exports = router;
