const API = "/api";

const state = {
  notebooks: [],
  currentId: null,
  documents: [],
  messages: [],
  notes: [],
  activeMode: "chat",
  geminiApiKey: localStorage.getItem("notebooklm_gemini_key") || "",
  geminiModel: localStorage.getItem("notebooklm_gemini_model") || "gemini-1.5-flash",
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
  visuals: [],
  activeVisual: null,
  videoProject: null,
  activePdfDoc: null,
  currentPdfPage: 1,
  pollTimer: null,
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
const chipModes = document.querySelectorAll(".chip-mode");
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

// PDF Modal Elements
const pdfModal = document.getElementById("pdfModal");
const pdfModalTitle = document.getElementById("pdfModalTitle");
const pdfPageIndicator = document.getElementById("pdfPageIndicator");
const pdfPageJumpInput = document.getElementById("pdfPageJumpInput");
const btnPdfPrev = document.getElementById("btnPdfPrev");
const btnPdfNext = document.getElementById("btnPdfNext");
const closePdfModalBtn = document.getElementById("closePdfModalBtn");
const pdfCanvas = document.getElementById("pdfCanvas");
const pdfTextFallback = document.getElementById("pdfTextFallback");

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
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
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

function parseMarkdownToHtml(markdownText) {
  if (!markdownText) return "";
  let html = escapeHtml(markdownText);

  html = html.replace(/\[([a-zA-Z0-9_\-\.\s]+?)(?:,\s*p\.(\d+))?\]/gi, (match, fname, pNum) => {
    const pageStr = pNum ? `p.${pNum}` : "p.1";
    return `<span class="citation-chip" data-doc="${escapeHtml(fname.trim())}" data-page="${pNum || 1}">📄 [${escapeHtml(fname.trim())}, ${pageStr}]</span>`;
  });

  html = html.replace(/⚠️ \*\*Topic Mismatch Detected\*\*(.*?)(?=\n\n|\#)/s, (match, body) => {
    return `<div style="background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); border-radius:8px; padding:0.75rem; margin-bottom:0.75rem; color:var(--warning); font-size:0.85rem;">⚠️ <strong>Topic Mismatch Detected</strong>${body}</div>`;
  });

  html = html.replace(/^### (.*$)/gim, '<h4 style="font-size:0.95rem; font-weight:700; color:var(--primary-blue); margin:1rem 0 0.4rem 0;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="font-size:1.05rem; font-weight:700; color:var(--primary-purple); margin:1.2rem 0 0.5rem 0;">$1</h3>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^&gt;\s*"(.*?)"/gim, '<blockquote class="quote-card">“$1”</blockquote>');
  html = html.replace(/^&gt;\s*(.*?)$/gim, '<blockquote class="quote-card">$1</blockquote>');
  html = html.replace(/^- (.*$)/gim, '<li style="margin-left:1.2rem; margin-bottom:0.35rem;">$1</li>');
  html = html.replace(/^([0-9]+\.) (.*$)/gim, '<li style="margin-left:1.2rem; margin-bottom:0.35rem;">$2</li>');

  return html;
}

// --- Init & Settings ---
async function initApp() {
  setupEventListeners();
  setupDropdowns();
  setupSettingsModal();
  setupDropzones();
  setupCategorizedTabs();
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
  openSettingsBtn.addEventListener("click", () => {
    geminiApiKeyInput.value = state.geminiApiKey;
    geminiModelSelect.value = state.geminiModel;
    settingsModal.classList.add("show");
  });

  closeSettingsModalBtn.addEventListener("click", () => settingsModal.classList.remove("show"));

  saveSettingsBtn.addEventListener("click", () => {
    state.geminiApiKey = geminiApiKeyInput.value.trim();
    state.geminiModel = geminiModelSelect.value;
    localStorage.setItem("notebooklm_gemini_key", state.geminiApiKey);
    localStorage.setItem("notebooklm_gemini_model", state.geminiModel);
    settingsModal.classList.remove("show");
    showToast(state.geminiApiKey ? "Gemini API key saved! Live cloud models active." : "API key cleared. Using offline model engine.");
  });
}

async function loadNotebooks() {
  state.notebooks = await api("/notebooks");
  renderNotebookList();
  if (!state.currentId && state.notebooks.length > 0) {
    selectNotebook(state.notebooks[0]._id);
  } else if (state.notebooks.length === 0) {
    showEmptyState();
  }
}

function renderNotebookList() {
  if (state.notebooks.length === 0) {
    notebookList.innerHTML = `
      <div style="padding: 1.25rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        <div style="font-size: 1.6rem; margin-bottom: 0.35rem;">📓</div>
        <p style="font-weight: 600; color: var(--text-sub); margin-bottom: 0.25rem;">No notebooks yet</p>
        <span style="font-size: 0.72rem;">Click "+ New Notebook" above to create your first study workspace.</span>
      </div>`;
    return;
  }
  notebookList.innerHTML = state.notebooks
    .map(
      (nb) => `
      <div class="notebook-item ${nb._id === state.currentId ? "active" : ""}" data-id="${nb._id}">
        <div style="display: flex; align-items: center; gap: 0.45rem;">
          <span style="font-size: 0.95rem;">📓</span>
          <div class="notebook-item-title" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(nb.title)}</div>
        </div>
        <div class="notebook-item-meta" style="margin-top: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
          <span>${new Date(nb.updatedAt || nb.createdAt).toLocaleDateString()}</span>
          ${nb._id === state.currentId ? `<span style="font-size: 0.65rem; color: var(--primary-purple); font-weight: 700; letter-spacing: 0.05em;">ACTIVE</span>` : ""}
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

  document.getElementById("renameBtn").style.display = "inline-block";
  document.getElementById("deleteNotebookBtn").style.display = "inline-block";

  const { notebook, documents } = await api(`/notebooks/${id}`);
  state.documents = documents;
  notebookTitle.textContent = notebook.title;

  renderSources();
  await loadMessages();
  await loadNotes();
  await loadCachedArtifacts();
  maybePollDocs();
}

function showEmptyState() {
  notebookTitle.textContent = "Select or create a notebook";
  sourcesRailInner.innerHTML = `
    <div style="padding: 1.25rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
      <div style="font-size: 1.4rem; margin-bottom: 0.35rem;">📄</div>
      <p style="font-weight: 600; color: var(--text-sub); margin-bottom: 0.2rem;">No sources attached</p>
      <span>Create a notebook to begin.</span>
    </div>`;
  document.getElementById("renameBtn").style.display = "none";
  document.getElementById("deleteNotebookBtn").style.display = "none";
  renderChat();
}

// --- Sources ---
function renderSources() {
  sourceCount.textContent = state.documents.length;
  const chatSourceBadge = document.getElementById("chatSourceBadge");
  if (chatSourceBadge) {
    chatSourceBadge.textContent = state.documents.length > 0
      ? `🛡️ Citing ${state.documents.length} Source${state.documents.length > 1 ? "s" : ""}`
      : "🛡️ 0 Sources (Add docs to start)";
  }

  if (state.documents.length === 0) {
    sourcesRailInner.innerHTML = `
      <div style="padding: 1.25rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
        <div style="font-size: 1.4rem; margin-bottom: 0.35rem;">📄</div>
        <p style="font-weight: 600; color: var(--text-sub); margin-bottom: 0.2rem;">No sources attached</p>
        <span>Drop a PDF or paste notes to begin grounded learning.</span>
      </div>`;
    return;
  }

  sourcesRailInner.innerHTML = state.documents
    .map(
      (doc) => `
      <div class="source-card" data-docid="${doc._id}" title="Click to open in Document Viewer">
        <div class="source-info">
          <div class="source-name" style="display: flex; align-items: center; gap: 0.35rem;">
            <span>📄</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(doc.filename)}</span>
          </div>
          <div class="source-meta" style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${doc.status === 'processing' ? 'var(--warning)' : 'var(--success)'};"></span>
            <span>${doc.status === 'processing' ? '⚡ Processing...' : (doc.pageCount ? doc.pageCount + ' pages' : 'Ready')}</span>
          </div>
        </div>
        <button class="source-card-remove" data-remove="${doc._id}" title="Remove source">✕</button>
      </div>`
    )
    .join("");

  sourcesRailInner.querySelectorAll(".source-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.dataset.remove) return;
      openPdfModal(card.dataset.docid, 1);
    });
  });

  sourcesRailInner.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const docId = btn.dataset.remove;
      try {
        await api(`/notebooks/${state.currentId}/documents/${docId}`, { method: "DELETE" });
        state.documents = state.documents.filter((d) => d._id !== docId);
        renderSources();
        renderChat();
      } catch (err) {
        showToast(err.message);
      }
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

// --- PDF VIEWER ---
async function openPdfModal(docIdOrName, pageNum = 1) {
  const doc = state.documents.find((d) => d._id === docIdOrName || d.filename.toLowerCase().includes(docIdOrName.toLowerCase()));
  if (!doc) return showToast(`Document "${docIdOrName}" not found.`);

  state.activePdfDoc = doc;
  state.currentPdfPage = parseInt(pageNum, 10) || 1;

  pdfModalTitle.textContent = doc.filename;
  pdfPageIndicator.textContent = `Page ${state.currentPdfPage} of ${doc.pageCount || 1}`;
  pdfPageJumpInput.value = state.currentPdfPage;
  pdfPageJumpInput.max = doc.pageCount || 1;

  pdfModal.classList.add("show");
  renderPdfPage();
}

function renderPdfPage() {
  if (!state.activePdfDoc) return;
  const doc = state.activePdfDoc;
  const pNum = state.currentPdfPage;

  pdfPageIndicator.textContent = `Page ${pNum} of ${doc.pageCount || 1}`;

  if (doc.pages && doc.pages[pNum - 1]) {
    pdfCanvas.style.display = "none";
    pdfTextFallback.style.display = "block";
    pdfTextFallback.innerHTML = `<h3>--- Page ${pNum} ---</h3>\n\n` + escapeHtml(doc.pages[pNum - 1].text);
  } else {
    pdfCanvas.style.display = "none";
    pdfTextFallback.style.display = "block";
    pdfTextFallback.innerHTML = `<h3>--- Document Preview (Page ${pNum}) ---</h3>\n\n` + escapeHtml(doc.extractedText || doc.summary || "Content extracted.");
  }
}

btnPdfPrev.addEventListener("click", () => {
  if (state.currentPdfPage > 1) { state.currentPdfPage--; renderPdfPage(); }
});

btnPdfNext.addEventListener("click", () => {
  if (state.activePdfDoc && state.currentPdfPage < (state.activePdfDoc.pageCount || 1)) {
    state.currentPdfPage++; renderPdfPage();
  }
});

pdfPageJumpInput.addEventListener("change", (e) => {
  const val = parseInt(e.target.value, 10);
  if (val >= 1 && state.activePdfDoc && val <= (state.activePdfDoc.pageCount || 1)) {
    state.currentPdfPage = val; renderPdfPage();
  }
});

closePdfModalBtn.addEventListener("click", () => pdfModal.classList.remove("show"));

// --- CHAT ---
async function loadMessages() {
  state.messages = await api(`/notebooks/${state.currentId}/chat`);
  renderChat();
}

function renderChat() {
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
          <button class="btn-msg-action" data-pin="${escapeHtml(m.content.slice(0, 120))}">📌 Pin Note</button>
          <button class="btn-msg-action" data-copy="${escapeHtml(m.content)}">📋 Copy</button>
          <button class="btn-msg-action" data-speak="${escapeHtml(m.content)}">🔊 Listen</button>
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

function renderSuggestedQuestions() {
  const centerDropzone = document.getElementById("centerDropzone");
  const suggestedSection = document.getElementById("suggestedQuestionsSection");
  const suggestedGrid = document.getElementById("suggestedGrid");
  const chatSourceBadge = document.getElementById("chatSourceBadge");

  const hasDocs = state.documents && state.documents.length > 0;

  if (chatSourceBadge) {
    chatSourceBadge.textContent = hasDocs
      ? `🛡️ Citing ${state.documents.length} Source${state.documents.length > 1 ? "s" : ""}`
      : "🛡️ 0 Sources (Add docs to start)";
  }

  if (!hasDocs) {
    if (centerDropzone) centerDropzone.style.display = "block";
    if (suggestedSection) suggestedSection.style.display = "none";
    return;
  }

  // Documents exist! Show suggested questions grid
  if (centerDropzone) centerDropzone.style.display = "none";
  if (suggestedSection) suggestedSection.style.display = "block";

  // Gather questions from documents or smart academic defaults
  let questions = [];
  state.documents.forEach((doc) => {
    if (doc.suggestedQuestions && Array.isArray(doc.suggestedQuestions)) {
      questions.push(...doc.suggestedQuestions);
    }
  });

  if (questions.length === 0) {
    const docTitle = state.documents[0]?.filename ? state.documents[0].filename.replace(/\.[^/.]+$/, "") : "uploaded material";
    questions = [
      `Summarize the key concepts and architecture of ${docTitle}`,
      `Explain the primary mechanisms in simple terms with examples`,
      `Generate a 5-mark structured exam answer with page citations`,
      `What are the most important definitions, formulas, or protocols?`
    ];
  } else {
    questions = [...new Set(questions)].slice(0, 4);
  }

  const icons = ["💡", "📖", "✍️", "🔍"];
  if (suggestedGrid) {
    suggestedGrid.innerHTML = questions
      .map((q, idx) => `
        <button type="button" class="suggested-chip" data-prompt="${escapeHtml(q)}">
          <span class="suggested-chip-icon">${icons[idx % icons.length]}</span>
          <span class="suggested-chip-text">${escapeHtml(q)}</span>
        </button>
      `)
      .join("");

    suggestedGrid.querySelectorAll(".suggested-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const prompt = chip.dataset.prompt;
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
  state.messages.push({ role: "assistant", content: `Analyzing sources in [${state.activeMode.toUpperCase()}] mode...` });
  renderChat();

  try {
    const { userMessage, assistantMessage } = await api(`/notebooks/${state.currentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ question, mode: state.activeMode }),
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

chipModes.forEach((chip) => {
  chip.addEventListener("click", () => {
    chipModes.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.activeMode = chip.dataset.mode;
    
    // Update exam mode banner
    const examModeBanner = document.getElementById("examModeBanner");
    const examBannerText = document.getElementById("examBannerText");
    const examDescriptions = {
      "chat": "",
      "explain": "📖 Explanatory Mode: Simplified conceptual breakdown with intuitive analogies.",
      "2-mark": "✍️ 2-Mark Exam Mode: Crisp 1-2 sentence core definition followed by 2-4 key points with citations.",
      "5-mark": "📝 5-Mark Exam Mode: Structured academic breakdown (Definition, Key Components, Working, Example, and Citations).",
      "10-mark": "🏆 10-Mark Exam Mode: Comprehensive university-level essay, architectural layout, mechanisms, and citations."
    };

    if (examModeBanner && examBannerText) {
      if (examDescriptions[state.activeMode]) {
        examModeBanner.style.display = "flex";
        examBannerText.textContent = examDescriptions[state.activeMode];
      } else {
        examModeBanner.style.display = "none";
      }
    }

    showToast(`Switched mode: ${chip.textContent}`);
  });
});

// --- AUDIO OVERVIEW ---
generateAudioBtn.addEventListener("click", async () => {
  if (!state.currentId) return;
  generateAudioBtn.disabled = true;
  generateAudioBtn.textContent = "✨ Generating Podcast Dialogue...";

  try {
    state.audioScript = await api(`/notebooks/${state.currentId}/studio/audio-overview`, { method: "POST" });
    renderAudioOverview();
  } catch (err) { showToast(err.message); }
  finally {
    generateAudioBtn.disabled = false;
    generateAudioBtn.textContent = "✨ Regenerate Audio Overview";
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
  if (!state.currentId) return;
  generateCardsBtn.disabled = true;
  try {
    const data = await api(`/notebooks/${state.currentId}/studio/flashcards`, { method: "POST" });
    state.flashcards = data.cards || [];
    state.cardIndex = 0;
    state.cardRatings = {};
    renderFlashcards();
  } catch (err) { showToast(err.message); }
  finally { generateCardsBtn.disabled = false; }
});

function renderFlashcards() {
  if (!state.flashcards || state.flashcards.length === 0) return;
  masteryBarWrapper.style.display = "block";
  updateMasteryProgress();

  const card = state.flashcards[state.cardIndex];
  const currentRating = state.cardRatings[card.id] || "unrated";

  flashcardsWrapper.innerHTML = `
    <div class="flashcard-container">
      <div class="flashcard" id="activeFlashcard">
        <div class="card-face card-front">
          <div class="card-label">Question (${state.cardIndex + 1}/${state.flashcards.length})</div>
          <div class="card-text">${escapeHtml(card.question)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:1rem">Click card to flip ↺</div>
        </div>
        <div class="card-face card-back">
          <div class="card-label">Answer [${escapeHtml(card.sourceRef || 'p.1')}]</div>
          <div class="card-text">${escapeHtml(card.answer)}</div>
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
  fc.addEventListener("click", () => fc.classList.toggle("flipped"));

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
  const csv = state.flashcards.map(c => `"${c.question.replace(/"/g, '""')}","${c.answer.replace(/"/g, '""')} [${c.sourceRef || 'p.1'}]"`).join("\n");
  downloadFile(`${notebookTitle.textContent}_AnkiDeck.csv`, csv, "text/csv");
  showToast("Exported Anki CSV Deck!");
});

// --- QUIZ & IMPORTANT QUESTIONS & COMPARE ---
generateQuizBtn.addEventListener("click", async () => {
  if (!state.currentId) return;
  generateQuizBtn.disabled = true;
  try {
    const data = await api(`/notebooks/${state.currentId}/studio/quiz`, { method: "POST" });
    state.quiz = data.questions || [];
    state.quizAnswers = {};
    renderQuiz();
  } catch (err) { showToast(err.message); }
  finally { generateQuizBtn.disabled = false; }
});

function renderQuiz() {
  if (!state.quiz || state.quiz.length === 0) return;
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
      const exp = selected !== undefined ? `<div class="quiz-explanation">💡 <strong>Explanation:</strong> ${escapeHtml(q.explanation)} [${escapeHtml(q.citation || 'p.1')}]</div>` : "";
      return `<div class="quiz-card"><div class="quiz-q-title">Q${qIdx + 1}. ${escapeHtml(q.question)}</div><div class="quiz-options">${optionsHtml}</div>${exp}</div>`;
    }).join("");

  quizWrapper.querySelectorAll(".quiz-opt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.quizAnswers[parseInt(btn.dataset.qidx)] = parseInt(btn.dataset.optidx);
      renderQuiz();
    });
  });
}

generateImportantBtn.addEventListener("click", async () => {
  if (!state.currentId) return;
  generateImportantBtn.disabled = true;
  try {
    state.importantQuestions = await api(`/notebooks/${state.currentId}/studio/important-questions`, { method: "POST" });
    renderImportantQuestions();
  } catch (err) { showToast(err.message); }
  finally { generateImportantBtn.disabled = false; }
});

function renderImportantQuestions() {
  if (!state.importantQuestions) return;
  const iq = state.importantQuestions;
  const renderGroup = (items, badgeCls, badgeText) => items.map((q) => `
    <div class="quiz-card" style="margin-bottom:0.75rem">
      <span class="${badgeCls}">${badgeText}</span>
      <div class="quiz-q-title">${escapeHtml(q.question)}</div>
      <div style="font-size:0.78rem; color:var(--text-sub); margin-top:0.2rem">💡 ${escapeHtml(q.reason)}</div>
      <div style="font-size:0.72rem; color:var(--primary-blue); margin-top:0.3rem">📄 Citation: ${escapeHtml(q.citation || 'p.1')}</div>
    </div>`).join("");

  importantWrapper.innerHTML = `
    ${renderGroup(iq.veryImportant || [], 'q-badge-very-important', '🔥 VERY IMPORTANT')}
    ${renderGroup(iq.important || [], 'q-badge-important', '⭐ IMPORTANT')}
    ${renderGroup(iq.possible || [], 'q-badge-possible', '📌 POSSIBLE')}
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
  visualCardTags.innerHTML = (visual.tags || ["Infographic", "Concept"]).map(t => `<span class="visual-tag-badge">${escapeHtml(t)}</span>`).join("");
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
  generateImageBtn.disabled = true;
  generateImageBtn.textContent = "⏳ Generating...";
  try {
    const prompt = imagePromptInput.value.trim();
    const style = imageStyleSelect.value;
    const aspectRatio = imageRatioSelect.value;
    const res = await api(`/notebooks/${state.currentId}/studio/images`, {
      method: "POST",
      body: JSON.stringify({ prompt, style, aspectRatio })
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
  scenesTimelineGrid.innerHTML = videoPlayerState.project.scenes.map((scene, idx) => `
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
    </div>
  `).join("");

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
  generateVideoBtn.disabled = true;
  generateVideoBtn.textContent = "⏳ Generating...";
  try {
    const style = videoStyleSelect.value;
    const project = await api(`/notebooks/${state.currentId}/studio/video`, {
      method: "POST",
      body: JSON.stringify({ style })
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
    state.audioScript = await api(`/notebooks/${state.currentId}/studio/audio-overview`);
    if (state.audioScript) renderAudioOverview(); else podcastPlayerCard.style.display = "none";
    state.briefing = await api(`/notebooks/${state.currentId}/studio/briefing`);
    if (state.briefing) renderBriefing();
    const fc = await api(`/notebooks/${state.currentId}/studio/flashcards`);
    if (fc) { state.flashcards = fc.cards; renderFlashcards(); }
    const q = await api(`/notebooks/${state.currentId}/studio/quiz`);
    if (q) { state.quiz = q.questions; renderQuiz(); }

    const imgs = await api(`/notebooks/${state.currentId}/studio/images`);
    state.visuals = Array.isArray(imgs) ? imgs : [];
    if (state.visuals.length > 0) {
      renderVisual(state.visuals[0]);
      renderVisualGallery();
    } else {
      visualEmptyState.style.display = "block";
      activeVisualCard.style.display = "none";
      visualGallerySection.style.display = "none";
    }

    const vid = await api(`/notebooks/${state.currentId}/studio/video`);
    if (vid) {
      renderVideoProject(vid);
    } else {
      videoEmptyState.style.display = "block";
      videoActiveStage.style.display = "none";
    }
  } catch (err) { console.error("Error loading cached artifacts:", err); }
}

// --- EVENT LISTENERS & DROPDOWNS ---
function setupEventListeners() {
  document.getElementById("newNotebookBtn").addEventListener("click", async () => {
    const title = prompt("Name your research notebook:", "New Research Project");
    if (!title) return;
    try {
      const nb = await api("/notebooks", { method: "POST", body: JSON.stringify({ title }) });
      state.notebooks.unshift(nb); renderNotebookList(); selectNotebook(nb._id);
    } catch (err) { showToast(err.message); }
  });

  document.getElementById("renameBtn").addEventListener("click", async () => {
    const nb = state.notebooks.find((n) => n._id === state.currentId);
    if (!nb) return;
    const title = prompt("Rename notebook:", nb.title);
    if (!title) return;
    try {
      await api(`/notebooks/${nb._id}`, { method: "PUT", body: JSON.stringify({ title }) });
      nb.title = title; notebookTitle.textContent = title; renderNotebookList();
    } catch (err) { showToast(err.message); }
  });

  document.getElementById("deleteNotebookBtn").addEventListener("click", async () => {
    if (!state.currentId || !confirm("Delete notebook?")) return;
    try {
      await api(`/notebooks/${state.currentId}`, { method: "DELETE" });
      state.notebooks = state.notebooks.filter((n) => n._id !== state.currentId);
      state.currentId = null; renderNotebookList();
      if (state.notebooks.length > 0) selectNotebook(state.notebooks[0]._id); else showEmptyState();
    } catch (err) { showToast(err.message); }
  });

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
  addSourceMenuBtn.addEventListener("click", (e) => { e.stopPropagation(); addSourceDropdown.classList.toggle("show"); });
  document.addEventListener("click", () => addSourceDropdown.classList.remove("show"));
  document.getElementById("optUploadPdf").addEventListener("click", () => fileInput.click());
  document.getElementById("optPasteText").addEventListener("click", () => pasteTextModal.classList.add("show"));
  document.getElementById("optAddUrl").addEventListener("click", () => urlModal.classList.add("show"));
  document.getElementById("optSampleData").addEventListener("click", () => sampleModal.classList.add("show"));

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

  // Category and tool tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add("active");
    });
  });
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
  const sidebarDropzone = document.getElementById("sidebarDropzone");
  const centerDropzone = document.getElementById("centerDropzone");
  const btnCenterUpload = document.getElementById("btnCenterUpload");
  const btnCenterSample = document.getElementById("btnCenterSample");
  const btnCenterPaste = document.getElementById("btnCenterPaste");

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

  if (centerDropzone) {
    centerDropzone.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      fileInput.click();
    });
    ["dragenter", "dragover"].forEach((evt) => {
      centerDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        centerDropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      centerDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        centerDropzone.classList.remove("dragover");
      });
    });
    centerDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) uploadFiles(files);
    });
  }

  if (btnCenterUpload) {
    btnCenterUpload.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (btnCenterSample) {
    btnCenterSample.addEventListener("click", (e) => {
      e.stopPropagation();
      sampleModal.classList.add("show");
    });
  }

  if (btnCenterPaste) {
    btnCenterPaste.addEventListener("click", (e) => {
      e.stopPropagation();
      pasteTextModal.classList.add("show");
    });
  }
}

