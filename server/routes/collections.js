const express = require("express");
const store = require("../config/store");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

// GET /api/collections - list collections for user
router.get("/", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const role = req.user ? req.user.role : "user";
    const collections = await store.getCollections(userId, role);

    const collectionsWithCounts = await Promise.all(
      collections.map(async (col) => {
        const cObj = typeof col.toObject === "function" ? col.toObject() : { ...col };
        const nbIds = cObj.notebookIds || [];
        cObj.notebookCount = nbIds.length;
        
        // Fetch preview titles of first few notebooks
        const previewNotebooks = await Promise.all(
          nbIds.slice(0, 4).map(async (id) => {
            const nb = await store.getNotebookById(id);
            return nb ? { _id: nb._id, title: nb.title, icon: nb.icon || "📓", color: nb.color } : null;
          })
        );
        cObj.previewNotebooks = previewNotebooks.filter(Boolean);
        return cObj;
      })
    );

    res.json(collectionsWithCounts);
  } catch (err) {
    console.error("[collections] GET / error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collections - create a new collection
router.post("/", async (req, res) => {
  try {
    const { name, description, icon, color, notebookIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Collection name is required" });
    }
    const userId = req.user ? req.user.id : null;
    const collection = await store.createCollection({
      name: name.trim(),
      description: description || "",
      icon: icon || "📁",
      color: color || "#c58af9",
      userId,
      notebookIds: Array.isArray(notebookIds) ? notebookIds : []
    });
    res.status(201).json(collection);
  } catch (err) {
    console.error("[collections] POST / error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collections/:id - get collection with full notebook details
router.get("/:id", async (req, res) => {
  try {
    const collection = await store.getCollectionById(req.params.id);
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const cObj = typeof collection.toObject === "function" ? collection.toObject() : { ...collection };
    const nbIds = cObj.notebookIds || [];

    // Populate full notebook details
    const notebooks = await Promise.all(
      nbIds.map(async (id) => {
        const nb = await store.getNotebookById(id);
        if (!nb) return null;
        const nbObj = typeof nb.toObject === "function" ? nb.toObject() : { ...nb };
        const docs = await store.getDocuments(nb._id);
        nbObj.documentCount = docs ? docs.length : 0;
        return nbObj;
      })
    );

    cObj.notebooks = notebooks.filter(Boolean);
    cObj.notebookCount = cObj.notebooks.length;
    res.json(cObj);
  } catch (err) {
    console.error("[collections] GET /:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/collections/:id - update a collection
router.put("/:id", async (req, res) => {
  try {
    const { name, description, icon, color, notebookIds } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (notebookIds !== undefined && Array.isArray(notebookIds)) updates.notebookIds = notebookIds;

    const collection = await store.updateCollection(req.params.id, updates);
    if (!collection) return res.status(404).json({ error: "Collection not found" });
    res.json(collection);
  } catch (err) {
    console.error("[collections] PUT /:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/collections/:id - delete collection without deleting notebooks
router.delete("/:id", async (req, res) => {
  try {
    const success = await store.deleteCollection(req.params.id);
    if (!success) return res.status(404).json({ error: "Collection not found" });
    res.json({ success: true, message: "Collection deleted (notebooks preserved)" });
  } catch (err) {
    console.error("[collections] DELETE /:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collections/:id/notebooks - add notebook to collection
router.post("/:id/notebooks", async (req, res) => {
  try {
    const { notebookId } = req.body;
    if (!notebookId) return res.status(400).json({ error: "notebookId is required" });

    const collection = await store.addNotebookToCollection(req.params.id, notebookId);
    if (!collection) return res.status(404).json({ error: "Collection not found" });
    res.json(collection);
  } catch (err) {
    console.error("[collections] POST /:id/notebooks error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/collections/:id/notebooks/:notebookId - remove notebook from collection
router.delete("/:id/notebooks/:notebookId", async (req, res) => {
  try {
    const collection = await store.removeNotebookFromCollection(req.params.id, req.params.notebookId);
    if (!collection) return res.status(404).json({ error: "Collection not found" });
    res.json(collection);
  } catch (err) {
    console.error("[collections] DELETE /:id/notebooks/:notebookId error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
