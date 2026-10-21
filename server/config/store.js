const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Notebook = require("../models/Notebook");
const Document = require("../models/Document");
const Message = require("../models/Message");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Artifact = require("../models/Artifact");
const Note = require("../models/Note");
const Collection = require("../models/Collection");

const DATA_FILE = path.join(__dirname, "..", "data", "local_db.json");

let isMongo = false;
let memoryDb = {
  users: [],
  notebooks: [],
  collections: [],
  documents: [],
  messages: [],
  notes: [],
  artifacts: [],
  auditLogs: []
};

// Ensure data folder exists for local persistence in in-memory mode
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadLocalFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      memoryDb = JSON.parse(raw);
      if (!memoryDb.users) memoryDb.users = [];
      if (!memoryDb.notebooks) memoryDb.notebooks = [];
      if (!memoryDb.collections) memoryDb.collections = [];
      if (!memoryDb.documents) memoryDb.documents = [];
      if (!memoryDb.messages) memoryDb.messages = [];
      if (!memoryDb.notes) memoryDb.notes = [];
      if (!memoryDb.artifacts) memoryDb.artifacts = [];
      if (!memoryDb.auditLogs) memoryDb.auditLogs = [];
      console.log(`[store] Loaded local storage with ${memoryDb.notebooks.length} notebooks and ${memoryDb.users.length} users.`);
    }
  } catch (err) {
    console.error("[store] Error reading local db file:", err.message);
  }
}

function saveLocalFile() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
  } catch (err) {
    console.error("[store] Error saving local db file:", err.message);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

async function ensureDefaultAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@studyassistant.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass123!";

  try {
    if (isMongo) {
      const existing = await User.findOne({ email: adminEmail });
      if (!existing) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await User.create({
          name: "System Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          status: "active",
          avatar: "🛡️"
        });
        console.log(`[auth] Auto-created Default Admin Account: ${adminEmail}`);
      } else {
        if (existing.role !== "admin" || existing.status !== "active") {
          existing.role = "admin";
          existing.status = "active";
          await existing.save();
        }
      }
    } else {
      let existing = memoryDb.users.find(u => u.email === adminEmail);
      if (!existing) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const adminUser = {
          _id: generateId(),
          name: "System Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          status: "active",
          avatar: "🛡️",
          createdAt: new Date().toISOString()
        };
        memoryDb.users.unshift(adminUser);
        saveLocalFile();
        console.log(`[auth] Auto-created Default Admin Account (Local DB): ${adminEmail}`);
      } else {
        existing.role = "admin";
        existing.status = existing.status || "active";
        saveLocalFile();
      }
    }
  } catch (err) {
    console.error("[auth] Error seeding default admin:", err.message);
  }
}

function resolveMongoUri() {
  let uri = process.env.MONGO_URI;
  try {
    const rootDir = path.join(__dirname, "..", "..");
    const candidateFiles = [".env", ".env.local", ".env.example"];
    for (const f of candidateFiles) {
      const envPath = path.join(rootDir, f);
      if (fs.existsSync(envPath)) {
        const dotenv = require("dotenv");
        const parsed = dotenv.parse(fs.readFileSync(envPath));
        if (parsed.MONGO_URI && (parsed.MONGO_URI.startsWith("mongodb+srv://") || !uri || uri.includes("127.0.0.1"))) {
          uri = parsed.MONGO_URI;
          process.env.MONGO_URI = uri;
          break;
        }
      }
    }
  } catch (_) {}
  return uri;
}

