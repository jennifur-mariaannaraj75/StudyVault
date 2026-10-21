const API = "/api";

const state = {
  notebooks: [],
  currentId: null,
  documents: [],
  messages: [],
  notes: [],
  activeMode: "chat",
  geminiApiKey: localStorage.getItem("notebooklm_gemini_key") || "",
  geminiModel: ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"].includes(localStorage.getItem("notebooklm_gemini_model")) ? localStorage.getItem("notebooklm_gemini_model") : "gemini-3.8-flash",
  audioScript: null,
  isPlayingAudio: false,
  audioTurnIndex: 0,
  audioSpeed: 1.0,
  flashcards: null,
  cardIndex: 0,
  cardRatings: {}, // { cardId: 'easy' | 'med' | 'hard' }
  quiz: null,
  quizAnswers: {},
  mindmap: null,
  briefing: null,
  compare: null,
  importantQuestions: null,
  examFilter: "all",
  slides: null,
  currentSlideIndex: 0,
  dataTable: null,
  activeStudioCategory: "study",
  activeStudioTool: "tabFlashcards",
  categoryLastTool: {
    study: "tabFlashcards",
    synthesis: "tabOverview",
    media: "tabImages"
  },
  visuals: [],
  activeVisual: null,
  videoProject: null,
  activePdfDoc: null,
  currentPdfPage: 1,
  pollTimer: null,
  answerStyle: "study-notes",
};

// --- DOM References ---
const notebookList = document.getElementById("notebookList");
const notebookTitle = document.getElementById("notebookTitle");
const storagePill = document.getElementById("storagePill");
const sourcesRailInner = document.getElementById("sourcesRailInner");
const sourceCount = document.getElementById("sourceCount");
const chatLog = document.getElementById("chatLog");
const chatEmpty = document.getElementById("chatEmpty");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const toast = document.getElementById("toast");

// Action Modes & Search
const chipModes = [];
const searchSourcesBtn = document.getElementById("searchSourcesBtn");
const sourceSearchBox = document.getElementById("sourceSearchBox");
const sourceSearchInput = document.getElementById("sourceSearchInput");

// Add Source Elements
const addSourceMenuBtn = document.getElementById("addSourceMenuBtn");
const addSourceDropdown = document.getElementById("addSourceDropdown");
const fileInput = document.getElementById("fileInput");

// Studio Tabs
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

// Settings Modal Elements
const settingsModal = document.getElementById("settingsModal");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");
const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
const geminiModelSelect = document.getElementById("geminiModelSelect");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

// Export Buttons
const exportBriefingMdBtn = document.getElementById("exportBriefingMdBtn");
const exportAnkiCsvBtn = document.getElementById("exportAnkiCsvBtn");

// Spaced Repetition Mastery Elements
const masteryBarWrapper = document.getElementById("masteryBarWrapper");
const masteryPercent = document.getElementById("masteryPercent");
const masteryCount = document.getElementById("masteryCount");
const masteryFill = document.getElementById("masteryFill");

// Audio Overview Player Elements
const generateAudioBtn = document.getElementById("generateAudioBtn");
const podcastPlayerCard = document.getElementById("podcastPlayerCard");
const waveformCanvas = document.getElementById("waveformCanvas");
const btnAudioPlay = document.getElementById("btnAudioPlay");
const btnAudioSkipBack = document.getElementById("btnAudioSkipBack");
const btnAudioSkipFwd = document.getElementById("btnAudioSkipFwd");
const audioSpeedSelect = document.getElementById("audioSpeedSelect");
const transcriptContainer = document.getElementById("transcriptContainer");

// Study Buttons
const generateBriefingBtn = document.getElementById("generateBriefingBtn");
const briefingContent = document.getElementById("briefingContent");
const generateCardsBtn = document.getElementById("generateCardsBtn");
const flashcardsWrapper = document.getElementById("flashcardsWrapper");
const generateQuizBtn = document.getElementById("generateQuizBtn");
const quizWrapper = document.getElementById("quizWrapper");
const generateImportantBtn = document.getElementById("generateImportantBtn");
const importantWrapper = document.getElementById("importantWrapper");
const generateMindMapBtn = document.getElementById("generateMindMapBtn");
const mindmapWrapper = document.getElementById("mindmapWrapper");
const generateSlidesBtn = document.getElementById("generateSlidesBtn");
const slidesWrapper = document.getElementById("slidesWrapper");
const generateDataTableBtn = document.getElementById("generateDataTableBtn");
const dataTableWrapper = document.getElementById("dataTableWrapper");
const generateCompareBtn = document.getElementById("generateCompareBtn");
const compareWrapper = document.getElementById("compareWrapper");
const newNoteBtn = document.getElementById("newNoteBtn");
const notesGrid = document.getElementById("notesGrid");

// AI Visual & Image Studio DOM Elements
const generateImageBtn = document.getElementById("generateImageBtn");
const imagePromptInput = document.getElementById("imagePromptInput");
const imageStyleSelect = document.getElementById("imageStyleSelect");
const imageRatioSelect = document.getElementById("imageRatioSelect");
const visualDisplayArea = document.getElementById("visualDisplayArea");
const visualEmptyState = document.getElementById("visualEmptyState");
const activeVisualCard = document.getElementById("activeVisualCard");
const visualCardTitle = document.getElementById("visualCardTitle");
const visualCardTags = document.getElementById("visualCardTags");
const visualRenderStage = document.getElementById("visualRenderStage");
const visualSummaryText = document.getElementById("visualSummaryText");
const btnVisualDownload = document.getElementById("btnVisualDownload");
const btnVisualPinNote = document.getElementById("btnVisualPinNote");
const btnVisualZoom = document.getElementById("btnVisualZoom");
const visualGallerySection = document.getElementById("visualGallerySection");
const visualGalleryGrid = document.getElementById("visualGalleryGrid");
const visualZoomModal = document.getElementById("visualZoomModal");
const visualZoomTitle = document.getElementById("visualZoomTitle");
const visualZoomContent = document.getElementById("visualZoomContent");
const closeVisualZoomModalBtn = document.getElementById("closeVisualZoomModalBtn");

// AI Video Explainer Studio DOM Elements
const videoStyleSelect = document.getElementById("videoStyleSelect");
const generateVideoBtn = document.getElementById("generateVideoBtn");
const videoLectureContainer = document.getElementById("videoLectureContainer");
const videoEmptyState = document.getElementById("videoEmptyState");
const videoActiveStage = document.getElementById("videoActiveStage");
const videoLectureCanvas = document.getElementById("videoLectureCanvas");
const videoCanvasWrapper = document.getElementById("videoCanvasWrapper");
const videoSubtitleBar = document.getElementById("videoSubtitleBar");
const videoSubtitleText = document.getElementById("videoSubtitleText");
const videoStagePlayOverlay = document.getElementById("videoStagePlayOverlay");
const videoBigPlayBtn = document.getElementById("videoBigPlayBtn");
const btnVideoPlayPause = document.getElementById("btnVideoPlayPause");
const btnVideoPrevScene = document.getElementById("btnVideoPrevScene");
const btnVideoNextScene = document.getElementById("btnVideoNextScene");
const videoScrubber = document.getElementById("videoScrubber");
const videoTimeDisplay = document.getElementById("videoTimeDisplay");
const videoSpeedSelect = document.getElementById("videoSpeedSelect");
const btnVideoVoiceToggle = document.getElementById("btnVideoVoiceToggle");
const btnVideoFullscreen = document.getElementById("btnVideoFullscreen");
const scenesTimelineGrid = document.getElementById("scenesTimelineGrid");
const btnExportVideoScript = document.getElementById("btnExportVideoScript");

// PDF Modal Elements (PDF.js Real Visual Viewer)
const pdfModal = document.getElementById("pdfModal");
const pdfModalTitle = document.getElementById("pdfModalTitle");
const pdfPageIndicator = document.getElementById("pdfPageIndicator");
const pdfSourceTypeBadge = document.getElementById("pdfSourceTypeBadge");
const pdfPageJumpInput = document.getElementById("pdfPageJumpInput");
const pdfTotalPages = document.getElementById("pdfTotalPages");
const btnPdfPrev = document.getElementById("btnPdfPrev");
const btnPdfNext = document.getElementById("btnPdfNext");
const btnPdfZoomOut = document.getElementById("btnPdfZoomOut");
const pdfZoomLevel = document.getElementById("pdfZoomLevel");
const btnPdfZoomIn = document.getElementById("btnPdfZoomIn");
const btnPdfFit = document.getElementById("btnPdfFit");
const btnPdfDownload = document.getElementById("btnPdfDownload");
const closePdfModalBtn = document.getElementById("closePdfModalBtn");
const pdfViewContainer = document.getElementById("pdfViewContainer");
const pdfLoadingSpinner = document.getElementById("pdfLoadingSpinner");
const pdfCanvas = document.getElementById("pdfCanvas");
const pdfTextFallback = document.getElementById("pdfTextFallback");

if (typeof window !== "undefined" && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.js";
}

const pasteTextModal = document.getElementById("pasteTextModal");
const urlModal = document.getElementById("urlModal");
const sampleModal = document.getElementById("sampleModal");

// --- API Helper ---
async function api(path, options = {}) {
  const token = localStorage.getItem("studyvault_token");
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(state.geminiApiKey ? { "x-gemini-key": state.geminiApiKey } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && typeof AuthManager !== "undefined") {
      AuthManager.clearSession();
      showToast("Session expired. Please sign in again.");
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Download helper for Export Hub
 */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showConfirmDialog({ title = "Confirm Action", message = "Are you sure you want to proceed?", onConfirm, confirmText = "Confirm" }) {
  const modal = document.getElementById("customConfirmModal");
  const titleEl = document.getElementById("confirmModalTitle");
  const msgEl = document.getElementById("confirmModalMessage");
  const submitBtn = document.getElementById("submitConfirmBtn");
  const closeBtn = document.getElementById("closeConfirmModalBtn");
  const cancelBtn = document.getElementById("cancelConfirmBtn");

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (submitBtn) submitBtn.textContent = confirmText;

  let isHandled = false;
  const doConfirm = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isHandled) return;
    isHandled = true;
    if (modal) modal.classList.remove("show");
    if (typeof libState !== "undefined") libState.confirmCallback = null;
    if (onConfirm) {
      await onConfirm();
    }
  };

  const doCancel = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isHandled) return;
    isHandled = true;
    if (modal) modal.classList.remove("show");
    if (typeof libState !== "undefined") libState.confirmCallback = null;
  };

  if (typeof libState !== "undefined") {
    libState.confirmCallback = doConfirm;
  }

  if (submitBtn) submitBtn.onclick = doConfirm;
  if (closeBtn) closeBtn.onclick = doCancel;
  if (cancelBtn) cancelBtn.onclick = doCancel;

  if (modal) {
    modal.classList.add("show");
    modal.onclick = (e) => {
      if (e.target === modal) doCancel(e);
    };
  }
}

function parseMarkdownToHtml(markdownText) {
  if (!markdownText) return "";

  // 1. Separate code blocks and math into placeholders to prevent citation or formatting corruption
  const codeBlocks = [];
  let text = String(markdownText).replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code });
    return `___CODE_BLOCK_${idx}___`;
  });

  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return `___INLINE_CODE_${idx}___`;
  });

  const displayMath = [];
  // Match $$ ... $$ or \[ ... \]
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const idx = displayMath.length;
    displayMath.push(math.trim());
    return `___MATH_DISP_${idx}___`;
  });
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
    const idx = displayMath.length;
    displayMath.push(math.trim());
    return `___MATH_DISP_${idx}___`;
  });

  const inlineMath = [];
  // Match $ ... $ or \( ... \) (ignore currency like $10 or $25.50)
  text = text.replace(/(^|[^\w\$])\$([^\$\n]+?)\$(?!\w)/g, (match, prefix, math) => {
    if (/^\d+(?:\.\d+)?$/.test(math.trim())) return match;
    const idx = inlineMath.length;
    inlineMath.push(math.trim());
    return `${prefix}___MATH_INL_${idx}___`;
  });
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
    const idx = inlineMath.length;
    inlineMath.push(math.trim());
    return `___MATH_INL_${idx}___`;
  });

  // 2. Strict & Safe Source Citation Parsing:
  // NEVER match variable brackets like [i], [j], [n], [m], [0], [1], [row], [col]
  // Must match [doc.ext, p.X], [doc.ext], [Notes, p. 12], or [Operating Systems, page 5]
  const renderCitationChip = (fname, pNum) => {
    const trimmedFname = (fname || "").trim().replace(/^📄\s*/, "");
    // Check if filename looks like a single variable name or array index
    if (/^[a-zA-Z0-9]$|^[a-zA-Z]_[a-zA-Z0-9]+$/i.test(trimmedFname)) {
      return `[${trimmedFname}]`; // Leave ordinary brackets intact!
    }
    const cleanPage = pNum ? parseInt(pNum, 10) || 1 : 1;
    const pageStr = `p.${cleanPage}`;
    return `<span class="citation-chip" data-doc="${escapeHtml(trimmedFname)}" data-page="${cleanPage}" title="Click to view in PDF Viewer at ${pageStr}">📄 [${escapeHtml(trimmedFname)}, ${pageStr}]</span>`;
  };

  // Match [doc.ext, p.X] or [Title, p.X]
  text = text.replace(/\[\s*([^,\]\n]{2,}?)\s*,\s*p(?:age|\.)?\s*(\d+)\s*\]/gi, (match, fname, pNum) => {
    return renderCitationChip(fname, pNum);
  });

  // Match [doc.pdf] with known file extension
  text = text.replace(/\[\s*([a-zA-Z0-9_\-\. ]+\.(?:pdf|docx|doc|txt|epub|pptx))\s*\]/gi, (match, fname) => {
    return renderCitationChip(fname, 1);
  });

  // 3. Topic Mismatch Warning
  text = text.replace(/⚠️ \*\*Topic Mismatch Detected\*\*(.*?)(?=\n\n|\#|$)/s, (match, body) => {
    return `<div style="background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); border-radius:8px; padding:0.75rem; margin-bottom:0.75rem; color:var(--warning); font-size:0.85rem;">⚠️ <strong>Topic Mismatch Detected</strong>${escapeHtml(body)}</div>\n\n`;
  });

  // 4. Academic Callouts: Definition, Exam Tip, Quick Revision
  text = text.replace(/^>\s*\*\*Definition(?:\s*\([^)]*\))?:\*\*\s*(.*?)(?=\n\n|\n[^\>]|$)/gims, (match, body) => {
    const cleanBody = body.replace(/^>\s*/gm, "").trim();
    return `\n<div class="callout-definition"><div class="callout-title">📖 Definition</div><div class="callout-body">${cleanBody}</div></div>\n`;
  });

  text = text.replace(/^>\s*\*\*Exam Tip:\*\*\s*(.*?)(?=\n\n|\n[^\>]|$)/gims, (match, body) => {
    const cleanBody = body.replace(/^>\s*/gm, "").trim();
    return `\n<div class="callout-exam-tip"><div class="callout-title">💡 Exam Tip</div><div class="callout-body">${cleanBody}</div></div>\n`;
  });

  text = text.replace(/^>\s*\*\*Quick Revision Summary:\*\*\s*(.*?)(?=\n\n|\n[^\>]|$)/gims, (match, body) => {
    const cleanBody = body.replace(/^>\s*/gm, "").trim();
    return `\n<div class="callout-revision"><div class="callout-title">⚡ Quick Revision Summary</div><div class="callout-body">${cleanBody}</div></div>\n`;
  });

  // Generic blockquotes
  text = text.replace(/^>\s*"(.*?)"/gim, '<blockquote class="quote-card">“$1”</blockquote>');
  text = text.replace(/^>\s*(.*?)$/gim, '<blockquote class="quote-card">$1</blockquote>');

  // 5. Tables: Detect markdown tables
  text = text.replace(/(?:^|\n)(\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, (match, tableText) => {
    const lines = tableText.trim().split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
    if (lines.length < 2) return match;

    const parseRow = (line) => line.split("|").slice(1, -1).map((c) => c.trim());
    const headerCols = parseRow(lines[0]);
    const bodyRows = lines.slice(2).map(parseRow);

    let tableHtml = '<div class="academic-table-wrap"><table class="academic-table"><thead><tr>';
    headerCols.forEach((h) => {
      tableHtml += `<th>${h}</th>`;
    });
    tableHtml += "</tr></thead><tbody>";
    bodyRows.forEach((row) => {
      tableHtml += "<tr>";
      row.forEach((cell) => {
        tableHtml += `<td>${cell}</td>`;
      });
      tableHtml += "</tr>";
    });
    tableHtml += "</tbody></table></div>";
    return `\n${tableHtml}\n`;
  });

  // 6. Headings
  text = text.replace(/^#### (.*$)/gim, '<h4 class="academic-heading">$1</h4>');
  text = text.replace(/^### (.*$)/gim, '<h3 class="academic-heading">$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2 class="academic-heading">$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h2 class="academic-heading">$1</h2>');

  // 7. Text Formatting (bold, italics)
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^\*])\*([^\*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

  // 8. Lists (Unordered & Ordered)
  text = text.replace(/(?:^|\n)((?:^[ \t]*[-*]\s+.+(?:\r?\n|$))+)/gm, (match, listBlock) => {
    const items = listBlock.trim().split(/\r?\n/).map((line) => {
      return `<li>${line.replace(/^[ \t]*[-*]\s+/, "")}</li>`;
    }).join("");
    return `\n<ul class="academic-list">${items}</ul>\n`;
  });

  text = text.replace(/(?:^|\n)((?:^[ \t]*\d+\.\s+.+(?:\r?\n|$))+)/gm, (match, listBlock) => {
    const items = listBlock.trim().split(/\r?\n/).map((line) => {
      return `<li>${line.replace(/^[ \t]*\d+\.\s+/, "")}</li>`;
    }).join("");
    return `\n<ol class="academic-list">${items}</ol>\n`;
  });

  // 9. Paragraphs: split by double newlines, preserving blocks that already contain HTML tags
  const rawBlocks = text.split(/\n\s*\n/);
  const formattedBlocks = rawBlocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("<div") ||
      trimmed.startsWith("<table") ||
      trimmed.startsWith("<h2") ||
      trimmed.startsWith("<h3") ||
      trimmed.startsWith("<h4") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("<blockquote") ||
      trimmed.startsWith("___MATH_DISP") ||
      trimmed.startsWith("___CODE_BLOCK")
    ) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
  });
  let html = formattedBlocks.filter(Boolean).join("\n");

  // 10. KaTeX Math Placeholders Replacement
  html = html.replace(/___MATH_DISP_(\d+)___/g, (match, id) => {
    const mathCode = displayMath[parseInt(id, 10)] || "";
    if (typeof window !== "undefined" && window.katex && typeof window.katex.renderToString === "function") {
      try {
        const rendered = window.katex.renderToString(mathCode, {
          displayMode: true,
          throwOnError: false,
        });
        return `<div class="math-display-wrap">${rendered}</div>`;
      } catch (err) {
        return `<div class="math-display-wrap"><code>${escapeHtml(mathCode)}</code></div>`;
      }
    }
    return `<div class="math-display-wrap"><code>${escapeHtml(mathCode)}</code></div>`;
  });

  html = html.replace(/___MATH_INL_(\d+)___/g, (match, id) => {
    const mathCode = inlineMath[parseInt(id, 10)] || "";
    if (typeof window !== "undefined" && window.katex && typeof window.katex.renderToString === "function") {
      try {
        const rendered = window.katex.renderToString(mathCode, {
          displayMode: false,
          throwOnError: false,
        });
        return `<span class="math-inline">${rendered}</span>`;
      } catch (err) {
        return `<span class="math-inline"><code>${escapeHtml(mathCode)}</code></span>`;
      }
    }
    return `<span class="math-inline"><code>${escapeHtml(mathCode)}</code></span>`;
  });

  // 11. Restore Code Placeholders
  html = html.replace(/___CODE_BLOCK_(\d+)___/g, (match, id) => {
    const block = codeBlocks[parseInt(id, 10)];
    if (!block) return "";
    return `<pre class="code-block-wrap"><code>${escapeHtml(block.code)}</code></pre>`;
  });

  html = html.replace(/___INLINE_CODE_(\d+)___/g, (match, id) => {
    const code = inlineCodes[parseInt(id, 10)];
    if (!code) return "";
    return `<code class="inline-code">${escapeHtml(code)}</code>`;
  });

  return html;
}

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// GENERATION SCOPE CONTROLLER (Flashcards, Quiz, Questions, Mindmap, Slides, Data Table, Visuals, Video)
// ══════════════════════════════════════════════════════════════════
const genScopes = {
  flashcards: "all",
  quiz: "all",
  important: "all",
  mindmap: "all",
  slides: "all",
  dataTable: "all",
  images: "all",
  video: "all"
};

function setupGenerationScopeControls() {
  const tools = [
    { name: "flashcards", prefix: "fc", group: "fcScopeGroup" },
    { name: "quiz", prefix: "quiz", cardId: "tabQuiz" },
    { name: "important", prefix: "iq", cardId: "tabImportant" },
    { name: "mindmap", prefix: "mm", cardId: "tabMindMap" },
    { name: "slides", prefix: "slides", cardId: "tabSlides" },
    { name: "dataTable", prefix: "dt", cardId: "tabDataTable" },
    { name: "images", prefix: "img", group: "imgScopeGroup" },
    { name: "video", prefix: "vid", group: "videoScopeGroup" }
  ];

  tools.forEach(({ name, prefix, group, cardId }) => {
    let scopePills = [];
    if (group) {
      const gEl = document.getElementById(group);
      if (gEl) scopePills = gEl.querySelectorAll(".scope-pill-btn");
    } else if (cardId) {
      const cEl = document.getElementById(cardId);
      if (cEl) scopePills = cEl.querySelectorAll(".generation-scope-card .scope-pill-btn");
    }

    scopePills.forEach(btn => {
      btn.addEventListener("click", () => {
        scopePills.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const scope = btn.dataset.scope || "all";
        genScopes[name] = scope;

        const topicSub = document.getElementById(`${prefix}TopicSubpanel`);
        const sourceSub = document.getElementById(`${prefix}SourceSubpanel`);

        if (topicSub) topicSub.style.display = scope === "topic" ? "flex" : "none";
        if (sourceSub) sourceSub.style.display = scope === "source" ? "flex" : "none";
      });
    });
  });
}

function getScopeParams(prefix, toolName = null) {
  const scopeKey = toolName || prefix;
  const scope = genScopes[scopeKey] || genScopes[prefix] || "all";
  let topic = "";
  if (scope === "topic") {
    const custom = document.getElementById(`${prefix}CustomTopicInput`)?.value?.trim();
    const sel = document.getElementById(`${prefix}TopicSelect`)?.value?.trim();
    topic = custom || sel || "";
  }
  let documentIds = [];
  if (scope === "source") {
    const grid = document.getElementById(`${prefix}DocCheckboxesGrid`);
    if (grid) {
      documentIds = Array.from(grid.querySelectorAll("input[type='checkbox']:checked")).map(cb => cb.value);
    }
  }
  return { scopeType: scope, topic, documentIds };
}

function updateGenerationScopeUI() {
  const readyDocs = (state.documents || []).filter(d => d.status === "ready");

  const topics = new Set();
  readyDocs.forEach(d => {
    if (Array.isArray(d.keyTopics)) {
      d.keyTopics.forEach(t => { if (t && typeof t === "string" && t.trim()) topics.add(t.trim()); });
    }
  });
  const topicList = Array.from(topics);

  const prefixes = ["fc", "quiz", "iq", "mm", "slides", "dt", "img", "vid"];

  prefixes.forEach(prefix => {
    const sel = document.getElementById(`${prefix}TopicSelect`);
    if (sel) {
      const curVal = sel.value;
      sel.innerHTML = `<option value="">-- Choose Detected Topic (${topicList.length}) --</option>` +
        topicList.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
      if (curVal && topicList.includes(curVal)) sel.value = curVal;
    }

    const grid = document.getElementById(`${prefix}DocCheckboxesGrid`);
    if (grid) {
      if (readyDocs.length === 0) {
        grid.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); padding:0.5rem">No ready documents in this notebook yet.</div>`;
      } else {
        grid.innerHTML = readyDocs.map(d => `
          <label class="scope-doc-item">
            <input type="checkbox" value="${d._id || d.id}" checked />
            <span class="scope-doc-name" title="${escapeHtml(d.filename)}">📄 ${escapeHtml(d.filename)}</span>
            <span class="scope-doc-badge">${d.pageCount || 1}p</span>
          </label>
        `).join("");
      }
    }
  });
}

// --- Init & Settings ---
let appInitialized = false;
async function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  setupEventListeners();
  setupDropdowns();
  setupSettingsModal();
  setupGoogleClientModal();
  setupDropzones();
  setupGenerationScopeControls();
  setupAnswerStyleControls();
  if (typeof StudioManager !== "undefined") {
    StudioManager.init();
  }
  checkDbStatus();
  await loadNotebooks();
}

async function checkDbStatus() {
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      const data = await res.json();
      if (storagePill) {
        storagePill.textContent = `🟢 ${data.label || "DB Connected"}`;
        storagePill.title = `Storage: ${data.details}`;
        storagePill.style.background = "rgba(52, 168, 83, 0.15)";
        storagePill.style.color = "#81c995";
        storagePill.style.borderColor = "rgba(52, 168, 83, 0.3)";
      }
    }
  } catch (e) {}
}

function setupSettingsModal() {
  const settingsGoogleClientIdInput = document.getElementById("settingsGoogleClientIdInput");
  openSettingsBtn.addEventListener("click", () => {
    geminiApiKeyInput.value = state.geminiApiKey;
    geminiModelSelect.value = state.geminiModel;
    if (settingsGoogleClientIdInput) {
      settingsGoogleClientIdInput.value = localStorage.getItem("studyvault_google_client_id") || window.GOOGLE_CLIENT_ID || "";
    }
    settingsModal.classList.add("show");
  });

  closeSettingsModalBtn.addEventListener("click", () => settingsModal.classList.remove("show"));

  saveSettingsBtn.addEventListener("click", () => {
    state.geminiApiKey = geminiApiKeyInput.value.trim();
    state.geminiModel = geminiModelSelect.value;
    localStorage.setItem("notebooklm_gemini_key", state.geminiApiKey);
    localStorage.setItem("notebooklm_gemini_model", state.geminiModel);

    if (settingsGoogleClientIdInput) {
      const gId = settingsGoogleClientIdInput.value.trim();
      if (gId) {
        localStorage.setItem("studyvault_google_client_id", gId);
        window.GOOGLE_CLIENT_ID = gId;
        if (typeof AuthManager !== "undefined" && typeof AuthManager.initGoogleSignIn === "function") {
          AuthManager.initGoogleSignIn();
        }
      } else {
        localStorage.removeItem("studyvault_google_client_id");
      }
    }

    settingsModal.classList.remove("show");
    showToast(state.geminiApiKey ? "Settings saved! Live cloud models active." : "Settings saved.");
  });
}

