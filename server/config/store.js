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
const {
  ALL_STUDIO_FEATURES,
  getTodayKey,
  getPlans,
  getPlanConfig,
  updatePlanConfig,
  resetPlansToDefault,
  getMinimumPlanForFeature,
  getFeatureLabel,
  syncPlansWithDatabase
} = require("./plans");

const os = require("os");
const BUNDLED_DATA_FILE = path.join(__dirname, "..", "data", "local_db.json");
const DATA_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), "studyvault_data", "local_db.json")
  : BUNDLED_DATA_FILE;

let isMongo = false;
const guestUsageMap = {};

function normalizeUsage(rawUsage = {}) {
  const today = getTodayKey();
  const isToday = rawUsage && rawUsage.dateKey === today;
  return {
    dateKey: today,
    chatQueriesToday: isToday ? (Number(rawUsage.chatQueriesToday) || 0) : 0,
    studioGenerationsToday: isToday ? (Number(rawUsage.studioGenerationsToday) || 0) : 0,
    totalChatQueries: Number(rawUsage?.totalChatQueries) || 0,
    totalStudioGenerations: Number(rawUsage?.totalStudioGenerations) || 0,
    lastActiveAt: rawUsage?.lastActiveAt || null
  };
}

function resolveUserPlanDetails(userObj = {}) {
  const role = userObj.role || "user";
  const planId = String(userObj.plan || (role === "admin" ? "pro" : "free")).toLowerCase();
  const basePlan = getPlanConfig(planId, role);
  const cq = userObj.customQuota || {};

  const limits = {
    maxNotebooks: cq.maxNotebooks != null && cq.maxNotebooks > 0 ? Number(cq.maxNotebooks) : basePlan.maxNotebooks,
    maxDocsPerNotebook: cq.maxDocsPerNotebook != null && cq.maxDocsPerNotebook > 0 ? Number(cq.maxDocsPerNotebook) : basePlan.maxDocsPerNotebook,
    maxFileSizeMB: basePlan.maxFileSizeMB,
    maxPagesPerDoc: basePlan.maxPagesPerDoc,
    maxDailyChatQueries: cq.maxDailyChatQueries != null && cq.maxDailyChatQueries > 0 ? Number(cq.maxDailyChatQueries) : basePlan.maxDailyChatQueries,
    maxDailyStudioGenerations: cq.maxDailyStudioGenerations != null && cq.maxDailyStudioGenerations > 0 ? Number(cq.maxDailyStudioGenerations) : basePlan.maxDailyStudioGenerations,
    ragTopK: basePlan.ragTopK
  };

  return {
    plan: basePlan.id,
    planName: basePlan.name,
    tagline: basePlan.tagline,
    priceMonthly: basePlan.priceMonthly,
    priceLabel: basePlan.priceLabel,
    badgeColor: basePlan.badgeColor,
    limits,
    allowedStudioFeatures: basePlan.allowedStudioFeatures || [],
    highlights: basePlan.highlights || [],
    hasCustomQuota: Boolean(
      (cq.maxNotebooks != null && cq.maxNotebooks > 0) ||
      (cq.maxDocsPerNotebook != null && cq.maxDocsPerNotebook > 0) ||
      (cq.maxDailyChatQueries != null && cq.maxDailyChatQueries > 0) ||
      (cq.maxDailyStudioGenerations != null && cq.maxDailyStudioGenerations > 0)
    )
  };
}
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
const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "studyvault_data")
  : path.join(__dirname, "..", "data");
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (_) {}

function loadLocalFile() {
  try {
    const fileToRead = fs.existsSync(DATA_FILE)
      ? DATA_FILE
      : (fs.existsSync(BUNDLED_DATA_FILE) ? BUNDLED_DATA_FILE : null);
    if (fileToRead) {
      const raw = fs.readFileSync(fileToRead, "utf-8");
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
          plan: "pro",
          avatar: "🛡️"
        });
        console.log(`[auth] Auto-created Default Admin Account: ${adminEmail}`);
      } else {
        let changed = false;
        if (existing.role !== "admin" || existing.status !== "active") {
          existing.role = "admin";
          existing.status = "active";
          changed = true;
        }
        if (!existing.plan || existing.plan === "free") {
          existing.plan = "pro";
          changed = true;
        }
        if (changed) await existing.save();
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
          plan: "pro",
          avatar: "🛡️",
          createdAt: new Date().toISOString()
        };
        memoryDb.users.unshift(adminUser);
        saveLocalFile();
        console.log(`[auth] Auto-created Default Admin Account (Local DB): ${adminEmail}`);
      } else {
        existing.role = "admin";
        existing.status = existing.status || "active";
        existing.plan = existing.plan || "pro";
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

let connectPromise = null;

async function connectDB() {
  if (isMongo && mongoose.connection.readyState === 1) {
    return true;
  }
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const uri = resolveMongoUri();
    if (!uri) {
      isMongo = false;
      console.log("[db] No MONGO_URI provided in environment.");
      console.log("[db] Running in Zero-Config Persistent Local Storage mode (persisted to server/data/local_db.json).");
      loadLocalFile();
      await ensureDefaultAdmin();
      return false;
    }

    const maskedUri = uri.replace(/:([^:@]+)@/, ":****@");
    // Always load local file as warm cache in case of offline fallback, but prioritize MongoDB
    loadLocalFile();

    mongoose.set("strictQuery", false);
    mongoose.set("bufferCommands", false);

    mongoose.connection.on("connected", () => {
      isMongo = true;
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("[db] MongoDB disconnected — attempting automatic reconnect...");
    });

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[db] Connecting to MongoDB (attempt ${attempt}): ${maskedUri}...`);
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 12000,
          connectTimeoutMS: 12000,
        });
        isMongo = true;
        console.log("[db] ✅ MongoDB connected successfully!");
        await syncPlansWithDatabase();
        break;
      } catch (err) {
        console.warn(`[db] MongoDB connection attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) {
          isMongo = false;
          console.log("[db] Operating in Zero-Config Persistent Local Storage mode (server/data/local_db.json).");
        }
      }
    }
    await ensureDefaultAdmin();
    return isMongo;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

