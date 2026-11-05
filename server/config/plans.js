const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const SystemSetting = require("../models/SystemSetting");

const os = require("os");
const BUNDLED_PLAN_CONFIG_PATH = path.join(__dirname, "..", "data", "plan_config.json");
const PLAN_CONFIG_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), "studyvault_data", "plan_config.json")
  : BUNDLED_PLAN_CONFIG_PATH;

const ALL_STUDIO_FEATURES = [
  { id: "flashcards", label: "Flashcards Deck", minTier: "free" },
  { id: "quiz", label: "Practice Quiz", minTier: "free" },
  { id: "important-questions", label: "Important Exam Questions (2M/5M/10M)", minTier: "free" },
  { id: "briefing", label: "Executive Briefing Report", minTier: "free" },
  { id: "notes", label: "Notes Pinboard", minTier: "free" },
  { id: "mindmap", label: "Concept Mind Map", minTier: "plus" },
  { id: "slides", label: "Slide Deck Generator", minTier: "plus" },
  { id: "data-table", label: "Structured Data Table", minTier: "plus" },
  { id: "compare", label: "Multi-Source Comparison Matrix", minTier: "plus" },
  { id: "audio-overview", label: "Audio Overview Podcast", minTier: "plus" },
  { id: "images", label: "AI Visual & Diagram Studio", minTier: "pro" },
  { id: "video", label: "AI Video Explainer Lecture", minTier: "pro" }
];

const DEFAULT_PLANS = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Starter Study Plan",
    priceMonthly: 0,
    priceLabel: "$0 / mo",
    badgeColor: "#94a3b8",
    maxNotebooks: 2,
    maxDocsPerNotebook: 3,
    maxFileSizeMB: 10,
    maxPagesPerDoc: 25,
    maxDailyChatQueries: 15,
    maxDailyStudioGenerations: 4,
    ragTopK: 6,
    allowOcr: true,
    allowedStudioFeatures: [
      "flashcards",
      "quiz",
      "important-questions",
      "briefing",
      "notes"
    ],
    highlights: [
      "Up to 2 study notebooks & 3 sources/notebook",
      "10 MB / 25 pages max per uploaded document",
      "15 grounded AI chat queries per day",
      "4 Studio generations per day (Flashcards, Quiz, Exam Qs, Briefing)"
    ]
  },
  plus: {
    id: "plus",
    name: "Plus",
    tagline: "Scholar & Exam Prep",
    priceMonthly: 9,
    priceLabel: "$9 / mo",
    badgeColor: "#38bdf8",
    maxNotebooks: 12,
    maxDocsPerNotebook: 15,
    maxFileSizeMB: 35,
    maxPagesPerDoc: 100,
    maxDailyChatQueries: 100,
    maxDailyStudioGenerations: 30,
    ragTopK: 10,
    allowOcr: true,
    allowedStudioFeatures: [
      "flashcards",
      "quiz",
      "important-questions",
      "briefing",
      "notes",
      "mindmap",
      "slides",
      "data-table",
      "compare",
      "audio-overview"
    ],
    highlights: [
      "Up to 12 study notebooks & 15 sources/notebook",
      "35 MB / 100 pages max per uploaded document",
      "100 grounded AI chat queries per day",
      "30 Studio generations/day + Mind Maps, Slides, Data Tables, Audio Podcast & Multi-Doc Compare"
    ]
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Unlimited Research & Visual Studio",
    priceMonthly: 19,
    priceLabel: "$19 / mo",
    badgeColor: "#a855f7",
    maxNotebooks: 100,
    maxDocsPerNotebook: 50,
    maxFileSizeMB: 100,
    maxPagesPerDoc: 500,
    maxDailyChatQueries: 500,
    maxDailyStudioGenerations: 150,
    ragTopK: 16,
    allowOcr: true,
    allowedStudioFeatures: [
      "flashcards",
      "quiz",
      "important-questions",
      "briefing",
      "notes",
      "mindmap",
      "slides",
      "data-table",
      "compare",
      "audio-overview",
      "images",
      "video"
    ],
    highlights: [
      "Up to 100 notebooks & 50 sources/notebook",
      "100 MB / 500 pages max per document with priority OCR",
      "500 grounded AI chat queries/day with Deep Hybrid RAG (topK=16)",
      "150 Studio generations/day + Full AI Visual Diagram Studio & Video Explainer Lectures"
    ]
  }
};

let runtimePlans = JSON.parse(JSON.stringify(DEFAULT_PLANS));