function setupGoogleClientModal() {
  const modal = document.getElementById("googleClientModal");
  if (!modal) return;
  const closeBtn = document.getElementById("closeGoogleClientModalBtn");
  const cancelBtn = document.getElementById("cancelGoogleClientBtn");
  const saveBtn = document.getElementById("saveQuickGoogleClientBtn");
  const input = document.getElementById("quickGoogleClientIdInput");

  const openModal = () => {
    if (input) {
      input.value = localStorage.getItem("studyvault_google_client_id") || window.GOOGLE_CLIENT_ID || "";
    }
    modal.classList.add("show");
    if (input) input.focus();
  };

  const closeModal = () => modal.classList.remove("show");

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const val = (input ? input.value : "").trim();
      if (!val) {
        showToast("Please enter a valid Google Client ID.");
        return;
      }
      localStorage.setItem("studyvault_google_client_id", val);
      window.GOOGLE_CLIENT_ID = val;
      closeModal();
      showToast("Google Client ID saved! Initializing Google Sign-In... 🎉");
      if (typeof AuthManager !== "undefined" && typeof AuthManager.initGoogleSignIn === "function") {
        AuthManager.initGoogleSignIn();
      }
    });
  }

  // Bind to fallback Google buttons across landing page and auth modal
  const googleFallback = document.getElementById("googleSignInFallback");
  if (googleFallback) {
    googleFallback.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  }
  const latGoogleFallback = document.getElementById("latGoogleFallback");
  if (latGoogleFallback) {
    latGoogleFallback.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  }
}

async function loadNotebooks() {
  try {
    state.notebooks = await api("/notebooks");
    if (typeof libState !== "undefined") {
      libState.notebooks = [...state.notebooks];
    }
    renderNotebookList();
    if (typeof ViewRouter !== "undefined" && ViewRouter.currentView === "workspace") {
      if (state.notebooks.length > 0) {
        const savedId = localStorage.getItem("studyvault_active_notebook");
        const foundSaved = state.notebooks.find((n) => String(n._id) === String(savedId));
        const withDocs = state.notebooks.find((n) => (n.documentCount || 0) > 0);
        const target = (state.currentId && state.notebooks.find(n => String(n._id) === String(state.currentId)))
          || foundSaved
          || withDocs
          || state.notebooks[0];
        selectNotebook(target._id);
      } else {
        showEmptyState();
      }
    }
  } catch (err) {
    console.error("loadNotebooks error:", err);
  }
}


function renderNotebookList() {
  if (state.notebooks.length === 0) {
    notebookList.innerHTML = `
      <div style="padding: 1.5rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        <div style="width: 36px; height: 36px; margin: 0 auto 0.5rem auto; border-radius: 10px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <p style="font-weight: 600; color: var(--text-sub); margin-bottom: 0.25rem;">No notebooks yet</p>
        <span style="font-size: 0.72rem;">Click "New notebook" above to create your first workspace.</span>
      </div>`;
    return;
  }
  notebookList.innerHTML = state.notebooks
    .map(
      (nb) => `
      <div class="notebook-item ${nb._id === state.currentId ? "active" : ""}" data-id="${nb._id}">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);flex-shrink:0;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <div class="notebook-item-title" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(nb.title)}</div>
        </div>
        <div class="notebook-item-meta" style="margin-top: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
          <span>${new Date(nb.updatedAt || nb.createdAt).toLocaleDateString()}</span>
          ${nb._id === state.currentId ? `<span style="font-size: 0.68rem; color: var(--accent); font-weight: 600;">Active</span>` : ""}
        </div>
      </div>`
    )
    .join("");

  notebookList.querySelectorAll(".notebook-item").forEach((el) => {
    el.addEventListener("click", () => selectNotebook(el.dataset.id));
  });
}

async function selectNotebook(id) {
  state.currentId = id;
  stopAudioPlayback();
  stopVideoPlayback();
  clearInterval(state.pollTimer);
  renderNotebookList();

  // Reset all artifact states so previous notebook data never leaks
  state.audioScript = null;
  state.briefing = null;
  state.flashcards = null;
  state.cardIndex = 0;
  state.cardRatings = {};
  state.quiz = null;
  state.quizAnswers = {};
  state.importantQuestions = null;
  state.mindmap = null;
  state.slides = null;
  state.currentSlideIndex = 0;
  state.dataTable = null;
  state.visuals = [];
  state.activeVisual = null;
  state.videoProject = null;

  // Reset artifact DOM wrappers to their pristine empty states
  if (podcastPlayerCard) podcastPlayerCard.style.display = "none";
  if (briefingContent) briefingContent.innerHTML = '<p class="tab-empty">Click "Generate" to create an executive summary, key findings, and action items.</p>';
  if (flashcardsWrapper) flashcardsWrapper.innerHTML = '<p class="tab-empty">Choose your content scope and click "Generate" to create interactive self-testing study flashcards grounded in your notebook sources.</p>';
  if (quizWrapper) quizWrapper.innerHTML = '<p class="tab-empty">Choose your scope and click "Start Quiz" to launch a source-grounded practice test.</p>';
  if (importantWrapper) importantWrapper.innerHTML = '<p class="tab-empty">Choose your scope and click "Extract Questions" to generate grounded test your understanding questions.</p>';
  if (mindmapWrapper) mindmapWrapper.innerHTML = '<p class="tab-empty">Click "Generate Map" to visualize the knowledge architecture of your documents.</p>';
  if (slidesWrapper) slidesWrapper.innerHTML = '<p class="tab-empty">Click "Generate Slides" to synthesize a study presentation from your materials.</p>';
  if (dataTableWrapper) dataTableWrapper.innerHTML = '<p class="tab-empty" style="padding:1.5rem">Click "Generate Table" to structure key technical concepts into a comparison matrix.</p>';

  document.getElementById("renameBtn").style.display = "inline-block";
  document.getElementById("deleteNotebookBtn").style.display = "inline-block";

  const { notebook, documents } = await api(`/notebooks/${id}`);
  state.documents = documents;
  notebookTitle.textContent = notebook.title;

  renderSources();
  updateGenerationScopeUI();
  await loadMessages();
  await loadNotes();
  await loadCachedArtifacts();
  maybePollDocs();

  if (typeof StudioManager !== "undefined") {
    StudioManager.selectTool(state.activeStudioTool || "tabFlashcards");
  }
}

function showEmptyState() {
  state.currentId = null;
  state.activeNotebookId = null;
  state.documents = [];
  state.chatHistory = [];
  try { localStorage.removeItem("studyvault_active_notebook"); } catch (e) {}
  notebookTitle.textContent = "Select or create a notebook";
  sourcesRailInner.innerHTML = `
    <div style="padding: 1.25rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
      <div style="font-size: 1.4rem; margin-bottom: 0.35rem;">📄</div>
      <p style="font-weight: 600; color: var(--text-sub); margin-bottom: 0.2rem;">No sources attached</p>
      <span>Create a notebook to begin.</span>
    </div>`;
  if (typeof sourceCount !== "undefined" && sourceCount) sourceCount.textContent = "0";
  const chatSourceBadge = document.getElementById("chatSourceBadge");
  if (chatSourceBadge) {
    chatSourceBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>0 sources attached</span>`;
  }
  const renameBtn = document.getElementById("renameBtn");
  if (renameBtn) renameBtn.style.display = "none";
  const deleteBtn = document.getElementById("deleteNotebookBtn");
  if (deleteBtn) deleteBtn.style.display = "none";
  updateGenerationScopeUI();
  renderChat();
  if (typeof StudioManager !== "undefined") {
    StudioManager.selectCategory("study", "tabFlashcards");
  }
}

// --- Sources ---
function renderSources() {
  sourceCount.textContent = state.documents.length;
  updateGenerationScopeUI();
  updateStudioLockedState();
  const chatSourceBadge = document.getElementById("chatSourceBadge");
  if (chatSourceBadge) {
    chatSourceBadge.innerHTML = state.documents.length > 0
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Citing ${state.documents.length} source${state.documents.length > 1 ? "s" : ""}</span>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>0 sources attached</span>`;
  }

  if (state.documents.length === 0) {
    sourcesRailInner.innerHTML = `
      <div style="padding: 1.5rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
        <div style="width: 36px; height: 36px; margin: 0 auto 0.5rem auto; border-radius: 10px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <p style="font-weight: 600; color: var(--text-sub); margin-bottom: 0.25rem;">No sources attached</p>
        <span>Add a PDF, scrape a URL, or paste notes to begin grounded study.</span>
      </div>`;
    return;
  }

  sourcesRailInner.innerHTML = state.documents
    .map((doc) => {
      const lower = doc.filename.toLowerCase();
      const isPdf = (doc.mimeType && doc.mimeType.includes("pdf")) || lower.endsWith(".pdf");
      const isPpt = (doc.mimeType && doc.mimeType.includes("presentation")) || lower.endsWith(".pptx") || lower.endsWith(".ppt");
      const isDoc = (doc.mimeType && doc.mimeType.includes("word")) || lower.endsWith(".docx") || lower.endsWith(".doc");
      const isWeb = lower.startsWith("web_") || (doc.mimeType && doc.mimeType.includes("html"));
      const docSvg = isPpt
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="21 15 16 10 5 21"/></svg>`
        : isDoc
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
        : isPdf
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
        : isWeb
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="2" x2="22" y2="6"/><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"/></svg>`;
      const typeBadge = isPpt ? "SLIDES" : isDoc ? "DOCX" : isPdf ? "PDF" : isWeb ? "Web" : "Text";
      const unitWord = isPpt ? (doc.pageCount === 1 ? "slide" : "slides") : (doc.pageCount === 1 ? "page" : "pages");

      const isProcessing = doc.status === "processing";
      const isFailed = doc.status === "failed";
      const statusBadge = isProcessing
        ? `<span class="source-status-badge status-processing">Processing</span>`
        : isFailed
        ? `<span class="source-status-badge status-failed" title="${escapeHtml(doc.summary || 'Processing failed')}">Error</span>`
        : `<span class="source-status-badge status-ready">Ready</span>`;

      const pageInfo = doc.pageCount ? `${doc.pageCount} ${unitWord}` : "Document";

      const pillClass = isPpt ? "ppt" : isDoc ? "doc" : isPdf ? "pdf" : "text";
      const pillLabel = isPpt ? `PPTX • ${doc.pageCount || 1} slides` : isDoc ? `DOCX • ${doc.pageCount || 1} pgs` : isPdf ? `PDF • ${doc.pageCount || 1} pgs` : `TEXT • ${doc.pageCount || 1} pgs`;

      const docId = String(doc._id || doc.id);

      return `
      <div class="source-card" data-docid="${docId}" title="Click to open source reader">
        <div class="source-card-main">
          <div class="source-card-header">
            <span class="source-doc-icon">${docSvg}</span>
            <div class="source-title-wrap">
              <span class="source-filename" title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</span>
              <div class="source-meta-row" style="margin-top:0.25rem;">
                <span class="source-type-pill ${pillClass}">${pillLabel}</span>
                ${statusBadge}
              </div>
            </div>
          </div>
        </div>
        <div class="source-card-actions-row">
          <button type="button" class="source-action-btn-sm" data-view-visual="${docId}" title="View visual PDF or slides">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>${isPpt ? "Slides" : "PDF"}</span>
          </button>
          <button type="button" class="source-action-btn-sm" data-view-content="${docId}" title="View full source content & outline">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>Outline</span>
          </button>
          <button type="button" class="source-action-btn-delete" data-remove="${docId}" data-filename="${escapeHtml(doc.filename)}" title="Remove source">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
    })
    .join("");

  sourcesRailInner.querySelectorAll(".source-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-remove]") || e.target.closest("[data-view-visual]") || e.target.closest("[data-view-content]")) return;
      openPdfModal(card.dataset.docid, 1, "split");
    });
  });

  sourcesRailInner.querySelectorAll("[data-view-visual]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPdfModal(btn.dataset.viewVisual, 1, "visual");
    });
  });

  sourcesRailInner.querySelectorAll("[data-view-content]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPdfModal(btn.dataset.viewContent, 1, "content");
    });
  });

  sourcesRailInner.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const docId = btn.dataset.remove;
      const docName = btn.dataset.filename || "this source";
      const targetNbId = state.currentId || (state.documents.find(d => String(d._id || d.id) === String(docId)) || {}).notebookId;
      showConfirmDialog({
        title: "Remove Source",
        message: `Are you sure you want to remove "${docName}" from this notebook? This action will remove its text content and citations.`,
        confirmText: "Remove",
        onConfirm: async () => {
          try {
            const url = targetNbId
              ? `/notebooks/${targetNbId}/documents/${docId}`
              : `/documents/${docId}`;
            await api(url, { method: "DELETE" });
            state.documents = state.documents.filter((d) => String(d._id || d.id) !== String(docId));
            pdfDocCache.delete(docId);
            if (activePdfDoc && String(activePdfDoc._id || activePdfDoc.id) === String(docId)) {
              const modal = document.getElementById("pdfModal");
              if (modal) modal.classList.remove("show");
              if (currentRenderTask) {
                try { currentRenderTask.cancel(); } catch (_) {}
              }
              activePdfDoc = null;
            }
            renderSources();
            updateGenerationScopeUI();
            updateStudioLockedState();
            renderChat();
            showToast(`"${docName}" removed from notebook.`);
          } catch (err) {
            showToast(err.message || "Failed to remove source");
          }
        }
      });
    });
  });
}

function maybePollDocs() {
  clearInterval(state.pollTimer);
  const processing = state.documents.some((d) => d.status === "processing");
  if (!processing) return;

  state.pollTimer = setInterval(async () => {
    if (!state.currentId) return clearInterval(state.pollTimer);
    const docs = await api(`/notebooks/${state.currentId}/documents`);
    state.documents = docs;
    renderSources();
    if (!docs.some((d) => d.status === "processing")) {
      clearInterval(state.pollTimer);
    }
  }, 2500);
}

// --- MULTI-FORMAT REAL VISUAL VIEWER & SOURCE CONTENT ENGINE ---
const pdfDocCache = new Map();
let activePdfDoc = null;
let activePdfJsDoc = null;
let currentRenderTask = null;
let pdfZoomScale = 1.0;
let isFitToWidth = false;
let currentViewerTab = "visual"; // "visual" or "content"

// Dual Mode Switcher Elements
const btnPdfTabVisual = document.getElementById("btnPdfTabVisual");
const btnPdfTabContent = document.getElementById("btnPdfTabContent");
const pdfPageNavControls = document.getElementById("pdfPageNavControls");
const sourceContentContainer = document.getElementById("sourceContentContainer");
const sourceContentSearchInput = document.getElementById("sourceContentSearchInput");
const sourceContentMatchCount = document.getElementById("sourceContentMatchCount");
const sourceDocMetaStrip = document.getElementById("sourceDocMetaStrip");
const sourcePagesFeed = document.getElementById("sourcePagesFeed");
const btnCopyPageText = document.getElementById("btnCopyPageText");
const btnCopyAllText = document.getElementById("btnCopyAllText");
const btnPdfDownloadLabel = document.getElementById("btnPdfDownloadLabel");

const btnPdfTabSplit = document.getElementById("btnPdfTabSplit");
const pdfModalBody = document.querySelector("#pdfModal .pdf-body");

function setViewerTab(tab) {
  currentViewerTab = tab || "split";
  if (btnPdfTabVisual) btnPdfTabVisual.classList.toggle("active", currentViewerTab === "visual");
  if (btnPdfTabContent) btnPdfTabContent.classList.toggle("active", currentViewerTab === "content");
  if (btnPdfTabSplit) btnPdfTabSplit.classList.toggle("active", currentViewerTab === "split");

  if (currentViewerTab === "visual") {
    if (pdfModalBody) pdfModalBody.classList.remove("split-mode");
    if (pdfViewContainer) pdfViewContainer.style.display = "flex";
    if (sourceContentContainer) sourceContentContainer.style.display = "none";
    if (pdfPageNavControls) pdfPageNavControls.style.display = "flex";
    if (activePdfJsDoc) renderPdfPage();
  } else if (currentViewerTab === "content") {
    if (pdfModalBody) pdfModalBody.classList.remove("split-mode");
    if (pdfViewContainer) pdfViewContainer.style.display = "none";
    if (sourceContentContainer) sourceContentContainer.style.display = "flex";
    if (pdfPageNavControls) pdfPageNavControls.style.display = "none";
    if (activePdfDoc) renderSourceContent(activePdfDoc, state.currentPdfPage);
  } else {
    // split mode: side-by-side visual and source outline!
    if (pdfModalBody) pdfModalBody.classList.add("split-mode");
    if (pdfViewContainer) pdfViewContainer.style.display = "flex";
    if (sourceContentContainer) sourceContentContainer.style.display = "flex";
    if (pdfPageNavControls) pdfPageNavControls.style.display = "flex";
    if (activePdfJsDoc) renderPdfPage();
    if (activePdfDoc) renderSourceContent(activePdfDoc, state.currentPdfPage);
  }
}

if (btnPdfTabVisual) {
  btnPdfTabVisual.addEventListener("click", () => setViewerTab("visual"));
}
if (btnPdfTabContent) {
  btnPdfTabContent.addEventListener("click", () => setViewerTab("content"));
}
if (btnPdfTabSplit) {
  btnPdfTabSplit.addEventListener("click", () => setViewerTab("split"));
}

async function loadPdfDocument(doc) {
  const docIdStr = String(doc._id || doc.id);
  if (pdfDocCache.has(docIdStr)) {
    return pdfDocCache.get(docIdStr);
  }
  const token = localStorage.getItem("studyvault_token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const fileUrl = `/api/notebooks/${state.currentId}/documents/${docIdStr}/file`;

  // Fetch binary ArrayBuffer directly for bulletproof PDF parsing
  const res = await fetch(fileUrl, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch document PDF (${res.status} ${res.statusText})`);
  }
  const arrayBuffer = await res.arrayBuffer();

  const loadingTask = window.pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdf = await loadingTask.promise;
  pdfDocCache.set(docIdStr, pdf);
  return pdf;
}

function detectDocumentType(doc) {
  const filename = (doc.filename || "").toLowerCase();
  const mime = (doc.mimeType || "").toLowerCase();
  const isPpt = filename.endsWith(".pptx") || filename.endsWith(".ppt") || mime.includes("presentation");
  const isDoc = filename.endsWith(".docx") || filename.endsWith(".doc") || mime.includes("word");
  const isPdf = filename.endsWith(".pdf") || mime.includes("pdf");
  const isWeb = filename.startsWith("web_") || mime.includes("html");
  return { isPpt, isDoc, isPdf, isWeb };
}

function renderSourceContent(doc, targetPage = 1, searchQuery = "") {
  if (!doc || !sourcePagesFeed) return;
  const { isPpt, isDoc, isPdf } = detectDocumentType(doc);
  const pages = Array.isArray(doc.pages) && doc.pages.length > 0 ? doc.pages : [];
  const totalPages = Math.max(1, doc.pageCount || pages.length || 1);
  const totalWords = (doc.extractedText || "").split(/\s+/).filter(Boolean).length;
  const q = (searchQuery || "").trim().toLowerCase();

  // 1. Meta strip
  if (sourceDocMetaStrip) {
    const formatName = isPpt ? "PowerPoint Slide Deck" : isDoc ? "Word Document" : isPdf ? "PDF Document" : "Text Source";
    const unitName = isPpt ? "slides" : "pages";
    const topicsHtml = (doc.keyTopics || []).slice(0, 4).map(t => `<span class="tag-badge" style="cursor:pointer;" onclick="filterSourceContent('${escapeHtml(t)}')">${escapeHtml(t)}</span>`).join(" ");

    sourceDocMetaStrip.innerHTML = `
      <div class="source-meta-tag">📄 <strong>Format:</strong> ${formatName}</div>
      <div class="source-meta-tag">📑 <strong>Length:</strong> ${totalPages} ${unitName}</div>
      <div class="source-meta-tag">📝 <strong>Words:</strong> ~${totalWords.toLocaleString()}</div>
      <div class="source-meta-tag">🛡️ <strong>Status:</strong> Grounded in verified sources</div>
      ${topicsHtml ? `<div class="source-meta-tag" style="margin-left:auto;">${topicsHtml}</div>` : ""}
    `;
  }

  // 2. Pages feed
  let matchCount = 0;
  const feedItems = [];

  for (let i = 1; i <= totalPages; i++) {
    const pageObj = pages[i - 1] || {};
    const pNum = pageObj.pageNumber || i;
    const pText = pageObj.text || (pages.length === 0 ? doc.extractedText : "") || `Content for ${isPpt ? "Slide" : "Page"} ${pNum}`;
    const pTitle = pageObj.title || (isPpt ? `Slide ${pNum}` : `Page ${pNum}`);
    const pNotes = pageObj.notes || "";

    const fullContent = `${pTitle} ${pText} ${pNotes}`;
    const isMatch = !q || fullContent.toLowerCase().includes(q);

    if (q && isMatch) {
      matchCount++;
    }

    if (!isMatch) continue;

    const isActive = pNum === targetPage;
    let highlightedText = escapeHtml(pText);
    let highlightedTitle = escapeHtml(pTitle);

    if (q) {
      const reg = new RegExp(`(${escapeRegex(q)})`, "gi");
      highlightedText = highlightedText.replace(reg, `<mark class="search-highlight">$1</mark>`);
      highlightedTitle = highlightedTitle.replace(reg, `<mark class="search-highlight">$1</mark>`);
    }

    if (isPpt) {
      // Slide Card layout
      const bullets = (pageObj.bullets && pageObj.bullets.length > 0)
        ? pageObj.bullets
        : pText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

      const bulletsHtml = bullets.map(b => {
        let bText = escapeHtml(b.replace(/^[•\-\*]\s*/, ""));
        if (q) {
          bText = bText.replace(new RegExp(`(${escapeRegex(q)})`, "gi"), `<mark class="search-highlight">$1</mark>`);
        }
        return `
          <div class="source-slide-bullet">
            <span class="source-bullet-dot"></span>
            <span>${bText}</span>
          </div>`;
      }).join("");

      feedItems.push(`
        <div class="source-page-card ${isActive ? 'current-active' : ''}" id="sourceCardPage${pNum}" data-page="${pNum}">
          <div class="source-card-top">
            <span class="source-page-num-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="21 15 16 10 5 21"/></svg>
              SLIDE ${pNum} OF ${totalPages}
            </span>
            <div class="source-slide-title">${highlightedTitle}</div>
            <div class="source-card-quick-actions">
              <button type="button" class="btn-ctrl" onclick="jumpToVisualPage(${pNum})" title="View slide in visual canvas">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>View slide</span>
              </button>
              <button type="button" class="btn-ctrl" onclick="copySlideContent(${pNum})" title="Copy slide text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
          </div>
          <div class="source-slide-bullets">
            ${bulletsHtml || `<div class="source-card-body">${highlightedText}</div>`}
          </div>
          ${pNotes ? `<div class="source-slide-notes-box"><strong>Speaker Notes:</strong> ${escapeHtml(pNotes)}</div>` : ""}
        </div>
      `);
    } else {
      // Document Page Card layout
      feedItems.push(`
        <div class="source-page-card ${isActive ? 'current-active' : ''}" id="sourceCardPage${pNum}" data-page="${pNum}">
          <div class="source-card-top">
            <span class="source-page-num-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              PAGE ${pNum} OF ${totalPages}
            </span>
            <div class="source-card-quick-actions">
              <button type="button" class="btn-ctrl" onclick="jumpToVisualPage(${pNum})" title="View page in visual canvas">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>View visual</span>
              </button>
              <button type="button" class="btn-ctrl" onclick="copySlideContent(${pNum})" title="Copy page text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
          </div>
          <div class="source-card-body">${highlightedText}</div>
        </div>
      `);
    }
  }

  if (sourceContentMatchCount) {
    if (q) {
      sourceContentMatchCount.style.display = "inline-block";
      sourceContentMatchCount.textContent = `${matchCount} match${matchCount === 1 ? "" : "es"}`;
    } else {
      sourceContentMatchCount.style.display = "none";
    }
  }

  if (feedItems.length === 0) {
    sourcePagesFeed.innerHTML = `
      <div style="padding:3rem 1rem; text-align:center; color:var(--text-muted);">
        <p style="font-size:1.1rem; font-weight:600; color:var(--text-sub); margin-bottom:0.5rem;">No matches found for "${escapeHtml(q)}"</p>
        <span>Try searching for other keywords, terms, or clear the search query.</span>
      </div>`;
  } else {
    sourcePagesFeed.innerHTML = feedItems.join("");
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

window.filterSourceContent = function(query) {
  if (sourceContentSearchInput) {
    sourceContentSearchInput.value = query;
    if (activePdfDoc) renderSourceContent(activePdfDoc, state.currentPdfPage, query);
  }
};

window.jumpToVisualPage = function(pageNum) {
  state.currentPdfPage = pageNum;
  setViewerTab("visual");
  renderPdfPage();
  showToast(`Jumped to Page ${pageNum}`);
};

window.copySlideContent = function(pageNum) {
  if (!activePdfDoc) return;
  const pages = activePdfDoc.pages || [];
  const p = pages[pageNum - 1];
  const text = p ? (p.text || p.title) : (activePdfDoc.extractedText || "");
  if (navigator.clipboard && text) {
    navigator.clipboard.writeText(text);
    showToast(`Copied text for Page/Slide ${pageNum} to clipboard!`);
  }
};

if (sourceContentSearchInput) {
  sourceContentSearchInput.addEventListener("input", (e) => {
    if (!activePdfDoc) return;
    renderSourceContent(activePdfDoc, state.currentPdfPage, e.target.value);
  });
}

if (btnCopyPageText) {
  btnCopyPageText.addEventListener("click", () => {
    copySlideContent(state.currentPdfPage);
  });
}

if (btnCopyAllText) {
  btnCopyAllText.addEventListener("click", () => {
    if (!activePdfDoc) return;
    const text = activePdfDoc.extractedText || "";
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text);
      showToast(`Copied all document text (~${text.length} characters) to clipboard!`);
    }
  });
}

