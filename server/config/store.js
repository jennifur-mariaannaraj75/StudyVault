const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Notebook = require("../models/Notebook");
const Document = require("../models/Document");
const Message = require("../models/Message");
const User = require("../models/User");

const DATA_FILE = path.join(__dirname, "..", "data", "local_db.json");

let isMongo = false;
let memoryDb = {
  users: [],
  notebooks: [],
  documents: [],
  messages: [],
  notes: [],
  artifacts: []
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
      console.log(`[store] Loaded local storage with ${memoryDb.notebooks?.length || 0} notebooks and ${memoryDb.users?.length || 0} users.`);
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
          avatar: "🛡️"
        });
        console.log(`[auth] Auto-created Default Admin Account: ${adminEmail}`);
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
          avatar: "🛡️",
          createdAt: new Date().toISOString()
        };
        memoryDb.users.unshift(adminUser);
        saveLocalFile();
        console.log(`[auth] Auto-created Default Admin Account (Local DB): ${adminEmail}`);
      }
    }
  } catch (err) {
    console.error("[auth] Error seeding default admin:", err.message);
  }
}

async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/notebooklm_clone";
  try {
    mongoose.set("strictQuery", false);
    mongoose.set("bufferCommands", false);
    // Connect with 3-second timeout so app starts instantly if MongoDB is offline
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    isMongo = true;
    console.log("[db] MongoDB connected successfully:", uri);
  } catch (err) {
    isMongo = false;
    console.warn(`[db] MongoDB connection failed (${err.message}).`);
    console.warn("[db] Running in Zero-Config In-Memory Storage mode (persisted to server/data/local_db.json).");
    loadLocalFile();
  }
  await ensureDefaultAdmin();
}