/**
 * 3-Tier Categorized Studio Tabs Manager
 */
function setupCategorizedTabs() {
  const catBtns = document.querySelectorAll(".cat-btn");
  const catGroups = {
    study: document.getElementById("catGroupStudy"),
    synthesis: document.getElementById("catGroupSynthesis"),
    media: document.getElementById("catGroupMedia"),
  };

  catBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      catBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const cat = btn.dataset.cat;
      Object.entries(catGroups).forEach(([key, el]) => {
        if (el) el.style.display = key === cat ? "flex" : "none";
      });

      const activeGroup = catGroups[cat];
      if (activeGroup) {
        const firstTab = activeGroup.querySelector(".tab-btn");
        if (firstTab) firstTab.click();
      }
    });
  });
}

initApp();

// ══════════════════════════════════════════════════════════════════
// AUTH MANAGER
// ══════════════════════════════════════════════════════════════════
const AuthManager = {
  currentUser: null,

  init() {
    const saved = localStorage.getItem("studyvault_user");
    const token = localStorage.getItem("studyvault_token");
    if (saved && token) {
      try { this.currentUser = JSON.parse(saved); } catch(e) {}
    }

    // Show landing page OR main app
    const landingEl = document.getElementById("landingPage");
    const appEl = document.getElementById("app");
    if (this.currentUser) {
      if (landingEl) landingEl.style.display = "none";
      if (appEl) appEl.style.display = "flex";
    } else {
      if (landingEl) landingEl.style.display = "flex";
      if (appEl) appEl.style.display = "none";
    }

    this.updateUI();
    this.bindEvents();
    if (typeof LandingPage !== "undefined") {
      LandingPage.init();
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
    this.updateUI();
    if (typeof LandingPage !== "undefined") {
      LandingPage.show();
    }
  },

  updateUI() {
    const loginBtn  = document.getElementById("openAuthModalBtn");
    const userMenu  = document.getElementById("userMenu");
    if (!loginBtn || !userMenu) return;

    if (this.currentUser) {
      const nameLabel = document.getElementById("userNameLabel");
      const avatarEl  = document.getElementById("userAvatarCircle");
      const emailEl   = document.getElementById("dropdownUserEmail");
      const roleEl    = document.getElementById("dropdownUserRole");
      const adminBtn  = document.getElementById("adminPanelBtn");

      loginBtn.style.display  = "none";
      userMenu.style.display  = "block";
      if (nameLabel) nameLabel.textContent = this.currentUser.name || "Student";
      if (emailEl)   emailEl.textContent   = this.currentUser.email || "";
      if (roleEl)    roleEl.textContent    = this.currentUser.role === "admin" ? "🛡️ Admin" : "🎓 Student";
      if (adminBtn)  adminBtn.style.display = this.currentUser.role === "admin" ? "flex" : "none";

      // Avatar
      if (avatarEl) {
        if (this.currentUser.avatar && this.currentUser.avatar.startsWith("http")) {
          avatarEl.innerHTML = `<img src="${this.currentUser.avatar}" alt="avatar" onerror="this.parentElement.textContent='${(this.currentUser.name||'S')[0].toUpperCase()}'">`;
        } else if (this.currentUser.avatar && this.currentUser.avatar.length <= 3) {
          avatarEl.textContent = this.currentUser.avatar;
        } else {
          avatarEl.textContent = (this.currentUser.name || "S")[0].toUpperCase();
        }
      }
    } else {
      loginBtn.style.display = "inline-flex";
      userMenu.style.display = "none";
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
        showToast("Add your Google Client ID to .env to enable Google Sign-In 🔑");
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
        AdminPanel.open();
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

  initGoogleSignIn() {
    const googleClientId = window.GOOGLE_CLIENT_ID || "";
    if (!googleClientId || !window.google) return;
    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const { token, user } = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: response.credential })
            }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
            this.saveSession(user, token);
            const authModal = document.getElementById("authModal");
            if (authModal) authModal.classList.remove("show");
            if (typeof LandingPage !== "undefined") {
              LandingPage.hide(() => { loadNotebooks(); showToast(`Welcome, ${user.name}! 🎉`); });
            } else {
              showToast(`Welcome, ${user.name}! 🎉`);
              loadNotebooks();
            }
          } catch(err) { showToast(err.message); }
        }
      });
      const landingGoogleBtn = document.getElementById("landingGoogleBtn");
      if (landingGoogleBtn) {
        window.google.accounts.id.renderButton(
          landingGoogleBtn,
          { theme: "outline", size: "large", width: 340 }
        );
      }
      const googleSignInBtn = document.getElementById("googleSignInBtn");
      if (googleSignInBtn) {
        window.google.accounts.id.renderButton(
          googleSignInBtn,
          { theme: "outline", size: "large", width: 340 }
        );
      }
    } catch(e) { /* Google SDK not loaded */ }
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
      document.getElementById("statStorage").textContent    = data.storageMode === "MongoDB Database" ? "Mongo" : "Local";
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
          <td><span class="role-badge ${u.role}">${u.role === "admin" ? "🛡️ Admin" : "🎓 User"}</span></td>
          <td style="color:var(--text-muted);font-size:0.8rem">${joined}</td>
          <td>
            <div class="admin-action-btns">
              ${!isCurrentAdmin ? `
                <button class="btn-admin-action" onclick="AdminPanel.toggleRole('${u._id}','${u.role}')">
                  ${u.role === "admin" ? "⬇️ Demote" : "⬆️ Promote"}
                </button>
                <button class="btn-admin-action danger" onclick="AdminPanel.deleteUser('${u._id}','${escapeHtml(u.name)}')">
                  🗑️ Delete
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
    lp.classList.add("fade-out");
    setTimeout(() => {
      lp.style.display = "none";
      const app = document.getElementById("app");
      app.style.display = "flex";
      app.classList.add("fade-in");
      setTimeout(() => app.classList.remove("fade-in"), 600);
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
          this.hide(() => { loadNotebooks(); showToast(`Welcome, Guest Student! 🎓`); });
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
      showToast("Add GOOGLE_CLIENT_ID to .env to enable Google Sign-In 🔑");
    });
  }
};

// Init everything
AuthManager.init();