async function openPdfModal(docIdOrName, pageNum = 1) {
  if (!state.documents || state.documents.length === 0) {
    return showToast("No documents found in this notebook.");
  }
  const query = String(docIdOrName || "").trim().toLowerCase();
  let doc = state.documents.find((d) => String(d._id) === String(docIdOrName));
  if (!doc) {
    doc = state.documents.find((d) => d.filename.toLowerCase() === query)
      || state.documents.find((d) => d.filename.toLowerCase().includes(query))
      || state.documents.find((d) => query.includes(d.filename.toLowerCase()))
      || state.documents.find((d) => d.filename.toLowerCase().replace(/\.[^/.]+$/, "") === query.replace(/\.[^/.]+$/, ""))
      || state.documents.find((d) => d.filename.toLowerCase().replace(/\s+/g, "").includes(query.replace(/\s+/g, "")));
  }
  if (!doc) {
    doc = state.documents[0];
  }

  // Fetch full document details from server to ensure fresh pages, text, and structure
  try {
    const fullDoc = await api(`/notebooks/${state.currentId}/documents/${doc._id}`);
    if (fullDoc) {
      if (Array.isArray(fullDoc.pages) && fullDoc.pages.length > 0) doc.pages = fullDoc.pages;
      if (fullDoc.extractedText) doc.extractedText = fullDoc.extractedText;
      if (fullDoc.pageCount) doc.pageCount = fullDoc.pageCount;
      if (fullDoc.summary) doc.summary = fullDoc.summary;
      if (fullDoc.keyTopics) doc.keyTopics = fullDoc.keyTopics;
    }
  } catch (err) {
    console.warn("[openPdfModal] Could not fetch fresh doc details:", err.message);
  }

  activePdfDoc = doc;
  state.activePdfDoc = doc;
  state.currentPdfPage = Math.max(1, parseInt(pageNum, 10) || 1);

  pdfModalTitle.textContent = doc.filename;

  const { isPpt, isDoc, isPdf } = detectDocumentType(doc);

  if (pdfSourceTypeBadge) {
    pdfSourceTypeBadge.textContent = isPpt ? "SLIDES" : isDoc ? "DOCX" : isPdf ? "PDF" : "TEXT";
  }

  if (btnPdfDownloadLabel) {
    btnPdfDownloadLabel.textContent = isPpt ? "PPTX" : isDoc ? "DOCX" : isPdf ? "PDF" : "Download";
  }

  const totalPages = Math.max(1, doc.pageCount || (doc.pages && doc.pages.length) || 1);
  if (pdfTotalPages) pdfTotalPages.textContent = `/ ${totalPages}`;
  pdfPageJumpInput.max = totalPages;
  if (state.currentPdfPage > totalPages) state.currentPdfPage = totalPages;

  // Render the source content view
  renderSourceContent(doc, state.currentPdfPage);

  // Set default tab to visual view
  setViewerTab(currentViewerTab || "visual");

  pdfModal.classList.add("show");
  if (pdfLoadingSpinner) pdfLoadingSpinner.style.display = "flex";
  pdfCanvas.style.display = "none";
  pdfTextFallback.style.display = "none";

  try {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js library is not available.");
    }
    const pdf = await loadPdfDocument(doc);
    activePdfJsDoc = pdf;
    state.activePdfJsDoc = pdf;

    const realPages = pdf.numPages || totalPages;
    if (pdfTotalPages) pdfTotalPages.textContent = `/ ${realPages}`;
    pdfPageJumpInput.max = realPages;
    if (state.currentPdfPage > realPages) state.currentPdfPage = realPages;

    await renderPdfPage();
  } catch (err) {
    console.error("[PDF.js] Load error:", err);
    if (pdfLoadingSpinner) pdfLoadingSpinner.style.display = "none";
    pdfCanvas.style.display = "none";
    pdfTextFallback.style.display = "block";

    // Clean readable fallback of real page content
    const pages = doc.pages || [];
    const pObj = pages[state.currentPdfPage - 1];
    const realText = pObj ? (pObj.text || pObj.title) : (doc.extractedText || "No text content available.");

    pdfTextFallback.innerHTML = `
      <div style="padding:1.5rem; max-width:760px; margin:0 auto; background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.75rem;">
          <h4 style="color:var(--primary-blue); font-weight:700; margin:0;">
            ${isPpt ? "📊 Slide" : "📄 Page"} ${state.currentPdfPage} of ${totalPages}
          </h4>
          <button type="button" class="btn-ctrl" onclick="setViewerTab('content')">
            Switch to Source Content View ↗
          </button>
        </div>
        <div style="color:#e2e8f0; line-height:1.7; font-size:0.95rem; white-space:pre-wrap;">${escapeHtml(realText)}</div>
      </div>`;
    pdfPageIndicator.textContent = `${isPpt ? "Slide" : "Page"} ${state.currentPdfPage} of ${totalPages}`;
  }
}

async function renderPdfPage() {
  if (!activePdfJsDoc) return;
  const pNum = state.currentPdfPage;
  const totalPages = activePdfJsDoc.numPages || 1;
  const isPpt = activePdfDoc ? detectDocumentType(activePdfDoc).isPpt : false;

  pdfPageIndicator.textContent = `${isPpt ? "Slide" : "Page"} ${pNum} of ${totalPages}`;
  pdfPageJumpInput.value = pNum;
  btnPdfPrev.disabled = pNum <= 1;
  btnPdfNext.disabled = pNum >= totalPages;

  if (pdfLoadingSpinner) pdfLoadingSpinner.style.display = "flex";

  try {
    if (currentRenderTask) {
      try { currentRenderTask.cancel(); } catch (_) {}
      currentRenderTask = null;
    }
    const page = await activePdfJsDoc.getPage(pNum);
    let scale = pdfZoomScale;
    if (isFitToWidth && pdfViewContainer) {
      const containerWidth = Math.max(300, (pdfViewContainer.clientWidth || 800) - 64);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      scale = containerWidth / unscaledViewport.width;
      pdfZoomScale = scale;
    }
    if (pdfZoomLevel) {
      pdfZoomLevel.textContent = Math.round(pdfZoomScale * 100) + "%";
    }

    const outputScale = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale });

    pdfCanvas.width = Math.floor(viewport.width * outputScale);
    pdfCanvas.height = Math.floor(viewport.height * outputScale);
    pdfCanvas.style.width = Math.floor(viewport.width) + "px";
    pdfCanvas.style.height = Math.floor(viewport.height) + "px";

    const ctx = pdfCanvas.getContext("2d");
    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    currentRenderTask = page.render(renderContext);
    await currentRenderTask.promise;
    currentRenderTask = null;

    if (pdfLoadingSpinner) pdfLoadingSpinner.style.display = "none";
    pdfCanvas.style.display = "block";
    pdfTextFallback.style.display = "none";
  } catch (err) {
    if (err && err.name === "RenderingCancelledException") {
      return;
    }
    console.error("[PDF.js] Render error:", err);
    if (pdfLoadingSpinner) pdfLoadingSpinner.style.display = "none";
  }
}

btnPdfPrev.addEventListener("click", () => {
  if (state.currentPdfPage > 1) {
    state.currentPdfPage--;
    renderPdfPage();
  }
});

btnPdfNext.addEventListener("click", () => {
  const max = activePdfJsDoc ? activePdfJsDoc.numPages : (activePdfDoc?.pageCount || 1);
  if (state.currentPdfPage < max) {
    state.currentPdfPage++;
    renderPdfPage();
  }
});

pdfPageJumpInput.addEventListener("change", (e) => {
  const val = parseInt(e.target.value, 10);
  const max = activePdfJsDoc ? activePdfJsDoc.numPages : (activePdfDoc?.pageCount || 1);
  if (val >= 1 && val <= max) {
    state.currentPdfPage = val;
    renderPdfPage();
  } else {
    e.target.value = state.currentPdfPage;
  }
});

if (btnPdfZoomIn) {
  btnPdfZoomIn.addEventListener("click", () => {
    isFitToWidth = false;
    pdfZoomScale = Math.min(3.0, Number((pdfZoomScale + 0.2).toFixed(1)));
    renderPdfPage();
  });
}

if (btnPdfZoomOut) {
  btnPdfZoomOut.addEventListener("click", () => {
    isFitToWidth = false;
    pdfZoomScale = Math.max(0.5, Number((pdfZoomScale - 0.2).toFixed(1)));
    renderPdfPage();
  });
}

if (btnPdfFit) {
  btnPdfFit.addEventListener("click", () => {
    isFitToWidth = !isFitToWidth;
    renderPdfPage();
    showToast(isFitToWidth ? "Fit to Width enabled" : "Standard 100% Zoom");
  });
}

if (btnPdfDownload) {
  btnPdfDownload.addEventListener("click", () => {
    if (!activePdfDoc) return;
    const url = `/api/notebooks/${state.currentId}/documents/${activePdfDoc._id}/raw`;
    window.open(url, "_blank");
  });
}

const btnPdfDeleteSource = document.getElementById("btnPdfDeleteSource");
if (btnPdfDeleteSource) {
  btnPdfDeleteSource.addEventListener("click", () => {
    if (!activePdfDoc) return;
    const docId = String(activePdfDoc._id || activePdfDoc.id);
    const docName = activePdfDoc.filename || "this source";
    const targetNbId = state.currentId || activePdfDoc.notebookId;

    showConfirmDialog({
      title: "Remove Source",
      message: `Are you sure you want to remove "${docName}" from this notebook? This action will remove its text content and citations.`,
      confirmText: "Remove",
      onConfirm: async () => {
        try {
          const url = targetNbId
            ? `/notebooks/${targetNbId}/documents/${docId}`
            : `/documents/${docId}`;
          await api(url, { method: "DELETE" });
          state.documents = state.documents.filter((d) => String(d._id || d.id) !== String(docId));
          pdfDocCache.delete(docId);
          pdfModal.classList.remove("show");
          if (currentRenderTask) {
            try { currentRenderTask.cancel(); } catch (_) {}
            currentRenderTask = null;
          }
          activePdfDoc = null;
          renderSources();
          updateGenerationScopeUI();
          updateStudioLockedState();
          renderChat();
          showToast(`"${docName}" removed from notebook.`);
        } catch (err) {
          showToast(err.message || "Failed to remove source");
        }
      }
    });
  });
}

closePdfModalBtn.addEventListener("click", () => {
  pdfModal.classList.remove("show");
  if (currentRenderTask) {
    try { currentRenderTask.cancel(); } catch (_) {}
    currentRenderTask = null;
  }
});

// Keyboard Navigation for Viewer
window.addEventListener("keydown", (e) => {
  if (!pdfModal.classList.contains("show")) return;
  if (e.key === "Escape") {
    pdfModal.classList.remove("show");
  } else if (e.key === "ArrowLeft") {
    if (state.currentPdfPage > 1) {
      state.currentPdfPage--;
      renderPdfPage();
    }
  } else if (e.key === "ArrowRight") {
    const max = activePdfJsDoc ? activePdfJsDoc.numPages : (activePdfDoc?.pageCount || 1);
    if (state.currentPdfPage < max) {
      state.currentPdfPage++;
      renderPdfPage();
    }
  } else if (e.key === "+" || e.key === "=") {
    isFitToWidth = false;
    pdfZoomScale = Math.min(3.0, Number((pdfZoomScale + 0.2).toFixed(1)));
    renderPdfPage();
  } else if (e.key === "-") {
    isFitToWidth = false;
    pdfZoomScale = Math.max(0.5, Number((pdfZoomScale - 0.2).toFixed(1)));
    renderPdfPage();
  }
});


// --- CHAT ---
async function loadMessages() {
  state.messages = await api(`/notebooks/${state.currentId}/chat`);
  renderChat();
}

function updateStudioLockedState() {
  const hasDocs = state.documents && state.documents.length > 0;
  const lockedStateEl = document.getElementById("studioLockedState");
  const categoryBarEl = document.querySelector(".studio-category-bar");
  const categorizedTabsEl = document.querySelector(".studio-tabs-categorized");
  const tabContentEl = document.querySelector(".studio-tab-content");

  if (lockedStateEl) {
    lockedStateEl.style.display = "none";
  }
  if (categorizedTabsEl) {
    categorizedTabsEl.classList.remove("is-locked");
  }
  if (categoryBarEl) {
    categoryBarEl.style.opacity = "1";
    categoryBarEl.style.pointerEvents = "auto";
  }
  if (tabContentEl) {
    tabContentEl.style.display = "block";
  }

  const chatInputEl = document.getElementById("chatInput");
  const chatInputHintEl = document.getElementById("chatInputHint");
  if (chatInputEl) {
    chatInputEl.placeholder = hasDocs
      ? "Ask a question about your uploaded study sources..."
      : "Add a source to start asking questions with citations...";
  }
  if (chatInputHintEl) {
    chatInputHintEl.textContent = hasDocs
      ? "Press Enter to ask • Verifiable citations included automatically"
      : "Upload or add a source above to begin grounded research";
  }
}

function renderChat() {
  updateStudioLockedState();

  if (state.messages.length === 0) {
    chatLog.innerHTML = "";
    chatLog.appendChild(chatEmpty);
    chatEmpty.style.display = "block";
    renderSuggestedQuestions();
    return;
  }

  chatEmpty.style.display = "none";
  chatLog.innerHTML = state.messages
    .map((m) => {
      const formattedContent = parseMarkdownToHtml(m.content);
      const actions = m.role === "assistant" ? `
        <div class="msg-actions">
          <button class="btn-msg-action" data-pin="${escapeHtml(m.content.slice(0, 120))}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>Pin note</span>
          </button>
          <button class="btn-msg-action" data-copy="${escapeHtml(m.content)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy</span>
          </button>
          <button class="btn-msg-action" data-speak="${escapeHtml(m.content)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <span>Listen</span>
          </button>
        </div>` : "";

      return `
        <div class="msg ${m.role}">
          <div class="msg-bubble">${formattedContent}</div>
          ${actions}
        </div>`;
    })
    .join("");

  chatLog.scrollTop = chatLog.scrollHeight;

  chatLog.querySelectorAll(".citation-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      openPdfModal(chip.dataset.doc, chip.dataset.page || 1);
    });
  });

  chatLog.querySelectorAll("[data-pin]").forEach((btn) => {
    btn.addEventListener("click", () => pinChatNote(btn.dataset.pin));
  });

  chatLog.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      showToast("Copied to clipboard!");
    });
  });

  chatLog.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => speakText(btn.dataset.speak));
  });
}

// Global citation click delegation across the entire app (Chat, Flashcards, Quiz, Important Questions, Notes, etc.)
document.body.addEventListener("click", (e) => {
  const chip = e.target.closest(".citation-chip");
  if (chip && chip.dataset.doc) {
    e.preventDefault();
    e.stopPropagation();
    openPdfModal(chip.dataset.doc, chip.dataset.page || 1);
  }
});

function renderSuggestedQuestions() {
  const centerEmptyState = document.getElementById("centerEmptyState");
  const starterPromptsSection = document.getElementById("starterPromptsSection");
  const starterPromptsGrid = document.getElementById("starterPromptsGrid");
  const chatSourceBadge = document.getElementById("chatSourceBadge");

  const hasDocs = state.documents && state.documents.length > 0;

  if (chatSourceBadge) {
    chatSourceBadge.innerHTML = hasDocs
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Citing ${state.documents.length} source${state.documents.length > 1 ? "s" : ""}</span>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>0 sources attached</span>`;
  }

  if (!hasDocs) {
    if (centerEmptyState) centerEmptyState.style.display = "flex";
    if (starterPromptsSection) starterPromptsSection.style.display = "none";
    return;
  }

  // Documents exist! Show starter prompts grid
  if (centerEmptyState) centerEmptyState.style.display = "none";
  if (starterPromptsSection) starterPromptsSection.style.display = "block";

  // Gather questions from documents or smart academic defaults
  let questions = [];
  state.documents.forEach((doc) => {
    if (doc.suggestedQuestions && Array.isArray(doc.suggestedQuestions)) {
      questions.push(...doc.suggestedQuestions);
    }
  });

  const docTitle = state.documents[0]?.filename ? state.documents[0].filename.replace(/\.[^/.]+$/, "") : "uploaded material";

  const starterPromptList = [
    {
      title: "Core Thesis & Summary",
      desc: `High-level synthesis of ${docTitle}`,
      prompt: `Summarize the key concepts, main thesis, and findings of ${docTitle} with exact page citations`,
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    },
    {
      title: "Technical Mechanism",
      desc: "Step-by-step breakdown with concrete examples",
      prompt: `Explain the core mechanisms and principles in simple terms with examples from the material`,
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
    },
    {
      title: "5-Mark Exam Breakdown",
      desc: "Definition, components, working & citations",
      prompt: `Generate a 5-mark structured exam answer with page citations based on these documents`,
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
    },
    {
      title: "Definitions & Key Terms",
      desc: "Critical formulas, laws, and definitions",
      prompt: `List the most essential definitions, laws, protocols, and formulas with their page references`,
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
    }
  ];

  if (starterPromptsGrid) {
    starterPromptsGrid.innerHTML = starterPromptList
      .map((item) => `
        <button type="button" class="starter-prompt-card" data-prompt="${escapeHtml(item.prompt)}">
          <span class="starter-prompt-icon">${item.icon}</span>
          <div class="starter-prompt-body">
            <div class="starter-prompt-title">${escapeHtml(item.title)}</div>
            <div class="starter-prompt-desc">${escapeHtml(item.desc)}</div>
          </div>
        </button>
      `)
      .join("");

    starterPromptsGrid.querySelectorAll(".starter-prompt-card").forEach((card) => {
      card.addEventListener("click", () => {
        const prompt = card.dataset.prompt;
        if (!prompt) return;
        chatInput.value = prompt;
        chatForm.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    });
  }
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question || !state.currentId) return;

  chatInput.value = "";
  sendBtn.disabled = true;

  state.messages.push({ role: "user", content: question });
  state.messages.push({ role: "assistant", content: "Analyzing sources..." });
  renderChat();

  try {
    const { userMessage, assistantMessage } = await api(`/notebooks/${state.currentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ question, mode: state.answerStyle || "study-notes" }),
    });
    state.messages.pop(); state.messages.pop();
    state.messages.push(userMessage, assistantMessage);
    renderChat();
  } catch (err) {
    state.messages.pop(); renderChat();
    showToast(err.message);
  } finally {
    sendBtn.disabled = false;
  }
});

function setupAnswerStyleControls() {
  const bar = document.getElementById("chatAnswerStylesBar");
  if (!bar) return;
  const chips = bar.querySelectorAll(".answer-style-chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.answerStyle = chip.dataset.style || "study-notes";
    });
  });
}

// --- AUDIO OVERVIEW ---
generateAudioBtn.addEventListener("click", async () => {
  if (!state.currentId) return;
  generateAudioBtn.disabled = true;
  generateAudioBtn.textContent = "Generating Podcast Dialogue...";

  try {
    state.audioScript = await api(`/notebooks/${state.currentId}/studio/audio-overview`, { method: "POST" });
    renderAudioOverview();
  } catch (err) { showToast(err.message); }
  finally {
    generateAudioBtn.disabled = false;
    generateAudioBtn.textContent = "Regenerate Audio Overview";
  }
});

function renderAudioOverview() {
  if (!state.audioScript) return;
  podcastPlayerCard.style.display = "flex";

  transcriptContainer.innerHTML = state.audioScript.turns
    .map(
      (turn, i) => `
      <div class="transcript-turn ${i === state.audioTurnIndex ? "active" : ""}" id="turn-${i}">
        <div class="speaker-tag speaker-${turn.speaker}">${turn.speaker}</div>
        <div>${escapeHtml(turn.text)}</div>
      </div>`
    )
    .join("");
}

btnAudioPlay.addEventListener("click", () => {
  if (state.isPlayingAudio) pauseAudioPlayback(); else startAudioPlayback();
});

btnAudioSkipBack.addEventListener("click", () => {
  state.audioTurnIndex = Math.max(0, state.audioTurnIndex - 1);
  if (state.isPlayingAudio) playCurrentTurn(); else renderAudioOverview();
});

btnAudioSkipFwd.addEventListener("click", () => {
  if (!state.audioScript) return;
  state.audioTurnIndex = Math.min(state.audioScript.turns.length - 1, state.audioTurnIndex + 1);
  if (state.isPlayingAudio) playCurrentTurn(); else renderAudioOverview();
});

audioSpeedSelect.addEventListener("change", (e) => {
  state.audioSpeed = parseFloat(e.target.value);
});

function startAudioPlayback() {
  if (!state.audioScript || !window.speechSynthesis) return showToast("Speech synthesis not supported.");
  state.isPlayingAudio = true;
  btnAudioPlay.textContent = "⏸ Pause Podcast";
  startWaveformAnim();
  playCurrentTurn();
}

function pauseAudioPlayback() {
  state.isPlayingAudio = false;
  btnAudioPlay.textContent = "▶ Play Podcast";
  window.speechSynthesis.cancel();
  stopWaveformAnim();
}

function stopAudioPlayback() {
  state.isPlayingAudio = false;
  state.audioTurnIndex = 0;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  stopWaveformAnim();
}

function playCurrentTurn() {
  if (!state.isPlayingAudio || !state.audioScript) return;
  if (state.audioTurnIndex >= state.audioScript.turns.length) {
    stopAudioPlayback(); showToast("Podcast completed!"); return;
  }

  renderAudioOverview();
  const turn = state.audioScript.turns[state.audioTurnIndex];
  const turnEl = document.getElementById(`turn-${state.audioTurnIndex}`);
  if (turnEl) turnEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(turn.text);
  utt.rate = state.audioSpeed;

  const voices = window.speechSynthesis.getVoices();
  if (turn.speaker === "Sierra") {
    utt.pitch = 1.2;
    if (voices.length > 1) utt.voice = voices.find((v) => v.name.includes("Female") || v.name.includes("Google")) || voices[1];
  } else {
    utt.pitch = 0.9;
    if (voices.length > 0) utt.voice = voices.find((v) => v.name.includes("Male") || v.name.includes("David")) || voices[0];
  }

  utt.onend = () => { if (state.isPlayingAudio) { state.audioTurnIndex++; playCurrentTurn(); } };
  utt.onerror = () => { if (state.isPlayingAudio) { state.audioTurnIndex++; playCurrentTurn(); } };
  window.speechSynthesis.speak(utt);
}

let animReq = null;
function startWaveformAnim() {
  const ctx = waveformCanvas.getContext("2d");
  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    for (let i = 0; i < 22; i++) {
      const h = Math.abs(Math.sin(t + i * 0.3)) * 30 + 6;
      const x = i * 10;
      const y = (waveformCanvas.height - h) / 2;
      ctx.fillStyle = i % 2 === 0 ? "#8ab4f8" : "#c58af9";
      ctx.beginPath(); ctx.roundRect(x, y, 6, h, 3); ctx.fill();
    }
    t += 0.15;
    animReq = requestAnimationFrame(draw);
  }
  draw();
}

function stopWaveformAnim() {
  if (animReq) cancelAnimationFrame(animReq);
  const ctx = waveformCanvas.getContext("2d");
  ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utt);
}

// --- BRIEFING & EXPORT ---
generateBriefingBtn.addEventListener("click", async () => {
  if (!state.currentId) return;
  generateBriefingBtn.disabled = true;
  try {
    state.briefing = await api(`/notebooks/${state.currentId}/studio/briefing`, { method: "POST" });
    renderBriefing();
  } catch (err) { showToast(err.message); }
  finally { generateBriefingBtn.disabled = false; }
});

function renderBriefing() {
  if (!state.briefing) return;
  const b = state.briefing;
  briefingContent.innerHTML = `
    <div class="briefing-doc-box">
      <h3>${escapeHtml(b.title)}</h3>
      <p style="font-size:0.88rem; margin-bottom:1rem;">${escapeHtml(b.executiveSummary)}</p>
      <h4 style="font-size:0.9rem; font-weight:700; margin-bottom:0.4rem; color:var(--primary-cyan)">Key Takeaways</h4>
      <ul class="briefing-takeaways">${(b.keyTakeaways || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
    </div>`;
}

exportBriefingMdBtn.addEventListener("click", () => {
  if (!state.briefing) return showToast("Generate a Briefing Doc first.");
  const b = state.briefing;
  const md = `# ${b.title}\n\n## Executive Summary\n${b.executiveSummary}\n\n## Key Takeaways\n${(b.keyTakeaways || []).map(t => `- ${t}`).join("\n")}`;
  downloadFile(`${notebookTitle.textContent}_Briefing.md`, md, "text/markdown");
  showToast("Exported Briefing Doc as Markdown!");
});

// --- FLASHCARDS & SPACED REPETITION ---
generateCardsBtn.addEventListener("click", async () => {
  if (!state.currentId) return showToast("Select a notebook first.");

  const scope = genScopes.flashcards || "all";
  let topic = "";
  let documentIds = [];

  if (scope === "topic") {
    const custom = document.getElementById("fcCustomTopicInput")?.value.trim();
    const selected = document.getElementById("fcTopicSelect")?.value;
    topic = custom || selected || "";
    if (!topic) return showToast("Please select or enter a topic for flashcard generation.");
  } else if (scope === "source") {
    const checked = Array.from(document.querySelectorAll("#fcDocCheckboxesGrid input:checked")).map(cb => cb.value);
    if (checked.length === 0) return showToast("Please select at least one document source.");
    documentIds = checked;
  }

  const count = parseInt(document.getElementById("fcCardCountSelect")?.value, 10) || 10;

  generateCardsBtn.disabled = true;
  generateCardsBtn.textContent = "⏳ Generating...";
  try {
    const data = await api(`/notebooks/${state.currentId}/studio/flashcards`, {
      method: "POST",
      body: JSON.stringify({ scopeType: scope, topic, documentIds, count })
    });
    state.flashcards = data.cards || (Array.isArray(data) ? data : []);
    state.cardIndex = 0;
    state.cardRatings = {};
    renderFlashcards();
    showToast(`✨ Generated ${state.flashcards.length} grounded flashcards!`);
  } catch (err) {
    showToast(err.message);
  } finally {
    generateCardsBtn.disabled = false;
    generateCardsBtn.textContent = "✨ Generate";
  }
});