function loadSavedPlans() {
  try {
    const targetPath = fs.existsSync(PLAN_CONFIG_PATH)
      ? PLAN_CONFIG_PATH
      : (fs.existsSync(BUNDLED_PLAN_CONFIG_PATH) ? BUNDLED_PLAN_CONFIG_PATH : null);
    if (targetPath) {
      const parsed = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
      for (const tier of ["free", "plus", "pro"]) {
        if (parsed[tier]) {
          runtimePlans[tier] = {
            ...DEFAULT_PLANS[tier],
            ...parsed[tier],
            id: tier
          };
        }
      }
    }
  } catch (err) {
    console.warn("[plans] Could not load saved plan config:", err.message);
  }
}

function savePlans() {
  try {
    const dir = path.dirname(PLAN_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PLAN_CONFIG_PATH, JSON.stringify(runtimePlans, null, 2), "utf-8");
  } catch (err) {
    console.error("[plans] Could not save plan config:", err.message);
  }

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    SystemSetting.findOneAndUpdate(
      { key: "subscription_plans" },
      { $set: { value: runtimePlans, updatedAt: new Date() } },
      { upsert: true, new: true }
    ).catch((err) => console.warn("[plans] Mongo sync warning:", err.message));
  }
}

async function syncPlansWithDatabase() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
  try {
    const doc = await SystemSetting.findOne({ key: "subscription_plans" }).lean();
    if (doc && doc.value) {
      for (const tier of ["free", "plus", "pro"]) {
        if (doc.value[tier]) {
          runtimePlans[tier] = {
            ...DEFAULT_PLANS[tier],
            ...doc.value[tier],
            id: tier
          };
        }
      }
    } else {
      await SystemSetting.findOneAndUpdate(
        { key: "subscription_plans" },
        { $set: { value: runtimePlans, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn("[plans] Could not sync plans from MongoDB:", err.message);
  }
}

loadSavedPlans();

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function getPlans() {
  return runtimePlans;
}

function getPlanConfig(planId = "free", role = "user") {
  const normalized = String(planId || (role === "admin" ? "pro" : "free")).toLowerCase();
  return runtimePlans[normalized] || runtimePlans.free;
}

function updatePlanConfig(tier, updates = {}) {
  const cleanTier = String(tier || "").toLowerCase();
  if (!runtimePlans[cleanTier]) {
    throw new Error(`Invalid plan tier: ${tier}`);
  }
  const current = runtimePlans[cleanTier];
  const numericFields = [
    "priceMonthly",
    "maxNotebooks",
    "maxDocsPerNotebook",
    "maxFileSizeMB",
    "maxPagesPerDoc",
    "maxDailyChatQueries",
    "maxDailyStudioGenerations",
    "ragTopK"
  ];

  const next = { ...current };
  for (const key of numericFields) {
    if (updates[key] !== undefined && !Number.isNaN(Number(updates[key]))) {
      next[key] = Math.max(0, Number(updates[key]));
    }
  }
  if (typeof updates.name === "string" && updates.name.trim()) {
    next.name = updates.name.trim();
  }
  if (typeof updates.tagline === "string") {
    next.tagline = updates.tagline.trim();
  }
  if (typeof updates.priceLabel === "string" && updates.priceLabel.trim()) {
    next.priceLabel = updates.priceLabel.trim();
  } else if (updates.priceMonthly !== undefined) {
    next.priceLabel = `$${next.priceMonthly} / mo`;
  }
  if (Array.isArray(updates.allowedStudioFeatures)) {
    next.allowedStudioFeatures = updates.allowedStudioFeatures.filter(Boolean);
  }
  if (Array.isArray(updates.highlights)) {
    next.highlights = updates.highlights.filter(Boolean);
  }

  runtimePlans[cleanTier] = next;
  savePlans();
  return runtimePlans[cleanTier];
}

function resetPlansToDefault() {
  runtimePlans = JSON.parse(JSON.stringify(DEFAULT_PLANS));
  savePlans();
  return runtimePlans;
}

function getMinimumPlanForFeature(featureId) {
  for (const tier of ["free", "plus", "pro"]) {
    const cfg = runtimePlans[tier];
    if (cfg && Array.isArray(cfg.allowedStudioFeatures) && cfg.allowedStudioFeatures.includes(featureId)) {
      return tier;
    }
  }
  return "pro";
}

function getFeatureLabel(featureId) {
  const found = ALL_STUDIO_FEATURES.find((f) => f.id === featureId);
  return found ? found.label : featureId;
}

module.exports = {
  ALL_STUDIO_FEATURES,
  DEFAULT_PLANS,
  getTodayKey,
  getPlans,
  getPlanConfig,
  updatePlanConfig,
  resetPlansToDefault,
  getMinimumPlanForFeature,
  getFeatureLabel,
  syncPlansWithDatabase
};