const store = {
  connectDB,
  isMongoMode: () => isMongo,

  // --- Users & Auth ---
  async getUsers() {
    if (isMongo) return await User.find().select("-password").sort({ createdAt: -1 });
    return memoryDb.users.map(({ password, ...u }) => u);
  },

  async getUserByEmail(email) {
    const cleanEmail = (email || "").toLowerCase().trim();
    if (isMongo) return await User.findOne({ email: cleanEmail });
    return memoryDb.users.find(u => u.email === cleanEmail) || null;
  },

  async getUserById(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await User.findById(id).select("-password");
    }
    const u = memoryDb.users.find(user => user._id === id);
    if (!u) return null;
    const { password, ...userWithoutPass } = u;
    return userWithoutPass;
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
        role: userData.role || "user"
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
      createdAt: now
    };
    memoryDb.users.unshift(newUser);
    saveLocalFile();
    return newUser;
  },

  async updateUserRole(userId, newRole) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      return await User.findByIdAndUpdate(userId, { $set: { role: newRole } }, { new: true }).select("-password");
    }
    const user = memoryDb.users.find(u => u._id === userId);
    if (!user) return null;
    user.role = newRole;
    saveLocalFile();
    const { password, ...updatedUser } = user;
    return updatedUser;
  },

  async deleteUser(userId) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return false;
      await User.findByIdAndDelete(userId);
      return true;
    }
    memoryDb.users = memoryDb.users.filter(u => u._id !== userId);
    saveLocalFile();
    return true;
  },

  async getSystemStats() {
    if (isMongo) {
      const userCount = await User.countDocuments();
      const notebookCount = await Notebook.countDocuments();
      const documentCount = await Document.countDocuments();
      return { userCount, notebookCount, documentCount };
    }
    return {
      userCount: memoryDb.users.length,
      notebookCount: memoryDb.notebooks.length,
      documentCount: memoryDb.documents.length
    };
  },

  // --- Notebooks ---
  async getNotebooks(userId = null, role = "user") {
    if (isMongo) {
      if (role === "admin" || !userId || userId === "guest") {
        return await Notebook.find().sort({ updatedAt: -1 });
      }
      return await Notebook.find({ $or: [{ userId }, { userId: { $exists: false } }] }).sort({ updatedAt: -1 });
    }
    if (role === "admin" || !userId || userId === "guest") {
      return [...memoryDb.notebooks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    return memoryDb.notebooks
      .filter(n => !n.userId || n.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  async createNotebook(title, description = "", userId = null) {
    if (isMongo) {
      return await Notebook.create({ title: title || "Untitled notebook", description, userId });
    }
    const now = new Date().toISOString();
    const nb = {
      _id: generateId(),
      title: title || "Untitled notebook",
      description,
      userId,
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
    return memoryDb.notebooks.find((n) => n._id === id) || null;
  },

  async updateNotebook(id, updates) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Notebook.findByIdAndUpdate(id, { $set: updates }, { new: true });
    }
    const nb = memoryDb.notebooks.find((n) => n._id === id);
    if (!nb) return null;
    Object.assign(nb, updates, { updatedAt: new Date().toISOString() });
    saveLocalFile();
    return nb;
  },

  async deleteNotebook(id) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      await Document.deleteMany({ notebookId: id });
      await Message.deleteMany({ notebookId: id });
      await Notebook.findByIdAndDelete(id);
      return true;
    }
    memoryDb.notebooks = memoryDb.notebooks.filter((n) => n._id !== id);
    memoryDb.documents = memoryDb.documents.filter((d) => d.notebookId !== id);
    memoryDb.messages = memoryDb.messages.filter((m) => m.notebookId !== id);
    memoryDb.notes = memoryDb.notes.filter((n) => n.notebookId !== id);
    memoryDb.artifacts = memoryDb.artifacts.filter((a) => a.notebookId !== id);
    saveLocalFile();
    return true;
  },

  // --- Documents ---
  async getAllDocuments() {
    if (isMongo) return await Document.find().sort({ createdAt: -1 });
    return [...memoryDb.documents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getDocuments(notebookId) {
    if (isMongo) return await Document.find({ notebookId }).sort({ createdAt: 1 });
    return memoryDb.documents
      .filter((d) => d.notebookId === notebookId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async createDocument(data) {
    if (isMongo) return await Document.create(data);
    const now = new Date().toISOString();
    const doc = {
      _id: generateId(),
      notebookId: data.notebookId,
      filename: data.filename,
      pageCount: data.pageCount || 0,
      charCount: data.charCount || 0,
      extractedText: data.extractedText || "",
      summary: data.summary || "",
      keyTopics: data.keyTopics || [],
      suggestedQuestions: data.suggestedQuestions || [],
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
    const doc = memoryDb.documents.find((d) => d._id === id);
    if (!doc) return null;
    Object.assign(doc, updates, { updatedAt: new Date().toISOString() });
    saveLocalFile();
    return doc;
  },

  async deleteDocument(id, notebookId) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      await Document.findOneAndDelete({ _id: id, notebookId });
      return true;
    }
    memoryDb.documents = memoryDb.documents.filter((d) => d._id !== id);
    saveLocalFile();
    return true;
  },

  // --- Messages ---
  async getMessages(notebookId) {
    if (isMongo) return await Message.find({ notebookId }).sort({ createdAt: 1 });
    return memoryDb.messages
      .filter((m) => m.notebookId === notebookId)
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
    memoryDb.messages = memoryDb.messages.filter((m) => m.notebookId !== notebookId);
    saveLocalFile();
    return true;
  },

  // --- Notes Pinboard ---
  async getNotes(notebookId) {
    if (!memoryDb.notes) memoryDb.notes = [];
    return memoryDb.notes
      .filter((n) => n.notebookId === notebookId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async createNote(notebookId, title, content, tag = "General") {
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
    if (!memoryDb.notes) memoryDb.notes = [];
    const note = memoryDb.notes.find((n) => n._id === id);
    if (!note) return null;
    Object.assign(note, updates, { updatedAt: new Date().toISOString() });
    saveLocalFile();
    return note;
  },

  async deleteNote(id) {
    if (!memoryDb.notes) memoryDb.notes = [];
    memoryDb.notes = memoryDb.notes.filter((n) => n._id !== id);
    saveLocalFile();
    return true;
  },

  // --- Studio Artifacts ---
  async getArtifact(notebookId, type) {
    if (!memoryDb.artifacts) memoryDb.artifacts = [];
    return memoryDb.artifacts.find((a) => a.notebookId === notebookId && a.type === type) || null;
  },

  async saveArtifact(notebookId, type, data) {
    if (!memoryDb.artifacts) memoryDb.artifacts = [];
    const existingIndex = memoryDb.artifacts.findIndex((a) => a.notebookId === notebookId && a.type === type);
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
  }
};

module.exports = store;