function renderFlashcards() {
  if (!state.flashcards || state.flashcards.length === 0) {
    flashcardsWrapper.innerHTML = `<p class="tab-empty">No flashcards generated yet. Choose your scope above and click "Generate".</p>`;
    masteryBarWrapper.style.display = "none";
    return;
  }
  masteryBarWrapper.style.display = "block";
  updateMasteryProgress();

  const card = state.flashcards[state.cardIndex];
  const currentRating = state.cardRatings[card.id] || "unrated";

  const fn = (card.source && card.source.filename) || (card.sourceRef ? card.sourceRef.split(",")[0].trim() : "Source");
  const pNum = (card.source && card.source.pageNumber) || (card.sourceRef && parseInt(card.sourceRef.replace(/[^0-9]/g, ""), 10)) || 1;
  const citationDisplay = card.source
    ? `${card.source.filename}, p.${card.source.pageNumber}`
    : (card.sourceRef || `${fn}, p.${pNum}`);

  flashcardsWrapper.innerHTML = `
    <div class="flashcard-container">
      <div class="flashcard" id="activeFlashcard">
        <div class="card-face card-front">
          <div class="card-label">Question (${state.cardIndex + 1}/${state.flashcards.length})</div>
          <div class="card-text">${escapeHtml(card.question)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:1rem">Click card to flip ↺</div>
        </div>
        <div class="card-face card-back">
          <div class="card-label">Answer</div>
          <div class="card-text">${escapeHtml(card.answer)}</div>
          <button type="button" class="flashcard-source-citation" id="fcCitationBtn" title="Jump to page in PDF Reader">
            📄 [${escapeHtml(citationDisplay)}] • Open in PDF Viewer ↗
          </button>
        </div>
      </div>
    </div>

    <!-- Leitner Self-Grading Buttons -->
    <div class="card-rating-buttons">
      <button class="btn-rate btn-rate-hard" data-rate="hard">🔴 Hard</button>
      <button class="btn-rate btn-rate-med" data-rate="med">🟡 Medium</button>
      <button class="btn-rate btn-rate-easy" data-rate="easy">🟢 Easy</button>
    </div>

    <div class="deck-nav" style="margin-top:0.75rem">
      <button class="btn-ctrl" id="prevCardBtn">← Previous</button>
      <span style="font-size:0.8rem; color:var(--text-muted)">Card ${state.cardIndex + 1} of ${state.flashcards.length}</span>
      <button class="btn-ctrl" id="nextCardBtn">Next →</button>
    </div>`;

  const fc = document.getElementById("activeFlashcard");
  fc.addEventListener("click", (e) => {
    if (e.target.closest("#fcCitationBtn")) return;
    fc.classList.toggle("flipped");
  });

  const citBtn = document.getElementById("fcCitationBtn");
  if (citBtn) {
    citBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPdfModal(fn, pNum);
    });
  }

  flashcardsWrapper.querySelectorAll("[data-rate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cardRatings[card.id] = btn.dataset.rate;
      updateMasteryProgress();
      showToast(`Rated card: ${btn.dataset.rate.toUpperCase()}`);
    });
  });

  document.getElementById("prevCardBtn").addEventListener("click", () => {
    state.cardIndex = (state.cardIndex - 1 + state.flashcards.length) % state.flashcards.length; renderFlashcards();
  });
  document.getElementById("nextCardBtn").addEventListener("click", () => {
    state.cardIndex = (state.cardIndex + 1) % state.flashcards.length; renderFlashcards();
  });
}

function updateMasteryProgress() {
  if (!state.flashcards || state.flashcards.length === 0) return;
  const total = state.flashcards.length;
  const easyCount = Object.values(state.cardRatings).filter(r => r === "easy").length;
  const pct = Math.round((easyCount / total) * 100);

  masteryPercent.textContent = `${pct}%`;
  masteryCount.textContent = `${easyCount} / ${total} Mastered`;
  masteryFill.style.width = `${pct}%`;
}

exportAnkiCsvBtn.addEventListener("click", () => {
  if (!state.flashcards || state.flashcards.length === 0) return showToast("Generate Flashcards first.");
  const csv = state.flashcards.map(c => {
    const cit = c.source ? `${c.source.filename}, p.${c.source.pageNumber}` : (c.sourceRef || 'p.1');
    return `"${c.question.replace(/"/g, '""')}","${c.answer.replace(/"/g, '""')} [${cit}]"`;
  }).join("\n");
  downloadFile(`${notebookTitle.textContent}_AnkiDeck.csv`, csv, "text/csv");
  showToast("Exported Anki CSV Deck!");
});

// --- QUIZ & IMPORTANT QUESTIONS & COMPARE & MIND MAP & SLIDES & DATA TABLE ---
if (generateQuizBtn) {
  generateQuizBtn.addEventListener("click", async () => {
    if (!state.currentId) {
      showToast("Please select a notebook first");
      return;
    }
    if (!state.documents || state.documents.length === 0) {
      showToast("Add a source to start an interactive quiz");
      return;
    }
    generateQuizBtn.disabled = true;
    generateQuizBtn.textContent = "⏳ Generating...";
    try {
      const { scopeType, topic, documentIds } = getScopeParams("quiz", "quiz");
      const count = parseInt(document.getElementById("quizCountSelect")?.value || "6");
      const data = await api(`/notebooks/${state.currentId}/studio/quiz`, {
        method: "POST",
        body: JSON.stringify({ scopeType, topic, documentIds, count })
      });
      state.quiz = data.questions || [];
      state.quizAnswers = {};
      renderQuiz();
      showToast("🎯 Practice Quiz Ready!");
    } catch (err) {
      showToast(err.message || "Failed to generate quiz");
    } finally {
      generateQuizBtn.disabled = false;
      generateQuizBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        <span>Start quiz</span>`;
    }
  });
}

function renderQuiz() {
  if (!quizWrapper) return;
  if (!state.quiz || state.quiz.length === 0) {
    quizWrapper.innerHTML = `<p class="tab-empty">Choose your scope and click "Start Quiz" to launch a source-grounded practice test.</p>`;
    return;
  }
  quizWrapper.innerHTML = state.quiz
    .map((q, qIdx) => {
      const selected = state.quizAnswers[qIdx];
      const optionsHtml = q.options
        .map((opt, optIdx) => {
          let cls = "";
          if (selected !== undefined) {
            if (optIdx === q.correctIndex) cls = "correct";
            else if (optIdx === selected) cls = "wrong";
          }
          return `<button class="quiz-opt-btn ${cls}" data-qidx="${qIdx}" data-optidx="${optIdx}">${escapeHtml(opt)}</button>`;
        })
        .join("");
      const citChip = q.citation ? parseMarkdownToHtml(`[${q.citation}]`) : "";
      const exp = selected !== undefined ? `<div class="quiz-explanation">💡 <strong>Explanation:</strong> ${escapeHtml(q.explanation)} ${citChip}</div>` : "";
      return `<div class="quiz-card"><div class="quiz-q-title">Q${qIdx + 1}. ${escapeHtml(q.question)}</div><div class="quiz-options">${optionsHtml}</div>${exp}</div>`;
    }).join("");

  quizWrapper.querySelectorAll(".quiz-opt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.quizAnswers[parseInt(btn.dataset.qidx)] = parseInt(btn.dataset.optidx);
      renderQuiz();
    });
  });
}

if (generateImportantBtn) {
  generateImportantBtn.addEventListener("click", async () => {
    if (!state.currentId) {
      showToast("Please select a notebook first");
      return;
    }
    if (!state.documents || state.documents.length === 0) {
      showToast("Add a source to extract practice questions");
      return;
    }
    generateImportantBtn.disabled = true;
    generateImportantBtn.textContent = "⏳ Extracting...";
    try {
      const { scopeType, topic, documentIds } = getScopeParams("iq", "important");
      state.importantQuestions = await api(`/notebooks/${state.currentId}/studio/important-questions`, {
        method: "POST",
        body: JSON.stringify({ scopeType, topic, documentIds })
      });
      renderImportantQuestions();
      showToast("✨ Grounded Practice Questions Extracted!");
    } catch (err) {
      showToast(err.message || "Failed to extract questions");
    } finally {
      generateImportantBtn.disabled = false;
      generateImportantBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Extract questions</span>`;
    }
  });
}

function renderImportantQuestions() {
  if (!importantWrapper) return;
  if (!state.importantQuestions) {
    importantWrapper.innerHTML = `<p class="tab-empty">Choose your scope and click "Extract Questions" to generate grounded test your understanding questions.</p>`;
    return;
  }
  const iq = state.importantQuestions;
  const filter = state.examFilter || "all";

  const twoMarkList = (iq.twoMark && iq.twoMark.length > 0) ? iq.twoMark : (iq.veryImportant || []);
  const fiveMarkList = (iq.fiveMark && iq.fiveMark.length > 0) ? iq.fiveMark : (iq.important || []);
  const tenMarkList = (iq.tenMark && iq.tenMark.length > 0) ? iq.tenMark : (iq.possible || []);

  const renderGroup = (items, badgeCls, badgeText) => items.map((q) => {
    const keyPointsHtml = Array.isArray(q.keyPoints) && q.keyPoints.length > 0
      ? `<div style="margin-top:0.45rem;">
          <strong style="font-size:0.75rem; color:var(--text-main);">Key Expected Points:</strong>
          <ul class="q-key-points-list">${q.keyPoints.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
        </div>`
      : "";

    let rawCit = (q.citation || "").trim();
    let cleanCit = rawCit
      .replace(/^\[+|\]+$/g, "")
      .replace(/^Source\s*\d+:\s*/i, "")
      .trim();

    const citationHtml = cleanCit
      ? `<div style="margin-top:0.4rem; display:flex; align-items:center; gap:0.35rem;">
          <span style="font-size:0.72rem; color:var(--text-sub);">Source Citation:</span>
          ${parseMarkdownToHtml(`[${cleanCit}]`)}
        </div>`
      : `<div style="margin-top:0.4rem; font-size:0.72rem; color:var(--text-muted); font-style:italic;">
          Source Citation: Verified from source passage (Page citation unavailable)
        </div>`;

    let cleanReason = (q.reason || "").trim()
      .replace(/frequently tested on basic recall\.?/gi, "")
      .replace(/frequently tested\.?/gi, "")
      .trim();

    return `
    <div class="quiz-card" style="margin-bottom:0.75rem">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="${badgeCls}">${badgeText}</span>
        ${q.marks ? `<span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Weight: ${q.marks} Marks</span>` : ""}
      </div>
      <div class="quiz-q-title" style="margin-top:0.35rem; font-weight:600; font-size:0.92rem; color:var(--text-main); line-height:1.4;">${escapeHtml(q.question)}</div>
      ${keyPointsHtml}
      ${cleanReason ? `<div style="font-size:0.76rem; color:var(--text-sub); margin-top:0.35rem">💡 <em>${escapeHtml(cleanReason)}</em></div>` : ""}
      ${citationHtml}
    </div>`;
  }).join("");

  let sectionsHtml = "";
  if (filter === "all" || filter === "2mark") {
    sectionsHtml += `
      <div style="margin-bottom:1.5rem">
        <h3 style="font-size:0.95rem; font-weight:700; color:#38bdf8; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
          <span>📝</span> 2-Mark Short & Definition Questions
        </h3>
        ${twoMarkList.length > 0 ? renderGroup(twoMarkList, 'q-badge-2mark', '2 MARKS') : '<p class="tab-empty">No 2-mark questions generated.</p>'}
      </div>
    `;
  }
  if (filter === "all" || filter === "5mark") {
    sectionsHtml += `
      <div style="margin-bottom:1.5rem">
        <h3 style="font-size:0.95rem; font-weight:700; color:#c58af9; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
          <span>⭐</span> 5-Mark Analytical & Procedural Questions
        </h3>
        ${fiveMarkList.length > 0 ? renderGroup(fiveMarkList, 'q-badge-5mark', '5 MARKS') : '<p class="tab-empty">No 5-mark questions generated.</p>'}
      </div>
    `;
  }
  if (filter === "all" || filter === "10mark") {
    sectionsHtml += `
      <div style="margin-bottom:1.5rem">
        <h3 style="font-size:0.95rem; font-weight:700; color:#f43f5e; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
          <span>🔥</span> 10-Mark Comprehensive & Essay Questions
        </h3>
        ${tenMarkList.length > 0 ? renderGroup(tenMarkList, 'q-badge-10mark', '10 MARKS') : '<p class="tab-empty">No 10-mark questions generated.</p>'}
      </div>
    `;
  }

  importantWrapper.innerHTML = sectionsHtml || `<p class="tab-empty">No questions match the selected filter.</p>`;
}

function renderMindMap() {
  if (!mindmapWrapper) return;
  if (!state.mindmap || !state.mindmap.nodes || state.mindmap.nodes.length === 0) {
    mindmapWrapper.innerHTML = `<p class="tab-empty">Click "Generate Map" to visualize the knowledge architecture of your documents.</p>`;
    return;
  }
  const mm = state.mindmap;
  const rootTitle = mm.root || notebookTitle.textContent || "Core Concepts";
  const nodes = mm.nodes || [];

  const PALETTE = ["#8ab4f8", "#c58af9", "#78d9ec", "#81c995", "#f9ab00", "#f28b82", "#6ee7b7", "#f0a3ff"];
  const isBranch = (n) => !n.parent || n.parent === "root" || n.level === 1;
  const branches = nodes.filter(isBranch);
  const childrenOf = (id) => nodes.filter((n) => n.parent === id);

  const ROOT_W = 170, ROOT_H = 74;
  const X1 = 230, W1 = 210, H1 = 54;
  const X2 = 500, W2 = 250, H2 = 44;
  const ROW = 54, GAP = 16, PAD = 20;
  const anyChildren = branches.some((b) => childrenOf(b.id).length > 0);

  const placed = [];
  let y = PAD;
  branches.forEach((b, i) => {
    const kids = childrenOf(b.id);
    const span = Math.max(1, kids.length) * ROW;
    const color = PALETTE[i % PALETTE.length];
    placed.push({ node: b, x: X1, y: y + span / 2 - H1 / 2, w: W1, h: H1, level: 1, color, parentRef: "root" });
    kids.forEach((k, j) => {
      placed.push({ node: k, x: X2, y: y + j * ROW + (ROW - H2) / 2, w: W2, h: H2, level: 2, color, parentRef: b.id });
    });
    y += span + GAP;
  });
  const totalH = Math.max(y + PAD - GAP, 260);
  const totalW = (anyChildren ? X2 + W2 : X1 + W1) + PAD;
  const rootX = PAD, rootY = totalH / 2 - ROOT_H / 2;

  const byId = new Map(placed.map((p) => [p.node.id, p]));
  const curve = (x1, y1, x2, y2, color) =>
    `<path d="M ${x1} ${y1} C ${x1 + 45} ${y1}, ${x2 - 45} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-opacity="0.55" stroke-width="2"/>`;

  let paths = "";
  placed.forEach((p) => {
    if (p.parentRef === "root") {
      paths += curve(rootX + ROOT_W, rootY + ROOT_H / 2, p.x, p.y + p.h / 2, p.color);
    } else {
      const par = byId.get(p.parentRef);
      if (par) paths += curve(par.x + par.w, par.y + par.h / 2, p.x, p.y + p.h / 2, p.color);
    }
  });

  const nodeDivs = placed.map((p) => `
    <div class="mm-tnode mm-l${p.level}" data-id="${escapeHtml(String(p.node.id))}" title="${escapeHtml(p.node.label)}"
         style="left:${p.x}px; top:${p.y}px; width:${p.w}px; height:${p.h}px; --mm-c:${p.color};">
      <span>${escapeHtml(p.node.label)}</span>
    </div>`).join("");

  mindmapWrapper.innerHTML = `
    <div class="mindmap-viewport">
      <div class="mm-summary-bar">
        <span class="mm-summary-title">${escapeHtml(rootTitle)}</span>
        <span class="mm-summary-count">${branches.length} topics · ${nodes.length - branches.length} sub-concepts</span>
      </div>
      <div class="mm-canvas-scroll">
        <div class="mm-canvas" style="width:${totalW}px; height:${totalH}px;">
          <svg class="mm-links" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">${paths}</svg>
          <div class="mm-troot" style="left:${rootX}px; top:${rootY}px; width:${ROOT_W}px; height:${ROOT_H}px;">
            <span>${escapeHtml(rootTitle)}</span>
          </div>
          ${nodeDivs}
        </div>
      </div>
      <div class="mm-detail-panel" id="mmDetailPanel">
        <span class="mm-detail-hint">Click any node to see its explanation and source.</span>
      </div>
    </div>
  `;

  const panel = mindmapWrapper.querySelector("#mmDetailPanel");
  const openCitation = (citation) => {
    if (!state.documents || state.documents.length === 0) return;
    const pageMatch = String(citation).match(/p\.?\s*(\d+)/i) || String(citation).match(/(\d+)/);
    const page = pageMatch ? parseInt(pageMatch[1]) : 1;
    const lower = String(citation).toLowerCase();
    const doc = state.documents.find((d) => d.filename && lower.includes(String(d.filename).toLowerCase())) || state.documents[0];
    openPdfModal(doc._id, page);
  };

  mindmapWrapper.querySelectorAll(".mm-tnode").forEach((el) => {
    el.addEventListener("click", () => {
      mindmapWrapper.querySelectorAll(".mm-tnode.active").forEach((a) => a.classList.remove("active"));
      el.classList.add("active");
      const p = byId.get(el.dataset.id);
      if (!p || !panel) return;
      const n = p.node;
      panel.style.setProperty("--mm-c", p.color);
      panel.innerHTML = `
        <div class="mm-detail-head">
          <span class="mm-detail-label">${escapeHtml(n.label)}</span>
          ${n.category ? `<span class="mm-node-badge mm-badge-default">${escapeHtml(n.category)}</span>` : ""}
        </div>
        ${n.detail ? `<div class="mm-detail-text">${escapeHtml(n.detail)}</div>` : ""}
        ${n.citation ? `
          <button type="button" class="citation-chip-btn mm-cit-btn" title="View source citation">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${escapeHtml(n.citation)}</span>
          </button>` : ""}
      `;
      const citBtn = panel.querySelector(".mm-cit-btn");
      if (citBtn) citBtn.addEventListener("click", (e) => { e.stopPropagation(); openCitation(n.citation); });
    });
  });
}
// Slides Generation & Rendering
if (generateSlidesBtn) {
  generateSlidesBtn.addEventListener("click", async () => {
    if (!state.currentId) return showToast("Please select a notebook first");
    if (!state.documents || state.documents.length === 0) return showToast("Add a source to generate slides");
    generateSlidesBtn.disabled = true;
    generateSlidesBtn.textContent = "⏳ Generating...";
    try {
      const { scopeType, topic, documentIds } = getScopeParams("slides", "slides");
      const data = await api(`/notebooks/${state.currentId}/studio/slides`, {
        method: "POST",
        body: JSON.stringify({ scopeType, topic, documentIds })
      });
      state.slides = data;
      state.currentSlideIndex = 0;
      renderSlides();
      showToast("📽️ Study Slide Deck Generated!");
    } catch (err) {
      showToast(err.message || "Failed to generate slides");
    } finally {
      generateSlidesBtn.disabled = false;
      generateSlidesBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span>Generate slides</span>`;
    }
  });
}

function renderSlides() {
  if (!slidesWrapper) return;
  if (!state.slides || !state.slides.slides || state.slides.slides.length === 0) {
    slidesWrapper.innerHTML = `<p class="tab-empty">Click "Generate Slides" to synthesize a study presentation from your materials.</p>`;
    return;
  }
  const slides = state.slides.slides;
  const idx = Math.min(Math.max(0, state.currentSlideIndex || 0), slides.length - 1);
  state.currentSlideIndex = idx;
  const slide = slides[idx];

  const bulletsHtml = (slide.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join("");
  const citChip = slide.citation ? `<span class="citation-chip-btn" style="font-size:0.7rem; pointer-events:none;">${escapeHtml(slide.citation)}</span>` : "";

  slidesWrapper.innerHTML = `
    <div class="slide-stage-card">
      <div class="slide-header-bar">
        <span class="slide-number-pill">Slide ${idx + 1} of ${slides.length}</span>
        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${escapeHtml(state.slides.topic || "Overview")}</span>
      </div>
      <div>
        <h3 class="slide-title-heading">${escapeHtml(slide.title)}</h3>
        <ul class="slide-bullets-list">${bulletsHtml}</ul>
      </div>
      ${slide.takeaway ? `<div style="font-size:0.78rem; color:var(--text-sub); background:rgba(255,255,255,0.03); border-radius:8px; padding:0.5rem 0.75rem; margin-bottom:0.75rem;">💡 <strong>Takeaway:</strong> ${escapeHtml(slide.takeaway)}</div>` : ""}
      <div class="slide-footer-row">
        <div>${citChip}</div>
        <div class="slide-controls-bar">
          <button type="button" class="btn-ctrl" id="btnSlidePrev" ${idx === 0 ? "disabled" : ""}>◀ Prev</button>
          <span style="font-size:0.72rem; color:var(--text-sub);">${idx + 1} / ${slides.length}</span>
          <button type="button" class="btn-ctrl" id="btnSlideNext" ${idx === slides.length - 1 ? "disabled" : ""}>Next ▶</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnSlidePrev")?.addEventListener("click", () => {
    if (state.currentSlideIndex > 0) {
      state.currentSlideIndex--;
      renderSlides();
    }
  });
  document.getElementById("btnSlideNext")?.addEventListener("click", () => {
    if (state.currentSlideIndex < slides.length - 1) {
      state.currentSlideIndex++;
      renderSlides();
    }
  });
}

// Data Table Generation & Rendering
if (generateDataTableBtn) {
  generateDataTableBtn.addEventListener("click", async () => {
    if (!state.currentId) return showToast("Please select a notebook first");
    if (!state.documents || state.documents.length === 0) return showToast("Add a source to generate a technical table");
    generateDataTableBtn.disabled = true;
    generateDataTableBtn.textContent = "⏳ Generating...";
    try {
      const { scopeType, topic, documentIds } = getScopeParams("dt", "dataTable");
      const data = await api(`/notebooks/${state.currentId}/studio/data-table`, {
        method: "POST",
        body: JSON.stringify({ scopeType, topic, documentIds })
      });
      state.dataTable = data;
      renderDataTable();
      showToast("📊 Technical Data Table Generated!");
    } catch (err) {
      showToast(err.message || "Failed to generate data table");
    } finally {
      generateDataTableBtn.disabled = false;
      generateDataTableBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
        <span>Generate table</span>`;
    }
  });
}

function renderDataTable() {
  if (!dataTableWrapper) return;
  if (!state.dataTable || !state.dataTable.headers || !state.dataTable.rows) {
    dataTableWrapper.innerHTML = `<p class="tab-empty" style="padding:1.5rem">Click "Generate Table" to structure key technical concepts into a comparison matrix.</p>`;
    return;
  }
  const headers = state.dataTable.headers || [];
  const rows = state.dataTable.rows || [];

  const thHtml = headers.map(h => `<th>${escapeHtml(h)}</th>`).join("");
  const trHtml = rows.map(r => `
    <tr>
      ${(Array.isArray(r) ? r : [r]).map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}
    </tr>
  `).join("");

  dataTableWrapper.innerHTML = `
    <div style="padding:0.75rem 0.5rem;">
      <h3 style="font-size:0.95rem; font-weight:700; color:var(--text-main); margin-bottom:0.6rem;">${escapeHtml(state.dataTable.title || "Technical Synthesis Matrix")}</h3>
      <div class="table-scroll-wrap">
        <table class="studio-data-table">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${trHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

generateCompareBtn.addEventListener("click", async () => {
  if (!state.currentId) return;
  generateCompareBtn.disabled = true;
  try {
    const res = await api(`/notebooks/${state.currentId}/studio/compare`, { method: "POST" });
    state.compare = res.matrix;
    renderCompare();
  } catch (err) { showToast(err.message); }
  finally { generateCompareBtn.disabled = false; }
});

function renderCompare() {
  if (!state.compare) return;
  compareWrapper.innerHTML = `<div class="compare-box">${parseMarkdownToHtml(state.compare)}</div>`;
}

// --- NOTES PINBOARD ---
async function loadNotes() {
  if (!state.currentId) return;
  state.notes = await api(`/notebooks/${state.currentId}/studio/notes`);
  renderNotes();
}

function renderNotes() {
  if (state.notes.length === 0) {
    notesGrid.innerHTML = `<p class="tab-empty">No saved notes yet. Pin chat responses or add research notes.</p>`;
    return;
  }
  notesGrid.innerHTML = state.notes
    .map((note) => `
      <div class="note-card">
        <div class="note-card-title">${escapeHtml(note.title)}</div>
        <div class="note-card-body">${escapeHtml(note.content)}</div>
        <div class="note-card-footer">
          <span>${new Date(note.createdAt).toLocaleDateString()}</span>
          <button class="source-card-remove" data-delnote="${note._id}">✕</button>
        </div>
      </div>`).join("");

  notesGrid.querySelectorAll("[data-delnote]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/notebooks/${state.currentId}/studio/notes/${btn.dataset.delnote}`, { method: "DELETE" });
      await loadNotes();
    });
  });
}

async function pinChatNote(content) {
  if (!state.currentId) return;
  try {
    await api(`/notebooks/${state.currentId}/studio/notes`, { method: "POST", body: JSON.stringify({ title: "Grounded Chat Insight", content, tag: "Chat" }) });
    showToast("Pinned to Notes!");
    await loadNotes();
  } catch (err) { showToast(err.message); }
}

newNoteBtn.addEventListener("click", async () => {
  if (!state.currentId) return;
  const content = prompt("Enter note content:");
  if (!content) return;
  try {
    await api(`/notebooks/${state.currentId}/studio/notes`, { method: "POST", body: JSON.stringify({ title: "Custom Research Note", content, tag: "User Note" }) });
    await loadNotes();
  } catch (err) { showToast(err.message); }
});

// ══════════════════════════════════════════════════════════════════
// AI VISUAL & IMAGE STUDIO CONTROLLER
// ══════════════════════════════════════════════════════════════════
function renderVisual(visual) {
  if (!visual) {
    visualEmptyState.style.display = "block";
    activeVisualCard.style.display = "none";
    return;
  }
  state.activeVisual = visual;
  visualEmptyState.style.display = "none";
  activeVisualCard.style.display = "flex";

  visualCardTitle.textContent = visual.title || "Visual Synthesis";
  
  let tagsHtml = (visual.tags || ["Infographic", "Concept"]).map(t => `<span class="visual-tag-badge">${escapeHtml(t)}</span>`).join("");
  if (visual.citations && Array.isArray(visual.citations) && visual.citations.length > 0) {
    tagsHtml += visual.citations.map(c => {
      const parts = c.split(",");
      const fn = parts[0]?.trim() || "document.pdf";
      const p = parts[1] ? parseInt(parts[1].replace(/[^0-9]/g, ""), 10) || 1 : 1;
      return `<span class="visual-tag-badge" style="background:rgba(138,180,248,0.18); color:#8ab4f8; cursor:pointer;" onclick="openPdfModal('${escapeHtml(fn)}', ${p})">📄 ${escapeHtml(c)} ↗</span>`;
    }).join("");
  }
  visualCardTags.innerHTML = tagsHtml;

  visualSummaryText.textContent = visual.summary || "Source-grounded concept illustration.";

  if (visual.svgContent) {
    visualRenderStage.innerHTML = visual.svgContent;
  } else if (visual.previewUrl) {
    visualRenderStage.innerHTML = `<img src="${visual.previewUrl}" alt="${escapeHtml(visual.title)}" style="max-width:100%; border-radius:8px;" referrerpolicy="no-referrer" />`;
  }
}

function renderVisualGallery() {
  if (!state.visuals || state.visuals.length === 0) {
    visualGallerySection.style.display = "none";
    return;
  }
  visualGallerySection.style.display = "block";
  visualGalleryGrid.innerHTML = state.visuals.map((vis, idx) => `
    <div class="visual-gallery-thumb" data-visidx="${idx}">
      <div style="height:90px; overflow:hidden; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#0b0e14;">
        ${vis.svgContent ? vis.svgContent : `<img src="${vis.previewUrl || '/assets/images/study_infographic_preview_1790174854345.jpg'}" alt="Thumb" style="width:100%; height:100%; object-fit:cover;" referrerpolicy="no-referrer" />`}
      </div>
      <div class="visual-gallery-thumb-title">${escapeHtml(vis.title || 'Visual')}</div>
    </div>
  `).join("");

  visualGalleryGrid.querySelectorAll(".visual-gallery-thumb").forEach(el => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.visidx, 10);
      if (state.visuals[idx]) renderVisual(state.visuals[idx]);
    });
  });
}