async function connectDB() {
  const uri = resolveMongoUri();
  if (!uri) {
    isMongo = false;
    console.log("[db] No MONGO_URI provided in environment.");
    console.log("[db] Running in Zero-Config Persistent Local Storage mode (persisted to server/data/local_db.json).");
    loadLocalFile();
    await ensureDefaultAdmin();
    return;
  }

  const maskedUri = uri.replace(/:([^:@]+)@/, ":****@");
  try {
    mongoose.set("strictQuery", false);
    mongoose.set("bufferCommands", false);
    console.log(`[db] Connecting to MongoDB: ${maskedUri}...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isMongo = true;
    console.log("[db] ✅ MongoDB connected successfully!");
  } catch (err) {
    isMongo = false;
    console.log(`[db] MongoDB connection unavailable (${err.message}).`);
    console.log("[db] Operating in Zero-Config Persistent Local Storage mode (server/data/local_db.json).");
    loadLocalFile();
  }
  await ensureDefaultAdmin();
}

const store = {
  connectDB,
  isMongoMode: () => isMongo,

  // --- Audit Logs ---
  async createAuditLog({ adminUser, action, affectedEntity, metadata = {} }) {
    const safeAdmin = {
      id: adminUser?.id || adminUser?._id || "system",
      email: adminUser?.email || "system@studyvault.local",
      name: adminUser?.name || "System"
    };
    const now = new Date();
    if (isMongo) {
      try {
        return await AuditLog.create({
          timestamp: now,
          adminUser: safeAdmin,
          action,
          affectedEntity,
          metadata
        });
      } catch (err) {
        console.error("[audit] Mongo AuditLog write failed:", err.message);
      }
    }

    if (!memoryDb.auditLogs) memoryDb.auditLogs = [];
    const logItem = {
      _id: generateId(),
      timestamp: now.toISOString(),
      adminUser: safeAdmin,
      action,
      affectedEntity,
      metadata
    };
    memoryDb.auditLogs.unshift(logItem);
    if (memoryDb.auditLogs.length > 500) {
      memoryDb.auditLogs = memoryDb.auditLogs.slice(0, 500);
    }
    saveLocalFile();
    return logItem;
  },

  async getAuditLogs(limit = 100) {
    if (isMongo) {
      try {
        return await AuditLog.find().sort({ timestamp: -1 }).limit(Number(limit) || 100);
      } catch (err) {
        console.warn("[audit] Fetching Mongo audit logs failed:", err.message);
      }
    }
    if (!memoryDb.auditLogs) memoryDb.auditLogs = [];
    return memoryDb.auditLogs.slice(0, Number(limit) || 100);
  },

  // --- Users & Auth ---
  async getUsers() {
    if (isMongo) {
      const [users, notebooks, documents] = await Promise.all([
        User.find().select("-password").sort({ createdAt: -1 }).lean(),
        Notebook.find().select("userId").lean(),
        Document.find().select("notebookId").lean()
      ]);

      const nbMap = {};
      const userNbs = {};
      notebooks.forEach(n => {
        const uid = n.userId ? String(n.userId) : null;
        if (uid) {
          nbMap[uid] = (nbMap[uid] || 0) + 1;
          if (!userNbs[uid]) userNbs[uid] = new Set();
          userNbs[uid].add(String(n._id));
        }
      });

      const userDocs = {};
      documents.forEach(d => {
        const nid = d.notebookId ? String(d.notebookId) : null;
        if (nid) {
          for (const [uid, nSet] of Object.entries(userNbs)) {
            if (nSet.has(nid)) {
              userDocs[uid] = (userDocs[uid] || 0) + 1;
            }
          }
        }
      });

      return users.map(u => ({
        ...u,
        status: u.status || "active",
        notebookCount: nbMap[String(u._id)] || 0,
        documentCount: userDocs[String(u._id)] || 0
      }));
    }

    const nbMap = {};
    const userNbs = {};
    (memoryDb.notebooks || []).forEach(n => {
      const uid = n.userId ? String(n.userId) : null;
      if (uid) {
        nbMap[uid] = (nbMap[uid] || 0) + 1;
        if (!userNbs[uid]) userNbs[uid] = new Set();
        userNbs[uid].add(String(n._id));
      }
    });

    const userDocs = {};
    (memoryDb.documents || []).forEach(d => {
      const nid = d.notebookId ? String(d.notebookId) : null;
      if (nid) {
        for (const [uid, nSet] of Object.entries(userNbs)) {
          if (nSet.has(nid)) {
            userDocs[uid] = (userDocs[uid] || 0) + 1;
          }
        }
      }
    });

    return memoryDb.users.map(({ password, ...u }) => ({
      ...u,
      status: u.status || "active",
      notebookCount: nbMap[String(u._id)] || 0,
      documentCount: userDocs[String(u._id)] || 0
    }));
  },

  async getUserByEmail(email) {
    const cleanEmail = (email || "").toLowerCase().trim();
    if (isMongo) return await User.findOne({ email: cleanEmail });
    return memoryDb.users.find(u => u.email === cleanEmail) || null;
  },

  async getUserById(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const user = await User.findById(id).select("-password").lean();
      if (!user) return null;
      const notebooks = await Notebook.find({ userId: id }).select("title createdAt updatedAt").lean();
      return {
        ...user,
        status: user.status || "active",
        notebooks,
        notebookCount: notebooks.length
      };
    }
    const u = memoryDb.users.find(user => user._id === id);
    if (!u) return null;
    const { password, ...userWithoutPass } = u;
    const notebooks = (memoryDb.notebooks || []).filter(n => n.userId === id);
    return {
      ...userWithoutPass,
      status: userWithoutPass.status || "active",
      notebooks,
      notebookCount: notebooks.length
    };
  },

  async createUser(userData) {
    const cleanEmail = (userData.email || "").toLowerCase().trim();
    let hashedPassword = null;
    if (userData.password) {
      hashedPassword = await bcrypt.hash(userData.password, 10);
    }

    if (isMongo) {
      const newUser = await User.create({
        name: userData.name || "Student",
        email: cleanEmail,
        password: hashedPassword,
        googleId: userData.googleId || null,
        avatar: userData.avatar || "",
        role: userData.role || "user",
        status: userData.status || "active"
      });
      return newUser;
    }

    const now = new Date().toISOString();
    const newUser = {
      _id: generateId(),
      name: userData.name || "Student",
      email: cleanEmail,
      password: hashedPassword,
      googleId: userData.googleId || null,
      avatar: userData.avatar || "",
      role: userData.role || "user",
      status: userData.status || "active",
      createdAt: now
    };
    memoryDb.users.unshift(newUser);
    saveLocalFile();
    return newUser;
  },

  async updateUserRole(userId, newRole) {
    if (!["user", "admin"].includes(newRole)) {
      return { error: "Invalid role specified." };
    }

    if (newRole === "user") {
      // Prevent demoting the last active admin
      if (isMongo) {
        const totalAdmins = await User.countDocuments({ role: "admin", status: { $ne: "disabled" } });
        const target = await User.findById(userId);
        if (target && target.role === "admin" && totalAdmins <= 1) {
          return { error: "Cannot demote the last remaining active administrator." };
        }
      } else {
        const totalAdmins = memoryDb.users.filter(u => u.role === "admin" && u.status !== "disabled").length;
        const target = memoryDb.users.find(u => u._id === userId);
        if (target && target.role === "admin" && totalAdmins <= 1) {
          return { error: "Cannot demote the last remaining active administrator." };
        }
      }
    }

    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const updated = await User.findByIdAndUpdate(userId, { $set: { role: newRole } }, { new: true }).select("-password");
      return updated;
    }

    const user = memoryDb.users.find(u => u._id === userId);
    if (!user) return null;
    user.role = newRole;
    saveLocalFile();
    const { password, ...updatedUser } = user;
    return updatedUser;
  },

  async updateUserStatus(userId, newStatus, currentAdminId = null) {
    if (!["active", "disabled"].includes(newStatus)) {
      return { error: "Invalid status specified." };
    }

    if (newStatus === "disabled") {
      if (currentAdminId && String(userId) === String(currentAdminId)) {
        return { error: "You cannot disable your own administrator account." };
      }

      if (isMongo) {
        const target = await User.findById(userId);
        if (target && target.role === "admin") {
          const activeAdmins = await User.countDocuments({ role: "admin", status: "active" });
          if (activeAdmins <= 1) {
            return { error: "Cannot disable the last remaining active administrator." };
          }
        }
      } else {
        const target = memoryDb.users.find(u => u._id === userId);
        if (target && target.role === "admin") {
          const activeAdmins = memoryDb.users.filter(u => u.role === "admin" && u.status === "active").length;
          if (activeAdmins <= 1) {
            return { error: "Cannot disable the last remaining active administrator." };
          }
        }
      }
    }

    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const updated = await User.findByIdAndUpdate(userId, { $set: { status: newStatus } }, { new: true }).select("-password");
      return updated;
    }

    const user = memoryDb.users.find(u => u._id === userId);
    if (!user) return null;
    user.status = newStatus;
    saveLocalFile();
    const { password, ...updatedUser } = user;
    return updatedUser;
  },

  async deleteUser(userId, currentAdminId = null) {
    if (currentAdminId && String(userId) === String(currentAdminId)) {
      return { error: "You cannot delete your own administrator account while logged in." };
    }

    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const target = await User.findById(userId);
      if (!target) return null;

      if (target.role === "admin") {
        const totalAdmins = await User.countDocuments({ role: "admin" });
        if (totalAdmins <= 1) {
          return { error: "Cannot delete the last remaining administrator account." };
        }
      }

      // Safe cascade: delete user's notebooks and related documents/messages/notes/artifacts
      const notebooks = await Notebook.find({ userId });
      const nbIds = notebooks.map(n => n._id);

      await Document.deleteMany({ notebookId: { $in: nbIds } });
      await Message.deleteMany({ notebookId: { $in: nbIds } });
      await Note.deleteMany({ notebookId: { $in: nbIds } });
      await Artifact.deleteMany({ notebookId: { $in: nbIds } });
      await Notebook.deleteMany({ userId });
      await User.findByIdAndDelete(userId);
      return { success: true };
    }

    const target = memoryDb.users.find(u => u._id === userId);
    if (!target) return null;

    if (target.role === "admin") {
      const totalAdmins = memoryDb.users.filter(u => u.role === "admin").length;
      if (totalAdmins <= 1) {
        return { error: "Cannot delete the last remaining administrator account." };
      }
    }

    const userNbs = (memoryDb.notebooks || []).filter(n => n.userId === userId);
    const nbIds = new Set(userNbs.map(n => String(n._id)));

    memoryDb.notebooks = memoryDb.notebooks.filter(n => n.userId !== userId);
    memoryDb.documents = (memoryDb.documents || []).filter(d => !nbIds.has(String(d.notebookId)));
    memoryDb.messages = (memoryDb.messages || []).filter(m => !nbIds.has(String(m.notebookId)));
    memoryDb.notes = (memoryDb.notes || []).filter(n => !nbIds.has(String(n.notebookId)));
    memoryDb.artifacts = (memoryDb.artifacts || []).filter(a => !nbIds.has(String(a.notebookId)));
    memoryDb.users = memoryDb.users.filter(u => u._id !== userId);

    saveLocalFile();
    return { success: true };
  },

  async getSystemStats() {
    if (isMongo) {
      const [
        userCount,
        notebookCount,
        documentCount,
        messageCount,
        docs,
        flashcardsCount,
        quizCount,
        notesCount,
        recentUsers,
        recentDocs,
        recentLogs
      ] = await Promise.all([
        User.countDocuments(),
        Notebook.countDocuments(),
        Document.countDocuments(),
        Message.countDocuments(),
        Document.find().select("chunks filename").lean(),
        Artifact.countDocuments({ type: "flashcards" }),
        Artifact.countDocuments({ type: "quiz" }),
        Note.countDocuments(),
        User.find().select("-password").sort({ createdAt: -1 }).limit(5).lean(),
        Document.find().select("filename pageCount chunks status notebookId createdAt").sort({ createdAt: -1 }).limit(5).lean(),
        AuditLog.find().sort({ timestamp: -1 }).limit(5).lean()
      ]);

      let totalChunks = 0;
      let embeddedChunksCount = 0;
      docs.forEach(d => {
        if (d.chunks && Array.isArray(d.chunks)) {
          totalChunks += d.chunks.length;
          embeddedChunksCount += d.chunks.filter(c => c.embedding && c.embedding.length > 0).length;
        }
      });

      return {
        userCount,
        notebookCount,
        documentCount,
        totalChunks,
        embeddedChunksCount,
        messageCount,
        flashcardsCount,
        quizCount,
        notesCount,
        recentUsers: recentUsers.map(u => ({ ...u, status: u.status || "active" })),
        recentDocuments: recentDocs.map(d => ({
          _id: d._id,
          filename: d.filename,
          pageCount: d.pageCount || 0,
          chunkCount: d.chunks ? d.chunks.length : 0,
          status: d.status,
          createdAt: d.createdAt
        })),
        recentAuditLogs: recentLogs
      };
    }

    let totalChunks = 0;
    let embeddedChunksCount = 0;
    (memoryDb.documents || []).forEach(d => {
      if (d.chunks && Array.isArray(d.chunks)) {
        totalChunks += d.chunks.length;
        embeddedChunksCount += d.chunks.filter(c => c.embedding && c.embedding.length > 0).length;
      }
    });

    const flashcardsCount = (memoryDb.artifacts || []).filter(a => a.type === "flashcards").length;
    const quizCount = (memoryDb.artifacts || []).filter(a => a.type === "quiz").length;
    const notesCount = (memoryDb.notes || []).length;
    const messageCount = (memoryDb.messages || []).length;

    const recentUsers = (memoryDb.users || []).slice(0, 5).map(({ password, ...u }) => ({
      ...u,
      status: u.status || "active"
    }));

    const recentDocs = (memoryDb.documents || []).slice(0, 5).map(d => ({
      _id: d._id,
      filename: d.filename,
      pageCount: d.pageCount || 0,
      chunkCount: d.chunks ? d.chunks.length : 0,
      status: d.status,
      createdAt: d.createdAt
    }));

    const recentAuditLogs = (memoryDb.auditLogs || []).slice(0, 5);

    return {
      userCount: (memoryDb.users || []).length,
      notebookCount: (memoryDb.notebooks || []).length,
      documentCount: (memoryDb.documents || []).length,
      totalChunks,
      embeddedChunksCount,
      messageCount,
      flashcardsCount,
      quizCount,
      notesCount,
      recentUsers,
      recentDocuments: recentDocs,
      recentAuditLogs
    };
  },

  // --- Notebooks ---
  async getNotebooks(userId = null, role = "user") {
    if (isMongo) {
      if (role === "admin") {
        return await Notebook.find().sort({ updatedAt: -1 });
      }
      if (!userId || userId === "guest" || String(userId).startsWith("guest_")) {
        // Guests must NEVER see private registered users' notebooks!
        // Only return notebooks specifically created by this guest session
        return await Notebook.find({ userId: userId || "guest" }).sort({ updatedAt: -1 });
      }
      const queryIds = mongoose.Types.ObjectId.isValid(userId)
        ? [{ userId }, { userId: new mongoose.Types.ObjectId(userId) }]
        : [{ userId }];
      return await Notebook.find({ $or: queryIds }).sort({ updatedAt: -1 });
    }
    if (role === "admin") {
      return [...memoryDb.notebooks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    if (!userId || userId === "guest" || String(userId).startsWith("guest_")) {
      return memoryDb.notebooks
        .filter(n => String(n.userId) === String(userId || "guest"))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    return memoryDb.notebooks
      .filter(n => String(n.userId) === String(userId))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  async getAllNotebooksAdmin() {
    if (isMongo) {
      const [notebooks, users, documents, messages] = await Promise.all([
        Notebook.find().sort({ updatedAt: -1 }).lean(),
        User.find().select("name email").lean(),
        Document.find().select("notebookId filename").lean(),
        Message.find().select("notebookId").lean()
      ]);

      const userMap = {};
      users.forEach(u => { userMap[String(u._id)] = u; });

      const docCountMap = {};
      documents.forEach(d => {
        const nid = d.notebookId ? String(d.notebookId) : null;
        if (nid) docCountMap[nid] = (docCountMap[nid] || 0) + 1;
      });

      const msgCountMap = {};
      messages.forEach(m => {
        const nid = m.notebookId ? String(m.notebookId) : null;
        if (nid) msgCountMap[nid] = (msgCountMap[nid] || 0) + 1;
      });

      return notebooks.map(n => ({
        _id: n._id,
        title: n.title,
        description: n.description || "",
        userId: n.userId,
        owner: n.userId && userMap[String(n.userId)] ? userMap[String(n.userId)] : { name: "System / Guest", email: "guest@local" },
        documentCount: docCountMap[String(n._id)] || 0,
        messageCount: msgCountMap[String(n._id)] || 0,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt
      }));
    }

    const userMap = {};
    (memoryDb.users || []).forEach(u => { userMap[String(u._id)] = u; });

    const docCountMap = {};
    (memoryDb.documents || []).forEach(d => {
      const nid = d.notebookId ? String(d.notebookId) : null;
      if (nid) docCountMap[nid] = (docCountMap[nid] || 0) + 1;
    });

    const msgCountMap = {};
    (memoryDb.messages || []).forEach(m => {
      const nid = m.notebookId ? String(m.notebookId) : null;
      if (nid) msgCountMap[nid] = (msgCountMap[nid] || 0) + 1;
    });

    return (memoryDb.notebooks || []).map(n => ({
      _id: n._id,
      title: n.title,
      description: n.description || "",
      userId: n.userId,
      owner: n.userId && userMap[String(n.userId)] ? { name: userMap[String(n.userId)].name, email: userMap[String(n.userId)].email } : { name: "System / Guest", email: "guest@local" },
      documentCount: docCountMap[String(n._id)] || 0,
      messageCount: msgCountMap[String(n._id)] || 0,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt
    })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  async getNotebookDetailsAdmin(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const [notebook, documents, messagesCount, notesCount, artifacts] = await Promise.all([
        Notebook.findById(id).lean(),
        Document.find({ notebookId: id }).select("filename pageCount chunks status createdAt").lean(),
        Message.countDocuments({ notebookId: id }),
        Note.countDocuments({ notebookId: id }),
        Artifact.find({ notebookId: id }).select("type updatedAt").lean()
      ]);
      if (!notebook) return null;

      let owner = { name: "System / Guest", email: "guest@local" };
      if (notebook.userId && mongoose.Types.ObjectId.isValid(notebook.userId)) {
        const u = await User.findById(notebook.userId).select("name email").lean();
        if (u) owner = u;
      }

      return {
        ...notebook,
        owner,
        documents: documents.map(d => ({
          _id: d._id,
          filename: d.filename,
          pageCount: d.pageCount || 0,
          chunkCount: d.chunks ? d.chunks.length : 0,
          status: d.status,
          createdAt: d.createdAt
        })),
        documentCount: documents.length,
        messageCount: messagesCount,
        noteCount: notesCount,
        artifacts: artifacts.map(a => ({ type: a.type, updatedAt: a.updatedAt }))
      };
    }

    const notebook = (memoryDb.notebooks || []).find(n => n._id === id);
    if (!notebook) return null;

    let owner = { name: "System / Guest", email: "guest@local" };
    if (notebook.userId) {
      const u = (memoryDb.users || []).find(user => user._id === notebook.userId);
      if (u) owner = { name: u.name, email: u.email };
    }

    const docs = (memoryDb.documents || []).filter(d => String(d.notebookId) === String(id));
    const messagesCount = (memoryDb.messages || []).filter(m => String(m.notebookId) === String(id)).length;
    const notesCount = (memoryDb.notes || []).filter(n => String(n.notebookId) === String(id)).length;
    const artifacts = (memoryDb.artifacts || []).filter(a => String(a.notebookId) === String(id));

    return {
      ...notebook,
      owner,
      documents: docs.map(d => ({
        _id: d._id,
        filename: d.filename,
        pageCount: d.pageCount || 0,
        chunkCount: d.chunks ? d.chunks.length : 0,
        status: d.status,
        createdAt: d.createdAt
      })),
      documentCount: docs.length,
      messageCount: messagesCount,
      noteCount: notesCount,
      artifacts: artifacts.map(a => ({ type: a.type, updatedAt: a.updatedAt }))
    };
  },

  async createNotebook(title, description = "", userId = null, icon = "📓", color = "#8ab4f8") {
    if (isMongo) {
      return await Notebook.create({
        title: title || "Untitled notebook",
        description,
        userId,
        icon: icon || "📓",
        color: color || "#8ab4f8"
      });
    }
    const now = new Date().toISOString();
    const nb = {
      _id: generateId(),
      title: title || "Untitled notebook",
      description,
      userId,
      icon: icon || "📓",
      color: color || "#8ab4f8",
      createdAt: now,
      updatedAt: now,
    };
    memoryDb.notebooks.unshift(nb);
    saveLocalFile();
    return nb;
  },

  async getNotebookById(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Notebook.findById(id);
    }
    return memoryDb.notebooks.find((n) => String(n._id) === String(id)) || null;
  },

  async updateNotebook(id, updates) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Notebook.findByIdAndUpdate(id, { $set: updates }, { new: true });
    }
    const nb = memoryDb.notebooks.find((n) => String(n._id) === String(id));
    if (!nb) return null;
    Object.assign(nb, updates, { updatedAt: new Date().toISOString() });
    saveLocalFile();
    return nb;
  },

  async duplicateNotebook(id, userId = null) {
    const original = await this.getNotebookById(id);
    if (!original) throw new Error("Original notebook not found");

    const newTitle = `${original.title} (Copy)`;
    const newNb = await this.createNotebook(
      newTitle,
      original.description || "",
      userId || original.userId,
      original.icon || "📓",
      original.color || "#8ab4f8"
    );

    // Duplicate documents
    const docs = await this.getDocuments(id);
    if (docs && docs.length > 0) {
      for (const d of docs) {
        await this.createDocument({
          notebookId: newNb._id,
          filename: d.filename,
          extractedText: d.extractedText,
          pageCount: d.pageCount,
          pages: d.pages,
          charCount: d.charCount,
          status: d.status,
          summary: d.summary,
          keyTopics: d.keyTopics,
          suggestedQuestions: d.suggestedQuestions,
          chunks: d.chunks
        });
      }
    }

    // Duplicate notes
    const notes = await this.getNotes(id);
    if (notes && notes.length > 0) {
      for (const n of notes) {
        await this.createNote(newNb._id, n.title, n.content);
      }
    }

    return newNb;
  },

  async deleteNotebook(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      await Document.deleteMany({ notebookId: id });
      await Message.deleteMany({ notebookId: id });
      await Note.deleteMany({ notebookId: id });
      await Artifact.deleteMany({ notebookId: id });
      await Notebook.findByIdAndDelete(id);
      // Remove notebook from any collections
      await Collection.updateMany(
        { notebookIds: { $in: [id, String(id)] } },
        { $pull: { notebookIds: { $in: [id, String(id)] } } }
      ).catch(() => {});
      return true;
    }
    memoryDb.notebooks = memoryDb.notebooks.filter((n) => String(n._id) !== String(id));
    memoryDb.documents = memoryDb.documents.filter((d) => String(d.notebookId) !== String(id));
    memoryDb.messages = memoryDb.messages.filter((m) => String(m.notebookId) !== String(id));
    memoryDb.notes = (memoryDb.notes || []).filter((n) => String(n.notebookId) !== String(id));
    memoryDb.artifacts = (memoryDb.artifacts || []).filter((a) => String(a.notebookId) !== String(id));
    if (memoryDb.collections) {
      memoryDb.collections.forEach((c) => {
        if (c.notebookIds) {
          c.notebookIds = c.notebookIds.filter((nid) => String(nid) !== String(id));
        }
      });
    }
    saveLocalFile();
    return true;
  },

  // --- Collections ---
  async getCollections(userId = null, role = "user") {
    if (isMongo) {
      if (role === "admin") {
        return await Collection.find().sort({ updatedAt: -1 });
      }
      if (!userId || userId === "guest" || String(userId).startsWith("guest_")) {
        return await Collection.find({ userId: userId || "guest" }).sort({ updatedAt: -1 });
      }
      const queryIds = mongoose.Types.ObjectId.isValid(userId)
        ? [{ userId }, { userId: new mongoose.Types.ObjectId(userId) }]
        : [{ userId }];
      return await Collection.find({ $or: queryIds }).sort({ updatedAt: -1 });
    }
    const cols = memoryDb.collections || [];
    if (role === "admin") {
      return [...cols].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }
    if (!userId || userId === "guest" || String(userId).startsWith("guest_")) {
      return cols
        .filter((c) => String(c.userId) === String(userId || "guest"))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }
    return cols
      .filter((c) => String(c.userId) === String(userId))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  },

  async getCollectionById(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Collection.findById(id);
    }
    return (memoryDb.collections || []).find((c) => String(c._id) === String(id)) || null;
  },

  async createCollection({ name, description = "", icon = "📁", color = "#c58af9", userId = null, notebookIds = [] }) {
    if (isMongo) {
      return await Collection.create({
        name: name || "New Collection",
        description,
        icon: icon || "📁",
        color: color || "#c58af9",
        userId,
        notebookIds: Array.isArray(notebookIds) ? notebookIds : []
      });
    }
    const now = new Date().toISOString();
    const col = {
      _id: generateId(),
      name: name || "New Collection",
      description,
      icon: icon || "📁",
      color: color || "#c58af9",
      userId,
      notebookIds: Array.isArray(notebookIds) ? notebookIds : [],
      createdAt: now,
      updatedAt: now,
    };
    if (!memoryDb.collections) memoryDb.collections = [];
    memoryDb.collections.unshift(col);
    saveLocalFile();
    return col;
  },

  async updateCollection(id, updates) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Collection.findByIdAndUpdate(id, { $set: updates }, { new: true });
    }
    const col = (memoryDb.collections || []).find((c) => String(c._id) === String(id));
    if (!col) return null;
    Object.assign(col, updates, { updatedAt: new Date().toISOString() });
    saveLocalFile();
    return col;
  },

  async deleteCollection(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      await Collection.findByIdAndDelete(id);
      return true;
    }
    if (memoryDb.collections) {
      memoryDb.collections = memoryDb.collections.filter((c) => String(c._id) !== String(id));
      saveLocalFile();
    }
    return true;
  },

  async addNotebookToCollection(collectionId, notebookId) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(collectionId)) return null;
      const col = await Collection.findById(collectionId);
      if (!col) return null;
      const idStr = String(notebookId);
      const exists = (col.notebookIds || []).some(nid => String(nid) === idStr);
      if (!exists) {
        col.notebookIds.push(notebookId);
        await col.save();
      }
      return col;
    }
    const col = (memoryDb.collections || []).find((c) => String(c._id) === String(collectionId));
    if (!col) return null;
    if (!col.notebookIds) col.notebookIds = [];
    const idStr = String(notebookId);
    if (!col.notebookIds.some(nid => String(nid) === idStr)) {
      col.notebookIds.push(notebookId);
      col.updatedAt = new Date().toISOString();
      saveLocalFile();
    }
    return col;
  },

  async removeNotebookFromCollection(collectionId, notebookId) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(collectionId)) return null;
      const col = await Collection.findById(collectionId);
      if (!col) return null;
      col.notebookIds = (col.notebookIds || []).filter(nid => String(nid) !== String(notebookId));
      await col.save();
      return col;
    }
    const col = (memoryDb.collections || []).find((c) => String(c._id) === String(collectionId));
    if (!col) return null;
    if (col.notebookIds) {
      col.notebookIds = col.notebookIds.filter(nid => String(nid) !== String(notebookId));
      col.updatedAt = new Date().toISOString();
      saveLocalFile();
    }
    return col;
  },

  // --- Documents ---
  async getAllDocuments() {
    if (isMongo) return await Document.find().sort({ createdAt: -1 });
    return [...memoryDb.documents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getAllDocumentsAdmin() {
    if (isMongo) {
      const [docs, notebooks, users] = await Promise.all([
        Document.find().select("filename pageCount charCount chunks status notebookId createdAt").sort({ createdAt: -1 }).lean(),
        Notebook.find().select("title userId").lean(),
        User.find().select("name email").lean()
      ]);

      const nbMap = {};
      notebooks.forEach(n => { nbMap[String(n._id)] = n; });

      const userMap = {};
      users.forEach(u => { userMap[String(u._id)] = u; });

      return docs.map(d => {
        const nb = d.notebookId && nbMap[String(d.notebookId)];
        const owner = nb && nb.userId && userMap[String(nb.userId)] ? userMap[String(nb.userId)] : { name: "Student", email: "student@local" };
        const chunks = d.chunks || [];
        const embeddedCount = chunks.filter(c => c.embedding && c.embedding.length > 0).length;

        return {
          _id: d._id,
          filename: d.filename,
          notebookId: d.notebookId,
          notebookTitle: nb ? nb.title : "Unknown Notebook",
          owner,
          pageCount: d.pageCount || 0,
          charCount: d.charCount || 0,
          chunksCount: chunks.length,
          embeddedChunksCount: embeddedCount,
          status: d.status,
          createdAt: d.createdAt
        };
      });
    }

    const nbMap = {};
    (memoryDb.notebooks || []).forEach(n => { nbMap[String(n._id)] = n; });

    const userMap = {};
    (memoryDb.users || []).forEach(u => { userMap[String(u._id)] = u; });

    return (memoryDb.documents || []).map(d => {
      const nb = d.notebookId && nbMap[String(d.notebookId)];
      const owner = nb && nb.userId && userMap[String(nb.userId)] ? { name: userMap[String(nb.userId)].name, email: userMap[String(nb.userId)].email } : { name: "Student", email: "student@local" };
      const chunks = d.chunks || [];
      const embeddedCount = chunks.filter(c => c.embedding && c.embedding.length > 0).length;

      return {
        _id: d._id,
        filename: d.filename,
        notebookId: d.notebookId,
        notebookTitle: nb ? nb.title : "Unknown Notebook",
        owner,
        pageCount: d.pageCount || 0,
        charCount: d.charCount || 0,
        chunksCount: chunks.length,
        embeddedChunksCount: embeddedCount,
        status: d.status,
        createdAt: d.createdAt
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getDocumentDetailsAdmin(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await Document.findById(id).lean();
      if (!doc) return null;

      let notebookTitle = "Unknown Notebook";
      let owner = { name: "Student", email: "student@local" };
      if (doc.notebookId) {
        const nb = await Notebook.findById(doc.notebookId).lean();
        if (nb) {
          notebookTitle = nb.title;
          if (nb.userId && mongoose.Types.ObjectId.isValid(nb.userId)) {
            const u = await User.findById(nb.userId).select("name email").lean();
            if (u) owner = u;
          }
        }
      }

      const chunks = doc.chunks || [];
      const sampleChunks = chunks.slice(0, 5).map(c => ({
        chunkId: c.chunkId,
        pageNumber: c.pageNumber,
        charCount: c.charCount,
        hasEmbedding: Boolean(c.embedding && c.embedding.length > 0),
        embeddingDim: c.embedding ? c.embedding.length : 0,
        snippet: (c.text || "").slice(0, 200) + ((c.text || "").length > 200 ? "..." : "")
      }));

      return {
        _id: doc._id,
        filename: doc.filename,
        notebookId: doc.notebookId,
        notebookTitle,
        owner,
        pageCount: doc.pageCount || 0,
        charCount: doc.charCount || 0,
        chunksCount: chunks.length,
        embeddedCount: chunks.filter(c => c.embedding && c.embedding.length > 0).length,
        status: doc.status,
        summary: doc.summary || "",
        keyTopics: doc.keyTopics || [],
        suggestedQuestions: doc.suggestedQuestions || [],
        sampleChunks,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      };
    }

    const doc = (memoryDb.documents || []).find(d => String(d._id) === String(id));
    if (!doc) return null;

    let notebookTitle = "Unknown Notebook";
    let owner = { name: "Student", email: "student@local" };
    if (doc.notebookId) {
      const nb = (memoryDb.notebooks || []).find(n => String(n._id) === String(doc.notebookId));
      if (nb) {
        notebookTitle = nb.title;
        if (nb.userId) {
          const u = (memoryDb.users || []).find(user => String(user._id) === String(nb.userId));
          if (u) owner = { name: u.name, email: u.email };
        }
      }
    }

    const chunks = doc.chunks || [];
    const sampleChunks = chunks.slice(0, 5).map(c => ({
      chunkId: c.chunkId,
      pageNumber: c.pageNumber,
      charCount: c.charCount,
      hasEmbedding: Boolean(c.embedding && c.embedding.length > 0),
      embeddingDim: c.embedding ? c.embedding.length : 0,
      snippet: (c.text || "").slice(0, 200) + ((c.text || "").length > 200 ? "..." : "")
    }));

    return {
      _id: doc._id,
      filename: doc.filename,
      notebookId: doc.notebookId,
      notebookTitle,
      owner,
      pageCount: doc.pageCount || 0,
      charCount: doc.charCount || 0,
      chunksCount: chunks.length,
      embeddedCount: chunks.filter(c => c.embedding && c.embedding.length > 0).length,
      status: doc.status,
      summary: doc.summary || "",
      keyTopics: doc.keyTopics || [],
      suggestedQuestions: doc.suggestedQuestions || [],
      sampleChunks,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  },

  async getDocuments(notebookId) {
    if (isMongo) return await Document.find({ notebookId }).sort({ createdAt: 1 });
    return memoryDb.documents
      .filter((d) => String(d.notebookId) === String(notebookId))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async getDocumentById(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Document.findById(id).lean();
    }
    return memoryDb.documents.find((d) => String(d._id || d.id) === String(id)) || null;
  },

  async createDocument(data) {
    if (isMongo) return await Document.create(data);
    const now = new Date().toISOString();
    const doc = {
      _id: generateId(),
      notebookId: data.notebookId,
      filename: data.filename,
      storagePath: data.storagePath || "",
      hasPdfFile: Boolean(data.hasPdfFile),
      mimeType: data.mimeType || "application/pdf",
      pageCount: data.pageCount || 0,
      pages: data.pages || [],
      chunks: data.chunks || [],
      charCount: data.charCount || 0,
      extractedText: data.extractedText || "",
      summary: data.summary || "",
      keyTopics: data.keyTopics || [],
      suggestedQuestions: data.suggestedQuestions || [],
      nlp: data.nlp || null,
      status: data.status || "processing",
      createdAt: now,
      updatedAt: now,
    };
    memoryDb.documents.push(doc);
    saveLocalFile();
    return doc;
  },

  async updateDocument(id, updates) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Document.findByIdAndUpdate(id, { $set: updates }, { new: true });
    }
    const doc = memoryDb.documents.find((d) => String(d._id || d.id) === String(id));
    if (!doc) return null;
    Object.assign(doc, updates, { updatedAt: new Date().toISOString() });
    saveLocalFile();
    return doc;
  },

  async deleteDocument(id, notebookId = null) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const query = { _id: id };
      if (notebookId && mongoose.Types.ObjectId.isValid(notebookId)) {
        query.notebookId = notebookId;
      }
      const deleted = await Document.findOneAndDelete(query);
      return Boolean(deleted);
    }
    const before = memoryDb.documents.length;
    memoryDb.documents = memoryDb.documents.filter((d) => {
      const dId = d._id || d.id;
      if (String(dId) !== String(id)) return true;
      if (notebookId && String(d.notebookId) !== String(notebookId)) return true;
      return false;
    });
    saveLocalFile();
    return memoryDb.documents.length < before;
  },

  // --- Messages ---
  async getMessages(notebookId) {
    if (isMongo) return await Message.find({ notebookId }).sort({ createdAt: 1 });
    return memoryDb.messages
      .filter((m) => String(m.notebookId) === String(notebookId))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async createMessage(data) {
    if (isMongo) return await Message.create(data);
    const now = new Date().toISOString();
    const msg = {
      _id: generateId(),
      notebookId: data.notebookId,
      role: data.role,
      content: data.content,
      sources: data.sources || [],
      createdAt: now,
    };
    memoryDb.messages.push(msg);
    saveLocalFile();
    return msg;
  },

  async clearMessages(notebookId) {
    if (isMongo) {
      await Message.deleteMany({ notebookId });
      return true;
    }
    memoryDb.messages = memoryDb.messages.filter((m) => String(m.notebookId) !== String(notebookId));
    saveLocalFile();
    return true;
  },

  // --- Notes Pinboard ---
  async getNotes(notebookId) {
    if (isMongo) {
      try {
        return await Note.find({ notebookId }).sort({ createdAt: -1 });
      } catch (e) {
        // fallback
      }
    }
    if (!memoryDb.notes) memoryDb.notes = [];
    return memoryDb.notes
      .filter((n) => String(n.notebookId) === String(notebookId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async createNote(notebookId, title, content, tag = "General") {
    if (isMongo) {
      try {
        return await Note.create({ notebookId, title: title || "Untitled Note", content, tag });
      } catch (e) {
        // fallback
      }
    }
    if (!memoryDb.notes) memoryDb.notes = [];
    const now = new Date().toISOString();
    const note = {
      _id: generateId(),
      notebookId,
      title: title || "Untitled Note",
      content,
      tag,
      createdAt: now,
      updatedAt: now,
    };
    memoryDb.notes.unshift(note);
    saveLocalFile();
    return note;
  },

  async updateNote(id, updates) {
    if (isMongo) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          return await Note.findByIdAndUpdate(id, { $set: updates }, { new: true });
        }
      } catch (e) {
        // fallback
      }
    }
    if (!memoryDb.notes) memoryDb.notes = [];
    const note = memoryDb.notes.find((n) => n._id === id);
    if (!note) return null;
    Object.assign(note, updates, { updatedAt: new Date().toISOString() });
    saveLocalFile();
    return note;
  },

  async deleteNote(id) {
    if (isMongo) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          await Note.findByIdAndDelete(id);
          return true;
        }
      } catch (e) {
        // fallback
      }
    }
    if (!memoryDb.notes) memoryDb.notes = [];
    memoryDb.notes = memoryDb.notes.filter((n) => n._id !== id);
    saveLocalFile();
    return true;
  },

  // --- Studio Artifacts ---
  async getArtifact(notebookId, type) {
    if (isMongo) {
      try {
        return await Artifact.findOne({ notebookId, type });
      } catch (e) {
        // fallback
      }
    }
    if (!memoryDb.artifacts) memoryDb.artifacts = [];
    return memoryDb.artifacts.find((a) => String(a.notebookId) === String(notebookId) && a.type === type) || null;
  },

  async saveArtifact(notebookId, type, data) {
    if (isMongo) {
      try {
        return await Artifact.findOneAndUpdate(
          { notebookId, type },
          { $set: { data } },
          { upsert: true, new: true }
        );
      } catch (e) {
        // fallback
      }
    }
    if (!memoryDb.artifacts) memoryDb.artifacts = [];
    const existingIndex = memoryDb.artifacts.findIndex((a) => String(a.notebookId) === String(notebookId) && a.type === type);
    const artifactObj = {
      notebookId,
      type,
      data,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      memoryDb.artifacts[existingIndex] = artifactObj;
    } else {
      memoryDb.artifacts.push(artifactObj);
    }
    saveLocalFile();
    return artifactObj;
  },

  // --- AI / RAG Metrics ---
  async getRagMetrics() {
    let docs = [];
    if (isMongo) {
      docs = await Document.find().select("chunks status filename").lean();
    } else {
      docs = memoryDb.documents || [];
    }

    let totalChunks = 0;
    let embeddedChunks = 0;
    let fallback3072Chunks = 0;
    let fallback512Chunks = 0;
    let documentsReady = 0;
    let documentsNeedingReindex = 0;

    docs.forEach(doc => {
      if (doc.status === "ready") documentsReady++;
      const chunks = doc.chunks || [];
      if (!chunks.length || doc.status === "failed") {
        documentsNeedingReindex++;
      }
      totalChunks += chunks.length;
      chunks.forEach(c => {
        if (c.embedding && Array.isArray(c.embedding) && c.embedding.length > 0) {
          embeddedChunks++;
          if (c.embedding.length === 3072) {
            fallback3072Chunks++;
          } else if (c.embedding.length === 512) {
            fallback512Chunks++;
          }
        }
      });
    });

    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here" &&
      process.env.GEMINI_API_KEY !== "...your key from aistudio.google.com..."
    );

    return {
      embeddingModel: "gemini-embedding-2-preview",
      embeddingDimension: 3072,
      fallbackDimension: 512,
      semanticRetrieval: "Cosine similarity",
      lexicalRetrieval: "BM25-style lexical retrieval",
      hybridRetrieval: "Enabled",
      rankFusion: "Reciprocal Rank Fusion (RRF)",
      rrfConstantK: 60,
      hybridFormula: "0.6 * (0.65 * semanticScore + 0.35 * lexicalScore) + 0.4 * (RRF_Score * 30)",
      currentVectorRetrieval: "Node.js cosine similarity over stored embeddings",
      mongoAtlasVectorSearch: "Not currently implemented",
      trueMmr: "Not currently implemented",
      diversityFilter: "Page-level diversity capping (maximum 2 chunks per page)",
      generationModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      generationFallbackModel: "gemini-3.1-flash-lite",
      geminiConfigured: hasGeminiKey,
      totalDocuments: docs.length,
      documentsReady,
      documentsNeedingReindex,
      totalChunks,
      embeddedChunks,
      chunks3072Dim: fallback3072Chunks,
      chunks512Dim: fallback512Chunks
    };
  },

  // --- System Health ---
  async getSystemHealth() {
    const memory = process.memoryUsage();
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here" &&
      process.env.GEMINI_API_KEY !== "...your key from aistudio.google.com..."
    );

    return {
      timestamp: new Date().toISOString(),
      backend: {
        status: "Connected / Healthy",
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsageMB: {
          rss: Math.round(memory.rss / (1024 * 1024)),
          heapUsed: Math.round(memory.heapUsed / (1024 * 1024)),
          heapTotal: Math.round(memory.heapTotal / (1024 * 1024))
        }
      },
      database: {
        status: isMongo ? "Connected" : "Connected (Local Storage Fallback)",
        mode: isMongo ? "mongodb" : "local_json",
        label: isMongo ? "MongoDB Database" : "Zero-Config In-Memory Storage",
        details: isMongo ? "MongoDB Active" : "server/data/local_db.json"
      },
      geminiApi: {
        status: hasGeminiKey ? "Configured" : "Not configured",
        configured: hasGeminiKey,
        primaryModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        embeddingModel: "gemini-embedding-2-preview"
      },
      pdfExtraction: {
        status: "Available",
        engine: "pdf.js & unpdf parser"
      },
      ocrExtraction: {
        status: "Available",
        engine: "Tesseract.js OCR fallback"
      },
      ragEngine: {
        status: "Available",
        engine: "VectorEngine v2 (Hybrid: Cosine + BM25 + RRF)"
      }
    };
  },

  // --- Analytics ---
  async getAdminAnalytics() {
    let users = [];
    let notebooks = [];
    let docs = [];

    if (isMongo) {
      [users, notebooks, docs] = await Promise.all([
        User.find().select("createdAt").lean(),
        Notebook.find().select("createdAt userId title").lean(),
        Document.find().select("createdAt charCount chunks status").lean()
      ]);
    } else {
      users = (memoryDb.users || []).map(u => ({ createdAt: u.createdAt }));
      notebooks = (memoryDb.notebooks || []).map(n => ({ createdAt: n.createdAt, userId: n.userId, title: n.title }));
      docs = (memoryDb.documents || []).map(d => ({ createdAt: d.createdAt, charCount: d.charCount, chunks: d.chunks, status: d.status }));
    }

    // Aggregate by date (YYYY-MM-DD)
    function groupByDay(items) {
      const counts = {};
      items.forEach(item => {
        if (!item.createdAt) return;
        const d = new Date(item.createdAt).toISOString().split("T")[0];
        counts[d] = (counts[d] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));
    }

    const usersOverTime = groupByDay(users);
    const notebooksOverTime = groupByDay(notebooks);
    const documentsOverTime = groupByDay(docs);

    // Status breakdown
    const statusCounts = { ready: 0, processing: 0, failed: 0 };
    let totalChars = 0;
    let totalChunks = 0;
    docs.forEach(d => {
      const s = d.status || "processing";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
      totalChars += d.charCount || 0;
      totalChunks += (d.chunks || []).length;
    });

    return {
      usersOverTime,
      notebooksOverTime,
      documentsOverTime,
      totalUsers: users.length,
      totalNotebooks: notebooks.length,
      totalDocuments: docs.length,
      documentStatusBreakdown: statusCounts,
      totalExtractedCharacters: totalChars,
      totalChunksCreated: totalChunks,
      averageChunksPerDocument: docs.length ? Math.round((totalChunks / docs.length) * 10) / 10 : 0
    };
  }
};

module.exports = store;
