/* ═══════════════════════════════════════════════════════════════════
   StudyVault Admin Console Frontend Controller
   Handles authentication verification, section routing, live API data,
   subscription plan & quota management, RAG diagnostics, and audit trails.
   ═══════════════════════════════════════════════════════════════════ */

const AdminApp = {
  token: null,
  currentUser: null,
  currentSection: "overview",
  allUsers: [],
  allNotebooks: [],
  allDocuments: [],
  plansCatalog: null,
  studioFeaturesList: [],

  async init() {
    this.token = localStorage.getItem("studyvault_token");
    const savedUser = localStorage.getItem("studyvault_user");
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        this.currentUser = null;
      }
    }

    if (!this.token) {
      this.showShield(
        "401 UNAUTHORIZED",
        "Authentication Required",
        "Please sign in with an administrator account to access the StudyVault Admin Console."
      );
      return;
    }

    try {
      const meRes = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      if (!meRes.ok) {
        this.showShield(
          "401 SESSION EXPIRED",
          "Invalid or Expired Session",
          "Your authentication token has expired. Please return to the application and sign in again."
        );
        return;
      }

      const { user } = await meRes.json();
      this.currentUser = user;

      if (!user || user.role !== "admin") {
        this.showShield(
          "403 FORBIDDEN",
          "Administrator Privileges Required",
          `Signed in as ${user?.email || "Student"} (Role: ${user?.role || "user"}). Only administrator accounts can view this dashboard.`
        );
        return;
      }

      document.getElementById("adminLayout").classList.add("visible");
      this.renderAdminTopbar();
      this.bindEvents();
      await this.loadOverview();
    } catch (err) {
      this.showShield(
        "500 CONNECTION ERROR",
        "Unable to Verify Credentials",
        "Could not reach the StudyVault backend server."
      );
    }
  },

  showShield(code, title, desc) {
    document.getElementById("adminLayout").classList.remove("visible");
    const shield = document.getElementById("authShield");
    document.getElementById("shieldCode").textContent = code;
    document.getElementById("shieldTitle").textContent = title;
    document.getElementById("shieldDesc").textContent = desc;
    shield.classList.add("visible");
  },

  renderAdminTopbar() {
    if (!this.currentUser) return;
    document.getElementById("adminNameDisplay").textContent = this.currentUser.name || "Administrator";
    document.getElementById("adminEmailDisplay").textContent = this.currentUser.email || "admin@studyvault";
    const initial = (this.currentUser.name || "A")[0].toUpperCase();
    document.getElementById("adminAvatarDisplay").textContent = initial;
  },

  async api(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${this.token}`,
      ...(options.headers || {})
    };
    const res = await fetch(`/api/admin${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  },

  toast(message) {
    const container = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3500);
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  },

  formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  },

  formatPlanBadge(plan = "free", hasCustom = false) {
    const clean = String(plan || "free").toLowerCase();
    const label = clean === "pro" ? "💎 PRO" : clean === "plus" ? "⚡ PLUS" : "🌱 FREE";
    return `<span class="badge badge-plan-${clean}">${label}${hasCustom ? " *" : ""}</span>`;
  },

  bindEvents() {
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const section = btn.dataset.section;
        this.switchSection(section);
      });
    });

    document.getElementById("refreshCurrentSectionBtn").addEventListener("click", () => {
      this.refreshCurrentSection();
      this.toast("Refreshed data 🔄");
    });

    document.getElementById("adminLogoutBtn").addEventListener("click", () => {
      localStorage.removeItem("studyvault_token");
      localStorage.removeItem("studyvault_user");
      window.location.href = "/";
    });

    // User filters
    document.getElementById("userSearchInput").addEventListener("input", () => this.filterAndRenderUsers());
    document.getElementById("userPlanFilter").addEventListener("change", () => this.filterAndRenderUsers());
    document.getElementById("userRoleFilter").addEventListener("change", () => this.filterAndRenderUsers());
    document.getElementById("userStatusFilter").addEventListener("change", () => this.filterAndRenderUsers());

    // Notebook filter
    document.getElementById("notebookSearchInput").addEventListener("input", () => this.filterAndRenderNotebooks());

    // Document filters
    document.getElementById("docSearchInput").addEventListener("input", () => this.filterAndRenderDocuments());
    document.getElementById("docStatusFilter").addEventListener("change", () => this.filterAndRenderDocuments());

    // Database Explorer collection selector
    const dbColSelect = document.getElementById("dbCollectionSelect");
    if (dbColSelect) {
      dbColSelect.addEventListener("change", () => this.loadDatabaseExplorer(dbColSelect.value));
    }

    // Reset all plans default button
    const resetPlansBtn = document.getElementById("resetPlansDefaultBtn");
    if (resetPlansBtn) {
      resetPlansBtn.addEventListener("click", () => this.resetAllPlansToDefault());
    }

    // RAG Diagnostic form
    const ragForm = document.getElementById("ragDiagnosticForm");
    if (ragForm) {
      ragForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.runRagDiagnosticTest();
      });
    }

    // Inspect Modal close
    const closeModal = () => document.getElementById("inspectModal").classList.remove("show");
    document.getElementById("closeInspectModalBtn").addEventListener("click", closeModal);
    document.getElementById("closeInspectFooterBtn").addEventListener("click", closeModal);
    document.getElementById("inspectModal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("inspectModal")) closeModal();
    });

    // User Plan Modal close & save
    const closePlanModal = () => document.getElementById("userPlanModal").classList.remove("show");
    document.getElementById("closeUserPlanModalBtn").addEventListener("click", closePlanModal);
    document.getElementById("cancelUserPlanModalBtn").addEventListener("click", closePlanModal);
    document.getElementById("userPlanModal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("userPlanModal")) closePlanModal();
    });
    document.getElementById("saveUserPlanModalBtn").addEventListener("click", () => this.saveUserPlanFromModal());
    document.getElementById("resetUserDailyQuotaBtn").addEventListener("click", () => this.resetUserQuotaFromModal());
  },

  switchSection(section) {
    this.currentSection = section;

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.section === section);
    });

    document.querySelectorAll(".admin-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === `view-${section}`);
    });

    const titles = {
      overview: "Dashboard Overview & Telemetry",
      users: "Users, Plans & Quota Management",
      plans: "Subscription Tiers & Usage Restrictions",
      notebooks: "Study Notebooks Directory",
      documents: "Uploaded Documents & Vector Indexing",
      rag: "Hybrid RAG & AI Diagnostics Playground",
      analytics: "Platform Analytics & Revenue",
      health: "System Health & Infrastructure",
      audit: "Administrator & Plan Audit Logs",
      database: "Live MongoDB Atlas Database Explorer",
      settings: "Environment & System Settings"
    };
    document.getElementById("pageTitle").textContent = titles[section] || "Admin Console";

    this.refreshCurrentSection();
  },

  refreshCurrentSection() {
    switch (this.currentSection) {
      case "overview": return this.loadOverview();
      case "users": return this.loadUsers();
      case "plans": return this.loadPlansConfig();
      case "notebooks": return this.loadNotebooks();
      case "documents": return this.loadDocuments();
      case "rag": return this.loadRagDiagnostics();
      case "analytics": return this.loadAnalytics();
      case "health": return this.loadHealth();
      case "audit": return this.loadAuditLogs();
      case "database": return this.loadDatabaseExplorer();
      case "settings": return this.loadSettings();
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 1. OVERVIEW
  // ─────────────────────────────────────────────────────────────
  async loadOverview() {
    try {
      const data = await this.api("/stats");

      const badge = document.getElementById("storageModeBadge");
      const isMongo = (data.storageMode || "").toLowerCase().includes("mongo");
      badge.className = `storage-pill ${isMongo ? "mongo" : "local"}`;
      badge.textContent = isMongo ? "🟢 MongoDB Atlas" : "🟡 Local Storage Mode";

      const pb = data.planBreakdown || { free: 0, plus: 0, pro: 0, estimatedMonthlyRevenue: 0, conversionRatePct: 0 };
      const qt = data.quotaTelemetry || { chatQueriesToday: 0, studioGenerationsToday: 0, usersNearQuota: 0 };
      const ds = data.docStatusCounts || { ready: 0, processing: 0, failed: 0 };

      document.getElementById("kpiUsers").textContent = data.userCount ?? 0;
      document.getElementById("kpiUsersSub").textContent = `Free: ${pb.free || 0} • Plus: ${pb.plus || 0} • Pro: ${pb.pro || 0}`;

      document.getElementById("kpiMrr").textContent = `$${pb.estimatedMonthlyRevenue ?? 0}/mo`;
      document.getElementById("kpiMrrSub").textContent = `${pb.paidUsers || 0} paid accounts (${pb.conversionRatePct || 0}% conversion) • ${qt.usersNearQuota || 0} near quota`;

      document.getElementById("kpiNotebooksDocs").textContent = `${data.notebookCount ?? 0} / ${data.documentCount ?? 0}`;
      document.getElementById("kpiNotebooksDocsSub").textContent = `${ds.ready || 0} ready, ${ds.processing || 0} processing, ${ds.failed || 0} failed (${(data.totalPages || 0).toLocaleString()} pages)`;

      document.getElementById("kpiChunks").textContent = `${data.embeddingCoveragePct ?? 100}%`;
      document.getElementById("kpiEmbeddedSub").textContent = `${data.embeddedChunksCount ?? 0} / ${data.totalChunks ?? 0} chunks embedded (3072-dim)`;

      document.getElementById("kpiMessages").textContent = `${qt.chatQueriesToday ?? 0} / ${data.messageCount ?? 0}`;
      document.getElementById("kpiMessagesSub").textContent = `${qt.chatQueriesToday ?? 0} queries today • ${data.messageCount ?? 0} total chat messages`;

      const totalArtifacts = data.totalArtifactsCount ?? ((data.flashcardsCount || 0) + (data.quizCount || 0));
      document.getElementById("kpiStudioTotal").textContent = `${qt.studioGenerationsToday ?? 0} / ${totalArtifacts}`;
      document.getElementById("kpiStudioSub").textContent = `${qt.studioGenerationsToday ?? 0} generated today • ${data.notesCount ?? 0} pinned notes`;

      // Render Plan Breakdown Panel
      const totalU = Math.max(1, data.userCount || 1);
      const freePct = Math.round(((pb.free || 0) / totalU) * 100);
      const plusPct = Math.round(((pb.plus || 0) / totalU) * 100);
      const proPct = Math.round(((pb.pro || 0) / totalU) * 100);

      document.getElementById("overviewPlanBreakdown").innerHTML = `
        <div class="health-details">
          <div class="health-row">
            <span class="health-key"><span class="badge badge-plan-free">🌱 FREE</span> Starter Accounts ($0/mo)</span>
            <span class="health-val">${pb.free || 0} users (${freePct}%)</span>
          </div>
          <div class="health-row">
            <span class="health-key"><span class="badge badge-plan-plus">⚡ PLUS</span> Scholar Accounts ($9/mo)</span>
            <span class="health-val">${pb.plus || 0} users (${plusPct}%)</span>
          </div>
          <div class="health-row">
            <span class="health-key"><span class="badge badge-plan-pro">💎 PRO</span> Researcher Accounts ($19/mo)</span>
            <span class="health-val">${pb.pro || 0} users (${proPct}%)</span>
          </div>
          <div class="health-row">
            <span class="health-key">Estimated Monthly Recurring Revenue (MRR)</span>
            <span class="health-val" style="color:var(--success);">$${pb.estimatedMonthlyRevenue || 0}.00 / month</span>
          </div>
          <div class="health-row">
            <span class="health-key">Users Near Daily Quota (≥80% utilized today)</span>
            <span class="health-val" style="color:${qt.usersNearQuota > 0 ? "var(--warning)" : "var(--text-main)"};">${qt.usersNearQuota || 0} accounts</span>
          </div>
        </div>
      `;

      // Render Studio Breakdown Panel
      const ab = data.artifactBreakdown || {};
      document.getElementById("overviewStudioBreakdown").innerHTML = `
        <div class="health-details">
          <div class="health-row">
            <span class="health-key">🃏 Flashcard Decks & 📝 Practice Quizzes (Free+)</span>
            <span class="health-val">${ab.flashcards || 0} decks / ${ab.quiz || 0} quizzes</span>
          </div>
          <div class="health-row">
            <span class="health-key">🎯 Exam Questions & 📋 Executive Briefings (Free+)</span>
            <span class="health-val">${ab["important-questions"] || 0} exam sets / ${ab.briefing || 0} briefings</span>
          </div>
          <div class="health-row">
            <span class="health-key">🕸️ Concept Mind Maps & 🖥️ Slide Decks (Plus+)</span>
            <span class="health-val">${ab.mindmap || 0} mind maps / ${ab.slides || 0} slide decks</span>
          </div>
          <div class="health-row">
            <span class="health-key">📊 Data Tables, Compare & 🎙️ Audio Podcasts (Plus+)</span>
            <span class="health-val">${(ab["data-table"] || 0) + (ab.compare || 0)} tables / ${ab["audio-overview"] || 0} podcasts</span>
          </div>
          <div class="health-row">
            <span class="health-key">🎨 AI Visual Diagrams & 🎬 Video Lectures (Pro)</span>
            <span class="health-val" style="color:var(--primary-purple);">${ab.images || 0} visuals / ${ab.video || 0} video lectures</span>
          </div>
        </div>
      `;

      // Render Recent Users
      const rUsers = data.recentUsers || [];
      const uBody = document.getElementById("recentUsersBody");
      if (!rUsers.length) {
        uBody.innerHTML = `<tr><td colspan="4">No users registered yet.</td></tr>`;
      } else {
        uBody.innerHTML = rUsers.map(u => {
          const uUsage = u.usage || {};
          return `
            <tr>
              <td>
                <div style="font-weight:600;color:#fff">${this.escapeHtml(u.name)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${this.escapeHtml(u.email)}</div>
              </td>
              <td>${this.formatPlanBadge(u.plan || (u.role === "admin" ? "pro" : "free"))}</td>
              <td style="font-family:var(--font-mono);font-size:0.78rem;">
                💬 ${uUsage.chatQueriesToday || 0} • ✨ ${uUsage.studioGenerationsToday || 0}
              </td>
              <td><span class="badge badge-${u.status || "active"}">${u.status || "active"}</span></td>
            </tr>
          `;
        }).join("");
      }

      // Render Recent Docs
      const rDocs = data.recentDocuments || [];
      const dBody = document.getElementById("recentDocsBody");
      if (!rDocs.length) {
        dBody.innerHTML = `<tr><td colspan="4">No documents uploaded yet.</td></tr>`;
      } else {
        dBody.innerHTML = rDocs.map(d => `
          <tr>
            <td style="font-weight:500;color:#fff">${this.escapeHtml(d.filename)}</td>
            <td>${d.pageCount || 0}p</td>
            <td style="font-family:var(--font-mono);font-size:0.78rem;">${d.embeddedCount ?? d.chunkCount ?? 0}/${d.chunkCount || 0} chunks</td>
            <td><span class="badge badge-${d.status || "ready"}">${d.status || "ready"}</span></td>
          </tr>
        `).join("");
      }

      // Render Recent Audit Logs
      const rLogs = data.recentAuditLogs || [];
      const aBody = document.getElementById("recentAuditBody");
      if (!rLogs.length) {
        aBody.innerHTML = `<tr><td colspan="4">No administrative actions recorded yet.</td></tr>`;
      } else {
        aBody.innerHTML = rLogs.map(log => `
          <tr>
            <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted)">${this.formatDate(log.timestamp)}</td>
            <td>${this.escapeHtml(log.adminUser?.email || "system")}</td>
            <td><span class="badge badge-admin">${this.escapeHtml(log.action)}</span></td>
            <td>${this.escapeHtml(log.affectedEntity)}</td>
          </tr>
        `).join("");
      }
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 2. USERS & QUOTA MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  async loadUsers() {
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = `<tr><td colspan="8">Loading users...</td></tr>`;
    try {
      const data = await this.api("/users");
      this.allUsers = data.users || [];
      document.getElementById("usersTotalCount").textContent = this.allUsers.length;
      this.filterAndRenderUsers();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8">Error: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  },

  filterAndRenderUsers() {
    const q = (document.getElementById("userSearchInput").value || "").toLowerCase().trim();
    const planFilter = document.getElementById("userPlanFilter").value;
    const roleFilter = document.getElementById("userRoleFilter").value;
    const statusFilter = document.getElementById("userStatusFilter").value;

    const filtered = this.allUsers.filter(u => {
      const matchText = !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
      const userPlan = u.plan || (u.role === "admin" ? "pro" : "free");
      const matchPlan = planFilter === "all" || userPlan === planFilter;
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || (u.status || "active") === statusFilter;
      return matchText && matchPlan && matchRole && matchStatus;
    });

    const tbody = document.getElementById("usersTableBody");
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8">No matching users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => {
      const isSelf = this.currentUser && String(u._id) === String(this.currentUser.id);
      const status = u.status || "active";
      const limits = u.limits || { maxNotebooks: 2, maxDocsPerNotebook: 3, maxDailyChatQueries: 15, maxDailyStudioGenerations: 4 };
      const usage = u.usage || { chatQueriesToday: 0, studioGenerationsToday: 0, totalChatQueries: 0 };
      const util = u.utilization || { notebooksPct: 0, chatDailyPct: 0, studioDailyPct: 0 };

      const nbBarClass = util.notebooksPct >= 90 ? "crit" : util.notebooksPct >= 75 ? "warn" : "";
      const chatBarClass = util.chatDailyPct >= 90 ? "crit" : util.chatDailyPct >= 75 ? "warn" : "";

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:#fff">
              ${this.escapeHtml(u.name)}
              ${isSelf ? '<span style="color:var(--primary-cyan);font-size:0.75rem"> (You)</span>' : ""}
            </div>
            <div style="font-size:0.76rem;color:var(--text-muted)">${this.escapeHtml(u.email)}</div>
          </td>
          <td><span class="badge badge-${u.role}">${u.role}</span></td>
          <td>
            <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:flex-start;">
              ${this.formatPlanBadge(u.plan, u.hasCustomQuota)}
              <span style="font-size:0.7rem; color:var(--text-muted);">${this.escapeHtml(u.priceLabel || "$0 / mo")}${u.hasCustomQuota ? " • Custom Override" : ""}</span>
            </div>
          </td>
          <td class="quota-cell">
            <div class="quota-row">
              <span>📓 Notebooks</span>
              <span style="font-family:var(--font-mono);color:#fff;">${u.notebookCount || 0} / ${limits.maxNotebooks}</span>
            </div>
            <div class="quota-bar"><div class="quota-fill ${nbBarClass}" style="width:${util.notebooksPct || 0}%"></div></div>
            <div style="font-size:0.72rem;color:var(--text-muted);">📄 ${u.documentCount || 0} sources (${u.totalPages || 0}p, ${u.totalChunks || 0} chunks)</div>
          </td>
          <td class="quota-cell">
            <div class="quota-row">
              <span>💬 Chat Today</span>
              <span style="font-family:var(--font-mono);color:#fff;">${usage.chatQueriesToday || 0} / ${limits.maxDailyChatQueries}</span>
            </div>
            <div class="quota-bar"><div class="quota-fill ${chatBarClass}" style="width:${util.chatDailyPct || 0}%"></div></div>
            <div style="font-size:0.72rem;color:var(--text-muted);">✨ Studio Today: <strong style="color:#fff;">${usage.studioGenerationsToday || 0}/${limits.maxDailyStudioGenerations}</strong> (${usage.totalChatQueries || 0} total Qs)</div>
          </td>
          <td><span class="badge badge-${status}">${status}</span></td>
          <td style="font-size:0.76rem;color:var(--text-muted)">${this.formatDate(u.createdAt)}</td>
          <td>
            <div class="btn-action-group" style="flex-wrap:wrap;">
              <button class="btn-action" style="border-color:rgba(197,138,249,0.4);color:var(--primary-purple);" onclick="AdminApp.openUserPlanModal('${u._id}')">💎 Plan / Quota</button>
              <button class="btn-action" onclick="AdminApp.inspectUser('${u._id}')">Inspect</button>
              <button class="btn-action" onclick="AdminApp.toggleUserRole('${u._id}', '${u.role}')">
                ${u.role === "admin" ? "Demote" : "Promote"}
              </button>
              ${!isSelf ? `
                <button class="btn-action" onclick="AdminApp.toggleUserStatus('${u._id}', '${status}')">
                  ${status === "active" ? "Disable" : "Enable"}
                </button>
                <button class="btn-action danger" onclick="AdminApp.deleteUser('${u._id}', '${this.escapeHtml(u.email)}')">
                  Delete
                </button>
              ` : ""}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  openUserPlanModal(userId) {
    const u = this.allUsers.find(item => String(item._id) === String(userId));
    if (!u) return;

    document.getElementById("editPlanUserId").value = u._id;
    document.getElementById("editUserPlanSelect").value = u.plan || (u.role === "admin" ? "pro" : "free");

    const cq = u.customQuota || {};
    document.getElementById("customMaxNotebooks").value = cq.maxNotebooks || "";
    document.getElementById("customMaxDocs").value = cq.maxDocsPerNotebook || "";
    document.getElementById("customMaxChat").value = cq.maxDailyChatQueries || "";
    document.getElementById("customMaxStudio").value = cq.maxDailyStudioGenerations || "";

    const usage = u.usage || {};
    const limits = u.limits || {};
    document.getElementById("editPlanUserSummary").innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700; color:#fff;">${this.escapeHtml(u.name)}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${this.escapeHtml(u.email)}</div>
        </div>
        ${this.formatPlanBadge(u.plan, u.hasCustomQuota)}
      </div>
      <div style="margin-top:0.65rem; font-size:0.76rem; color:var(--text-sub); display:flex; gap:1rem; flex-wrap:wrap;">
        <span>Notebooks: <strong>${u.notebookCount || 0}/${limits.maxNotebooks || 2}</strong></span>
        <span>Chat Today: <strong>${usage.chatQueriesToday || 0}/${limits.maxDailyChatQueries || 15}</strong></span>
        <span>Studio Today: <strong>${usage.studioGenerationsToday || 0}/${limits.maxDailyStudioGenerations || 4}</strong></span>
      </div>
    `;

    document.getElementById("userPlanModal").classList.add("show");
  },

  async saveUserPlanFromModal() {
    const userId = document.getElementById("editPlanUserId").value;
    const plan = document.getElementById("editUserPlanSelect").value;
    const customQuota = {
      maxNotebooks: document.getElementById("customMaxNotebooks").value ? Number(document.getElementById("customMaxNotebooks").value) : null,
      maxDocsPerNotebook: document.getElementById("customMaxDocs").value ? Number(document.getElementById("customMaxDocs").value) : null,
      maxDailyChatQueries: document.getElementById("customMaxChat").value ? Number(document.getElementById("customMaxChat").value) : null,
      maxDailyStudioGenerations: document.getElementById("customMaxStudio").value ? Number(document.getElementById("customMaxStudio").value) : null
    };

    try {
      await this.api(`/users/${userId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan, customQuota })
      });
      document.getElementById("userPlanModal").classList.remove("show");
      this.toast(`Updated user subscription plan to ${plan.toUpperCase()} ✅`);
      await this.loadUsers();
    } catch (err) {
      this.toast(err.message);
    }
  },

  async resetUserQuotaFromModal() {
    const userId = document.getElementById("editPlanUserId").value;
    if (!userId) return;
    try {
      await this.api(`/users/${userId}/reset-quota`, { method: "POST" });
      this.toast("Reset user's daily AI Chat and Studio counters to 0 ✅");
      await this.loadUsers();
      this.openUserPlanModal(userId);
    } catch (err) {
      this.toast(err.message);
    }
  },

  async inspectUser(userId) {
    try {
      const { user } = await this.api(`/users/${userId}`);
      const nbs = user.notebooks || [];
      const limits = user.limits || {};
      const usage = user.usage || {};
      const html = `
        <div class="health-details" style="margin-bottom:1.25rem">
          <div class="health-row"><span class="health-key">User ID</span><span class="health-val">${user._id}</span></div>
          <div class="health-row"><span class="health-key">Full Name</span><span class="health-val">${this.escapeHtml(user.name)}</span></div>
          <div class="health-row"><span class="health-key">Email</span><span class="health-val">${this.escapeHtml(user.email)}</span></div>
          <div class="health-row"><span class="health-key">Role & Status</span><span class="health-val">${user.role} / ${user.status || "active"}</span></div>
          <div class="health-row"><span class="health-key">Subscription Plan</span><span class="health-val">${this.formatPlanBadge(user.plan, user.hasCustomQuota)} (${this.escapeHtml(user.priceLabel || "$0/mo")})</span></div>
          <div class="health-row"><span class="health-key">Notebooks Quota</span><span class="health-val">${user.notebookCount || 0} / ${limits.maxNotebooks || 2} notebooks</span></div>
          <div class="health-row"><span class="health-key">Total Uploaded Sources</span><span class="health-val">${user.documentCount || 0} docs (${user.totalPages || 0} pages, ${(user.totalChars || 0).toLocaleString()} chars, ${user.totalChunks || 0} chunks)</span></div>
          <div class="health-row"><span class="health-key">Daily AI Chat Usage</span><span class="health-val">${usage.chatQueriesToday || 0} / ${limits.maxDailyChatQueries || 15} today (${usage.totalChatQueries || 0} all-time)</span></div>
          <div class="health-row"><span class="health-key">Daily Studio Usage</span><span class="health-val">${usage.studioGenerationsToday || 0} / ${limits.maxDailyStudioGenerations || 4} today (${usage.totalStudioGenerations || 0} all-time)</span></div>
          <div class="health-row"><span class="health-key">Unlocked Studio Tools</span><span class="health-val">${(user.allowedStudioFeatures || []).length} tools enabled</span></div>
          <div class="health-row"><span class="health-key">Joined Date</span><span class="health-val">${this.formatDate(user.createdAt)}</span></div>
        </div>
        <h4 style="color:#fff;margin-bottom:0.5rem">User's Notebooks (${nbs.length})</h4>
        ${nbs.length ? `
          <ul style="padding-left:1.2rem;color:var(--text-sub)">
            ${nbs.map(n => `<li><strong style="color:#fff">${this.escapeHtml(n.title)}</strong> — ${n.documentCount || 0} sources (Updated: ${this.formatDate(n.updatedAt || n.createdAt)})</li>`).join("")}
          </ul>
        ` : `<p>No notebooks owned by this user.</p>`}
      `;
      this.openModal(`User Profile & Quota Telemetry: ${user.name}`, html);
    } catch (err) {
      this.toast(err.message);
    }
  },

  async toggleUserRole(userId, currentRole) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`Are you sure you want to change this user's role to "${newRole}"?`)) return;
    try {
      await this.api(`/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole })
      });
      this.toast(`User role updated to ${newRole} ✅`);
      await this.loadUsers();
    } catch (err) {
      this.toast(err.message);
    }
  },

  async toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    if (!confirm(`Are you sure you want to ${newStatus === "disabled" ? "disable" : "enable"} this user account?`)) return;
    try {
      await this.api(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      this.toast(`User status updated to ${newStatus} ✅`);
      await this.loadUsers();
    } catch (err) {
      this.toast(err.message);
    }
  },

  async deleteUser(userId, email) {
    if (!confirm(`Delete user "${email}" and ALL their notebooks, documents, and notes? This cannot be undone.`)) return;
    try {
      await this.api(`/users/${userId}`, { method: "DELETE" });
      this.toast(`User ${email} deleted.`);
      await this.loadUsers();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 3. SUBSCRIPTION PLANS & RESTRICTIONS EDITOR
  // ─────────────────────────────────────────────────────────────
  async loadPlansConfig() {
    const container = document.getElementById("plansEditorContainer");
    container.innerHTML = `<div>Loading subscription plans...</div>`;
    try {
      const data = await this.api("/plans");
      this.plansCatalog = data.plans || {};
      this.studioFeaturesList = data.studioFeatures || [];
      this.renderPlansEditor();
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger)">Error: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  renderPlansEditor() {
    const container = document.getElementById("plansEditorContainer");
    const tiers = ["free", "plus", "pro"];

    container.innerHTML = tiers.map(tier => {
      const p = this.plansCatalog[tier] || {};
      const allowedSet = new Set(p.allowedStudioFeatures || []);

      const featuresHtml = this.studioFeaturesList.map(feat => {
        const checked = allowedSet.has(feat.id) ? "checked" : "";
        return `
          <label class="plan-feature-item">
            <input type="checkbox" data-tier-feat="${tier}" value="${this.escapeHtml(feat.id)}" ${checked} />
            <span>${this.escapeHtml(feat.label)}</span>
          </label>
        `;
      }).join("");

      return `
        <div class="plan-editor-card tier-${tier}">
          <div class="plan-card-top">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                ${this.formatPlanBadge(tier)}
                <strong style="font-size:1.05rem; color:#fff;">${this.escapeHtml(p.name || tier.toUpperCase())}</strong>
              </div>
              <div style="font-size:0.78rem; color:var(--text-sub); margin-top:0.2rem;">${this.escapeHtml(p.tagline || "")}</div>
            </div>
            <div style="font-family:var(--font-mono); font-size:1.1rem; font-weight:700; color:#fff;">
              $${p.priceMonthly ?? 0}<span style="font-size:0.75rem; color:var(--text-muted);">/mo</span>
            </div>
          </div>

          <div class="plan-field-grid">
            <div class="plan-field">
              <label>Monthly Price ($ USD)</label>
              <input type="number" id="plan-${tier}-price" min="0" value="${p.priceMonthly ?? 0}" />
            </div>
            <div class="plan-field">
              <label>Max Notebooks / User</label>
              <input type="number" id="plan-${tier}-notebooks" min="1" value="${p.maxNotebooks ?? 2}" />
            </div>
            <div class="plan-field">
              <label>Max Sources / Notebook</label>
              <input type="number" id="plan-${tier}-docs" min="1" value="${p.maxDocsPerNotebook ?? 3}" />
            </div>
            <div class="plan-field">
              <label>Max File Size (MB)</label>
              <input type="number" id="plan-${tier}-filesize" min="1" value="${p.maxFileSizeMB ?? 10}" />
            </div>
            <div class="plan-field">
              <label>Max Pages / Document</label>
              <input type="number" id="plan-${tier}-pages" min="1" value="${p.maxPagesPerDoc ?? 25}" />
            </div>
            <div class="plan-field">
              <label>Daily AI Chat Queries</label>
              <input type="number" id="plan-${tier}-chat" min="1" value="${p.maxDailyChatQueries ?? 15}" />
            </div>
            <div class="plan-field">
              <label>Daily Studio Generations</label>
              <input type="number" id="plan-${tier}-studio" min="1" value="${p.maxDailyStudioGenerations ?? 4}" />
            </div>
            <div class="plan-field">
              <label>RAG Retrieval Depth (topK)</label>
              <input type="number" id="plan-${tier}-topk" min="2" max="30" value="${p.ragTopK ?? 6}" />
            </div>
          </div>

          <div>
            <label style="display:block; font-size:0.76rem; color:var(--text-sub); margin-bottom:0.4rem; font-weight:600;">
              Unlocked Studio Features (${allowedSet.size}/${this.studioFeaturesList.length})
            </label>
            <div class="plan-features-list">
              ${featuresHtml}
            </div>
          </div>

          <button class="btn-primary" style="margin-top:auto; width:100%;" onclick="AdminApp.savePlanTier('${tier}')">
            💾 Save ${p.name || tier.toUpperCase()} Plan Rules
          </button>
        </div>
      `;
    }).join("");
  },

  async savePlanTier(tier) {
    const allowedStudioFeatures = [];
    document.querySelectorAll(`input[data-tier-feat="${tier}"]:checked`).forEach(cb => {
      allowedStudioFeatures.push(cb.value);
    });

    const payload = {
      priceMonthly: Number(document.getElementById(`plan-${tier}-price`).value),
      maxNotebooks: Number(document.getElementById(`plan-${tier}-notebooks`).value),
      maxDocsPerNotebook: Number(document.getElementById(`plan-${tier}-docs`).value),
      maxFileSizeMB: Number(document.getElementById(`plan-${tier}-filesize`).value),
      maxPagesPerDoc: Number(document.getElementById(`plan-${tier}-pages`).value),
      maxDailyChatQueries: Number(document.getElementById(`plan-${tier}-chat`).value),
      maxDailyStudioGenerations: Number(document.getElementById(`plan-${tier}-studio`).value),
      ragTopK: Number(document.getElementById(`plan-${tier}-topk`).value),
      allowedStudioFeatures
    };

    try {
      const res = await this.api(`/plans/${tier}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      this.plansCatalog = res.plans || this.plansCatalog;
      this.renderPlansEditor();
      this.toast(`Saved ${tier.toUpperCase()} tier limits & feature restrictions ✅`);
    } catch (err) {
      this.toast(err.message);
    }
  },

  async resetAllPlansToDefault() {
    if (!confirm("Reset Free, Plus, and Pro plan limits and feature gates to factory defaults?")) return;
    try {
      const res = await this.api("/plans/reset", { method: "POST" });
      this.plansCatalog = res.plans;
      this.renderPlansEditor();
      this.toast("All subscription tiers reset to factory defaults ✅");
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 4. NOTEBOOKS MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  async loadNotebooks() {
    const tbody = document.getElementById("notebooksTableBody");
    tbody.innerHTML = `<tr><td colspan="7">Loading notebooks...</td></tr>`;
    try {
      const data = await this.api("/notebooks");
      this.allNotebooks = data.notebooks || [];
      document.getElementById("notebooksTotalCount").textContent = this.allNotebooks.length;
      this.filterAndRenderNotebooks();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7">Error: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  },

  filterAndRenderNotebooks() {
    const q = (document.getElementById("notebookSearchInput").value || "").toLowerCase().trim();
    const filtered = this.allNotebooks.filter(n => {
      if (!q) return true;
      return (
        (n.title || "").toLowerCase().includes(q) ||
        (n.owner?.name || "").toLowerCase().includes(q) ||
        (n.owner?.email || "").toLowerCase().includes(q)
      );
    });

    const tbody = document.getElementById("notebooksTableBody");
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7">No matching notebooks found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(n => `
      <tr>
        <td style="font-weight:600;color:#fff">${this.escapeHtml(n.title)}</td>
        <td>
          <div>${this.escapeHtml(n.owner?.name || "System")}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${this.escapeHtml(n.owner?.email || "")}</div>
        </td>
        <td>${n.documentCount || 0}</td>
        <td>${n.messageCount || 0}</td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${this.formatDate(n.createdAt)}</td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${this.formatDate(n.updatedAt)}</td>
        <td>
          <div class="btn-action-group">
            <button class="btn-action" onclick="AdminApp.inspectNotebook('${n._id}')">Inspect</button>
            <button class="btn-action danger" onclick="AdminApp.deleteNotebook('${n._id}', '${this.escapeHtml(n.title)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join("");
  },

  async inspectNotebook(notebookId) {
    try {
      const { notebook } = await this.api(`/notebooks/${notebookId}`);
      const docs = notebook.documents || [];
      const artifacts = notebook.artifacts || [];
      const html = `
        <div class="health-details" style="margin-bottom:1.25rem">
          <div class="health-row"><span class="health-key">Notebook ID</span><span class="health-val">${notebook._id}</span></div>
          <div class="health-row"><span class="health-key">Title</span><span class="health-val">${this.escapeHtml(notebook.title)}</span></div>
          <div class="health-row"><span class="health-key">Owner</span><span class="health-val">${this.escapeHtml(notebook.owner?.name)} (${this.escapeHtml(notebook.owner?.email)})</span></div>
          <div class="health-row"><span class="health-key">Chat Messages</span><span class="health-val">${notebook.messageCount || 0}</span></div>
          <div class="health-row"><span class="health-key">Pinned Notes</span><span class="health-val">${notebook.noteCount || 0}</span></div>
          <div class="health-row"><span class="health-key">Generated Studio Artifacts</span><span class="health-val">${artifacts.map(a => a.type).join(", ") || "None"}</span></div>
        </div>
        <h4 style="color:#fff;margin-bottom:0.5rem">Uploaded Documents (${docs.length})</h4>
        ${docs.length ? `
          <ul style="padding-left:1.2rem;color:var(--text-sub)">
            ${docs.map(d => `<li><strong style="color:#fff">${this.escapeHtml(d.filename)}</strong> — ${d.pageCount} pages, ${d.chunkCount} chunks [${d.status}]</li>`).join("")}
          </ul>
        ` : `<p>No documents in this notebook.</p>`}
      `;
      this.openModal(`Notebook: ${notebook.title}`, html);
    } catch (err) {
      this.toast(err.message);
    }
  },

  async deleteNotebook(notebookId, title) {
    if (!confirm(`Delete notebook "${title}" and all its uploaded documents, chat history, and studio artifacts?`)) return;
    try {
      await this.api(`/notebooks/${notebookId}`, { method: "DELETE" });
      this.toast(`Notebook "${title}" deleted.`);
      await this.loadNotebooks();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 5. DOCUMENTS & VECTOR INDEXING
  // ─────────────────────────────────────────────────────────────
  async loadDocuments() {
    const tbody = document.getElementById("documentsTableBody");
    tbody.innerHTML = `<tr><td colspan="8">Loading documents...</td></tr>`;
    try {
      const data = await this.api("/documents");
      this.allDocuments = data.documents || [];
      document.getElementById("documentsTotalCount").textContent = this.allDocuments.length;
      this.filterAndRenderDocuments();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8">Error: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  },

  filterAndRenderDocuments() {
    const q = (document.getElementById("docSearchInput").value || "").toLowerCase().trim();
    const statusFilter = document.getElementById("docStatusFilter").value;

    const filtered = this.allDocuments.filter(d => {
      const matchText =
        !q ||
        (d.filename || "").toLowerCase().includes(q) ||
        (d.notebookTitle || "").toLowerCase().includes(q) ||
        (d.owner?.email || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || (d.status || "ready") === statusFilter;
      return matchText && matchStatus;
    });

    const tbody = document.getElementById("documentsTableBody");
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8">No matching documents found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      const totalC = d.chunksCount || 0;
      const embC = d.embeddedChunksCount || 0;
      const covPct = totalC > 0 ? Math.round((embC / totalC) * 100) : 0;
      return `
        <tr>
          <td style="font-weight:600;color:#fff">${this.escapeHtml(d.filename)}</td>
          <td>${this.escapeHtml(d.notebookTitle)}</td>
          <td style="font-size:0.78rem;color:var(--text-sub)">${this.escapeHtml(d.owner?.email || "student@local")}</td>
          <td style="font-family:var(--font-mono);font-size:0.78rem;">
            ${d.pageCount || 0}p • ${((d.charCount || 0) / 1000).toFixed(1)}k chars
          </td>
          <td style="font-family:var(--font-mono);font-size:0.78rem;">
            <span style="color:${covPct === 100 && totalC > 0 ? "var(--success)" : "var(--warning)"};">${embC}/${totalC}</span>
            <span style="color:var(--text-muted);">(${covPct}%)</span>
          </td>
          <td><span class="badge badge-${d.status || "ready"}">${d.status || "ready"}</span></td>
          <td style="font-size:0.78rem;color:var(--text-muted)">${this.formatDate(d.createdAt)}</td>
          <td>
            <div class="btn-action-group">
              <button class="btn-action" onclick="AdminApp.inspectDocument('${d._id}')">Inspect</button>
              <button class="btn-action" style="color:var(--primary-cyan);" onclick="AdminApp.reprocessDocument('${d._id}', '${this.escapeHtml(d.filename)}')">↻ Reprocess</button>
              <button class="btn-action danger" onclick="AdminApp.deleteDocument('${d._id}', '${this.escapeHtml(d.filename)}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  async reprocessDocument(docId, filename) {
    try {
      const res = await this.api(`/documents/${docId}/reprocess`, { method: "POST" });
      this.toast(res.message || `Reprocessing started for "${filename}" 🔄`);
      setTimeout(() => this.loadDocuments(), 1200);
    } catch (err) {
      this.toast(err.message);
    }
  },

  async inspectDocument(docId) {
    try {
      const { document: doc } = await this.api(`/documents/${docId}`);
      const sampleChunks = doc.sampleChunks || [];
      const html = `
        <div class="health-details" style="margin-bottom:1.25rem">
          <div class="health-row"><span class="health-key">Document ID</span><span class="health-val">${doc._id}</span></div>
          <div class="health-row"><span class="health-key">Filename</span><span class="health-val">${this.escapeHtml(doc.filename)}</span></div>
          <div class="health-row"><span class="health-key">Notebook</span><span class="health-val">${this.escapeHtml(doc.notebookTitle)}</span></div>
          <div class="health-row"><span class="health-key">Pages / Characters</span><span class="health-val">${doc.pageCount} pages / ${(doc.charCount || 0).toLocaleString()} chars</span></div>
          <div class="health-row"><span class="health-key">Chunks / Embeddings</span><span class="health-val">${doc.embeddedCount} / ${doc.chunksCount} embedded</span></div>
          <div class="health-row"><span class="health-key">Processing Status</span><span class="health-val">${doc.status}</span></div>
        </div>
        <h4 style="color:#fff;margin-bottom:0.35rem">Executive Summary</h4>
        <p style="margin-bottom:1rem;color:var(--text-sub)">${this.escapeHtml(doc.summary || "No summary generated.")}</p>
        <h4 style="color:#fff;margin-bottom:0.35rem">Sample Indexed Chunks (First ${sampleChunks.length})</h4>
        ${sampleChunks.map(c => `
          <div style="background:var(--bg-card);padding:0.65rem;border-radius:6px;margin-bottom:0.5rem;border:1px solid var(--border-color)">
            <div style="font-family:var(--font-mono);font-size:0.74rem;color:var(--primary-blue);margin-bottom:0.25rem">
              Page ${c.pageNumber} • ${c.charCount} chars • Vector Dim: ${c.embeddingDim}
            </div>
            <div style="font-size:0.8rem;color:var(--text-main)">${this.escapeHtml(c.snippet)}</div>
          </div>
        `).join("") || "<p>No chunks indexed.</p>"}
      `;
      this.openModal(`Document Inspection: ${doc.filename}`, html);
    } catch (err) {
      this.toast(err.message);
    }
  },

  async deleteDocument(docId, filename) {
    if (!confirm(`Delete document "${filename}" and its vector index chunks?`)) return;
    try {
      await this.api(`/documents/${docId}`, { method: "DELETE" });
      this.toast(`Document "${filename}" deleted.`);
      await this.loadDocuments();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 6. RAG & AI DIAGNOSTICS PLAYGROUND
  // ─────────────────────────────────────────────────────────────
  async loadRagDiagnostics() {
    const grid = document.getElementById("ragSpecGrid");
    try {
      const [rag, nbRes] = await Promise.all([
        this.api("/rag"),
        this.api("/notebooks")
      ]);

      // Populate notebook dropdown
      const nbSelect = document.getElementById("ragTestNotebookSelect");
      if (nbSelect && nbRes.notebooks) {
        const currentVal = nbSelect.value;
        nbSelect.innerHTML = `<option value="">All Ready Notebooks (${nbRes.notebooks.length})</option>` +
          nbRes.notebooks.map(n => `<option value="${n._id}">${this.escapeHtml(n.title)} (${n.documentCount || 0} docs)</option>`).join("");
        nbSelect.value = currentVal;
      }

      grid.innerHTML = `
        <div class="spec-box">
          <div class="spec-title">Primary Generation Model</div>
          <div class="spec-value">${this.escapeHtml(rag.generationModel)}</div>
          <span class="spec-tag ${rag.geminiConfigured ? "implemented" : "not-implemented"}">
            ${rag.geminiConfigured ? "API Key Active • Fallback: " + this.escapeHtml(rag.generationFallbackModel) : "API Key Missing"}
          </span>
        </div>
        <div class="spec-box">
          <div class="spec-title">Vector Embedding Engine</div>
          <div class="spec-value">${this.escapeHtml(rag.embeddingModel)} (${rag.embeddingDimension}-dim)</div>
          <span class="spec-tag implemented">${rag.chunks3072Dim || 0} Gemini vectors • ${rag.chunks512Dim || 0} deterministic fallback</span>
        </div>
        <div class="spec-box">
          <div class="spec-title">Vector Index Coverage</div>
          <div class="spec-value">${rag.embeddedChunks || 0} / ${rag.totalChunks || 0} Chunks (${rag.embeddingCoveragePct ?? 100}%)</div>
          <span class="spec-tag ${rag.documentsNeedingReindex > 0 ? "not-implemented" : "implemented"}">
            ${rag.documentsReady || 0} ready docs • ${rag.documentsNeedingReindex || 0} needing re-index
          </span>
        </div>
        <div class="spec-box">
          <div class="spec-title">Hybrid Rank Fusion Formula</div>
          <div class="spec-value" style="font-size:0.78rem;">${this.escapeHtml(rag.hybridFormula)}</div>
          <span class="spec-tag implemented">${this.escapeHtml(rag.diversityFilter)}</span>
        </div>
      `;
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--danger)">Failed to load RAG telemetry: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  async runRagDiagnosticTest() {
    const query = document.getElementById("ragTestQueryInput").value.trim();
    const notebookId = document.getElementById("ragTestNotebookSelect").value;
    const topK = Number(document.getElementById("ragTestTopKSelect").value) || 8;
    const btn = document.getElementById("ragTestSubmitBtn");
    const container = document.getElementById("ragTestResultsContainer");

    if (!query) return;
    btn.disabled = true;
    btn.textContent = "Retrieving...";
    container.innerHTML = `<div style="color:var(--text-sub); padding:0.75rem;">Running hybrid semantic + BM25 + RRF retrieval...</div>`;

    try {
      const data = await this.api("/rag/test", {
        method: "POST",
        body: JSON.stringify({ query, notebookId: notebookId || undefined, topK })
      });

      if (!data.results || data.results.length === 0) {
        container.innerHTML = `<div style="padding:1rem; background:var(--bg-card); border-radius:8px; color:var(--warning);">${this.escapeHtml(data.message || "No matching chunks retrieved.")}</div>`;
        return;
      }

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; padding:0.65rem 1rem; background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.3); border-radius:8px;">
          <span style="font-size:0.84rem; color:#fff;">
            Retrieved <strong>${data.retrievedCount}</strong> chunks across <strong>${data.totalDocumentsSearched}</strong> ready document(s)
          </span>
          <span style="font-family:var(--font-mono); font-size:0.8rem; color:var(--success);">Latency: ${data.latencyMs} ms</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${data.results.map((r, idx) => `
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <span class="badge badge-admin">#${idx + 1}</span>
                  <strong style="color:#fff; margin-left:0.4rem;">${this.escapeHtml(r.filename)}</strong>
                  <span style="font-family:var(--font-mono); font-size:0.76rem; color:var(--primary-cyan); margin-left:0.4rem;">Page ${r.pageNumber || 1}</span>
                </div>
                <div style="font-family:var(--font-mono); font-size:0.75rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
                  <span style="color:var(--success);">Hybrid: <strong>${r.hybridScore}</strong></span>
                  <span style="color:var(--primary-blue);">Cosine: ${r.semanticScore}</span>
                  <span style="color:var(--primary-purple);">BM25: ${r.lexicalScore}</span>
                  <span style="color:var(--text-muted);">RRF: ${r.rrfScore}</span>
                </div>
              </div>
              <div style="font-size:0.83rem; color:var(--text-main); line-height:1.55; background:rgba(0,0,0,0.25); padding:0.65rem 0.85rem; border-radius:6px;">
                ${this.escapeHtml(r.textSnippet)}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger); padding:0.75rem;">Error: ${this.escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Run Retrieval Test";
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 7. ANALYTICS
  // ─────────────────────────────────────────────────────────────
  async loadAnalytics() {
    try {
      const data = await this.api("/analytics");
      const pb = data.planBreakdown || { free: 0, plus: 0, pro: 0, estimatedMonthlyRevenue: 0 };

      document.getElementById("analyticsSummaryGrid").innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Extracted Characters</div>
          <div class="stat-value">${(data.totalExtractedCharacters || 0).toLocaleString()}</div>
          <div class="stat-subtext">Across ${data.totalDocuments || 0} documents (${data.totalPagesExtracted || 0} pages)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Chunks / Document</div>
          <div class="stat-value">${data.averageChunksPerDocument || 0}</div>
          <div class="stat-subtext">Total ${data.totalChunksCreated || 0} chunks (${data.embeddingCoveragePct ?? 100}% embedded)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Estimated Monthly Revenue</div>
          <div class="stat-value">$${pb.estimatedMonthlyRevenue || 0}</div>
          <div class="stat-subtext">Free: ${pb.free || 0} • Plus: ${pb.plus || 0} • Pro: ${pb.pro || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total AI Interactions</div>
          <div class="stat-value">${(data.totalMessages || 0) + (data.totalArtifacts || 0)}</div>
          <div class="stat-subtext">${data.totalMessages || 0} chat msgs • ${data.totalArtifacts || 0} studio artifacts</div>
        </div>
      `;

      const breakdown = data.documentStatusBreakdown || {};
      const stTools = data.studioToolBreakdown || {};
      document.getElementById("analyticsDocStatusBreakdown").innerHTML = `
        <div class="health-details">
          <div class="health-row"><span class="health-key">🟢 Ready Documents</span><span class="health-val">${breakdown.ready || 0}</span></div>
          <div class="health-row"><span class="health-key">🟡 Processing Documents</span><span class="health-val">${breakdown.processing || 0}</span></div>
          <div class="health-row"><span class="health-key">🔴 Failed Documents</span><span class="health-val">${breakdown.failed || 0}</span></div>
          <div class="health-row"><span class="health-key">🃏 Flashcards & Quizzes</span><span class="health-val">${stTools.flashcards || 0} / ${stTools.quiz || 0}</span></div>
          <div class="health-row"><span class="health-key">🕸️ Mind Maps & Visual Diagrams</span><span class="health-val">${stTools.mindmap || 0} / ${stTools.images || 0}</span></div>
          <div class="health-row"><span class="health-key">🎬 Video Lectures & Podcasts</span><span class="health-val">${stTools.video || 0} / ${stTools["audio-overview"] || 0}</span></div>
        </div>
      `;

      const docsByDay = data.documentsOverTime || [];
      const nbsByDay = data.notebooksOverTime || [];
      document.getElementById("analyticsTimeline").innerHTML = `
        <div class="health-details">
          <div style="font-weight:600;color:#fff;margin-bottom:0.25rem">Documents Uploaded by Date</div>
          ${docsByDay.length ? docsByDay.map(item => `
            <div class="health-row"><span class="health-key">${item.date}</span><span class="health-val">${item.count} docs</span></div>
          `).join("") : `<div style="color:var(--text-muted)">No dated document records</div>`}
          <div style="font-weight:600;color:#fff;margin:0.75rem 0 0.25rem">Notebooks Created by Date</div>
          ${nbsByDay.length ? nbsByDay.map(item => `
            <div class="health-row"><span class="health-key">${item.date}</span><span class="health-val">${item.count} notebooks</span></div>
          `).join("") : `<div style="color:var(--text-muted)">No dated notebook records</div>`}
        </div>
      `;
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 8. SYSTEM HEALTH
  // ─────────────────────────────────────────────────────────────
  async loadHealth() {
    const grid = document.getElementById("healthGrid");
    try {
      const h = await this.api("/health");
      grid.innerHTML = `
        <div class="health-card">
          <div class="health-header">
            <span class="health-name">🖥️ Backend Express Server</span>
            <span class="health-badge connected">${this.escapeHtml(h.backend?.status)}</span>
          </div>
          <div class="health-details">
            <div class="health-row"><span class="health-key">Uptime</span><span class="health-val">${h.backend?.uptimeSeconds}s</span></div>
            <div class="health-row"><span class="health-key">Node.js Version</span><span class="health-val">${this.escapeHtml(h.backend?.nodeVersion)}</span></div>
            <div class="health-row"><span class="health-key">Platform</span><span class="health-val">${this.escapeHtml(h.backend?.platform)}</span></div>
            <div class="health-row"><span class="health-key">Memory (Heap / RSS)</span><span class="health-val">${h.backend?.memoryUsageMB?.heapUsed} MB / ${h.backend?.memoryUsageMB?.rss} MB</span></div>
          </div>
        </div>

        <div class="health-card">
          <div class="health-header">
            <span class="health-name">🗄️ Database Storage</span>
            <span class="health-badge ${h.database?.mode === "mongodb" ? "connected" : "fallback"}">${this.escapeHtml(h.database?.status)}</span>
          </div>
          <div class="health-details">
            <div class="health-row"><span class="health-key">Active Engine</span><span class="health-val">${this.escapeHtml(h.database?.label)}</span></div>
            <div class="health-row"><span class="health-key">Details</span><span class="health-val">${this.escapeHtml(h.database?.details)}</span></div>
          </div>
        </div>

        <div class="health-card">
          <div class="health-header">
            <span class="health-name">✨ Gemini AI Configuration</span>
            <span class="health-badge ${h.geminiApi?.configured ? "configured" : "not-configured"}">${this.escapeHtml(h.geminiApi?.status)}</span>
          </div>
          <div class="health-details">
            <div class="health-row"><span class="health-key">Primary Generation Model</span><span class="health-val">${this.escapeHtml(h.geminiApi?.primaryModel)}</span></div>
            <div class="health-row"><span class="health-key">Fallback Model</span><span class="health-val">${this.escapeHtml(h.geminiApi?.fallbackModel || "gemini-2.5-flash-lite")}</span></div>
            <div class="health-row"><span class="health-key">Embedding Model</span><span class="health-val">${this.escapeHtml(h.geminiApi?.embeddingModel)}</span></div>
          </div>
        </div>

        <div class="health-card">
          <div class="health-header">
            <span class="health-name">📄 Document & OCR Pipeline</span>
            <span class="health-badge available">${this.escapeHtml(h.pdfExtraction?.status)}</span>
          </div>
          <div class="health-details">
            <div class="health-row"><span class="health-key">PDF Parser</span><span class="health-val">${this.escapeHtml(h.pdfExtraction?.engine)}</span></div>
            <div class="health-row"><span class="health-key">OCR Engine</span><span class="health-val">${this.escapeHtml(h.ocrExtraction?.engine)}</span></div>
            <div class="health-row"><span class="health-key">RAG Engine</span><span class="health-val">${this.escapeHtml(h.ragEngine?.engine)}</span></div>
          </div>
        </div>
      `;
    } catch (err) {
      grid.innerHTML = `<div class="card-panel">Error loading health: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 9. AUDIT LOGS
  // ─────────────────────────────────────────────────────────────
  async loadAuditLogs() {
    const tbody = document.getElementById("auditTableBody");
    tbody.innerHTML = `<tr><td colspan="5">Loading audit logs...</td></tr>`;
    try {
      const data = await this.api("/audit-logs?limit=100");
      const logs = data.logs || [];
      if (!logs.length) {
        tbody.innerHTML = `<tr><td colspan="5">No audit logs recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(log => `
        <tr>
          <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted)">${this.formatDate(log.timestamp)}</td>
          <td>
            <div style="font-weight:600;color:#fff">${this.escapeHtml(log.adminUser?.name || "Admin")}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${this.escapeHtml(log.adminUser?.email || "")}</div>
          </td>
          <td><span class="badge badge-admin">${this.escapeHtml(log.action)}</span></td>
          <td style="color:#fff">${this.escapeHtml(log.affectedEntity)}</td>
          <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-sub)">
            ${this.escapeHtml(JSON.stringify(log.metadata || {}))}
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5">Error: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 10. LIVE DATABASE EXPLORER
  // ─────────────────────────────────────────────────────────────
  async loadDatabaseExplorer(forcedCol = null) {
    const selectEl = document.getElementById("dbCollectionSelect");
    const col = forcedCol || (selectEl ? selectEl.value : "users");
    if (selectEl && forcedCol) selectEl.value = forcedCol;

    const summaryBar = document.getElementById("dbCollectionsSummaryBar");
    const container = document.getElementById("dbRecordsContainer");
    container.innerHTML = `<div style="color:var(--text-sub)">Querying MongoDB collection <code>${this.escapeHtml(col)}</code>...</div>`;

    try {
      const data = await this.api(`/database?collection=${encodeURIComponent(col)}&limit=25`);
      const modeEl = document.getElementById("dbExplorerMode");
      if (modeEl) modeEl.textContent = data.mode || "MongoDB";

      if (summaryBar && Array.isArray(data.collections)) {
        summaryBar.innerHTML = data.collections.map(c => `
          <button
            type="button"
            class="btn-action"
            style="${c.id === data.activeCollection ? "border-color:var(--primary-blue);background:rgba(138,180,248,0.16);color:#fff;" : ""}"
            onclick="AdminApp.loadDatabaseExplorer('${c.id}')"
          >
            🗄️ <strong>${this.escapeHtml(c.id)}</strong> <span style="color:var(--primary-cyan);font-family:var(--font-mono);">(${c.count})</span>
          </button>
        `).join("");
      }

      const records = data.records || [];
      if (!records.length) {
        container.innerHTML = `<div style="padding:1rem;background:var(--bg-card);border-radius:8px;color:var(--text-muted);">No documents currently in collection <code>${this.escapeHtml(col)}</code>.</div>`;
        return;
      }

      container.innerHTML = records.map((rec, i) => `
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:0.9rem 1.1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.45rem;">
            <span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--primary-blue);font-weight:600;">
              ${this.escapeHtml(col)}[${i}] • _id: ${this.escapeHtml(rec._id || rec.key || "doc")}
            </span>
            <span style="font-family:var(--font-mono);font-size:0.74rem;color:var(--text-muted);">
              ${this.formatDate(rec.updatedAt || rec.createdAt || rec.timestamp)}
            </span>
          </div>
          <pre style="margin:0;padding:0.75rem;background:rgba(0,0,0,0.35);border-radius:6px;font-family:var(--font-mono);font-size:0.76rem;color:#e2e8f0;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${this.escapeHtml(JSON.stringify(rec, null, 2))}</pre>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger)">Error: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 11. SETTINGS
  // ─────────────────────────────────────────────────────────────
  async loadSettings() {
    const container = document.getElementById("settingsEnvSummary");
    try {
      const [health, rag] = await Promise.all([
        this.api("/health"),
        this.api("/rag")
      ]);

      container.innerHTML = `
        <div class="health-row"><span class="health-key">Storage Mode</span><span class="health-val">${this.escapeHtml(health.database?.label)} (${this.escapeHtml(health.database?.details)})</span></div>
        <div class="health-row"><span class="health-key">Gemini API Key Configured</span><span class="health-val">${health.geminiApi?.configured ? "Yes (Configured in Server Environment)" : "No (Fallback Mode)"}</span></div>
        <div class="health-row"><span class="health-key">Primary Generation Model</span><span class="health-val">${this.escapeHtml(rag.generationModel)}</span></div>
        <div class="health-row"><span class="health-key">Fallback Generation Model</span><span class="health-val">${this.escapeHtml(rag.generationFallbackModel)}</span></div>
        <div class="health-row"><span class="health-key">Primary Embedding Model</span><span class="health-val">${this.escapeHtml(rag.embeddingModel)} (${rag.embeddingDimension} dimensions)</span></div>
        <div class="health-row"><span class="health-key">Fallback Hash Embedding</span><span class="health-val">Deterministic Sin-Hash (${rag.fallbackDimension} dimensions)</span></div>
        <div class="health-row"><span class="health-key">Hybrid Retrieval Formula</span><span class="health-val">${this.escapeHtml(rag.hybridFormula)}</span></div>
        <div class="health-row"><span class="health-key">Subscription Policy Storage</span><span class="health-val">server/data/plan_config.json (Editable in Plans & Restrictions tab)</span></div>
        <div class="health-row"><span class="health-key">Admin Route Guard</span><span class="health-val">JWT Bearer Token + requireAdmin Middleware Enabled</span></div>
      `;
    } catch (err) {
      container.innerHTML = `<div>Error loading settings: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  openModal(title, bodyHtml) {
    document.getElementById("inspectModalTitle").textContent = title;
    document.getElementById("inspectModalBody").innerHTML = bodyHtml;
    document.getElementById("inspectModal").classList.add("show");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  AdminApp.init();
});