generateImageBtn.addEventListener("click", async () => {
  if (!state.currentId) return showToast("Select a notebook first.");

  const scope = genScopes.images || "all";
  let topic = "";
  let documentIds = [];

  const customPrompt = imagePromptInput.value.trim();
  const selectedTopic = document.getElementById("imgTopicSelect")?.value;

  if (scope === "topic") {
    topic = customPrompt || selectedTopic || "";
    if (!topic) return showToast("Please select or enter a topic for the visual.");
  } else if (scope === "source") {
    const checked = Array.from(document.querySelectorAll("#imgDocCheckboxesGrid input:checked")).map(cb => cb.value);
    if (checked.length === 0) return showToast("Please select at least one document.");
    documentIds = checked;
    topic = customPrompt || "";
  } else {
    topic = customPrompt || "";
  }

  generateImageBtn.disabled = true;
  generateImageBtn.textContent = "⏳ Generating...";
  try {
    const style = imageStyleSelect.value;
    const aspectRatio = imageRatioSelect.value;
    const res = await api(`/notebooks/${state.currentId}/studio/images`, {
      method: "POST",
      body: JSON.stringify({ scopeType: scope, topic, prompt: topic, documentIds, style, aspectRatio })
    });
    state.visuals = res.list || [res.visual];
    renderVisual(res.visual);
    renderVisualGallery();
    showToast("✨ AI Concept Visual Generated!");
  } catch (err) {
    showToast(err.message);
  } finally {
    generateImageBtn.disabled = false;
    generateImageBtn.textContent = "✨ Generate Visual";
  }
});

btnVisualDownload.addEventListener("click", () => {
  if (!state.activeVisual) return;
  const content = state.activeVisual.svgContent || `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><text x="20" y="40">Visual</text></svg>`;
  downloadFile(`${(state.activeVisual.title || 'study_visual').replace(/\s+/g, '_')}.svg`, content, "image/svg+xml");
  showToast("SVG Vector Diagram Downloaded!");
});

btnVisualPinNote.addEventListener("click", async () => {
  if (!state.activeVisual || !state.currentId) return;
  const noteTitle = `Visual: ${state.activeVisual.title}`;
  const noteContent = `**Summary:** ${state.activeVisual.summary}\n\n**Style:** ${state.activeVisual.style}\n**Tags:** ${(state.activeVisual.tags || []).join(", ")}`;
  await api(`/notebooks/${state.currentId}/studio/notes`, {
    method: "POST",
    body: JSON.stringify({ title: noteTitle, content: noteContent, tag: "Visual Diagram" })
  });
  await loadNotes();
  showToast("Pinned visual note to pinboard!");
});

btnVisualZoom.addEventListener("click", () => {
  if (!state.activeVisual) return;
  visualZoomTitle.textContent = state.activeVisual.title;
  visualZoomContent.innerHTML = state.activeVisual.svgContent || `<img src="${state.activeVisual.previewUrl}" style="max-width:100%; border-radius:10px;" referrerpolicy="no-referrer" />`;
  visualZoomModal.classList.add("show");
});

closeVisualZoomModalBtn.addEventListener("click", () => {
  visualZoomModal.classList.remove("show");
});

// ══════════════════════════════════════════════════════════════════
// AI VIDEO EXPLAINER LECTURE CONTROLLER
// ══════════════════════════════════════════════════════════════════
let videoPlayerState = {
  project: null,
  isPlaying: false,
  currentSceneIdx: 0,
  sceneElapsed: 0,
  speed: 1.0,
  voiceEnabled: true,
  animInterval: null,
  particles: []
};

function initVideoParticles() {
  videoPlayerState.particles = [];
  for (let i = 0; i < 45; i++) {
    videoPlayerState.particles.push({
      x: Math.random() * 960,
      y: Math.random() * 540,
      r: Math.random() * 2.5 + 1,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      alpha: Math.random() * 0.6 + 0.2
    });
  }
}
initVideoParticles();

function renderVideoProject(project) {
  if (!project || !project.scenes || project.scenes.length === 0) {
    videoEmptyState.style.display = "block";
    videoActiveStage.style.display = "none";
    return;
  }
  videoPlayerState.project = project;
  videoEmptyState.style.display = "none";
  videoActiveStage.style.display = "flex";

  videoScrubber.max = project.totalDuration || 60;
  videoScrubber.value = 0;
  videoPlayerState.currentSceneIdx = 0;
  videoPlayerState.sceneElapsed = 0;

  renderStoryboardTimeline();
  updateVideoDisplayTime();
  drawCurrentVideoFrame();
}

function renderStoryboardTimeline() {
  if (!videoPlayerState.project) return;
  scenesTimelineGrid.innerHTML = videoPlayerState.project.scenes.map((scene, idx) => {
    const citationsHtml = (scene.citations || []).map(c => `
      <span class="scene-citation-tag" onclick="event.stopPropagation(); openPdfModal('${escapeHtml(c.filename)}', ${c.pageNumber || 1})" title="Open page in PDF viewer">
        📄 ${escapeHtml(c.filename)} (p.${c.pageNumber || 1}) ↗
      </span>
    `).join("");

    return `
    <div class="scene-card ${idx === videoPlayerState.currentSceneIdx ? 'active' : ''}" data-sceneidx="${idx}">
      <div class="scene-card-top">
        <span class="scene-badge" style="background:${scene.colorTheme}22; color:${scene.colorTheme}; border:1px solid ${scene.colorTheme}44">
          Scene ${scene.sceneNumber || (idx + 1)}
        </span>
        <span class="scene-duration">⏱ ${scene.duration || 15}s</span>
      </div>
      <div class="scene-card-title">${escapeHtml(scene.title)}</div>
      <ul class="scene-bullets">
        ${(scene.keyPoints || []).slice(0, 2).map(pt => `<li class="scene-bullet">${escapeHtml(pt)}</li>`).join("")}
      </ul>
      ${citationsHtml ? `<div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-top:0.4rem">${citationsHtml}</div>` : ""}
    </div>
  `;
  }).join("");

  scenesTimelineGrid.querySelectorAll(".scene-card").forEach(card => {
    card.addEventListener("click", () => {
      const idx = parseInt(card.dataset.sceneidx, 10);
      seekToScene(idx);
    });
  });
}

function drawCurrentVideoFrame() {
  if (!videoLectureCanvas || !videoPlayerState.project) return;
  const ctx = videoLectureCanvas.getContext("2d");
  const scene = videoPlayerState.project.scenes[videoPlayerState.currentSceneIdx] || videoPlayerState.project.scenes[0];
  if (!scene) return;

  const w = 960, h = 540;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#080b11");
  grad.addColorStop(1, "#121722");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(138, 180, 248, 0.05)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const themeColor = scene.colorTheme || "#8ab4f8";
  videoPlayerState.particles.forEach(p => {
    p.x += p.vx * videoPlayerState.speed;
    p.y += p.vy * videoPlayerState.speed;
    if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

    ctx.fillStyle = themeColor;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;

  // Header Bar
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(40, 30, w - 80, 48);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.strokeRect(40, 30, w - 80, 48);

  ctx.fillStyle = themeColor;
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText(`MODULE ${scene.sceneNumber || (videoPlayerState.currentSceneIdx + 1)} • ${scene.title.toUpperCase()}`, 60, 60);

  // Central Hologram Graphic Box
  const cx = 280, cy = 270;
  const pulse = Math.sin(Date.now() / 400) * 8;

  ctx.strokeStyle = `${themeColor}33`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 110 + pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `${themeColor}22`;
  ctx.beginPath(); ctx.arc(cx, cy, 140 - pulse, 0, Math.PI * 2); ctx.stroke();

  const orbGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 65);
  orbGrad.addColorStop(0, themeColor);
  orbGrad.addColorStop(0.8, "rgba(20, 26, 38, 0.9)");
  orbGrad.addColorStop(1, "transparent");
  ctx.fillStyle = orbGrad;
  ctx.beginPath(); ctx.arc(cx, cy, 65, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STUDYVAULT", cx, cy - 6);
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = themeColor;
  ctx.fillText("AI EXPLAINER", cx, cy + 16);
  ctx.textAlign = "left";

  // Key highlights card
  const cardX = 480, cardY = 120, cardW = 430, cardH = 290;
  ctx.fillStyle = "rgba(18, 24, 36, 0.85)";
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeStyle = `${themeColor}55`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cardX, cardY, cardW, cardH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillText("KEY CONCEPT HIGHLIGHTS", cardX + 24, cardY + 36);

  const pts = scene.keyPoints || [];
  pts.forEach((pt, i) => {
    const py = cardY + 80 + (i * 65);
    ctx.fillStyle = themeColor;
    ctx.beginPath(); ctx.arc(cardX + 30, py - 6, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(pt.length > 42 ? pt.slice(0, 42) + "..." : pt, cardX + 46, py);
  });

  const sceneProgress = Math.min(1, videoPlayerState.sceneElapsed / (scene.duration || 15));
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(40, 500, w - 80, 6);
  ctx.fillStyle = themeColor;
  ctx.fillRect(40, 500, (w - 80) * sceneProgress, 6);

  if (videoSubtitleText) {
    const subs = scene.subtitles || [scene.narration];
    const subIdx = Math.min(subs.length - 1, Math.floor(sceneProgress * subs.length));
    videoSubtitleText.textContent = subs[subIdx] || scene.narration;
  }
}

function startVideoAnimationLoop() {
  if (videoPlayerState.animInterval) clearInterval(videoPlayerState.animInterval);
  videoPlayerState.animInterval = setInterval(() => {
    if (!videoPlayerState.isPlaying) return;
    const scene = videoPlayerState.project.scenes[videoPlayerState.currentSceneIdx];
    const sceneDuration = (scene && scene.duration) || 15;
    videoPlayerState.sceneElapsed += 0.1 * videoPlayerState.speed;

    let totalSecs = 0;
    for (let i = 0; i < videoPlayerState.currentSceneIdx; i++) {
      totalSecs += videoPlayerState.project.scenes[i].duration || 15;
    }
    totalSecs += videoPlayerState.sceneElapsed;

    videoScrubber.value = Math.min(totalSecs, videoPlayerState.project.totalDuration || 60);
    updateVideoDisplayTime();
    drawCurrentVideoFrame();

    if (videoPlayerState.sceneElapsed >= sceneDuration) {
      if (videoPlayerState.currentSceneIdx < videoPlayerState.project.scenes.length - 1) {
        seekToScene(videoPlayerState.currentSceneIdx + 1);
      } else {
        stopVideoPlayback();
        showToast("🎬 Lecture Finished!");
      }
    }
  }, 100);
}

function toggleVideoPlay() {
  if (!videoPlayerState.project) return;
  if (videoPlayerState.isPlaying) {
    pauseVideoPlayback();
  } else {
    playVideoPlayback();
  }
}

function playVideoPlayback() {
  stopAudioPlayback();
  videoPlayerState.isPlaying = true;
  videoStagePlayOverlay.style.display = "none";
  btnVideoPlayPause.textContent = "❚❚ Pause";
  startVideoAnimationLoop();

  if (videoPlayerState.voiceEnabled && 'speechSynthesis' in window) {
    speakCurrentScene();
  }
}

function pauseVideoPlayback() {
  videoPlayerState.isPlaying = false;
  videoStagePlayOverlay.style.display = "flex";
  btnVideoPlayPause.textContent = "▶ Play";
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function stopVideoPlayback() {
  videoPlayerState.isPlaying = false;
  if (videoStagePlayOverlay) videoStagePlayOverlay.style.display = "flex";
  if (btnVideoPlayPause) btnVideoPlayPause.textContent = "▶ Play";
  if (videoPlayerState.animInterval) clearInterval(videoPlayerState.animInterval);
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function speakCurrentScene() {
  if (!videoPlayerState.voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const scene = videoPlayerState.project.scenes[videoPlayerState.currentSceneIdx];
  if (!scene || !scene.narration) return;

  const utter = new SpeechSynthesisUtterance(scene.narration);
  utter.rate = videoPlayerState.speed;
  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha")));
  if (naturalVoice) utter.voice = naturalVoice;

  window.speechSynthesis.speak(utter);
}

function seekToScene(sceneIdx) {
  if (!videoPlayerState.project || !videoPlayerState.project.scenes[sceneIdx]) return;
  videoPlayerState.currentSceneIdx = sceneIdx;
  videoPlayerState.sceneElapsed = 0;

  renderStoryboardTimeline();
  drawCurrentVideoFrame();

  if (videoPlayerState.isPlaying) {
    speakCurrentScene();
  }
}

function updateVideoDisplayTime() {
  if (!videoPlayerState.project) return;
  let cur = 0;
  for (let i = 0; i < videoPlayerState.currentSceneIdx; i++) {
    cur += videoPlayerState.project.scenes[i].duration || 15;
  }
  cur += Math.floor(videoPlayerState.sceneElapsed);
  const total = videoPlayerState.project.totalDuration || 60;

  const fmt = (s) => `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`;
  videoTimeDisplay.textContent = `${fmt(cur)} / ${fmt(total)}`;
}

btnVideoPlayPause.addEventListener("click", toggleVideoPlay);
videoBigPlayBtn.addEventListener("click", toggleVideoPlay);
videoStagePlayOverlay.addEventListener("click", (e) => {
  if (e.target === videoStagePlayOverlay) toggleVideoPlay();
});

btnVideoPrevScene.addEventListener("click", () => {
  if (videoPlayerState.currentSceneIdx > 0) seekToScene(videoPlayerState.currentSceneIdx - 1);
});
btnVideoNextScene.addEventListener("click", () => {
  if (videoPlayerState.project && videoPlayerState.currentSceneIdx < videoPlayerState.project.scenes.length - 1) {
    seekToScene(videoPlayerState.currentSceneIdx + 1);
  }
});

videoSpeedSelect.addEventListener("change", () => {
  videoPlayerState.speed = parseFloat(videoSpeedSelect.value) || 1.0;
  if (videoPlayerState.isPlaying && videoPlayerState.voiceEnabled) {
    speakCurrentScene();
  }
});

btnVideoVoiceToggle.addEventListener("click", () => {
  videoPlayerState.voiceEnabled = !videoPlayerState.voiceEnabled;
  btnVideoVoiceToggle.textContent = videoPlayerState.voiceEnabled ? "🔊 Voice: On" : "🔇 Voice: Off";
  if (!videoPlayerState.voiceEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  } else if (videoPlayerState.voiceEnabled && videoPlayerState.isPlaying) {
    speakCurrentScene();
  }
});

btnVideoFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    videoCanvasWrapper.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

btnExportVideoScript.addEventListener("click", () => {
  if (!videoPlayerState.project) return;
  const p = videoPlayerState.project;
  let md = `# 🎬 ${p.title}\n\n**Topic:** ${p.topic}\n**Total Duration:** ${p.totalDuration}s\n**Style:** ${p.style}\n\n---\n\n`;
  p.scenes.forEach(s => {
    md += `### Scene ${s.sceneNumber}: ${s.title} (${s.duration}s)\n\n`;
    md += `**Narration Script:**\n> "${s.narration}"\n\n`;
    md += `**Key Highlights:**\n${(s.keyPoints || []).map(k => `- ${k}`).join("\n")}\n\n---\n\n`;
  });
  downloadFile(`${p.title.replace(/\s+/g, '_')}_Script.md`, md, "text/markdown");
  showToast("Exported Video Lecture Script!");
});

generateVideoBtn.addEventListener("click", async () => {
  if (!state.currentId) return showToast("Select a notebook first.");

  const scope = genScopes.video || "all";
  let topic = "";
  let documentIds = [];

  const customTopic = document.getElementById("vidCustomTopicInput")?.value.trim();
  const selectedTopic = document.getElementById("vidTopicSelect")?.value;

  if (scope === "topic") {
    topic = customTopic || selectedTopic || "";
    if (!topic) return showToast("Please select or enter a topic for the video lecture.");
  } else if (scope === "source") {
    const checked = Array.from(document.querySelectorAll("#vidDocCheckboxesGrid input:checked")).map(cb => cb.value);
    if (checked.length === 0) return showToast("Please select at least one document.");
    documentIds = checked;
    topic = customTopic || "";
  } else {
    topic = customTopic || "";
  }

  generateVideoBtn.disabled = true;
  generateVideoBtn.textContent = "⏳ Generating...";
  try {
    const style = videoStyleSelect.value;
    const project = await api(`/notebooks/${state.currentId}/studio/video`, {
      method: "POST",
      body: JSON.stringify({ scopeType: scope, topic, documentIds, style })
    });
    renderVideoProject(project);
    showToast("🎬 AI Video Lecture Generated!");
  } catch (err) {
    showToast(err.message);
  } finally {
    generateVideoBtn.disabled = false;
    generateVideoBtn.textContent = "🎬 Generate Video";
  }
});

// --- CACHED ARTIFACTS LOADING ---
async function loadCachedArtifacts() {
  try {
    state.audioScript = await api(`/notebooks/${state.currentId}/studio/audio-overview`).catch(() => null);
    if (state.audioScript) renderAudioOverview(); else if (podcastPlayerCard) podcastPlayerCard.style.display = "none";

    state.briefing = await api(`/notebooks/${state.currentId}/studio/briefing`).catch(() => null);
    if (state.briefing) renderBriefing();

    const fc = await api(`/notebooks/${state.currentId}/studio/flashcards`).catch(() => null);
    if (fc) { state.flashcards = fc.cards; renderFlashcards(); }

    const q = await api(`/notebooks/${state.currentId}/studio/quiz`).catch(() => null);
    if (q) { state.quiz = q.questions; renderQuiz(); }

    const iq = await api(`/notebooks/${state.currentId}/studio/important-questions`).catch(() => null);
    if (iq) { state.importantQuestions = iq; renderImportantQuestions(); }

    const mm = await api(`/notebooks/${state.currentId}/studio/mindmap`).catch(() => null);
    if (mm) { state.mindmap = mm; renderMindMap(); }

    const sl = await api(`/notebooks/${state.currentId}/studio/slides`).catch(() => null);
    if (sl) { state.slides = sl; state.currentSlideIndex = 0; renderSlides(); }

    const dt = await api(`/notebooks/${state.currentId}/studio/data-table`).catch(() => null);
    if (dt) { state.dataTable = dt; renderDataTable(); }

    const imgs = await api(`/notebooks/${state.currentId}/studio/images`).catch(() => []);
    state.visuals = Array.isArray(imgs) ? imgs : [];
    if (state.visuals.length > 0) {
      renderVisual(state.visuals[0]);
      renderVisualGallery();
    } else {
      if (visualEmptyState) visualEmptyState.style.display = "block";
      if (activeVisualCard) activeVisualCard.style.display = "none";
      if (visualGallerySection) visualGallerySection.style.display = "none";
    }

    const vid = await api(`/notebooks/${state.currentId}/studio/video`).catch(() => null);
    if (vid) {
      renderVideoProject(vid);
    } else {
      if (videoEmptyState) videoEmptyState.style.display = "block";
      if (videoActiveStage) videoActiveStage.style.display = "none";
    }
  } catch (err) { console.error("Error loading cached artifacts:", err); }
}

// --- EVENT LISTENERS & DROPDOWNS ---
function setupEventListeners() {
  const newNbBtn = document.getElementById("newNotebookBtn");
  if (newNbBtn) {
    newNbBtn.addEventListener("click", () => {
      if (typeof LibraryManager !== "undefined" && !LibraryManager._initialized) {
        LibraryManager.init();
      }
      if (typeof LibraryManager !== "undefined" && typeof LibraryManager.openCreateNotebookModal === "function") {
        LibraryManager.openCreateNotebookModal();
      } else {
        const modal = document.getElementById("createNotebookModal");
        const titleInput = document.getElementById("newNbTitleInput");
        const descInput = document.getElementById("newNbDescInput");
        const errBanner = document.getElementById("newNbError");
        if (titleInput) titleInput.value = "";
        if (descInput) descInput.value = "";
        if (errBanner) errBanner.style.display = "none";
        if (modal) {
          modal.classList.add("show");
          setTimeout(() => { if (titleInput) titleInput.focus(); }, 100);
        }
      }
    });
  }

  const renameBtn = document.getElementById("renameBtn");
  if (renameBtn) {
    renameBtn.addEventListener("click", () => {
      const nb = state.notebooks.find((n) => String(n._id || n.id) === String(state.currentId));
      if (!nb) return;
      if (typeof LibraryManager !== "undefined" && !LibraryManager._initialized) {
        LibraryManager.init();
      }
      if (typeof LibraryManager !== "undefined" && typeof LibraryManager.openRenameNotebookModal === "function") {
        LibraryManager.openRenameNotebookModal(nb._id || nb.id);
      } else {
        const modal = document.getElementById("renameNotebookModal");
        if (modal) {
          const idEl = document.getElementById("renameNbId");
          const inputEl = document.getElementById("renameNbInput");
          if (idEl) idEl.value = nb._id || nb.id;
          if (inputEl) inputEl.value = nb.title;
          modal.classList.add("show");
          setTimeout(() => { if (inputEl) inputEl.focus(); }, 100);
        }
      }
    });
  }

  const deleteNbBtn = document.getElementById("deleteNotebookBtn");
  if (deleteNbBtn) {
    deleteNbBtn.addEventListener("click", () => {
      if (!state.currentId) return;
      const nb = state.notebooks.find((n) => String(n._id || n.id) === String(state.currentId));
      const title = nb ? nb.title : "this notebook";
      showConfirmDialog({
        title: "Delete Notebook",
        message: `Are you sure you want to delete "${title}"? All uploaded documents and generated study notes will be permanently removed.`,
        confirmText: "Delete Notebook",
        isDanger: true,
        onConfirm: async () => {
          try {
            await api(`/notebooks/${state.currentId}`, { method: "DELETE" });
            state.notebooks = state.notebooks.filter((n) => String(n._id || n.id) !== String(state.currentId));
            state.currentId = null;
            renderNotebookList();
            if (state.notebooks.length > 0) {
              selectNotebook(state.notebooks[0]._id || state.notebooks[0].id);
            } else {
              showEmptyState();
            }
            if (typeof LibraryManager !== "undefined") {
              LibraryManager.loadData();
            }
            showToast("Notebook deleted");
          } catch (err) {
            showToast(err.message || "Failed to delete notebook");
          }
        }
      });
    });
  }

  searchSourcesBtn.addEventListener("click", () => {
    sourceSearchBox.style.display = sourceSearchBox.style.display === "none" ? "block" : "none";
  });

  sourceSearchInput.addEventListener("input", async (e) => {
    const query = e.target.value.trim();
    if (!query || !state.currentId) return renderSources();
    try {
      const results = await api(`/notebooks/${state.currentId}/documents/search?q=${encodeURIComponent(query)}`);
      sourcesRailInner.innerHTML = results.map((r) => `
        <div class="source-card" onclick="openPdfModal('${escapeHtml(r.filename)}', ${r.pageNumber})">
          <div class="source-info">
            <div class="source-name">${escapeHtml(r.filename)} (p.${r.pageNumber})</div>
            <div class="source-meta">${escapeHtml(r.snippet.slice(0, 50))}...</div>
          </div>
        </div>`).join("");
    } catch (err) { showToast(err.message); }
  });

  document.getElementById("sampleNotebooksBtn").addEventListener("click", () => sampleModal.classList.add("show"));
  document.getElementById("closePasteModalBtn").addEventListener("click", () => pasteTextModal.classList.remove("show"));
  document.getElementById("closeUrlModalBtn").addEventListener("click", () => urlModal.classList.remove("show"));
  document.getElementById("closeSampleModalBtn").addEventListener("click", () => sampleModal.classList.remove("show"));
}

function setupDropdowns() {
  const addSourceModal = document.getElementById("addSourceModal");
  const closeAddSourceModalBtn = document.getElementById("closeAddSourceModalBtn");

  const openAddSource = () => {
    if (addSourceModal) addSourceModal.classList.add("show");
  };
  const closeAddSource = () => {
    if (addSourceModal) addSourceModal.classList.remove("show");
  };

  if (addSourceMenuBtn) {
    addSourceMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openAddSource();
    });
  }

  const btnBigAddSource = document.getElementById("btnBigAddSource");
  if (btnBigAddSource) {
    btnBigAddSource.addEventListener("click", openAddSource);
  }

  const btnUnlockAddSource = document.getElementById("btnUnlockAddSource");
  if (btnUnlockAddSource) {
    btnUnlockAddSource.addEventListener("click", openAddSource);
  }

  if (closeAddSourceModalBtn) {
    closeAddSourceModalBtn.addEventListener("click", closeAddSource);
  }
  if (addSourceModal) {
    addSourceModal.addEventListener("click", (e) => {
      if (e.target === addSourceModal) closeAddSource();
    });
  }

  // Add source options inside modal
  const srcOptUploadPdf = document.getElementById("srcOptUploadPdf");
  if (srcOptUploadPdf) {
    srcOptUploadPdf.addEventListener("click", () => {
      closeAddSource();
      fileInput.click();
    });
  }

  const srcOptPasteText = document.getElementById("srcOptPasteText");
  if (srcOptPasteText) {
    srcOptPasteText.addEventListener("click", () => {
      closeAddSource();
      pasteTextModal.classList.add("show");
    });
  }

  const srcOptAddUrl = document.getElementById("srcOptAddUrl");
  if (srcOptAddUrl) {
    srcOptAddUrl.addEventListener("click", () => {
      closeAddSource();
      urlModal.classList.add("show");
    });
  }

  const srcOptSampleData = document.getElementById("srcOptSampleData");
  if (srcOptSampleData) {
    srcOptSampleData.addEventListener("click", () => {
      closeAddSource();
      sampleModal.classList.add("show");
    });
  }

  // Preloaded sample buttons in the empty state
  document.querySelectorAll(".starter-sample-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const sampleKey = chip.dataset.sample;
      try {
        showToast("Loading sample research...");
        const nb = await api(`/notebooks/sample/${sampleKey}`, { method: "POST" });
        state.notebooks.unshift(nb);
        renderNotebookList();
        await selectNotebook(nb._id);
        showToast(`Loaded sample research: ${nb.title}`);
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  fileInput.addEventListener("change", async () => {
    if (!fileInput.files.length) return;
    await uploadFiles(fileInput.files);
    fileInput.value = "";
  });

  document.getElementById("submitPasteBtn").addEventListener("click", async () => {
    const title = document.getElementById("pasteTextTitle").value;
    const text = document.getElementById("pasteTextContent").value;
    if (!text || !state.currentId) return;
    try {
      const doc = await api(`/notebooks/${state.currentId}/documents/text`, { method: "POST", body: JSON.stringify({ title, text }) });
      state.documents.push(doc); renderSources(); pasteTextModal.classList.remove("show");
      document.getElementById("pasteTextTitle").value = ""; document.getElementById("pasteTextContent").value = "";
      maybePollDocs();
      renderChat();
    } catch (err) { showToast(err.message); }
  });

  document.getElementById("submitUrlBtn").addEventListener("click", async () => {
    const url = document.getElementById("urlInput").value;
    if (!url || !state.currentId) return;
    try {
      const doc = await api(`/notebooks/${state.currentId}/documents/url`, { method: "POST", body: JSON.stringify({ url }) });
      state.documents.push(doc); renderSources(); urlModal.classList.remove("show");
      document.getElementById("urlInput").value = ""; maybePollDocs();
      renderChat();
    } catch (err) { showToast(err.message); }
  });

  document.querySelectorAll(".sample-card-option").forEach((card) => {
    card.addEventListener("click", async () => {
      const sampleKey = card.dataset.key; sampleModal.classList.remove("show");
      try {
        const nb = await api(`/notebooks/sample/${sampleKey}`, { method: "POST" });
        state.notebooks.unshift(nb); renderNotebookList(); selectNotebook(nb._id);
        showToast(`Loaded sample research: ${nb.title}`);
      } catch (err) { showToast(err.message); }
    });
  });

  // Studio tabs and navigation are managed by StudioManager
}

/**
 * Reusable helper to upload one or more files and attach them to the active notebook
 */
async function uploadFiles(files) {
  if (!files || !files.length) return;

  if (!state.currentId) {
    try {
      const firstFileName = files[0].name.replace(/\.[^/.]+$/, "") || "New Study Notebook";
      const nb = await api("/notebooks", { method: "POST", body: JSON.stringify({ title: firstFileName }) });
      state.notebooks.unshift(nb);
      renderNotebookList();
      await selectNotebook(nb._id);
    } catch (err) {
      showToast("Please create or select a notebook first.");
      return;
    }
  }

  const formData = new FormData();
  [...files].forEach((f) => formData.append("files", f));
  try {
    showToast(`Uploading ${files.length} document(s)...`);
    const created = await api(`/notebooks/${state.currentId}/documents`, { method: "POST", body: formData });
    state.documents.push(...created);
    renderSources();
    renderChat();
    maybePollDocs();
    showToast(`Uploaded ${created.length} document(s) successfully!`);
  } catch (err) {
    showToast(err.message);
  }
}

/**
 * Drag and Drop & Dropzone Listeners
 */
function setupDropzones() {

  const btnModalBrowse = document.getElementById("btnModalBrowse");
  if (btnModalBrowse) {
    btnModalBrowse.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }
  const modalDropzone = document.getElementById("modalDropzone");
  if (modalDropzone) {
    modalDropzone.addEventListener("click", () => fileInput.click());
    ["dragenter", "dragover"].forEach((evt) => {
      modalDropzone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        modalDropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      modalDropzone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        modalDropzone.classList.remove("dragover");
      });
    });
    modalDropzone.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation();
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        closeAddSource();
        uploadFiles(files);
      }
    });
  }

  const sidebarDropzone = document.getElementById("sidebarDropzone");
  const centerEmptyState = document.getElementById("centerEmptyState");

  if (sidebarDropzone) {
    sidebarDropzone.addEventListener("click", () => fileInput.click());
    ["dragenter", "dragover"].forEach((evt) => {
      sidebarDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        sidebarDropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      sidebarDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        sidebarDropzone.classList.remove("dragover");
      });
    });
    sidebarDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) uploadFiles(files);
    });
  }

  // Allow dropping files anywhere on the center chat empty state
  if (centerEmptyState) {
    ["dragenter", "dragover"].forEach((evt) => {
      centerEmptyState.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    centerEmptyState.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) uploadFiles(files);
    });
  }
}