const store = {
  connectDB,
  isMongoMode: () => Boolean(isMongo && mongoose.connection.readyState === 1),

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

  // --- Subscription Plans & Quotas ---
  getPlansConfig() {
    return {
      plans: getPlans(),
      studioFeatures: ALL_STUDIO_FEATURES
    };
  },

  updatePlanTierConfig(tier, updates) {
    return updatePlanConfig(tier, updates);
  },

  resetPlansConfig() {
    return resetPlansToDefault();
  },

  async getUserPlanStatus(userId, role = "user") {
    let userObj = null;
    const isGuest = !userId || userId === "guest" || String(userId).startsWith("guest_");

    if (!isGuest) {
      if (isMongo && mongoose.Types.ObjectId.isValid(userId)) {
        userObj = await User.findById(userId).select("-password").lean();
      } else if (!isMongo) {
        userObj = (memoryDb.users || []).find(u => String(u._id) === String(userId)) || null;
      }
    }

    if (!userObj) {
      const guestKey = String(userId || "guest");
      const rawGuestUsage = guestUsageMap[guestKey] || {};
      userObj = {
        _id: guestKey,
        name: "Guest",
        role: role || "user",
        plan: role === "admin" ? "pro" : "free",
        usage: rawGuestUsage,
        customQuota: {}
      };
    }

    const planDetails = resolveUserPlanDetails(userObj);
    const usage = normalizeUsage(userObj.usage);

    // Count user's notebooks & documents
    let notebooksUsed = 0;
    let totalDocuments = 0;
    if (isMongo) {
      if (isGuest) {
        const nbs = await Notebook.find({ userId: String(userId || "guest") }).select("_id").lean();
        notebooksUsed = nbs.length;
        if (nbs.length > 0) {
          totalDocuments = await Document.countDocuments({ notebookId: { $in: nbs.map(n => n._id) } });
        }
      } else if (mongoose.Types.ObjectId.isValid(userId)) {
        const nbs = await Notebook.find({
          $or: [{ userId }, { userId: new mongoose.Types.ObjectId(userId) }]
        }).select("_id").lean();
        notebooksUsed = nbs.length;
        if (nbs.length > 0) {
          totalDocuments = await Document.countDocuments({ notebookId: { $in: nbs.map(n => n._id) } });
        }
      }
    } else {
      const nbs = (memoryDb.notebooks || []).filter(n => String(n.userId) === String(userId || "guest"));
      notebooksUsed = nbs.length;
      const nbSet = new Set(nbs.map(n => String(n._id)));
      totalDocuments = (memoryDb.documents || []).filter(d => nbSet.has(String(d.notebookId))).length;
    }

    return {
      userId: String(userObj._id || userId || "guest"),
      role: userObj.role || role || "user",
      plan: planDetails.plan,
      planName: planDetails.planName,
      tagline: planDetails.tagline,
      priceMonthly: planDetails.priceMonthly,
      priceLabel: planDetails.priceLabel,
      badgeColor: planDetails.badgeColor,
      limits: planDetails.limits,
      allowedStudioFeatures: planDetails.allowedStudioFeatures,
      highlights: planDetails.highlights,
      hasCustomQuota: planDetails.hasCustomQuota,
      customQuota: userObj.customQuota || {},
      usage: {
        ...usage,
        notebooksUsed,
        totalDocuments
      }
    };
  },

  async checkQuota(userId, role = "user", actionType, payload = {}) {
    const status = await this.getUserPlanStatus(userId, role);
    const { plan, planName, limits, allowedStudioFeatures, usage } = status;

    if (actionType === "create_notebook") {
      if (usage.notebooksUsed >= limits.maxNotebooks) {
        const nextTier = plan === "free" ? "plus" : "pro";
        return {
          allowed: false,
          code: "PLAN_LIMIT_REACHED",
          limitType: "maxNotebooks",
          currentPlan: plan,
          requiredPlan: nextTier,
          used: usage.notebooksUsed,
          limit: limits.maxNotebooks,
          error: `${planName} plan limit reached: You have ${usage.notebooksUsed}/${limits.maxNotebooks} notebooks. Upgrade to ${nextTier.toUpperCase()} to create more notebooks.`
        };
      }
    } else if (actionType === "upload_document") {
      const notebookId = payload.notebookId;
      const newFilesCount = Number(payload.filesCount) || 1;
      const maxFileBytes = Number(payload.maxFileBytes) || 0;

      if (maxFileBytes > limits.maxFileSizeMB * 1024 * 1024) {
        const nextTier = plan === "free" ? "plus" : "pro";
        const fileMB = (maxFileBytes / (1024 * 1024)).toFixed(1);
        return {
          allowed: false,
          code: "PLAN_LIMIT_REACHED",
          limitType: "maxFileSizeMB",
          currentPlan: plan,
          requiredPlan: nextTier,
          used: Number(fileMB),
          limit: limits.maxFileSizeMB,
          error: `File size (${fileMB} MB) exceeds the ${planName} plan limit of ${limits.maxFileSizeMB} MB per file. Upgrade to ${nextTier.toUpperCase()} for larger uploads.`
        };
      }

      if (notebookId) {
        const existingDocs = await this.getDocuments(notebookId);
        const currentCount = Array.isArray(existingDocs) ? existingDocs.length : 0;
        if (currentCount + newFilesCount > limits.maxDocsPerNotebook) {
          const nextTier = plan === "free" ? "plus" : "pro";
          return {
            allowed: false,
            code: "PLAN_LIMIT_REACHED",
            limitType: "maxDocsPerNotebook",
            currentPlan: plan,
            requiredPlan: nextTier,
            used: currentCount,
            limit: limits.maxDocsPerNotebook,
            error: `${planName} plan limit reached: This notebook has ${currentCount}/${limits.maxDocsPerNotebook} sources. Upgrade to ${nextTier.toUpperCase()} to add up to ${getPlanConfig(nextTier).maxDocsPerNotebook} sources per notebook.`
          };
        }
      }
    } else if (actionType === "chat_query") {
      if (usage.chatQueriesToday >= limits.maxDailyChatQueries) {
        const nextTier = plan === "free" ? "plus" : "pro";
        return {
          allowed: false,
          code: "PLAN_LIMIT_REACHED",
          limitType: "maxDailyChatQueries",
          currentPlan: plan,
          requiredPlan: nextTier,
          used: usage.chatQueriesToday,
          limit: limits.maxDailyChatQueries,
          error: `Daily AI Chat quota reached (${usage.chatQueriesToday}/${limits.maxDailyChatQueries} queries on ${planName} plan). Upgrade to ${nextTier.toUpperCase()} for up to ${getPlanConfig(nextTier).maxDailyChatQueries} daily queries.`
        };
      }
    } else if (actionType === "studio_feature") {
      const featureId = payload.feature;
      if (featureId && !allowedStudioFeatures.includes(featureId)) {
        const minPlan = getMinimumPlanForFeature(featureId);
        const featureName = getFeatureLabel(featureId);
        return {
          allowed: false,
          code: "PLAN_FEATURE_LOCKED",
          limitType: "studioFeature",
          feature: featureId,
          featureName,
          currentPlan: plan,
          requiredPlan: minPlan,
          error: `${featureName} requires the ${minPlan.toUpperCase()} plan (you are currently on ${planName}). Upgrade your plan to unlock this Studio tool.`
        };
      }
      if (featureId !== "notes" && usage.studioGenerationsToday >= limits.maxDailyStudioGenerations) {
        const nextTier = plan === "free" ? "plus" : "pro";
        return {
          allowed: false,
          code: "PLAN_LIMIT_REACHED",
          limitType: "maxDailyStudioGenerations",
          currentPlan: plan,
          requiredPlan: nextTier,
          used: usage.studioGenerationsToday,
          limit: limits.maxDailyStudioGenerations,
          error: `Daily Studio generation limit reached (${usage.studioGenerationsToday}/${limits.maxDailyStudioGenerations} generations on ${planName} plan). Upgrade to ${nextTier.toUpperCase()} for more daily AI studio generations.`
        };
      }
    }

    return { allowed: true, status };
  },

  async incrementUserUsage(userId, type = "chat") {
    const today = getTodayKey();
    const now = new Date();
    const isGuest = !userId || userId === "guest" || String(userId).startsWith("guest_");

    if (isGuest) {
      const key = String(userId || "guest");
      const current = normalizeUsage(guestUsageMap[key]);
      if (type === "chat") {
        current.chatQueriesToday += 1;
        current.totalChatQueries += 1;
      } else if (type === "studio") {
        current.studioGenerationsToday += 1;
        current.totalStudioGenerations += 1;
      }
      current.lastActiveAt = now.toISOString();
      guestUsageMap[key] = current;
      return current;
    }

    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const user = await User.findById(userId);
      if (!user) return null;
      const current = normalizeUsage(user.usage);
      if (type === "chat") {
        current.chatQueriesToday += 1;
        current.totalChatQueries += 1;
      } else if (type === "studio") {
        current.studioGenerationsToday += 1;
        current.totalStudioGenerations += 1;
      }
      current.lastActiveAt = now;
      user.usage = current;
      await user.save();
      return current;
    }

    const user = (memoryDb.users || []).find(u => String(u._id) === String(userId));
    if (!user) return null;
    const current = normalizeUsage(user.usage);
    if (type === "chat") {
      current.chatQueriesToday += 1;
      current.totalChatQueries += 1;
    } else if (type === "studio") {
      current.studioGenerationsToday += 1;
      current.totalStudioGenerations += 1;
    }
    current.lastActiveAt = now.toISOString();
    user.usage = current;
    saveLocalFile();
    return current;
  },

  async updateUserPlan(userId, newPlan, customQuota = undefined) {
    const cleanPlan = String(newPlan || "").toLowerCase();
    if (!["free", "plus", "pro"].includes(cleanPlan)) {
      return { error: "Invalid plan tier. Choose free, plus, or pro." };
    }

    const sanitizedQuota = customQuota !== undefined ? {
      maxNotebooks: customQuota?.maxNotebooks ? Number(customQuota.maxNotebooks) : null,
      maxDocsPerNotebook: customQuota?.maxDocsPerNotebook ? Number(customQuota.maxDocsPerNotebook) : null,
      maxDailyChatQueries: customQuota?.maxDailyChatQueries ? Number(customQuota.maxDailyChatQueries) : null,
      maxDailyStudioGenerations: customQuota?.maxDailyStudioGenerations ? Number(customQuota.maxDailyStudioGenerations) : null
    } : undefined;

    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const updateFields = { plan: cleanPlan, planUpdatedAt: new Date() };
      if (sanitizedQuota !== undefined) {
        updateFields.customQuota = sanitizedQuota;
      }
      const updated = await User.findByIdAndUpdate(userId, { $set: updateFields }, { new: true }).select("-password").lean();
      if (!updated) return null;
      return {
        ...updated,
        ...resolveUserPlanDetails(updated),
        usage: normalizeUsage(updated.usage)
      };
    }

    const user = (memoryDb.users || []).find(u => String(u._id) === String(userId));
    if (!user) return null;
    user.plan = cleanPlan;
    user.planUpdatedAt = new Date().toISOString();
    if (sanitizedQuota !== undefined) {
      user.customQuota = sanitizedQuota;
    }
    saveLocalFile();
    const { password, ...rest } = user;
    return {
      ...rest,
      ...resolveUserPlanDetails(rest),
      usage: normalizeUsage(rest.usage)
    };
  },

  async resetUserQuota(userId) {
    const today = getTodayKey();
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const user = await User.findById(userId);
      if (!user) return null;
      const cur = normalizeUsage(user.usage);
      user.usage = {
        ...cur,
        dateKey: today,
        chatQueriesToday: 0,
        studioGenerationsToday: 0
      };
      await user.save();
      return user.usage;
    }

    const user = (memoryDb.users || []).find(u => String(u._id) === String(userId));
    if (!user) return null;
    const cur = normalizeUsage(user.usage);
    user.usage = {
      ...cur,
      dateKey: today,
      chatQueriesToday: 0,
      studioGenerationsToday: 0
    };
    saveLocalFile();
    return user.usage;
  },

  // --- Users & Auth ---
  async getUsers() {
    let users = [];
    let notebooks = [];
    let documents = [];
    let messages = [];

    if (isMongo) {
      [users, notebooks, documents, messages] = await Promise.all([
        User.find().select("-password").sort({ createdAt: -1 }).lean(),
        Notebook.find().select("userId title").lean(),
        Document.find().select("notebookId pageCount charCount chunks status").lean(),
        Message.find().select("notebookId role").lean()
      ]);
    } else {
      users = (memoryDb.users || []).map(({ password, ...u }) => u);
      notebooks = memoryDb.notebooks || [];
      documents = memoryDb.documents || [];
      messages = memoryDb.messages || [];
    }

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
    const userPages = {};
    const userChars = {};
    const userChunks = {};
    documents.forEach(d => {
      const nid = d.notebookId ? String(d.notebookId) : null;
      if (nid) {
        for (const [uid, nSet] of Object.entries(userNbs)) {
          if (nSet.has(nid)) {
            userDocs[uid] = (userDocs[uid] || 0) + 1;
            userPages[uid] = (userPages[uid] || 0) + (d.pageCount || 0);
            userChars[uid] = (userChars[uid] || 0) + (d.charCount || 0);
            userChunks[uid] = (userChunks[uid] || 0) + (Array.isArray(d.chunks) ? d.chunks.length : 0);
          }
        }
      }
    });

    const userMsgs = {};
    messages.forEach(m => {
      if (m.role && m.role !== "user") return;
      const nid = m.notebookId ? String(m.notebookId) : null;
      if (nid) {
        for (const [uid, nSet] of Object.entries(userNbs)) {
          if (nSet.has(nid)) {
            userMsgs[uid] = (userMsgs[uid] || 0) + 1;
          }
        }
      }
    });

    return users.map(u => {
      const uid = String(u._id);
      const planInfo = resolveUserPlanDetails(u);
      const usage = normalizeUsage(u.usage);
      const notebookCount = nbMap[uid] || 0;
      const documentCount = userDocs[uid] || 0;
      const totalChatQueries = Math.max(usage.totalChatQueries, userMsgs[uid] || 0);

      return {
        ...u,
        status: u.status || "active",
        plan: planInfo.plan,
        planName: planInfo.planName,
        priceLabel: planInfo.priceLabel,
        badgeColor: planInfo.badgeColor,
        limits: planInfo.limits,
        hasCustomQuota: planInfo.hasCustomQuota,
        customQuota: u.customQuota || {},
        usage: {
          ...usage,
          totalChatQueries
        },
        notebookCount,
        documentCount,
        totalPages: userPages[uid] || 0,
        totalChars: userChars[uid] || 0,
        totalChunks: userChunks[uid] || 0,
        utilization: {
          notebooksPct: Math.min(100, Math.round((notebookCount / Math.max(1, planInfo.limits.maxNotebooks)) * 100)),
          chatDailyPct: Math.min(100, Math.round((usage.chatQueriesToday / Math.max(1, planInfo.limits.maxDailyChatQueries)) * 100)),
          studioDailyPct: Math.min(100, Math.round((usage.studioGenerationsToday / Math.max(1, planInfo.limits.maxDailyStudioGenerations)) * 100))
        }
      };
    });
  },

  async getUserByEmail(email) {
    const cleanEmail = (email || "").toLowerCase().trim();
    if (isMongo) return await User.findOne({ email: cleanEmail });
    return memoryDb.users.find(u => u.email === cleanEmail) || null;
  },

  async getUserById(id) {
    let user = null;
    let notebooks = [];
    let docs = [];
    let messagesCount = 0;
    let artifactsCount = 0;

    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      user = await User.findById(id).select("-password").lean();
      if (!user) return null;
      notebooks = await Notebook.find({
        $or: [{ userId: id }, { userId: new mongoose.Types.ObjectId(id) }]
      }).select("title icon color createdAt updatedAt").lean();
      const nbIds = notebooks.map(n => n._id);
      if (nbIds.length > 0) {
        docs = await Document.find({ notebookId: { $in: nbIds } }).select("notebookId filename pageCount charCount chunks status createdAt").lean();
        messagesCount = await Message.countDocuments({ notebookId: { $in: nbIds }, role: "user" });
        artifactsCount = await Artifact.countDocuments({ notebookId: { $in: nbIds } });
      }
    } else {
      const u = memoryDb.users.find(user => String(user._id) === String(id));
      if (!u) return null;
      const { password, ...userWithoutPass } = u;
      user = userWithoutPass;
      notebooks = (memoryDb.notebooks || []).filter(n => String(n.userId) === String(id));
      const nbSet = new Set(notebooks.map(n => String(n._id)));
      docs = (memoryDb.documents || []).filter(d => nbSet.has(String(d.notebookId)));
      messagesCount = (memoryDb.messages || []).filter(m => nbSet.has(String(m.notebookId)) && m.role === "user").length;
      artifactsCount = (memoryDb.artifacts || []).filter(a => nbSet.has(String(a.notebookId))).length;
    }

    const planInfo = resolveUserPlanDetails(user);
    const usage = normalizeUsage(user.usage);

    const docByNb = {};
    let totalPages = 0;
    let totalChars = 0;
    let totalChunks = 0;
    docs.forEach(d => {
      const nid = String(d.notebookId);
      docByNb[nid] = (docByNb[nid] || 0) + 1;
      totalPages += d.pageCount || 0;
      totalChars += d.charCount || 0;
      totalChunks += Array.isArray(d.chunks) ? d.chunks.length : 0;
    });

    const enrichedNotebooks = notebooks.map(nb => ({
      ...nb,
      documentCount: docByNb[String(nb._id)] || 0
    }));

    return {
      ...user,
      status: user.status || "active",
      plan: planInfo.plan,
      planName: planInfo.planName,
      priceLabel: planInfo.priceLabel,
      badgeColor: planInfo.badgeColor,
      limits: planInfo.limits,
      allowedStudioFeatures: planInfo.allowedStudioFeatures,
      hasCustomQuota: planInfo.hasCustomQuota,
      customQuota: user.customQuota || {},
      usage: {
        ...usage,
        totalChatQueries: Math.max(usage.totalChatQueries, messagesCount),
        totalStudioGenerations: Math.max(usage.totalStudioGenerations, artifactsCount)
      },
      notebooks: enrichedNotebooks,
      notebookCount: enrichedNotebooks.length,
      documentCount: docs.length,
      totalPages,
      totalChars,
      totalChunks,
      artifactsCount
    };
  },

  async createUser(userData) {
    const cleanEmail = (userData.email || "").toLowerCase().trim();
    let hashedPassword = null;
    if (userData.password) {
      hashedPassword = await bcrypt.hash(userData.password, 10);
    }
    const defaultPlan = userData.plan || (userData.role === "admin" ? "pro" : "free");

    if (isMongo) {
      const newUser = await User.create({
        name: userData.name || "Student",
        email: cleanEmail,
        password: hashedPassword,
        googleId: userData.googleId || null,
        avatar: userData.avatar || "",
        role: userData.role || "user",
        status: userData.status || "active",
        plan: defaultPlan,
        usage: normalizeUsage({})
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
      plan: defaultPlan,
      usage: normalizeUsage({}),
      customQuota: {},
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
    let users = [];
    let notebookCount = 0;
    let documentCount = 0;
    let messageCount = 0;
    let docs = [];
    let artifacts = [];
    let notesCount = 0;
    let recentUsers = [];
    let recentDocs = [];
    let recentLogs = [];

    if (isMongo) {
      [
        users,
        notebookCount,
        documentCount,
        messageCount,
        docs,
        artifacts,
        notesCount,
        recentUsers,
        recentDocs,
        recentLogs
      ] = await Promise.all([
        User.find().select("-password").lean(),
        Notebook.countDocuments(),
        Document.countDocuments(),
        Message.countDocuments(),
        Document.find().select("chunks filename pageCount charCount status").lean(),
        Artifact.find().select("type").lean(),
        Note.countDocuments(),
        User.find().select("-password").sort({ createdAt: -1 }).limit(6).lean(),
        Document.find().select("filename pageCount charCount chunks status notebookId createdAt").sort({ createdAt: -1 }).limit(6).lean(),
        AuditLog.find().sort({ timestamp: -1 }).limit(8).lean()
      ]);
    } else {
      users = (memoryDb.users || []).map(({ password, ...u }) => u);
      notebookCount = (memoryDb.notebooks || []).length;
      documentCount = (memoryDb.documents || []).length;
      messageCount = (memoryDb.messages || []).length;
      docs = memoryDb.documents || [];
      artifacts = memoryDb.artifacts || [];
      notesCount = (memoryDb.notes || []).length;
      recentUsers = users.slice(0, 6);
      recentDocs = docs.slice(0, 6);
      recentLogs = (memoryDb.auditLogs || []).slice(0, 8);
    }

    let totalChunks = 0;
    let embeddedChunksCount = 0;
    let totalPages = 0;
    let totalChars = 0;
    const docStatusCounts = { ready: 0, processing: 0, failed: 0 };

    docs.forEach(d => {
      const s = d.status || "processing";
      docStatusCounts[s] = (docStatusCounts[s] || 0) + 1;
      totalPages += d.pageCount || 0;
      totalChars += d.charCount || 0;
      if (d.chunks && Array.isArray(d.chunks)) {
        totalChunks += d.chunks.length;
        embeddedChunksCount += d.chunks.filter(c => c.embedding && c.embedding.length > 0).length;
      }
    });

    const artifactBreakdown = {
      flashcards: 0,
      quiz: 0,
      mindmap: 0,
      slides: 0,
      briefing: 0,
      "important-questions": 0,
      "data-table": 0,
      compare: 0,
      "audio-overview": 0,
      images: 0,
      video: 0
    };
    artifacts.forEach(a => {
      if (a && a.type) {
        artifactBreakdown[a.type] = (artifactBreakdown[a.type] || 0) + 1;
      }
    });

    const planCounts = { free: 0, plus: 0, pro: 0 };
    let estimatedMonthlyRevenue = 0;
    let chatQueriesToday = 0;
    let studioGenerationsToday = 0;
    let usersNearQuota = 0;
    const plansCfg = getPlans();

    users.forEach(u => {
      const pInfo = resolveUserPlanDetails(u);
      const tier = pInfo.plan || "free";
      planCounts[tier] = (planCounts[tier] || 0) + 1;
      if (u.role !== "admin") {
        estimatedMonthlyRevenue += Number(plansCfg[tier]?.priceMonthly || 0);
      }
      const uUsage = normalizeUsage(u.usage);
      chatQueriesToday += uUsage.chatQueriesToday;
      studioGenerationsToday += uUsage.studioGenerationsToday;
      if (
        uUsage.chatQueriesToday >= Math.max(1, pInfo.limits.maxDailyChatQueries * 0.8) ||
        uUsage.studioGenerationsToday >= Math.max(1, pInfo.limits.maxDailyStudioGenerations * 0.8)
      ) {
        usersNearQuota += 1;
      }
    });

    const embeddingCoveragePct = totalChunks > 0
      ? Math.round((embeddedChunksCount / totalChunks) * 100)
      : 100;

    return {
      userCount: users.length,
      notebookCount,
      documentCount,
      totalPages,
      totalChars,
      totalChunks,
      embeddedChunksCount,
      embeddingCoveragePct,
      messageCount,
      flashcardsCount: artifactBreakdown.flashcards || 0,
      quizCount: artifactBreakdown.quiz || 0,
      mindmapCount: artifactBreakdown.mindmap || 0,
      slidesCount: artifactBreakdown.slides || 0,
      visualsCount: (artifactBreakdown.images || 0) + (artifactBreakdown.video || 0),
      totalArtifactsCount: artifacts.length,
      artifactBreakdown,
      notesCount,
      docStatusCounts,
      planBreakdown: {
        ...planCounts,
        paidUsers: (planCounts.plus || 0) + (planCounts.pro || 0),
        conversionRatePct: users.length > 0 ? Math.round((((planCounts.plus || 0) + (planCounts.pro || 0)) / users.length) * 100) : 0,
        estimatedMonthlyRevenue
      },
      quotaTelemetry: {
        chatQueriesToday,
        studioGenerationsToday,
        usersNearQuota
      },
      recentUsers: recentUsers.map(u => {
        const p = resolveUserPlanDetails(u);
        return {
          ...u,
          status: u.status || "active",
          plan: p.plan,
          planName: p.planName,
          usage: normalizeUsage(u.usage)
        };
      }),
      recentDocuments: recentDocs.map(d => ({
        _id: d._id,
        filename: d.filename,
        pageCount: d.pageCount || 0,
        charCount: d.charCount || 0,
        chunkCount: d.chunks ? d.chunks.length : 0,
        embeddedCount: d.chunks ? d.chunks.filter(c => c.embedding && c.embedding.length > 0).length : 0,
        status: d.status,
        createdAt: d.createdAt
      })),
      recentAuditLogs: recentLogs
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
      generationModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      generationFallbackModel: "gemini-2.5-flash-lite",
      geminiConfigured: hasGeminiKey,
      totalDocuments: docs.length,
      documentsReady,
      documentsNeedingReindex,
      totalChunks,
      embeddedChunks,
      embeddingCoveragePct: totalChunks > 0 ? Math.round((embeddedChunks / totalChunks) * 100) : 100,
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
        label: isMongo ? "MongoDB Atlas Cluster" : "Zero-Config In-Memory Storage",
        details: isMongo ? "MongoDB Active" : "server/data/local_db.json"
      },
      geminiApi: {
        status: hasGeminiKey ? "Configured" : "Not configured",
        configured: hasGeminiKey,
        primaryModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
        fallbackModel: "gemini-2.5-flash-lite",
        embeddingModel: "gemini-embedding-2-preview"
      },
      pdfExtraction: {
        status: "Available",
        engine: "pdf.js & unpdf parser"
      },
      ocrExtraction: {
        status: "Available",
        engine: "Tesseract.js Parallel OCR Pool (3 workers)"
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
    let artifacts = [];
    let messages = [];

    if (isMongo) {
      [users, notebooks, docs, artifacts, messages] = await Promise.all([
        User.find().select("-password").lean(),
        Notebook.find().select("createdAt userId title").lean(),
        Document.find().select("createdAt pageCount charCount chunks status filename").lean(),
        Artifact.find().select("type updatedAt notebookId").lean(),
        Message.find().select("notebookId role createdAt").lean()
      ]);
    } else {
      users = (memoryDb.users || []).map(({ password, ...u }) => u);
      notebooks = (memoryDb.notebooks || []).map(n => ({ _id: n._id, createdAt: n.createdAt, userId: n.userId, title: n.title }));
      docs = (memoryDb.documents || []).map(d => ({ createdAt: d.createdAt, pageCount: d.pageCount, charCount: d.charCount, chunks: d.chunks, status: d.status, filename: d.filename }));
      artifacts = memoryDb.artifacts || [];
      messages = memoryDb.messages || [];
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
    let totalPages = 0;
    let totalChunks = 0;
    let embeddedChunks = 0;
    docs.forEach(d => {
      const s = d.status || "processing";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
      totalChars += d.charCount || 0;
      totalPages += d.pageCount || 0;
      const ch = d.chunks || [];
      totalChunks += ch.length;
      embeddedChunks += ch.filter(c => c.embedding && c.embedding.length > 0).length;
    });

    const planCounts = { free: 0, plus: 0, pro: 0 };
    let mrr = 0;
    const plansCfg = getPlans();
    users.forEach(u => {
      const p = resolveUserPlanDetails(u);
      planCounts[p.plan] = (planCounts[p.plan] || 0) + 1;
      if (u.role !== "admin") {
        mrr += Number(plansCfg[p.plan]?.priceMonthly || 0);
      }
    });

    const studioToolBreakdown = {};
    artifacts.forEach(a => {
      if (a && a.type) {
        studioToolBreakdown[a.type] = (studioToolBreakdown[a.type] || 0) + 1;
      }
    });

    return {
      usersOverTime,
      notebooksOverTime,
      documentsOverTime,
      totalUsers: users.length,
      totalNotebooks: notebooks.length,
      totalDocuments: docs.length,
      totalMessages: messages.length,
      totalArtifacts: artifacts.length,
      documentStatusBreakdown: statusCounts,
      totalExtractedCharacters: totalChars,
      totalPagesExtracted: totalPages,
      totalChunksCreated: totalChunks,
      embeddedChunksCount: embeddedChunks,
      embeddingCoveragePct: totalChunks > 0 ? Math.round((embeddedChunks / totalChunks) * 100) : 100,
      averageChunksPerDocument: docs.length ? Math.round((totalChunks / docs.length) * 10) / 10 : 0,
      planBreakdown: {
        ...planCounts,
        estimatedMonthlyRevenue: mrr
      },
      studioToolBreakdown
    };
  },

  async getDatabaseExplorer(collectionName = "users", limit = 25) {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const SystemSetting = require("../models/SystemSetting");

    if (isMongo) {
      const [
        usersCount,
        settingsCount,
        notebooksCount,
        documentsCount,
        messagesCount,
        artifactsCount,
        notesCount,
        collectionsCount,
        auditLogsCount
      ] = await Promise.all([
        User.countDocuments(),
        SystemSetting.countDocuments(),
        Notebook.countDocuments(),
        Document.countDocuments(),
        Message.countDocuments(),
        Artifact.countDocuments(),
        Note.countDocuments(),
        Collection.countDocuments(),
        AuditLog.countDocuments()
      ]);

      let records = [];
      switch (collectionName) {
        case "users":
          records = await User.find().select("-password").sort({ createdAt: -1 }).limit(safeLimit).lean();
          break;
        case "systemsettings":
          records = await SystemSetting.find().sort({ updatedAt: -1 }).limit(safeLimit).lean();
          break;
        case "notebooks":
          records = await Notebook.find().sort({ updatedAt: -1 }).limit(safeLimit).lean();
          break;
        case "documents":
          const rawDocs = await Document.find()
            .select("filename notebookId mimeType pageCount charCount status summary keyTopics chunks createdAt updatedAt")
            .sort({ createdAt: -1 })
            .limit(safeLimit)
            .lean();
          records = rawDocs.map(d => ({
            _id: d._id,
            filename: d.filename,
            notebookId: d.notebookId,
            mimeType: d.mimeType,
            pageCount: d.pageCount,
            charCount: d.charCount,
            status: d.status,
            chunksCount: Array.isArray(d.chunks) ? d.chunks.length : 0,
            embeddedChunksCount: Array.isArray(d.chunks) ? d.chunks.filter(c => c.embedding && c.embedding.length > 0).length : 0,
            keyTopics: d.keyTopics || [],
            summary: (d.summary || "").slice(0, 200),
            createdAt: d.createdAt,
            updatedAt: d.updatedAt
          }));
          break;
        case "messages":
          records = await Message.find().sort({ createdAt: -1 }).limit(safeLimit).lean();
          break;
        case "artifacts":
          const rawArts = await Artifact.find().sort({ updatedAt: -1 }).limit(safeLimit).lean();
          records = rawArts.map(a => ({
            _id: a._id,
            notebookId: a.notebookId,
            type: a.type,
            updatedAt: a.updatedAt,
            dataPreview: JSON.stringify(a.data || {}).slice(0, 350) + (JSON.stringify(a.data || {}).length > 350 ? "..." : "")
          }));
          break;
        case "notes":
          records = await Note.find().sort({ createdAt: -1 }).limit(safeLimit).lean();
          break;
        case "collections":
          records = await Collection.find().sort({ updatedAt: -1 }).limit(safeLimit).lean();
          break;
        case "auditlogs":
          records = await AuditLog.find().sort({ timestamp: -1 }).limit(safeLimit).lean();
          break;
        default:
          records = await User.find().select("-password").limit(safeLimit).lean();
      }

      return {
        mode: "MongoDB Atlas (studyvault)",
        activeCollection: collectionName,
        collections: [
          { id: "users", label: "users (Accounts, Plans & Quotas)", count: usersCount },
          { id: "systemsettings", label: "systemsettings (Global Plan Rules)", count: settingsCount },
          { id: "notebooks", label: "notebooks (Study Workspaces)", count: notebooksCount },
          { id: "documents", label: "documents (Sources & Vector Chunks)", count: documentsCount },
          { id: "messages", label: "messages (RAG Chat History)", count: messagesCount },
          { id: "artifacts", label: "artifacts (Studio Generations)", count: artifactsCount },
          { id: "notes", label: "notes (Pinned Student Notes)", count: notesCount },
          { id: "collections", label: "collections (Library Folders)", count: collectionsCount },
          { id: "auditlogs", label: "auditlogs (Admin & Plan Audit Trail)", count: auditLogsCount }
        ],
        records
      };
    }

    const colMap = {
      users: (memoryDb.users || []).map(({ password, ...u }) => u),
      systemsettings: [{ key: "subscription_plans", value: getPlans() }],
      notebooks: memoryDb.notebooks || [],
      documents: (memoryDb.documents || []).map(d => ({
        _id: d._id,
        filename: d.filename,
        notebookId: d.notebookId,
        pageCount: d.pageCount,
        charCount: d.charCount,
        status: d.status,
        chunksCount: (d.chunks || []).length
      })),
      messages: memoryDb.messages || [],
      artifacts: memoryDb.artifacts || [],
      notes: memoryDb.notes || [],
      collections: memoryDb.collections || [],
      auditlogs: memoryDb.auditLogs || []
    };

    return {
      mode: "Local JSON Storage (server/data/local_db.json)",
      activeCollection: collectionName,
      collections: Object.keys(colMap).map(k => ({
        id: k,
        label: k,
        count: (colMap[k] || []).length
      })),
      records: (colMap[collectionName] || []).slice(0, safeLimit)
    };
  }
};

module.exports = store;