/**
 * ══════════════════════════════════════════════════════════════════
 * STUDYVAULT STUDIO SUITE MANAGER
 * Robust, Single-Source-of-Truth Architecture for Categories and Tools
 * ══════════════════════════════════════════════════════════════════
 */
const STUDIO_CATEGORIES = {
  study: {
    id: "study",
    label: "Active study",
    groupId: "catGroupStudy",
    defaultTool: "tabFlashcards",
    tools: ["tabFlashcards", "tabQuiz", "tabImportant", "tabMindMap", "tabNotes"]
  },
  synthesis: {
    id: "synthesis",
    label: "Synthesis",
    groupId: "catGroupSynthesis",
    defaultTool: "tabOverview",
    tools: ["tabOverview", "tabBriefing", "tabSlides", "tabDataTable", "tabCompare"]
  },
  media: {
    id: "media",
    label: "Visual studio",
    groupId: "catGroupMedia",
    defaultTool: "tabImages",
    tools: ["tabImages", "tabVideo"]
  }
};

const STUDIO_TOOLS = {
  tabFlashcards: { id: "tabFlashcards", category: "study", paneId: "tabFlashcards", name: "Flashcards" },
  tabQuiz: { id: "tabQuiz", category: "study", paneId: "tabQuiz", name: "Quiz" },
  tabImportant: { id: "tabImportant", category: "study", paneId: "tabImportant", name: "Practice questions" },
  tabMindMap: { id: "tabMindMap", category: "study", paneId: "tabMindMap", name: "Mind map" },
  tabNotes: { id: "tabNotes", category: "study", paneId: "tabNotes", name: "Notes" },
  tabOverview: { id: "tabOverview", category: "synthesis", paneId: "tabOverview", name: "AI podcast" },
  tabBriefing: { id: "tabBriefing", category: "synthesis", paneId: "tabBriefing", name: "Briefing" },
  tabSlides: { id: "tabSlides", category: "synthesis", paneId: "tabSlides", name: "Slide deck" },
  tabDataTable: { id: "tabDataTable", category: "synthesis", paneId: "tabDataTable", name: "Data table" },
  tabCompare: { id: "tabCompare", category: "synthesis", paneId: "tabCompare", name: "Compare" },
  tabImages: { id: "tabImages", category: "media", paneId: "tabImages", name: "AI diagram" },
  tabVideo: { id: "tabVideo", category: "media", paneId: "tabVideo", name: "Video lecture" }
};

const StudioManager = {
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Bind category switcher buttons
    const catBtns = document.querySelectorAll(".cat-btn");
    catBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = btn.dataset.cat;
        if (cat) this.selectCategory(cat);
      });
    });

    // 2. Bind all tool tab buttons across all categories
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const tabId = btn.dataset.tab;
        if (tabId) this.selectTool(tabId);
      });
    });

    // 3. Bind Mind Map generator button
    if (generateMindMapBtn) {
      generateMindMapBtn.addEventListener("click", async () => {
        if (!state.currentId) {
          showToast("Please select a notebook first");
          return;
        }
        if (!state.documents || state.documents.length === 0) {
          showToast("Add a source to generate a concept mind map");
          return;
        }
        generateMindMapBtn.disabled = true;
        generateMindMapBtn.textContent = "⏳ Generating map...";
        try {
          const { scopeType, topic, documentIds } = getScopeParams("mm", "mindmap");
          const data = await api(`/notebooks/${state.currentId}/studio/mindmap`, {
            method: "POST",
            body: JSON.stringify({ scopeType, topic, documentIds })
          });
          state.mindmap = data;
          renderMindMap();
          showToast("🧠 Concept Mind Map Generated!");
        } catch (err) {
          showToast(err.message || "Failed to generate mind map");
        } finally {
          generateMindMapBtn.disabled = false;
          generateMindMapBtn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            <span>Generate map</span>`;
        }
      });
    }

    // 4. Bind Exam Filter pills in Practice Questions tab
    const examPills = document.querySelectorAll(".exam-pill-btn");
    examPills.forEach((pill) => {
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        examPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        state.examFilter = pill.dataset.examFilter || "all";
        renderImportantQuestions();
      });
    });

    // Default to Active Study category and Flashcards tool
    this.selectCategory(state.activeStudioCategory || "study", state.activeStudioTool || "tabFlashcards");
  },

  selectCategory(catId, preferredTool = null) {
    if (!STUDIO_CATEGORIES[catId]) catId = "study";
    state.activeStudioCategory = catId;

    const catConfig = STUDIO_CATEGORIES[catId];
    const targetTool = preferredTool || state.categoryLastTool[catId] || catConfig.defaultTool;
    this.selectTool(targetTool);
  },

  selectTool(toolId) {
    const toolConfig = STUDIO_TOOLS[toolId];
    if (!toolConfig) return;

    const catId = toolConfig.category;
    state.activeStudioCategory = catId;
    state.activeStudioTool = toolId;
    if (state.categoryLastTool) {
      state.categoryLastTool[catId] = toolId;
    }

    // 1. Update Category Switcher Bar buttons
    document.querySelectorAll(".cat-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === catId);
    });

    // 2. Display the correct tool group, hide the rest
    Object.entries(STUDIO_CATEGORIES).forEach(([cId, config]) => {
      const groupEl = document.getElementById(config.groupId);
      if (groupEl) {
        groupEl.style.display = cId === catId ? "flex" : "none";
        groupEl.classList.toggle("active", cId === catId);
      }
    });

    // 3. Highlight the selected tab button in the active group
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === toolId);
    });

    // 4. Activate ONLY the targeted tab pane; deactivate all other tab panes
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.classList.remove("active");
    });
    const targetPane = document.getElementById(toolConfig.paneId);
    if (targetPane) {
      targetPane.classList.add("active");
    }

    // 5. Dynamic refresh if artifact data is already cached
    if (toolId === "tabQuiz" && state.quiz) renderQuiz();
    else if (toolId === "tabImportant" && state.importantQuestions) renderImportantQuestions();
    else if (toolId === "tabMindMap" && state.mindmap) renderMindMap();
    else if (toolId === "tabSlides" && state.slides) renderSlides();
    else if (toolId === "tabDataTable" && state.dataTable) renderDataTable();
    else if (toolId === "tabFlashcards" && state.flashcards) renderFlashcards();
    else if (toolId === "tabOverview" && state.audioScript) renderAudioOverview();
    else if (toolId === "tabBriefing" && state.briefing) renderBriefing();
    else if (toolId === "tabImages" && state.visuals && state.visuals.length > 0) renderVisualGallery();
  }
};

function setupCategorizedTabs() {
  StudioManager.init();
}

// ══════════════════════════════════════════════════════════════════
// VIEW ROUTER (Landing, Main Notebook Library, Workspace)
// ══════════════════════════════════════════════════════════════════
const ViewRouter = {
  currentView: "landing", // "landing" | "library" | "workspace"

  showLanding() {
    this.currentView = "landing";
    const lp = document.getElementById("landingPage");
    const lib = document.getElementById("libraryPage");
    const app = document.getElementById("app");
    if (lib) lib.style.display = "none";
    if (app) app.style.display = "none";
    if (lp) {
      lp.style.display = "flex";
      lp.classList.remove("fade-out");
      if (typeof LandingPage !== "undefined") LandingPage.initParticles();
    }
    history.replaceState(null, "", window.location.pathname);
  },

  showLibrary(tab = null) {
    this.currentView = "library";
    const lp = document.getElementById("landingPage");
    const lib = document.getElementById("libraryPage");
    const app = document.getElementById("app");
    if (lp) lp.style.display = "none";
    if (app) app.style.display = "none";
    if (lib) {
      lib.style.display = "flex";
      lib.classList.add("fade-in");
      setTimeout(() => lib.classList.remove("fade-in"), 400);
    }
    if (tab && typeof libState !== "undefined") {
      libState.currentTab = tab;
    }
    if (typeof LibraryManager !== "undefined") {
      LibraryManager.loadData();
    }
    history.replaceState(null, "", window.location.pathname);
  },

  async showWorkspace(notebookId) {
    this.currentView = "workspace";
    const lp = document.getElementById("landingPage");
    const lib = document.getElementById("libraryPage");
    const app = document.getElementById("app");
    if (lp) lp.style.display = "none";
    if (lib) lib.style.display = "none";
    if (app) {
      app.style.display = "flex";
      app.classList.add("fade-in");
      setTimeout(() => app.classList.remove("fade-in"), 400);
    }
    if (typeof initApp === "function") {
      initApp();
    }
    if (typeof StudioManager !== "undefined") {
      StudioManager.init();
    }
    if (notebookId) {
      localStorage.setItem("studyvault_active_notebook", notebookId);
      window.location.hash = `notebook=${notebookId}`;
      await selectNotebook(notebookId);
    } else if (state.notebooks && state.notebooks.length > 0) {
      await selectNotebook(state.notebooks[0]._id);
    } else {
      showEmptyState();
    }
  }
};

function formatRelativeDate(dateStr) {
  if (!dateStr) return "Recently";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

// ══════════════════════════════════════════════════════════════════
// MAIN NOTEBOOK LIBRARY & COLLECTIONS MANAGER
// ══════════════════════════════════════════════════════════════════
const libState = {
  currentTab: "all", // "all" | "my" | "collections" | "collection-detail"
  activeCollectionId: null,
  activeCollectionData: null,
  viewMode: localStorage.getItem("studyvault_view_mode") || "grid",
  searchQuery: "",
  sortBy: localStorage.getItem("studyvault_sort_by") || "recent",
  notebooks: [],
  collections: [],
  isLoading: false,
  activeMenuCardId: null,
  confirmCallback: null
};

const LibraryManager = {
  _initialized: false,
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.bindNavTabs();
    this.bindSearchAndSort();
    this.bindViewToggles();
    this.bindHeroActions();
    this.bindModals();
    this.bindOutsideClicks();
    this.bindWorkspaceBack();
  },

  async loadData() {
    libState.isLoading = true;
    const skeleton = document.getElementById("librarySkeletonLoader");
    const grid = document.getElementById("libraryCardsGrid");
    if (skeleton) skeleton.style.display = "grid";
    if (grid) grid.style.display = "none";

    try {
      const [nbs, cols] = await Promise.all([
        api("/notebooks").catch(() => []),
        api("/collections").catch(() => [])
      ]);
      libState.notebooks = Array.isArray(nbs) ? nbs : [];
      libState.collections = Array.isArray(cols) ? cols : [];
      state.notebooks = [...libState.notebooks];

      if (libState.currentTab === "collection-detail" && libState.activeCollectionId) {
        try {
          const detail = await api(`/collections/${libState.activeCollectionId}`);
          libState.activeCollectionData = detail;
        } catch (e) {
          libState.currentTab = "collections";
          libState.activeCollectionId = null;
        }
      }
    } catch (err) {
      console.error("[library] loadData error:", err);
    } finally {
      libState.isLoading = false;
      if (skeleton) skeleton.style.display = "none";
      if (grid) grid.style.display = libState.viewMode === "list" ? "flex" : "grid";
      this.render();
    }
  },

  render() {
    // 1. Update Tab counts
    const countAll = document.getElementById("libCountAll");
    const countMy = document.getElementById("libCountMy");
    const countCols = document.getElementById("libCountCollections");
    if (countAll) countAll.textContent = libState.notebooks.length;
    if (countCols) countCols.textContent = libState.collections.length;

    const currentUserId = AuthManager.currentUser ? (AuthManager.currentUser.id || AuthManager.currentUser._id) : null;
    const isGuest = !AuthManager.currentUser || AuthManager.currentUser.role === "guest" || AuthManager.currentUser.id === "guest";
    const myNotebooks = libState.notebooks.filter(n => {
      if (AuthManager.currentUser?.role === "admin") return true;
      if (!currentUserId || isGuest) {
        return String(n.userId) === String(currentUserId || "guest");
      }
      return String(n.userId) === String(currentUserId);
    });
    if (countMy) countMy.textContent = myNotebooks.length;

    // 2. Tab active styling
    const tabAll = document.getElementById("libTabAll");
    const tabMy = document.getElementById("libTabMy");
    const tabCols = document.getElementById("libTabCollections");
    if (tabAll) tabAll.classList.toggle("active", libState.currentTab === "all");
    if (tabMy) tabMy.classList.toggle("active", libState.currentTab === "my");
    if (tabCols) tabCols.classList.toggle("active", libState.currentTab === "collections" || libState.currentTab === "collection-detail");

    // 3. View Mode Class
    const grid = document.getElementById("libraryCardsGrid");
    const gridBtn = document.getElementById("libViewGridBtn");
    const listBtn = document.getElementById("libViewListBtn");
    if (grid) {
      if (libState.viewMode === "list") {
        grid.classList.add("library-list");
        if (gridBtn) gridBtn.classList.remove("active");
        if (listBtn) listBtn.classList.add("active");
      } else {
        grid.classList.remove("library-list");
        if (gridBtn) gridBtn.classList.add("active");
        if (listBtn) listBtn.classList.remove("active");
      }
    }

    // 4. Containers visibility
    const sectionBar = document.querySelector(".library-section-bar");
    const colDetailContainer = document.getElementById("collectionDetailContainer");
    const quickColsRow = document.getElementById("quickCollectionsRow");
    const emptyState = document.getElementById("libraryEmptyState");

    if (libState.currentTab === "collection-detail") {
      if (sectionBar) sectionBar.style.display = "none";
      if (grid) grid.style.display = "none";
      if (quickColsRow) quickColsRow.style.display = "none";
      if (emptyState) emptyState.style.display = "none";
      if (colDetailContainer) {
        colDetailContainer.style.display = "flex";
        this.renderCollectionDetail();
      }
      return;
    } else {
      if (sectionBar) sectionBar.style.display = "flex";
      if (grid) grid.style.display = libState.viewMode === "list" ? "flex" : "grid";
      if (colDetailContainer) colDetailContainer.style.display = "none";
    }

    // 5. Quick Collections Row (visible in All tab if collections exist and no search query)
    if (quickColsRow) {
      if (libState.currentTab === "all" && libState.collections.length > 0 && !libState.searchQuery) {
        quickColsRow.style.display = "flex";
        this.renderQuickCollections();
      } else {
        quickColsRow.style.display = "none";
      }
    }

    // 6. Section Title & Counter
    const sectionTitle = document.getElementById("librarySectionTitle");
    const itemCounter = document.getElementById("libraryItemCounter");
    const filterTags = document.getElementById("activeFilterTags");

    if (libState.currentTab === "all") {
      if (sectionTitle) sectionTitle.textContent = "All Notebooks";
    } else if (libState.currentTab === "my") {
      if (sectionTitle) sectionTitle.textContent = "My Notebooks";
    } else if (libState.currentTab === "collections") {
      if (sectionTitle) sectionTitle.textContent = "Collections";
    }

    if (filterTags) {
      if (libState.searchQuery) {
        filterTags.innerHTML = `
          <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.25rem 0.65rem; background:rgba(138,180,248,0.12); border:1px solid rgba(138,180,248,0.3); border-radius:999px; font-size:0.75rem; color:#8ab4f8;">
            <span>Search: "<strong>${escapeHtml(libState.searchQuery)}</strong>"</span>
            <button id="clearFilterTagBtn" style="background:none; border:none; color:#8ab4f8; cursor:pointer; font-size:0.75rem; padding:0;">✕</button>
          </div>
        `;
        const clearBtn = document.getElementById("clearFilterTagBtn");
        if (clearBtn) clearBtn.addEventListener("click", () => {
          const input = document.getElementById("libSearchInput");
          if (input) input.value = "";
          libState.searchQuery = "";
          const clearIcon = document.getElementById("libSearchClear");
          if (clearIcon) clearIcon.style.display = "none";
          this.render();
        });
      } else {
        filterTags.innerHTML = "";
      }
    }

    // 7. Render Cards depending on current tab
    if (libState.currentTab === "collections") {
      this.renderCollectionsTab();
    } else {
      this.renderNotebooksTab();
    }
  },

  renderQuickCollections() {
    const carousel = document.getElementById("quickCollectionsCarousel");
    if (!carousel) return;
    carousel.innerHTML = libState.collections.slice(0, 6).map(c => `
      <div class="col-carousel-card" data-col-id="${c._id}">
        <div class="col-carousel-header">
          <span class="col-carousel-icon">${c.icon || "📁"}</span>
          <span class="col-carousel-name">${escapeHtml(c.name)}</span>
        </div>
        <div class="col-carousel-footer">
          <span>${c.notebookCount || (c.notebookIds ? c.notebookIds.length : 0)} notebooks</span>
          <span>${formatRelativeDate(c.updatedAt || c.createdAt)}</span>
        </div>
      </div>
    `).join("");

    carousel.querySelectorAll(".col-carousel-card").forEach(el => {
      el.addEventListener("click", () => {
        this.openCollection(el.dataset.colId);
      });
    });
  },

  renderNotebooksTab() {
    const grid = document.getElementById("libraryCardsGrid");
    const emptyState = document.getElementById("libraryEmptyState");
    const itemCounter = document.getElementById("libraryItemCounter");
    if (!grid) return;

    const currentUserId = AuthManager.currentUser ? (AuthManager.currentUser.id || AuthManager.currentUser._id) : null;
    const isGuest = !AuthManager.currentUser || AuthManager.currentUser.role === "guest" || AuthManager.currentUser.id === "guest";
    let items = libState.notebooks.filter(n => {
      if (AuthManager.currentUser?.role === "admin") return true;
      if (!currentUserId || isGuest) {
        return String(n.userId) === String(currentUserId || "guest");
      }
      return String(n.userId) === String(currentUserId);
    });

    // Filter by search
    if (libState.searchQuery) {
      const q = libState.searchQuery.toLowerCase();
      items = items.filter(n => (n.title && n.title.toLowerCase().includes(q)) || (n.description && n.description.toLowerCase().includes(q)));
    }

    // Sort
    if (libState.sortBy === "alpha") {
      items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (libState.sortBy === "created") {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      items.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }

    if (itemCounter) itemCounter.textContent = `${items.length} ${items.length === 1 ? "notebook" : "notebooks"}`;

    if (items.length === 0) {
      grid.innerHTML = "";
      if (emptyState) {
        emptyState.style.display = "flex";
        const emptyTitle = document.getElementById("libraryEmptyTitle");
        const emptyText = document.getElementById("libraryEmptyText");
        if (libState.searchQuery) {
          if (emptyTitle) emptyTitle.textContent = "No notebooks found";
          if (emptyText) emptyText.textContent = `No notebooks match "${libState.searchQuery}". Try a different keyword or clear search.`;
        } else {
          if (emptyTitle) emptyTitle.textContent = libState.currentTab === "my" ? "No notebooks in your library yet" : "No notebooks found";
          if (emptyText) emptyText.textContent = "Create your first research notebook or explore our pre-grounded sample research.";
        }
      }
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let html = "";
    // In grid view, include the "+ New Notebook" dashed card at the front
    if (libState.viewMode === "grid" && !libState.searchQuery) {
      html += `
        <div class="card-create-dashed" id="cardDashedNewNotebook" title="Create a new study notebook">
          <div class="card-create-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <span class="card-create-title">New notebook</span>
          <span class="card-create-subtitle">Upload sources, citations, and study aids</span>
        </div>
      `;
    }

    // Render notebook cards
    items.forEach(nb => {
      const cardColor = nb.color || "#8ab4f8";
      const icon = nb.icon || "📓";
      const docsCount = nb.documentCount || 0;
      const relativeDate = formatRelativeDate(nb.updatedAt || nb.createdAt);

      html += `
        <div class="notebook-card" data-nb-id="${nb._id}" style="--card-color: ${cardColor};">
          <div class="nb-card-cover">
            <div class="nb-card-top-actions">
              <button class="btn-card-menu" data-menu-id="${nb._id}" title="Notebook options">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
              <div class="card-dropdown-menu" id="menu-${nb._id}" style="display:none;">
                <button class="card-menu-item" data-action="open" data-id="${nb._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span>Open workspace</span>
                </button>
                <button class="card-menu-item" data-action="rename" data-id="${nb._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <span>Rename</span>
                </button>
                <button class="card-menu-item" data-action="add-to-collection" data-id="${nb._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span>Add to collection</span>
                </button>
                <button class="card-menu-item" data-action="duplicate" data-id="${nb._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Duplicate</span>
                </button>
                <div style="height:1px; background:rgba(255,255,255,0.08); margin:0.2rem 0;"></div>
                <button class="card-menu-item danger" data-action="delete" data-id="${nb._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span>Delete notebook</span>
                </button>
              </div>
            </div>
          </div>
          <div class="nb-card-icon-badge">${icon}</div>
          <div class="nb-card-content">
            <h3 class="nb-card-title" title="${escapeHtml(nb.title)}">${escapeHtml(nb.title)}</h3>
            <p class="nb-card-desc">${nb.description ? escapeHtml(nb.description) : "Research workspace with grounded AI citations, quiz, notes, and study studio."}</p>
          </div>
          <div class="nb-card-footer">
            <span class="nb-card-source-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>${docsCount} ${docsCount === 1 ? "source" : "sources"}</span>
            </span>
            <span class="nb-card-date">${relativeDate}</span>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
    this.bindCardInteractions(grid);
  },

  renderCollectionsTab() {
    const grid = document.getElementById("libraryCardsGrid");
    const emptyState = document.getElementById("libraryEmptyState");
    const itemCounter = document.getElementById("libraryItemCounter");
    if (!grid) return;

    let items = [...libState.collections];

    // Filter by search
    if (libState.searchQuery) {
      const q = libState.searchQuery.toLowerCase();
      items = items.filter(c => (c.name && c.name.toLowerCase().includes(q)) || (c.description && c.description.toLowerCase().includes(q)));
    }

    // Sort
    if (libState.sortBy === "alpha") {
      items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (libState.sortBy === "created") {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      items.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }

    if (itemCounter) itemCounter.textContent = `${items.length} ${items.length === 1 ? "collection" : "collections"}`;

    if (items.length === 0) {
      grid.innerHTML = "";
      if (emptyState) {
        emptyState.style.display = "flex";
        const emptyTitle = document.getElementById("libraryEmptyTitle");
        const emptyText = document.getElementById("libraryEmptyText");
        if (libState.searchQuery) {
          if (emptyTitle) emptyTitle.textContent = "No collections found";
          if (emptyText) emptyText.textContent = `No collections match "${libState.searchQuery}". Try a different keyword or clear search.`;
        } else {
          if (emptyTitle) emptyTitle.textContent = "No collections created yet";
          if (emptyText) emptyText.textContent = "Group your notebooks into collections by subject, course, or research topic.";
        }
      }
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let html = "";
    if (libState.viewMode === "grid" && !libState.searchQuery) {
      html += `
        <div class="card-create-dashed" id="cardDashedNewCollection" title="Create a new collection">
          <div class="card-create-icon-wrap" style="background:rgba(197,138,249,0.12); color:#c58af9; border-color:rgba(197,138,249,0.25);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <span class="card-create-title">Create collection</span>
          <span class="card-create-subtitle">Organize study materials and related vaults</span>
        </div>
      `;
    }

    items.forEach(col => {
      const icon = col.icon || "📁";
      const nbCount = col.notebookCount || (col.notebookIds ? col.notebookIds.length : 0);
      const relativeDate = formatRelativeDate(col.updatedAt || col.createdAt);

      html += `
        <div class="collection-card" data-col-id="${col._id}">
          <div class="col-card-header">
            <div class="col-card-icon-box" style="border-color:${col.color || '#c58af9'}44; background:${col.color || '#c58af9'}15;">${icon}</div>
            <div style="position:relative;">
              <button class="btn-card-menu" data-menu-id="col-${col._id}" title="Collection options">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
              <div class="card-dropdown-menu" id="menu-col-${col._id}" style="display:none;">
                <button class="card-menu-item" data-action="open-col" data-id="${col._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span>Open collection</span>
                </button>
                <button class="card-menu-item" data-action="manage-col-notebooks" data-id="${col._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                  <span>Add notebooks</span>
                </button>
                <button class="card-menu-item" data-action="edit-col" data-id="${col._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <span>Edit details</span>
                </button>
                <div style="height:1px; background:rgba(255,255,255,0.08); margin:0.2rem 0;"></div>
                <button class="card-menu-item danger" data-action="delete-col" data-id="${col._id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span>Delete collection</span>
                </button>
              </div>
            </div>
          </div>
          <div class="col-card-info">
            <h3 class="col-card-name">${escapeHtml(col.name)}</h3>
            <p class="col-card-desc">${col.description ? escapeHtml(col.description) : "Curated collection of StudyVault research notebooks."}</p>
          </div>
          <div class="col-card-footer">
            <span class="col-card-count-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span>${nbCount} ${nbCount === 1 ? "notebook" : "notebooks"}</span>
            </span>
            <span>${relativeDate}</span>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
    this.bindCollectionInteractions(grid);
  },

  async openCollection(colId) {
    libState.currentTab = "collection-detail";
    libState.activeCollectionId = colId;
    libState.isLoading = true;
    try {
      const col = await api(`/collections/${colId}`);
      libState.activeCollectionData = col;
    } catch (err) {
      showToast(err.message || "Failed to load collection details");
      libState.currentTab = "collections";
      libState.activeCollectionId = null;
    } finally {
      libState.isLoading = false;
      this.render();
    }
  },

  renderCollectionDetail() {
    const col = libState.activeCollectionData;
    if (!col) return;

    const iconEl = document.getElementById("colDetailIcon");
    const titleEl = document.getElementById("colDetailTitle");
    const countBadge = document.getElementById("colDetailCountBadge");
    const descEl = document.getElementById("colDetailDesc");
    const grid = document.getElementById("collectionNotebooksGrid");
    const emptyState = document.getElementById("collectionEmptyState");

    if (iconEl) iconEl.textContent = col.icon || "📁";
    if (titleEl) titleEl.textContent = col.name;
    const nbs = col.notebooks || [];
    if (countBadge) countBadge.textContent = `${nbs.length} ${nbs.length === 1 ? "notebook" : "notebooks"}`;
    if (descEl) descEl.textContent = col.description || "Curated collection of study notebooks.";

    if (nbs.length === 0) {
      if (grid) grid.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let html = "";
    nbs.forEach(nb => {
      const cardColor = nb.color || "#8ab4f8";
      const icon = nb.icon || "📓";
      const docsCount = nb.documentCount || 0;
      const relativeDate = formatRelativeDate(nb.updatedAt || nb.createdAt);

      html += `
        <div class="notebook-card" data-nb-id="${nb._id}" style="--card-color: ${cardColor};">
          <div class="nb-card-cover">
            <div class="nb-card-top-actions">
              <button class="btn-col-remove-nb" data-remove-nb-id="${nb._id}" data-col-id="${col._id}" title="Remove from this collection">
                <span>Remove</span>
              </button>
            </div>
          </div>
          <div class="nb-card-icon-badge">${icon}</div>
          <div class="nb-card-content">
            <h3 class="nb-card-title" title="${escapeHtml(nb.title)}">${escapeHtml(nb.title)}</h3>
            <p class="nb-card-desc">${nb.description ? escapeHtml(nb.description) : "Research workspace with grounded AI citations."}</p>
          </div>
          <div class="nb-card-footer">
            <span class="nb-card-source-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>${docsCount} sources</span>
            </span>
            <span class="nb-card-date">${relativeDate}</span>
          </div>
        </div>
      `;
    });

    if (grid) {
      grid.innerHTML = html;
      grid.querySelectorAll(".notebook-card").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".btn-col-remove-nb")) return;
          ViewRouter.showWorkspace(card.dataset.nbId);
        });
      });

      grid.querySelectorAll(".btn-col-remove-nb").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const nbId = btn.dataset.removeNbId;
          const colId = btn.dataset.colId;
          try {
            await api(`/collections/${colId}/notebooks/${nbId}`, { method: "DELETE" });
            showToast("Removed from collection");
            this.openCollection(colId);
          } catch (err) {
            showToast(err.message || "Failed to remove from collection");
          }
        });
      });
    }
  },

  bindCardInteractions(container) {
    const dashedCard = container.querySelector("#cardDashedNewNotebook");
    if (dashedCard) {
      dashedCard.addEventListener("click", () => this.openCreateNotebookModal());
    }

    container.querySelectorAll(".notebook-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-card-menu") || e.target.closest(".card-dropdown-menu")) return;
        const nbId = card.dataset.nbId;
        ViewRouter.showWorkspace(nbId);
      });
    });

    container.querySelectorAll(".btn-card-menu").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nbId = btn.dataset.menuId;
        this.toggleCardMenu(`menu-${nbId}`);
      });
    });

    container.querySelectorAll(".card-menu-item").forEach(item => {
      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const nbId = item.dataset.id;
        this.closeAllCardMenus();

        if (action === "open") {
          ViewRouter.showWorkspace(nbId);
        } else if (action === "rename") {
          this.openRenameNotebookModal(nbId);
        } else if (action === "add-to-collection") {
          this.openPickCollectionModal(nbId);
        } else if (action === "duplicate") {
          this.duplicateNotebook(nbId);
        } else if (action === "delete") {
          this.confirmDeleteNotebook(nbId);
        }
      });
    });
  },

  bindCollectionInteractions(container) {
    const dashedCol = container.querySelector("#cardDashedNewCollection");
    if (dashedCol) {
      dashedCol.addEventListener("click", () => this.openCollectionModal());
    }

    container.querySelectorAll(".collection-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-card-menu") || e.target.closest(".card-dropdown-menu")) return;
        const colId = card.dataset.colId;
        this.openCollection(colId);
      });
    });

    container.querySelectorAll(".btn-card-menu").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const menuId = btn.dataset.menuId;
        this.toggleCardMenu(`menu-${menuId}`);
      });
    });

    container.querySelectorAll(".card-menu-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const colId = item.dataset.id;
        this.closeAllCardMenus();

        if (action === "open-col") {
          this.openCollection(colId);
        } else if (action === "manage-col-notebooks") {
          this.openManageNotebooksModal(colId);
        } else if (action === "edit-col") {
          this.openCollectionModal(colId);
        } else if (action === "delete-col") {
          this.confirmDeleteCollection(colId);
        }
      });
    });
  },

  toggleCardMenu(menuId) {
    const targetMenu = document.getElementById(menuId);
    if (!targetMenu) return;
    const isShowing = targetMenu.style.display === "flex";
    this.closeAllCardMenus();
    if (!isShowing) {
      targetMenu.style.display = "flex";
      libState.activeMenuCardId = menuId;
    }
  },

  closeAllCardMenus() {
    document.querySelectorAll(".card-dropdown-menu").forEach(menu => {
      menu.style.display = "none";
    });
    libState.activeMenuCardId = null;
  },

  bindNavTabs() {
    const tabAll = document.getElementById("libTabAll");
    const tabMy = document.getElementById("libTabMy");
    const tabCols = document.getElementById("libTabCollections");
    const viewAllLink = document.getElementById("viewAllCollectionsLink");

    if (tabAll) tabAll.addEventListener("click", () => {
      libState.currentTab = "all";
      libState.activeCollectionId = null;
      this.render();
    });

    if (tabMy) tabMy.addEventListener("click", () => {
      libState.currentTab = "my";
      libState.activeCollectionId = null;
      this.render();
    });

    if (tabCols) tabCols.addEventListener("click", () => {
      libState.currentTab = "collections";
      libState.activeCollectionId = null;
      this.render();
    });

    if (viewAllLink) viewAllLink.addEventListener("click", () => {
      libState.currentTab = "collections";
      libState.activeCollectionId = null;
      this.render();
    });

    const logo = document.getElementById("libraryBrandLogo");
    if (logo) logo.addEventListener("click", () => {
      libState.currentTab = "all";
      libState.searchQuery = "";
      const searchInput = document.getElementById("libSearchInput");
      if (searchInput) searchInput.value = "";
      this.render();
    });
  },

  bindSearchAndSort() {
    const searchInput = document.getElementById("libSearchInput");
    const clearBtn = document.getElementById("libSearchClear");
    const sortSelect = document.getElementById("libSortSelect");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        libState.searchQuery = searchInput.value.trim();
        if (clearBtn) clearBtn.style.display = libState.searchQuery ? "block" : "none";
        this.render();
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          searchInput.value = "";
          libState.searchQuery = "";
          if (clearBtn) clearBtn.style.display = "none";
          searchInput.blur();
          this.render();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        libState.searchQuery = "";
        clearBtn.style.display = "none";
        this.render();
      });
    }

    window.addEventListener("keydown", (e) => {
      if (ViewRouter.currentView !== "library") return;
      if (e.key === "/" && document.activeElement !== searchInput && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    });

    if (sortSelect) {
      sortSelect.value = libState.sortBy;
      sortSelect.addEventListener("change", () => {
        libState.sortBy = sortSelect.value;
        localStorage.setItem("studyvault_sort_by", libState.sortBy);
        this.render();
      });
    }
  },

  bindViewToggles() {
    const gridBtn = document.getElementById("libViewGridBtn");
    const listBtn = document.getElementById("libViewListBtn");

    if (gridBtn) gridBtn.addEventListener("click", () => {
      libState.viewMode = "grid";
      localStorage.setItem("studyvault_view_mode", "grid");
      this.render();
    });

    if (listBtn) listBtn.addEventListener("click", () => {
      libState.viewMode = "list";
      localStorage.setItem("studyvault_view_mode", "list");
      this.render();
    });
  },

  bindHeroActions() {
    const heroNewNb = document.getElementById("heroNewNotebookBtn");
    const heroNewCol = document.getElementById("heroNewCollectionBtn");
    const emptyNewNb = document.getElementById("emptyCreateNotebookBtn");
    const emptySample = document.getElementById("emptySampleBtn");
    const colEmptyAdd = document.getElementById("colEmptyAddBtn");

    if (heroNewNb) heroNewNb.addEventListener("click", () => this.openCreateNotebookModal());
    if (heroNewCol) heroNewCol.addEventListener("click", () => this.openCollectionModal());
    if (emptyNewNb) emptyNewNb.addEventListener("click", () => this.openCreateNotebookModal());
    if (colEmptyAdd) colEmptyAdd.addEventListener("click", () => {
      if (libState.activeCollectionId) this.openManageNotebooksModal(libState.activeCollectionId);
    });

    if (emptySample) {
      emptySample.addEventListener("click", async () => {
        showToast("Loading sample research...");
        try {
          const sampleKey = "operating_systems";
          const nb = await api(`/notebooks/sample/${sampleKey}`, { method: "POST" });
          showToast(`Sample notebook loaded: ${nb.title}! 🎉`);
          await this.loadData();
          ViewRouter.showWorkspace(nb._id);
        } catch (err) {
          showToast(err.message || "Failed to load sample research");
        }
      });
    }

    const backToCols = document.getElementById("backToCollectionsBtn");
    if (backToCols) {
      backToCols.addEventListener("click", () => {
        libState.currentTab = "collections";
        libState.activeCollectionId = null;
        this.render();
      });
    }

    const colAddNbBtn = document.getElementById("colDetailAddNotebooksBtn");
    if (colAddNbBtn) {
      colAddNbBtn.addEventListener("click", () => {
        if (libState.activeCollectionId) this.openManageNotebooksModal(libState.activeCollectionId);
      });
    }

    const colEditBtn = document.getElementById("colDetailEditBtn");
    if (colEditBtn) {
      colEditBtn.addEventListener("click", () => {
        if (libState.activeCollectionId) this.openCollectionModal(libState.activeCollectionId);
      });
    }

    const colDeleteBtn = document.getElementById("colDetailDeleteBtn");
    if (colDeleteBtn) {
      colDeleteBtn.addEventListener("click", () => {
        if (libState.activeCollectionId) this.confirmDeleteCollection(libState.activeCollectionId);
      });
    }
  },

  bindWorkspaceBack() {
    const backBtn = document.getElementById("backToLibraryBtn");
    const wsLogo = document.getElementById("workspaceLogoClickable");
    const wsTitle = document.getElementById("workspaceBrandTitleClickable");

    const returnToLibrary = () => {
      ViewRouter.showLibrary();
    };

    if (backBtn) backBtn.addEventListener("click", returnToLibrary);
    if (wsLogo) wsLogo.addEventListener("click", returnToLibrary);
    if (wsTitle) wsTitle.addEventListener("click", returnToLibrary);
  },

  bindOutsideClicks() {
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".btn-card-menu") && !e.target.closest(".card-dropdown-menu")) {
        this.closeAllCardMenus();
      }

      const libUserMenu = document.getElementById("libUserMenu");
      const libDropdown = document.getElementById("libUserDropdown");
      if (libUserMenu && libDropdown && !libUserMenu.contains(e.target)) {
        libDropdown.classList.remove("show");
      }
    });

    const avatarBtn = document.getElementById("libUserAvatarBtn");
    const libDropdown = document.getElementById("libUserDropdown");
    if (avatarBtn && libDropdown) {
      avatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        libDropdown.classList.toggle("show");
      });
    }

    const settingsBtn = document.getElementById("libSettingsBtn");
    const settingsDropdownBtn = document.getElementById("libSettingsBtnDropdown");
    const openSettings = () => {
      if (typeof openSettingsBtn !== "undefined" && openSettingsBtn) {
        openSettingsBtn.click();
      } else {
        const modal = document.getElementById("settingsModal");
        if (modal) modal.classList.add("show");
      }
    };
    if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
    if (settingsDropdownBtn) settingsDropdownBtn.addEventListener("click", openSettings);

    const logoutBtn = document.getElementById("libLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        AuthManager.clearSession();
      });
    }

    const adminBtn = document.getElementById("libAdminPanelBtn");
    if (adminBtn) {
      adminBtn.addEventListener("click", () => {
        window.location.href = "/admin";
      });
    }
  },

  bindModals() {
    const createNbModal = document.getElementById("createNotebookModal");
    const closeCreateNbBtn = document.getElementById("closeCreateNbModalBtn");
    const cancelCreateNbBtn = document.getElementById("cancelCreateNbBtn");
    const createNbForm = document.getElementById("createNotebookForm");

    if (closeCreateNbBtn) closeCreateNbBtn.addEventListener("click", () => createNbModal.classList.remove("show"));
    if (cancelCreateNbBtn) cancelCreateNbBtn.addEventListener("click", () => createNbModal.classList.remove("show"));
    if (createNbModal) {
      createNbModal.addEventListener("click", (e) => {
        if (e.target === createNbModal) createNbModal.classList.remove("show");
      });
    }

    document.querySelectorAll("#nbEmojiPicker .emoji-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#nbEmojiPicker .emoji-opt").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.querySelectorAll("#nbColorPicker .color-swatch").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#nbColorPicker .color-swatch").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    if (createNbForm) {
      createNbForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById("newNbTitleInput");
        const descInput = document.getElementById("newNbDescInput");
        const submitBtn = document.getElementById("submitCreateNbBtn");
        const errBanner = document.getElementById("newNbError");

        const title = titleInput.value.trim();
        if (!title) {
          if (errBanner) {
            errBanner.textContent = "Please enter a notebook title";
            errBanner.style.display = "block";
          }
          return;
        }

        const activeEmoji = document.querySelector("#nbEmojiPicker .emoji-opt.active");
        const activeColor = document.querySelector("#nbColorPicker .color-swatch.active");
        const icon = activeEmoji ? activeEmoji.dataset.emoji : "📓";
        const color = activeColor ? activeColor.dataset.color : "#8ab4f8";
        const description = descInput ? descInput.value.trim() : "";

        if (submitBtn) {
          submitBtn.disabled = true;
          const span = submitBtn.querySelector("span");
          if (span) span.textContent = "Creating...";
        }
        if (errBanner) errBanner.style.display = "none";

        try {
          const newNb = await api("/notebooks", {
            method: "POST",
            body: JSON.stringify({ title, description, icon, color })
          });

          createNbModal.classList.remove("show");
          titleInput.value = "";
          if (descInput) descInput.value = "";
          showToast(`Created notebook "${title}"! 🎉`);

          const newId = newNb._id || newNb.id;
          if (Array.isArray(state.notebooks) && !state.notebooks.some(n => String(n._id || n.id) === String(newId))) {
            state.notebooks.unshift(newNb);
          }
          if (typeof renderNotebookList === "function") {
            renderNotebookList();
          }

          await this.loadData();
          ViewRouter.showWorkspace(newId);
        } catch (err) {
          if (errBanner) {
            errBanner.textContent = err.message || "Failed to create notebook";
            errBanner.style.display = "block";
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            const span = submitBtn.querySelector("span");
            if (span) span.textContent = "Create notebook";
          }
        }
      });
    }

    const colModal = document.getElementById("collectionModal");
    const closeColBtn = document.getElementById("closeColModalBtn");
    const cancelColBtn = document.getElementById("cancelColBtn");
    const colForm = document.getElementById("collectionForm");

    if (closeColBtn) closeColBtn.addEventListener("click", () => colModal.classList.remove("show"));
    if (cancelColBtn) cancelColBtn.addEventListener("click", () => colModal.classList.remove("show"));

    document.querySelectorAll("#colEmojiPicker .emoji-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#colEmojiPicker .emoji-opt").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.querySelectorAll("#colColorPicker .color-swatch").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#colColorPicker .color-swatch").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    if (colForm) {
      colForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const editId = document.getElementById("colEditId").value;
        const nameInput = document.getElementById("colNameInput");
        const descInput = document.getElementById("colDescInput");
        const submitBtn = document.getElementById("submitColBtn");
        const errBanner = document.getElementById("colError");

        const name = nameInput.value.trim();
        if (!name) {
          if (errBanner) {
            errBanner.textContent = "Collection name is required";
            errBanner.style.display = "block";
          }
          return;
        }

        const activeEmoji = document.querySelector("#colEmojiPicker .emoji-opt.active");
        const activeColor = document.querySelector("#colColorPicker .color-swatch.active");
        const icon = activeEmoji ? activeEmoji.dataset.emoji : "📁";
        const color = activeColor ? activeColor.dataset.color : "#c58af9";
        const description = descInput ? descInput.value.trim() : "";

        if (submitBtn) {
          submitBtn.disabled = true;
          const span = submitBtn.querySelector("span");
          if (span) span.textContent = "Saving...";
        }
        if (errBanner) errBanner.style.display = "none";

        try {
          if (editId) {
            await api(`/collections/${editId}`, {
              method: "PUT",
              body: JSON.stringify({ name, description, icon, color })
            });
            showToast("Collection updated! 📁");
          } else {
            await api("/collections", {
              method: "POST",
              body: JSON.stringify({ name, description, icon, color })
            });
            showToast("Collection created! 📁");
          }

          colModal.classList.remove("show");
          await this.loadData();
          if (editId && libState.currentTab === "collection-detail") {
            this.openCollection(editId);
          }
        } catch (err) {
          if (errBanner) {
            errBanner.textContent = err.message || "Failed to save collection";
            errBanner.style.display = "block";
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            const span = submitBtn.querySelector("span");
            if (span) span.textContent = "Save collection";
          }
        }
      });
    }

    const addNbModal = document.getElementById("addNotebooksToCollectionModal");
    const closeAddNbBtn = document.getElementById("closeAddToColModalBtn");
    const cancelAddNbBtn = document.getElementById("cancelColAddBtn");
    const submitAddNbBtn = document.getElementById("submitColAddBtn");
    const addNbSearch = document.getElementById("colAddSearchInput");

    if (closeAddNbBtn) closeAddNbBtn.addEventListener("click", () => addNbModal.classList.remove("show"));
    if (cancelAddNbBtn) cancelAddNbBtn.addEventListener("click", () => addNbModal.classList.remove("show"));

    if (addNbSearch) {
      addNbSearch.addEventListener("input", () => {
        const q = addNbSearch.value.trim().toLowerCase();
        document.querySelectorAll("#colAddNotebooksList .col-select-item").forEach(item => {
          const title = item.dataset.title || "";
          item.style.display = title.toLowerCase().includes(q) ? "flex" : "none";
        });
      });
    }

    if (submitAddNbBtn) {
      submitAddNbBtn.addEventListener("click", async () => {
        const colId = document.getElementById("targetCollectionId").value;
        if (!colId) return;

        const selectedIds = [];
        document.querySelectorAll("#colAddNotebooksList input[type='checkbox']:checked").forEach(cb => {
          selectedIds.push(cb.value);
        });

        submitAddNbBtn.disabled = true;
        submitAddNbBtn.textContent = "Saving...";

        try {
          await api(`/collections/${colId}`, {
            method: "PUT",
            body: JSON.stringify({ notebookIds: selectedIds })
          });
          addNbModal.classList.remove("show");
          showToast("Collection membership updated! 📁");
          await this.loadData();
          if (libState.currentTab === "collection-detail") {
            this.openCollection(colId);
          }
        } catch (err) {
          showToast(err.message || "Failed to update collection");
        } finally {
          submitAddNbBtn.disabled = false;
          submitAddNbBtn.textContent = "Save changes";
        }
      });
    }

    const renameModal = document.getElementById("renameNotebookModal");
    const closeRenameBtn = document.getElementById("closeRenameNbModalBtn");
    const cancelRenameBtn = document.getElementById("cancelRenameNbBtn");
    const renameForm = document.getElementById("renameNotebookForm");

    if (closeRenameBtn) closeRenameBtn.addEventListener("click", () => renameModal.classList.remove("show"));
    if (cancelRenameBtn) cancelRenameBtn.addEventListener("click", () => renameModal.classList.remove("show"));

    if (renameForm) {
      renameForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nbId = document.getElementById("renameNbId").value;
        const newTitle = document.getElementById("renameNbInput").value.trim();
        const submitBtn = document.getElementById("submitRenameNbBtn");
        const errBanner = document.getElementById("renameNbError");

        if (!newTitle) return;
        if (submitBtn) submitBtn.disabled = true;
        if (errBanner) errBanner.style.display = "none";

        try {
          await api(`/notebooks/${nbId}`, {
            method: "PUT",
            body: JSON.stringify({ title: newTitle })
          });
          renameModal.classList.remove("show");
          showToast("Notebook renamed! 📓");
          await this.loadData();
          if (state.currentId === nbId) {
            notebookTitle.textContent = newTitle;
          }
        } catch (err) {
          if (errBanner) {
            errBanner.textContent = err.message || "Failed to rename";
            errBanner.style.display = "block";
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const pickColModal = document.getElementById("pickCollectionModal");
    const closePickColBtn = document.getElementById("closePickColModalBtn");
    const cancelPickColBtn = document.getElementById("cancelPickColBtn");
    const quickCreateFromPicker = document.getElementById("quickCreateColFromPickerBtn");

    if (closePickColBtn) closePickColBtn.addEventListener("click", () => pickColModal.classList.remove("show"));
    if (cancelPickColBtn) cancelPickColBtn.addEventListener("click", () => pickColModal.classList.remove("show"));
    if (quickCreateFromPicker) quickCreateFromPicker.addEventListener("click", () => {
      pickColModal.classList.remove("show");
      this.openCollectionModal();
    });

  },

  openCreateNotebookModal() {
    const modal = document.getElementById("createNotebookModal");
    const titleInput = document.getElementById("newNbTitleInput");
    const descInput = document.getElementById("newNbDescInput");
    const errBanner = document.getElementById("newNbError");
    if (titleInput) titleInput.value = "";
    if (descInput) descInput.value = "";
    if (errBanner) errBanner.style.display = "none";
    if (modal) {
      modal.classList.add("show");
      setTimeout(() => { if (titleInput) titleInput.focus(); }, 100);
    }
  },

  openCollectionModal(editId = null) {
    const modal = document.getElementById("collectionModal");
    const titleHeader = document.getElementById("collectionModalTitle");
    const editIdInput = document.getElementById("colEditId");
    const nameInput = document.getElementById("colNameInput");
    const descInput = document.getElementById("colDescInput");
    const errBanner = document.getElementById("colError");

    if (errBanner) errBanner.style.display = "none";
    if (editId) {
      const col = libState.collections.find(c => String(c._id) === String(editId));
      if (col) {
        if (titleHeader) titleHeader.textContent = "Edit Collection";
        if (editIdInput) editIdInput.value = col._id;
        if (nameInput) nameInput.value = col.name;
        if (descInput) descInput.value = col.description || "";
        document.querySelectorAll("#colEmojiPicker .emoji-opt").forEach(b => {
          b.classList.toggle("active", b.dataset.emoji === (col.icon || "📁"));
        });
        document.querySelectorAll("#colColorPicker .color-swatch").forEach(b => {
          b.classList.toggle("active", b.dataset.color === (col.color || "#c58af9"));
        });
      }
    } else {
      if (titleHeader) titleHeader.textContent = "Create New Collection";
      if (editIdInput) editIdInput.value = "";
      if (nameInput) nameInput.value = "";
      if (descInput) descInput.value = "";
    }

    if (modal) {
      modal.classList.add("show");
      setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
    }
  },

  openManageNotebooksModal(colId) {
    const modal = document.getElementById("addNotebooksToCollectionModal");
    const targetIdInput = document.getElementById("targetCollectionId");
    const list = document.getElementById("colAddNotebooksList");
    const searchInput = document.getElementById("colAddSearchInput");
    if (!modal || !list) return;

    if (targetIdInput) targetIdInput.value = colId;
    if (searchInput) searchInput.value = "";

    const col = libState.collections.find(c => String(c._id) === String(colId)) || libState.activeCollectionData;
    const existingIds = new Set((col && col.notebookIds ? col.notebookIds : []).map(String));

    if (libState.notebooks.length === 0) {
      list.innerHTML = `<p style="padding:1rem; text-align:center; color:#94a3b8; font-size:0.85rem;">No notebooks exist yet. Create a notebook first.</p>`;
    } else {
      list.innerHTML = libState.notebooks.map(nb => {
        const isChecked = existingIds.has(String(nb._id));
        return `
          <label class="col-select-item" data-title="${escapeHtml(nb.title)}">
            <input type="checkbox" value="${nb._id}" ${isChecked ? "checked" : ""}>
            <span style="font-size:1.1rem;">${nb.icon || "📓"}</span>
            <span class="col-select-title">${escapeHtml(nb.title)}</span>
            <span class="col-select-count">${nb.documentCount || 0} docs</span>
          </label>
        `;
      }).join("");
    }

    modal.classList.add("show");
  },

  openRenameNotebookModal(nbId) {
    const modal = document.getElementById("renameNotebookModal");
    const idInput = document.getElementById("renameNbId");
    const titleInput = document.getElementById("renameNbInput");
    const errBanner = document.getElementById("renameNbError");
    if (!modal) return;

    const nb = libState.notebooks.find(n => String(n._id) === String(nbId));
    if (idInput) idInput.value = nbId;
    if (titleInput && nb) titleInput.value = nb.title;
    if (errBanner) errBanner.style.display = "none";

    modal.classList.add("show");
    setTimeout(() => { if (titleInput) titleInput.focus(); }, 100);
  },

  openPickCollectionModal(nbId) {
    const modal = document.getElementById("pickCollectionModal");
    const nbIdInput = document.getElementById("pickColNotebookId");
    const list = document.getElementById("pickColList");
    if (!modal || !list) return;

    if (nbIdInput) nbIdInput.value = nbId;

    if (libState.collections.length === 0) {
      list.innerHTML = `<p style="padding:0.75rem; text-align:center; color:#94a3b8; font-size:0.84rem;">No collections created yet.</p>`;
    } else {
      list.innerHTML = libState.collections.map(col => {
        const alreadyIn = (col.notebookIds || []).some(nid => String(nid) === String(nbId));
        return `
          <button class="col-picker-btn" data-col-id="${col._id}">
            <span>${col.icon || "📁"} ${escapeHtml(col.name)}</span>
            <span style="font-size:0.75rem; color:#94a3b8;">${alreadyIn ? "✓ Added" : "+ Add"}</span>
          </button>
        `;
      }).join("");

      list.querySelectorAll(".col-picker-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const colId = btn.dataset.colId;
          try {
            await api(`/collections/${colId}/notebooks`, {
              method: "POST",
              body: JSON.stringify({ notebookId: nbId })
            });
            modal.classList.remove("show");
            showToast("Added notebook to collection! 📁");
            await this.loadData();
          } catch (err) {
            showToast(err.message || "Failed to add to collection");
          }
        });
      });
    }

    modal.classList.add("show");
  },

  async duplicateNotebook(nbId) {
    try {
      showToast("Duplicating notebook...");
      const duplicated = await api(`/notebooks/${nbId}/duplicate`, { method: "POST" });
      showToast(`Duplicated: "${duplicated.title}"! 📑`);
      await this.loadData();
    } catch (err) {
      showToast(err.message || "Failed to duplicate notebook");
    }
  },

  confirmDeleteNotebook(nbId) {
    const nb = libState.notebooks.find(n => String(n._id) === String(nbId));
    const title = nb ? nb.title : "this notebook";

    showConfirmDialog({
      title: "Delete Notebook",
      message: `Are you sure you want to delete "${title}" and all its uploaded sources, chat history, and notes? This action cannot be undone.`,
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await api(`/notebooks/${nbId}`, { method: "DELETE" });
          showToast("Notebook deleted");
          if (state.currentId === nbId) state.currentId = null;
          await this.loadData();
        } catch (err) {
          showToast(err.message || "Failed to delete notebook");
        }
      }
    });
  },

  confirmDeleteCollection(colId) {
    const col = libState.collections.find(c => String(c._id) === String(colId));
    const name = col ? col.name : "this collection";

    showConfirmDialog({
      title: "Delete Collection",
      message: `Are you sure you want to delete collection "${name}"? Note: All notebooks within this collection will remain completely safe in your library.`,
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await api(`/collections/${colId}`, { method: "DELETE" });
          showToast("Collection deleted (notebooks preserved) 📁");
          if (libState.currentTab === "collection-detail") {
            libState.currentTab = "collections";
            libState.activeCollectionId = null;
          }
          await this.loadData();
        } catch (err) {
          showToast(err.message || "Failed to delete collection");
        }
      }
    });
  }
};

// ══════════════════════════════════════════════════════════════════
// AUTH MANAGER
// ══════════════════════════════════════════════════════════════════
const AuthManager = {
  currentUser: null,

  init() {
    initApp();

    const saved = localStorage.getItem("studyvault_user");
    const token = localStorage.getItem("studyvault_token");
    if (saved && token) {
      try { this.currentUser = JSON.parse(saved); } catch(e) {}
    }

    if (this.currentUser) {
      const urlParams = new URLSearchParams(window.location.search);
      const hashNb = window.location.hash.includes("notebook=") ? window.location.hash.split("notebook=")[1] : null;
      const paramNb = urlParams.get("notebook") || hashNb;
      if (paramNb) {
        ViewRouter.showWorkspace(paramNb);
      } else {
        ViewRouter.showLibrary();
      }
    } else {
      ViewRouter.showLanding();
    }

    this.updateUI();
    this.bindEvents();
    if (typeof LandingPage !== "undefined") {
      LandingPage.init();
    }
    if (typeof LibraryManager !== "undefined") {
      LibraryManager.init();
    }
    this.initGoogleSignIn();
  },

  saveSession(user, token) {
    this.currentUser = user;
    localStorage.setItem("studyvault_token", token);
    localStorage.setItem("studyvault_user", JSON.stringify(user));
    this.updateUI();
  },

  clearSession() {
    this.currentUser = null;
    localStorage.removeItem("studyvault_token");
    localStorage.removeItem("studyvault_user");
    localStorage.removeItem("studyvault_active_notebook");
    this.updateUI();
    ViewRouter.showLanding();
  },

  updateUI() {
    const loginBtn  = document.getElementById("openAuthModalBtn");
    const userMenu  = document.getElementById("userMenu");
    const libUserMenu = document.getElementById("libUserMenu");

    if (this.currentUser) {
      if (loginBtn) loginBtn.style.display = "none";
      if (userMenu) userMenu.style.display = "block";
      if (libUserMenu) libUserMenu.style.display = "block";

      const name = this.currentUser.name || "Student";
      const email = this.currentUser.email || "";
      const role = this.currentUser.role === "admin" ? "Admin" : "Student";

      const wsNameLabel = document.getElementById("userNameLabel");
      const wsEmailEl = document.getElementById("dropdownUserEmail");
      const wsRoleEl = document.getElementById("dropdownUserRole");
      const wsAdminBtn = document.getElementById("adminPanelBtn");
      const wsAvatarEl = document.getElementById("userAvatarCircle");

      const libNameLabel = document.getElementById("libUserNameLabel");
      const libEmailEl = document.getElementById("libDropdownUserEmail");
      const libRoleEl = document.getElementById("libDropdownUserRole");
      const libAdminBtn = document.getElementById("libAdminPanelBtn");
      const libAvatarEl = document.getElementById("libUserAvatarCircle");

      if (wsNameLabel) wsNameLabel.textContent = name;
      if (wsEmailEl) wsEmailEl.textContent = email;
      if (wsRoleEl) wsRoleEl.textContent = role;
      if (wsAdminBtn) wsAdminBtn.style.display = this.currentUser.role === "admin" ? "flex" : "none";

      if (libNameLabel) libNameLabel.textContent = name;
      if (libEmailEl) libEmailEl.textContent = email;
      if (libRoleEl) libRoleEl.textContent = role;
      if (libAdminBtn) libAdminBtn.style.display = this.currentUser.role === "admin" ? "flex" : "none";

      const setAvatar = (el) => {
        if (!el) return;
        if (this.currentUser.avatar && this.currentUser.avatar.startsWith("http")) {
          el.innerHTML = `<img src="${this.currentUser.avatar}" alt="avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.parentElement.textContent='${name[0].toUpperCase()}'">`;
        } else if (this.currentUser.avatar && this.currentUser.avatar.length <= 3) {
          el.textContent = this.currentUser.avatar;
        } else {
          el.textContent = name[0].toUpperCase();
        }
      };

      setAvatar(wsAvatarEl);
      setAvatar(libAvatarEl);
    } else {
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (userMenu) userMenu.style.display = "none";
      if (libUserMenu) libUserMenu.style.display = "none";
    }
  },

  bindEvents() {
    // Open auth modal or show landing
    const openAuthModalBtn = document.getElementById("openAuthModalBtn");
    if (openAuthModalBtn) {
      openAuthModalBtn.addEventListener("click", () => {
        if (typeof LandingPage !== "undefined") {
          LandingPage.show();
        } else {
          const authModal = document.getElementById("authModal");
          if (authModal) authModal.classList.add("show");
        }
      });
    }

    const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");
    if (closeAuthModalBtn) {
      closeAuthModalBtn.addEventListener("click", () => {
        const authModal = document.getElementById("authModal");
        if (authModal) authModal.classList.remove("show");
      });
    }

    // Auth tab switching
    document.querySelectorAll(".auth-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.authTab === "login" ? "loginForm" : "registerForm";
        const targetEl = document.getElementById(target);
        if (targetEl) targetEl.classList.add("active");
      });
    });

    // Login form in modal
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("loginSubmitBtn");
        const errEl = document.getElementById("loginError");
        if (btn) { btn.textContent = "Signing in..."; btn.disabled = true; }
        if (errEl) errEl.style.display = "none";
        try {
          const { token, user } = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: document.getElementById("loginEmail").value,
              password: document.getElementById("loginPassword").value
            })
          }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
          this.saveSession(user, token);
          const authModal = document.getElementById("authModal");
          if (authModal) authModal.classList.remove("show");
          if (typeof LandingPage !== "undefined") {
            LandingPage.hide(() => { loadNotebooks(); showToast(`Welcome back, ${user.name}! 🎉`); });
          } else {
            showToast(`Welcome back, ${user.name}! 🎉`);
            loadNotebooks();
          }
        } catch (err) {
          if (errEl) { errEl.textContent = err.message; errEl.style.display = "block"; }
        } finally {
          if (btn) { btn.textContent = "Sign In to StudyVault"; btn.disabled = false; }
        }
      });
    }

    // Register form in modal
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("registerSubmitBtn");
        const errEl = document.getElementById("registerError");
        if (btn) { btn.textContent = "Creating account..."; btn.disabled = true; }
        if (errEl) errEl.style.display = "none";
        try {
          const { token, user } = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: document.getElementById("registerName").value,
              email: document.getElementById("registerEmail").value,
              password: document.getElementById("registerPassword").value
            })
          }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
          this.saveSession(user, token);
          const authModal = document.getElementById("authModal");
          if (authModal) authModal.classList.remove("show");
          if (typeof LandingPage !== "undefined") {
            LandingPage.hide(() => { loadNotebooks(); showToast(`Account created! Welcome, ${user.name}! 🎉`); });
          } else {
            showToast(`Account created! Welcome, ${user.name}! 🎉`);
            loadNotebooks();
          }
        } catch (err) {
          if (errEl) { errEl.textContent = err.message; errEl.style.display = "block"; }
        } finally {
          if (btn) { btn.textContent = "Create Account"; btn.disabled = false; }
        }
      });
    }

    // Google fallback button
    const googleFallback = document.getElementById("googleSignInFallback");
    if (googleFallback) {
      googleFallback.addEventListener("click", () => {
        const modal = document.getElementById("googleClientModal");
        if (modal) {
          modal.classList.add("show");
          const input = document.getElementById("quickGoogleClientIdInput");
          if (input) {
            input.value = localStorage.getItem("studyvault_google_client_id") || window.GOOGLE_CLIENT_ID || "";
            input.focus();
          }
        } else {
          showToast("Configure your Google Client ID in Settings ⚙️");
        }
      });
    }

    // User avatar dropdown toggle
    const userAvatarBtn = document.getElementById("userAvatarBtn");
    if (userAvatarBtn) {
      userAvatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dd = document.getElementById("userDropdown");
        if (dd) dd.classList.toggle("show");
      });
    }
    document.addEventListener("click", () => {
      const dd = document.getElementById("userDropdown");
      if (dd) dd.classList.remove("show");
    });

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        this.clearSession();
        showToast("Logged out. See you soon! 👋");
      });
    }

    // Admin Panel button
    const adminPanelBtn = document.getElementById("adminPanelBtn");
    if (adminPanelBtn) {
      adminPanelBtn.addEventListener("click", () => {
        const dd = document.getElementById("userDropdown");
        if (dd) dd.classList.remove("show");
        window.location.href = "/admin";
      });
    }

    // Settings from dropdown
    const openSettingsBtnUser = document.getElementById("openSettingsBtnUser");
    if (openSettingsBtnUser) {
      openSettingsBtnUser.addEventListener("click", () => {
        const dd = document.getElementById("userDropdown");
        if (dd) dd.classList.remove("show");
        const sm = document.getElementById("settingsModal");
        if (sm) sm.classList.add("show");
      });
    }

    // Close admin modal
    const closeAdminModalBtn = document.getElementById("closeAdminModalBtn");
    if (closeAdminModalBtn) {
      closeAdminModalBtn.addEventListener("click", () => {
        const am = document.getElementById("adminModal");
        if (am) am.classList.remove("show");
      });
    }
  },

  async initGoogleSignIn() {
    if (!window.GOOGLE_CLIENT_ID) {
      try {
        const cfgRes = await fetch("/api/auth/config");
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (cfg.googleClientId && !cfg.googleClientId.includes("your_google") && !cfg.googleClientId.includes("...")) {
            window.GOOGLE_CLIENT_ID = cfg.googleClientId;
          }
        }
      } catch (e) {}
    }

    const stored = localStorage.getItem("studyvault_google_client_id") || "";
    const googleClientId = stored || (window.GOOGLE_CLIENT_ID && !window.GOOGLE_CLIENT_ID.includes("your_google") ? window.GOOGLE_CLIENT_ID : "");
    if (!googleClientId) return;

    const checkGoogle = (attempts = 0) => {
      if (typeof window !== "undefined" && window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response) => {
              try {
                const { token, user } = await fetch("/api/auth/google", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ credential: response.credential })
                }).then(async (r) => {
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  return d;
                });
                this.saveSession(user, token);
                const authModal = document.getElementById("authModal");
                if (authModal) authModal.classList.remove("show");
                if (typeof LandingPage !== "undefined") {
                  LandingPage.hide(() => {
                    loadNotebooks();
                    showToast(`Welcome, ${user.name}! 🎉`);
                  });
                } else {
                  showToast(`Welcome, ${user.name}! 🎉`);
                  loadNotebooks();
                }
              } catch (err) {
                showToast(err.message);
              }
            }
          });

          const landingGoogleBtn = document.getElementById("landingGoogleBtn");
          const latGoogleFallback = document.getElementById("latGoogleFallback");
          if (landingGoogleBtn) {
            landingGoogleBtn.innerHTML = "";
            window.google.accounts.id.renderButton(landingGoogleBtn, {
              theme: "outline",
              size: "large",
              width: 340
            });
            if (latGoogleFallback) latGoogleFallback.style.display = "none";
          }

          const googleSignInBtn = document.getElementById("googleSignInBtn");
          const googleSignInFallback = document.getElementById("googleSignInFallback");
          if (googleSignInBtn) {
            googleSignInBtn.innerHTML = "";
            window.google.accounts.id.renderButton(googleSignInBtn, {
              theme: "outline",
              size: "large",
              width: 340
            });
            if (googleSignInFallback) googleSignInFallback.style.display = "none";
          }
        } catch (e) {
          console.warn("[auth] Google GSI initialization notice:", e);
        }
      } else if (attempts < 10) {
        setTimeout(() => checkGoogle(attempts + 1), 300);
      }
    };

    checkGoogle();
  }
};

// ══════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════════════════════════
const AdminPanel = {
  allUsers: [],

  async open() {
    document.getElementById("adminModal").classList.add("show");
    await this.loadStats();
    await this.loadUsers();
  },

  async loadStats() {
    try {
      const data = await api("/admin/stats");
      document.getElementById("statUsers").textContent      = data.userCount ?? "—";
      document.getElementById("statNotebooks").textContent  = data.notebookCount ?? "—";
      document.getElementById("statDocuments").textContent  = data.documentCount ?? "—";
      const qEl = document.getElementById("statQueries") || document.getElementById("statStorage");
      if (qEl) qEl.textContent = data.messageCount ?? "0";
    } catch(e) { showToast("Failed to load admin stats."); }
  },

  async loadUsers() {
    const tbody = document.getElementById("adminUsersBody");
    tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">Loading...</td></tr>`;
    try {
      const data = await api("/admin/users");
      this.allUsers = data.users || [];
      this.renderUsers(this.allUsers);
    } catch(e) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">Failed to load users.</td></tr>`;
    }
  },

  renderUsers(users) {
    const tbody = document.getElementById("adminUsersBody");
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">No users found.</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => {
      const initials = (u.name || "U")[0].toUpperCase();
      const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—";
      const isCurrentAdmin = AuthManager.currentUser && u._id === AuthManager.currentUser.id;
      return `
        <tr>
          <td>
            <div class="admin-user-cell">
              <div class="admin-user-avatar">${initials}</div>
              <div class="admin-user-name">${escapeHtml(u.name || "—")}${ isCurrentAdmin ? ' <span style="font-size:0.7rem;color:var(--primary-cyan)">(You)</span>' : "" }</div>
            </div>
          </td>
          <td style="color:var(--text-sub);font-size:0.8rem">${escapeHtml(u.email)}</td>
          <td><span class="role-badge ${u.role}">${u.role === "admin" ? "Admin" : "User"}</span></td>
          <td style="color:var(--text-muted);font-size:0.8rem">${joined}</td>
          <td>
            <div class="admin-action-btns">
              ${!isCurrentAdmin ? `
                <button class="btn-admin-action" onclick="AdminPanel.toggleRole('${u._id}','${u.role}')">
                  ${u.role === "admin" ? "Demote" : "Promote"}
                </button>
                <button class="btn-admin-action danger" onclick="AdminPanel.deleteUser('${u._id}','${escapeHtml(u.name)}')">
                  Delete
                </button>` : `<span style="font-size:0.75rem;color:var(--text-muted)">—</span>`
              }
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  async toggleRole(userId, currentRole) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      await api(`/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole })
      });
      showToast(`User role updated to ${newRole}. ✅`);
      await this.loadUsers();
    } catch(e) { showToast(e.message); }
  },

  async deleteUser(userId, name) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api(`/admin/users/${userId}`, { method: "DELETE" });
      showToast(`User "${name}" deleted.`);
      await this.loadUsers();
      await this.loadStats();
    } catch(e) { showToast(e.message); }
  }
};

// Admin user search
document.getElementById("adminUserSearch").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = AdminPanel.allUsers.filter(u =>
    (u.name || "").toLowerCase().includes(q) ||
    (u.email || "").toLowerCase().includes(q)
  );
  AdminPanel.renderUsers(filtered);
});

// Close modals on overlay click
document.getElementById("authModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("authModal")) {
    document.getElementById("authModal").classList.remove("show");
  }
});
document.getElementById("adminModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("adminModal")) {
    document.getElementById("adminModal").classList.remove("show");
  }
});

// ══════════════════════════════════════════════════════════════════
// LANDING PAGE CONTROLLER
// ══════════════════════════════════════════════════════════════════
const LandingPage = {

  init() {
    this.initParticles();
    this.bindTabs();
    this.bindForms();
    this.bindPasswordToggle();
    this.bindGoogleBtn();
  },

  show() {
    const lp  = document.getElementById("landingPage");
    const app = document.getElementById("app");
    app.style.display = "none";
    lp.style.display  = "flex";
    lp.classList.remove("fade-out");
    this.initParticles();
  },

  hide(callback) {
    const lp = document.getElementById("landingPage");
    if (lp) lp.classList.add("fade-out");
    setTimeout(() => {
      if (typeof ViewRouter !== "undefined") {
        ViewRouter.showLibrary();
      } else {
        if (lp) lp.style.display = "none";
        const app = document.getElementById("app");
        if (app) app.style.display = "flex";
      }
      if (callback) callback();
    }, 400);
  },

  // ── Particle Canvas ─────────────────────────────────────────
  initParticles() {
    const canvas = document.getElementById("landingCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, particles, raf;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    const COLORS = ["#8ab4f8","#c58af9","#78d9ec","#ffffff"];
    particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > W) p.dx *= -1;
        if (p.y < 0 || p.y > H) p.dy *= -1;
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = raf;
    draw();
  },

  // ── Tab switching ───────────────────────────────────────────
  bindTabs() {
    const switchTab = (tabName) => {
      document.querySelectorAll(".lat").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".lat-form").forEach(f => f.classList.remove("active"));
      const tabBtn = document.querySelector(`.lat[data-lat="${tabName}"]`);
      if (tabBtn) tabBtn.classList.add("active");
      const target = tabName === "signin" ? "latSigninForm" : "latSignupForm";
      const targetEl = document.getElementById(target);
      if (targetEl) targetEl.classList.add("active");
    };

    document.querySelectorAll(".lat").forEach(btn => {
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.lat);
      });
    });

    const toSignup = document.getElementById("toSignupLink");
    if (toSignup) toSignup.addEventListener("click", () => switchTab("signup"));

    const toSignin = document.getElementById("toSigninLink");
    if (toSignin) toSignin.addEventListener("click", () => switchTab("signin"));
  },

  // ── Form handlers ───────────────────────────────────────────
  bindForms() {
    // 1-Click Demo Login
    const demoBtn = document.getElementById("latDemoBtn");
    if (demoBtn) {
      demoBtn.addEventListener("click", async () => {
        const emailEl = document.getElementById("latEmail");
        const passEl  = document.getElementById("latPassword");
        if (emailEl) emailEl.value = "admin@studyassistant.com";
        if (passEl)  passEl.value  = "AdminPass123!";

        const btn = document.getElementById("latSigninBtn");
        const err = document.getElementById("latSigninError");
        if (btn) {
          btn.disabled = true;
          const span = btn.querySelector("span");
          if (span) span.textContent = "Logging in demo…";
        }
        if (err) err.style.display = "none";
        try {
          const { token, user } = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@studyassistant.com", password: "AdminPass123!" })
          }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });

          AuthManager.saveSession(user, token);
          this.hide(() => { loadNotebooks(); showToast(`Welcome back, ${user.name}! 🎉`); });
        } catch (ex) {
          if (err) { err.textContent = ex.message; err.style.display = "block"; }
        } finally {
          if (btn) {
            btn.disabled = false;
            const span = btn.querySelector("span");
            if (span) span.textContent = "Sign In";
          }
        }
      });
    }

    // Guest Access
    const guestBtn = document.getElementById("latGuestBtn");
    if (guestBtn) {
      guestBtn.addEventListener("click", async () => {
        guestBtn.disabled = true;
        const span = guestBtn.querySelector("span");
        if (span) span.textContent = "Entering as Guest…";
        try {
          const { token, user } = await fetch("/api/auth/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });

          AuthManager.saveSession(user, token);
          this.hide(() => { loadNotebooks(); showToast(`Welcome, Guest! 🎓`); });
        } catch (ex) {
          showToast(ex.message || "Failed to start guest session");
        } finally {
          guestBtn.disabled = false;
          if (span) span.textContent = "👤 Explore as Guest (No sign up needed)";
        }
      });
    }

    // Sign In
    document.getElementById("latSigninForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("latSigninBtn");
      const err = document.getElementById("latSigninError");
      btn.disabled = true;
      btn.querySelector("span").textContent = "Signing in…";
      err.style.display = "none";
      try {
        const { token, user } = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:    document.getElementById("latEmail").value,
            password: document.getElementById("latPassword").value
          })
        }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });

        AuthManager.saveSession(user, token);
        this.hide(() => { loadNotebooks(); showToast(`Welcome back, ${user.name}! 🎉`); });
      } catch (ex) {
        err.textContent = ex.message; err.style.display = "block";
      } finally {
        btn.disabled = false;
        btn.querySelector("span").textContent = "Sign In";
      }
    });

    // Sign Up
    document.getElementById("latSignupForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("latSignupBtn");
      const err = document.getElementById("latSignupError");
      btn.disabled = true;
      btn.querySelector("span").textContent = "Creating account…";
      err.style.display = "none";
      try {
        const { token, user } = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:     document.getElementById("latName").value,
            email:    document.getElementById("latRegEmail").value,
            password: document.getElementById("latRegPassword").value
          })
        }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });

        AuthManager.saveSession(user, token);
        this.hide(() => { loadNotebooks(); showToast(`Welcome to StudyVault, ${user.name}! 🎉`); });
      } catch (ex) {
        err.textContent = ex.message; err.style.display = "block";
      } finally {
        btn.disabled = false;
        btn.querySelector("span").textContent = "Create Free Account";
      }
    });
  },

  bindPasswordToggle() {
    const toggle = document.getElementById("latPwToggle");
    const input  = document.getElementById("latPassword");
    if (!toggle || !input) return;
    toggle.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      toggle.textContent = input.type === "password" ? "👁" : "🙈";
    });
  },

  bindGoogleBtn() {
    const btn = document.getElementById("latGoogleFallback");
    if (btn) btn.addEventListener("click", () => {
      const modal = document.getElementById("googleClientModal");
      if (modal) {
        modal.classList.add("show");
        const input = document.getElementById("quickGoogleClientIdInput");
        if (input) {
          input.value = localStorage.getItem("studyvault_google_client_id") || window.GOOGLE_CLIENT_ID || "";
          input.focus();
        }
      } else {
        showToast("Add GOOGLE_CLIENT_ID in Settings (⚙️) to enable Google Sign-In 🔑");
      }
    });
  }
};

// Init everything
AuthManager.init();



// Setup 4 clickable starter prompts under the chat box
function setupChatStarterChips() {
  const chipsContainer = document.getElementById("chatStarterChips");
  if (!chipsContainer) return;
  const chips = chipsContainer.querySelectorAll(".chat-starter-chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.prompt;
      if (!prompt) return;
      chatInput.value = prompt;
      chatInput.focus();
      // Auto-resize or scroll if needed
      chatInput.dispatchEvent(new Event("input", { bubbles: true }));
      showToast(`Filled: "${prompt}"`);
    });
  });
}
setupChatStarterChips();

  const btnViewAllSources = document.getElementById("btnViewAllSources");
  if (btnViewAllSources) {
    btnViewAllSources.addEventListener("click", () => {
      if (state.documents && state.documents.length > 0) {
        openPdfModal(state.documents[0]._id, 1, "split");
      } else {
        showToast("No sources uploaded yet. Add a PDF or presentation first.");
      }
    });
  }

  const btnChatViewSources = document.getElementById("btnChatViewSources");
  if (btnChatViewSources) {
    btnChatViewSources.addEventListener("click", () => {
      if (state.documents && state.documents.length > 0) {
        openPdfModal(state.documents[0]._id, 1, "split");
      } else {
        showToast("No sources uploaded yet. Add a PDF or presentation first.");
      }
    });
  }

// Ensure complete applet initialization
initApp();
