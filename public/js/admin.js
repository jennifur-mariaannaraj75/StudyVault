/**
 * StudyVault Administration Console Frontend Controller
 * Strictly authenticated via Bearer JWT and verified against requireAdmin
 */

const AdminApp = {
  currentUser: null,
  token: null,
  activeTab: "overview",

  allUsers: [],
  allNotebooks: [],
  allDocuments: [],
  allAuditLogs: [],

  async init() {
    this.token = localStorage.getItem("studyvault_token");
    if (!this.token) {
      this.showShield(
        "Authentication Required",
        "HTTP 401 UNAUTHORIZED",
        "You must be signed in with an administrator account to access the StudyVault Console.",
        "Sign In to StudyVault",
        "/"
      );
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!res.ok) {
        throw new Error("Invalid session token.");
      }

      const data = await res.json();
      const user = data.user;

      if (!user || user.role !== "admin") {
        this.showShield(
          "Access Denied",
          "HTTP 403 FORBIDDEN",
          `Your account (${user ? user.email : "anonymous"}) does not possess administrator privileges. All unauthorized access attempts are recorded in the audit log.`,
          "Return to Student Workspace",
          "/"
        );
        return;
      }

      this.currentUser = user;
      this.showAdminLayout();
      this.bindEvents();
      this.loadOverview();
    } catch (err) {
      this.showShield(
        "Session Expired",
        "HTTP 401 UNAUTHORIZED",
        "Your authentication session is invalid or expired. Please sign in again.",
        "Sign In",
        "/"
      );
    }
  },

  showShield(title, code, desc, btnText, btnHref) {
    document.getElementById("authShield").classList.add("visible");
    document.getElementById("adminLayout").classList.remove("visible");
    document.getElementById("shieldTitle").textContent = title;
    document.getElementById("shieldCode").textContent = code;
    document.getElementById("shieldDesc").textContent = desc;
    const btn = document.getElementById("shieldBtn");
    btn.textContent = btnText;
    btn.href = btnHref;
  },

  showAdminLayout() {
    document.getElementById("authShield").classList.remove("visible");
    document.getElementById("adminLayout").classList.add("visible");

    // Populate admin user info
    const nameEl = document.getElementById("topbarAdminName");
    const avatarEl = document.getElementById("topbarAdminAvatar");
    if (nameEl) nameEl.textContent = this.currentUser.name || "Administrator";
    if (avatarEl) avatarEl.textContent = (this.currentUser.name || "A")[0].toUpperCase();
  },

  async api(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.token}`,
      ...(options.headers || {})
    };

    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        this.showShield(
          "Session Expired",
          "HTTP 401 UNAUTHORIZED",
          "Your admin session expired. Please sign in again.",
          "Sign In",
          "/"
        );
      } else if (res.status === 403) {
        this.showToast(data.error || "HTTP 403: Forbidden - Admin permission denied.");
      }
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  },

  bindEvents() {
    // Navigation items
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Logout
    const logoutBtn = document.getElementById("adminLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("studyvault_token");
        localStorage.removeItem("studyvault_user");
        window.location.href = "/";
      });
    }

    // Search inputs
    const userSearch = document.getElementById("usersSearchInput");
    if (userSearch) userSearch.addEventListener("input", () => this.filterUsers());

    const userRoleFilter = document.getElementById("usersRoleFilter");
    if (userRoleFilter) userRoleFilter.addEventListener("change", () => this.filterUsers());

    const userStatusFilter = document.getElementById("usersStatusFilter");
    if (userStatusFilter) userStatusFilter.addEventListener("change", () => this.filterUsers());

    const nbSearch = document.getElementById("notebooksSearchInput");
    if (nbSearch) nbSearch.addEventListener("input", () => this.filterNotebooks());

    const docsSearch = document.getElementById("docsSearchInput");
    if (docsSearch) docsSearch.addEventListener("input", () => this.filterDocs());

    const docsStatusFilter = document.getElementById("docsStatusFilter");
    if (docsStatusFilter) docsStatusFilter.addEventListener("change", () => this.filterDocs());
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    document.querySelectorAll(".admin-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === `section-${tabId}`);
    });

    const titles = {
      overview: "System Overview",
      users: "Users Management",
      notebooks: "Notebooks Directory",
      documents: "Document Storage & Ingestion",
      analytics: "System Analytics",
      health: "System Health & Runtime",
      audit: "Administrative Audit Logs",
      settings: "Platform Configuration"
    };

    const titleEl = document.getElementById("currentSectionTitle");
    if (titleEl) titleEl.textContent = titles[tabId] || "Administration";

    if (tabId === "overview") this.loadOverview();
    else if (tabId === "users") this.loadUsers();
    else if (tabId === "notebooks") this.loadNotebooks();
    else if (tabId === "documents") this.loadDocuments();
    else if (tabId === "analytics") this.loadAnalytics();
    else if (tabId === "health") this.loadHealth();
    else if (tabId === "audit") this.loadAuditLogs();
    else if (tabId === "settings") this.loadSettings();
  },

  // ── 1. OVERVIEW ──
  async loadOverview() {
    try {
      const data = await this.api("/admin/stats");

      document.getElementById("statTotalUsers").textContent = data.userCount ?? 0;
      document.getElementById("statTotalNotebooks").textContent = data.notebookCount ?? 0;
      document.getElementById("statTotalDocs").textContent = data.documentCount ?? 0;
      const notesEl = document.getElementById("statTotalNotes");
      if (notesEl) notesEl.textContent = data.notesCount ?? 0;
      document.getElementById("statTotalMessages").textContent = data.messageCount ?? 0;

      const totalArtifacts = (data.flashcardsCount ?? 0) + (data.quizCount ?? 0);
      document.getElementById("statTotalArtifacts").textContent = totalArtifacts;
      document.getElementById("statArtifactsBreakdown").textContent = `${data.flashcardsCount ?? 0} flashcard decks, ${data.quizCount ?? 0} practice quizzes`;

      const storageBadge = document.getElementById("topbarStorageBadge");
      if (storageBadge) {
        const isMongo = data.storageMode && data.storageMode.includes("MongoDB");
        storageBadge.textContent = isMongo ? "MongoDB Active" : "Storage Active";
        storageBadge.className = `storage-pill ${isMongo ? "mongo" : "local"}`;
      }

      // Recent users table
      const recentUsersBody = document.getElementById("overviewRecentUsersBody");
      if (recentUsersBody) {
        if (!data.recentUsers || !data.recentUsers.length) {
          recentUsersBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No users found.</td></tr>`;
        } else {
          recentUsersBody.innerHTML = data.recentUsers.map(u => `
            <tr>
              <td>
                <div style="font-weight:600;color:#fff;">${this.escape(u.name || "Student")}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${this.escape(u.email)}</div>
              </td>
              <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'user'}">${u.role}</span></td>
              <td style="color:var(--text-muted);font-size:0.78rem;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
            </tr>
          `).join("");
        }
      }

      // Recent documents table
      const recentDocsBody = document.getElementById("overviewRecentDocsBody");
      if (recentDocsBody) {
        if (!data.recentDocuments || !data.recentDocuments.length) {
          recentDocsBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No documents uploaded yet.</td></tr>`;
        } else {
          recentDocsBody.innerHTML = data.recentDocuments.map(d => `
            <tr>
              <td>
                <div style="font-weight:600;color:#fff;">${this.escape(d.filename)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${d.pageCount} pages</div>
              </td>
              <td style="font-family:var(--font-mono);font-size:0.8rem;">${d.chunkCount} chunks</td>
              <td><span class="badge badge-${d.status}">${d.status}</span></td>
            </tr>
          `).join("");
        }
      }
    } catch (err) {
      this.showToast("Failed to load overview statistics.");
    }
  },

  // ── 2. USERS ──
  async loadUsers() {
    try {
      const data = await this.api("/admin/users");
      this.allUsers = data.users || [];
      this.renderUsers(this.allUsers);
    } catch (err) {
      this.showToast("Failed to load users list.");
    }
  },

  filterUsers() {
    const q = (document.getElementById("usersSearchInput")?.value || "").toLowerCase().trim();
    const role = document.getElementById("usersRoleFilter")?.value || "all";
    const status = document.getElementById("usersStatusFilter")?.value || "all";

    const filtered = this.allUsers.filter(u => {
      const matchesQ = !q || (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
      const matchesRole = role === "all" || u.role === role;
      const matchesStatus = status === "all" || (u.status || "active") === status;
      return matchesQ && matchesRole && matchesStatus;
    });

    this.renderUsers(filtered);
  },

  renderUsers(users) {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">No matching users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isSelf = this.currentUser && String(u._id) === String(this.currentUser.id);
      const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—";
      const status = u.status || "active";

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:#fff;">${this.escape(u.name || "Student")} ${isSelf ? '<span style="font-size:0.7rem;color:var(--primary-cyan)">(You)</span>' : ''}</div>
          </td>
          <td style="color:var(--text-sub);font-family:var(--font-mono);font-size:0.8rem;">${this.escape(u.email)}</td>
          <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'user'}">${u.role}</span></td>
          <td><span class="badge badge-${status}">${status}</span></td>
          <td style="font-family:var(--font-mono);">${u.notebookCount || 0}</td>
          <td style="color:var(--text-muted);font-size:0.78rem;">${joined}</td>
          <td style="text-align: right;">
            <div class="btn-action-group" style="justify-content: flex-end;">
              <button class="btn-action" onclick="AdminApp.viewUser('${u._id}')">Inspect</button>
              ${!isSelf ? `
                <button class="btn-action" onclick="AdminApp.promptChangeRole('${u._id}', '${u.role}', '${this.escape(u.name || u.email)}')">
                  ${u.role === 'admin' ? 'Demote' : 'Promote'}
                </button>
                <button class="btn-action" onclick="AdminApp.promptToggleStatus('${u._id}', '${status}', '${this.escape(u.name || u.email)}')">
                  ${status === 'active' ? 'Disable' : 'Enable'}
                </button>
                <button class="btn-action danger" onclick="AdminApp.promptDeleteUser('${u._id}', '${this.escape(u.name || u.email)}')">
                  Delete
                </button>
              ` : `
                <span style="font-size:0.75rem;color:var(--text-muted);padding:0 0.5rem;">Current Admin</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  async viewUser(userId) {
    try {
      const data = await this.api(`/admin/users/${userId}`);
      const user = data.user;
      const nbs = user.notebooks || [];

      document.getElementById("userModalTitle").textContent = `User: ${user.name || user.email}`;
      document.getElementById("userModalBody").innerHTML = `
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;background:var(--bg-card);padding:1rem;border-radius:8px;">
            <div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Name</span><strong style="color:#fff;">${this.escape(user.name || "—")}</strong></div>
            <div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Email</span><strong style="color:#fff;">${this.escape(user.email)}</strong></div>
            <div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Role</span><span class="badge badge-${user.role}">${user.role}</span></div>
            <div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Status</span><span class="badge badge-${user.status || 'active'}">${user.status || 'active'}</span></div>
            <div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">Joined</span><strong style="color:#fff;">${user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</strong></div>
            <div><span style="color:var(--text-muted);display:block;font-size:0.75rem;">User ID</span><span style="font-family:var(--font-mono);font-size:0.75rem;">${user._id}</span></div>
          </div>

          <div>
            <h4 style="color:#fff;font-size:0.9rem;margin-bottom:0.5rem;">Owned Notebooks (${nbs.length})</h4>
            <div class="table-responsive">
              <table class="admin-table">
                <thead><tr><th>Title</th><th>Created</th></tr></thead>
                <tbody>
                  ${!nbs.length ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No notebooks owned.</td></tr>' : nbs.map(n => `
                    <tr>
                      <td style="font-weight:600;color:#fff;">${this.escape(n.title)}</td>
                      <td style="color:var(--text-muted);font-size:0.75rem;">${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      this.openModal("userModal");
    } catch (err) {
      this.showToast(err.message);
    }
  },

  promptChangeRole(userId, currentRole, name) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    this.confirmAction(
      `Change Role for ${name}`,
      `Are you sure you want to change ${name}'s role from "${currentRole}" to "${newRole}"?`,
      async () => {
        try {
          await this.api(`/admin/users/${userId}/role`, {
            method: "PATCH",
            body: JSON.stringify({ role: newRole })
          });
          this.showToast(`User role updated to ${newRole}.`);
          await this.loadUsers();
        } catch (err) {
          this.showToast(err.message);
        }
      }
    );
  },

  promptToggleStatus(userId, currentStatus, name) {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    this.confirmAction(
      `${newStatus === "disabled" ? "Disable" : "Enable"} Account: ${name}`,
      `Are you sure you want to set ${name}'s account status to "${newStatus}"?`,
      async () => {
        try {
          await this.api(`/admin/users/${userId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus })
          });
          this.showToast(`Account status set to ${newStatus}.`);
          await this.loadUsers();
        } catch (err) {
          this.showToast(err.message);
        }
      }
    );
  },

  promptDeleteUser(userId, name) {
    this.confirmAction(
      `Delete User: ${name}`,
      `⚠️ Warning: This will permanently delete user "${name}" and cascade delete all their notebooks, documents, messages, and study notes. This action cannot be undone.`,
      async () => {
        try {
          await this.api(`/admin/users/${userId}`, { method: "DELETE" });
          this.showToast("User and associated data deleted successfully.");
          await this.loadUsers();
        } catch (err) {
          this.showToast(err.message);
        }
      }
    );
  },

  // ── 3. NOTEBOOKS ──
  async loadNotebooks() {
    try {
      const data = await this.api("/admin/notebooks");
      this.allNotebooks = data.notebooks || [];
      this.renderNotebooks(this.allNotebooks);
    } catch (err) {
      this.showToast("Failed to load notebooks list.");
    }
  },

  filterNotebooks() {
    const q = (document.getElementById("notebooksSearchInput")?.value || "").toLowerCase().trim();
    const filtered = this.allNotebooks.filter(n => {
      const titleMatches = n.title && n.title.toLowerCase().includes(q);
      const ownerMatches = n.owner && ((n.owner.name && n.owner.name.toLowerCase().includes(q)) || (n.owner.email && n.owner.email.toLowerCase().includes(q)));
      return !q || titleMatches || ownerMatches;
    });
    this.renderNotebooks(filtered);
  },

  renderNotebooks(notebooks) {
    const tbody = document.getElementById("notebooksTableBody");
    if (!tbody) return;

    if (!notebooks.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">No matching notebooks found.</td></tr>`;
      return;
    }

    tbody.innerHTML = notebooks.map(n => {
      const ownerName = n.owner ? n.owner.name : "System / Guest";
      const ownerEmail = n.owner ? n.owner.email : "guest@local";
      const updated = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : "—";
      const created = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : "—";

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:#fff;">${this.escape(n.title || "Untitled notebook")}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escape(n.description || "No description")}</div>
          </td>
          <td>
            <div style="color:var(--text-main);font-size:0.85rem;">${this.escape(ownerName)}</div>
            <div style="color:var(--text-muted);font-size:0.75rem;">${this.escape(ownerEmail)}</div>
          </td>
          <td style="font-family:var(--font-mono);">${n.documentCount ?? 0} docs</td>
          <td style="font-family:var(--font-mono);">${n.messageCount ?? 0} msgs</td>
          <td style="color:var(--text-muted);font-size:0.78rem;">${updated}</td>
          <td style="color:var(--text-muted);font-size:0.78rem;">${created}</td>
          <td style="text-align: right;">
            <div class="btn-action-group" style="justify-content: flex-end;">
              <button class="btn-action" onclick="AdminApp.viewNotebook('${n._id}')">Inspect</button>
              <button class="btn-action danger" onclick="AdminApp.promptDeleteNotebook('${n._id}', '${this.escape(n.title)}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  async viewNotebook(notebookId) {
    try {
      const data = await this.api(`/admin/notebooks/${notebookId}`);
      const nb = data.notebook;
      const docs = nb.documents || [];

      document.getElementById("notebookModalTitle").textContent = `Notebook: ${nb.title}`;
      document.getElementById("notebookModalBody").innerHTML = `
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <div style="background:var(--bg-card);padding:1rem;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Title</span><strong style="color:#fff;">${this.escape(nb.title)}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Owner</span><strong style="color:#fff;">${this.escape(nb.owner?.name || "System")} (${this.escape(nb.owner?.email || "")})</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Documents</span><strong style="color:#fff;">${nb.documentCount}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Chat Messages</span><strong style="color:#fff;">${nb.messageCount}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Pinboard Notes</span><strong style="color:#fff;">${nb.noteCount ?? 0}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Generated Artifacts</span><strong style="color:#fff;">${(nb.artifacts || []).length}</strong></div>
          </div>

          <div>
            <h4 style="color:#fff;font-size:0.9rem;margin-bottom:0.5rem;">Associated Documents (${docs.length})</h4>
            <div class="table-responsive">
              <table class="admin-table">
                <thead><tr><th>Filename</th><th>Pages</th><th>Chunks</th><th>Status</th></tr></thead>
                <tbody>
                  ${!docs.length ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No documents in this notebook.</td></tr>' : docs.map(d => `
                    <tr>
                      <td style="font-weight:600;color:#fff;">${this.escape(d.filename)}</td>
                      <td style="font-family:var(--font-mono);font-size:0.8rem;">${d.pageCount}</td>
                      <td style="font-family:var(--font-mono);font-size:0.8rem;">${d.chunkCount}</td>
                      <td><span class="badge badge-${d.status}">${d.status}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      this.openModal("notebookModal");
    } catch (err) {
      this.showToast(err.message);
    }
  },

  promptDeleteNotebook(notebookId, title) {
    this.confirmAction(
      `Delete Notebook: "${title}"`,
      `Are you sure you want to delete this notebook? All uploaded documents, messages, and study notes in this notebook will be permanently removed.`,
      async () => {
        try {
          await this.api(`/admin/notebooks/${notebookId}`, { method: "DELETE" });
          this.showToast("Notebook deleted successfully.");
          await this.loadNotebooks();
        } catch (err) {
          this.showToast(err.message);
        }
      }
    );
  },

  // ── 4. DOCUMENTS ──
  async loadDocuments() {
    try {
      const data = await this.api("/admin/documents");
      this.allDocuments = data.documents || [];
      this.renderDocuments(this.allDocuments);
    } catch (err) {
      this.showToast("Failed to load documents list.");
    }
  },

  filterDocs() {
    const q = (document.getElementById("docsSearchInput")?.value || "").toLowerCase().trim();
    const status = document.getElementById("docsStatusFilter")?.value || "all";

    const filtered = this.allDocuments.filter(d => {
      const matchQ = !q || (d.filename && d.filename.toLowerCase().includes(q)) || (d.notebookTitle && d.notebookTitle.toLowerCase().includes(q));
      const matchStatus = status === "all" || d.status === status;
      return matchQ && matchStatus;
    });

    this.renderDocuments(filtered);
  },

  renderDocuments(documents) {
    const tbody = document.getElementById("docsTableBody");
    if (!tbody) return;

    if (!documents.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">No matching documents found.</td></tr>`;
      return;
    }

    tbody.innerHTML = documents.map(d => {
      const created = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—";
      const ownerName = d.owner ? d.owner.name : "Student";

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:#fff;">${this.escape(d.filename)}</div>
          </td>
          <td style="color:var(--text-sub);">${this.escape(d.notebookTitle || "—")}</td>
          <td style="color:var(--text-muted);font-size:0.8rem;">${this.escape(ownerName)}</td>
          <td style="font-family:var(--font-mono);">${d.pageCount || 0}</td>
          <td><span class="badge badge-${d.status}">${d.status}</span></td>
          <td style="color:var(--text-muted);font-size:0.78rem;">${created}</td>
          <td style="text-align: right;">
            <div class="btn-action-group" style="justify-content: flex-end;">
              <button class="btn-action" onclick="AdminApp.viewDocument('${d._id}')">Inspect</button>
              <button class="btn-action danger" onclick="AdminApp.promptDeleteDocument('${d._id}', '${this.escape(d.filename)}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  async viewDocument(docId) {
    try {
      const data = await this.api(`/admin/documents/${docId}`);
      const doc = data.document;

      document.getElementById("docModalTitle").textContent = `Document: ${doc.filename}`;
      document.getElementById("docModalBody").innerHTML = `
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <div style="background:var(--bg-card);padding:1rem;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Filename</span><strong style="color:#fff;">${this.escape(doc.filename)}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Notebook</span><strong style="color:#fff;">${this.escape(doc.notebookTitle)}</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Owner</span><strong style="color:#fff;">${this.escape(doc.owner?.name || "Student")} (${this.escape(doc.owner?.email || "")})</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Status</span><span class="badge badge-${doc.status}">${doc.status}</span></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Page Count</span><strong style="color:#fff;">${doc.pageCount} pages</strong></div>
            <div><span style="color:var(--text-muted);font-size:0.75rem;display:block;">Created</span><strong style="color:#fff;">${doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}</strong></div>
          </div>

          ${doc.keyTopics && doc.keyTopics.length ? `
            <div>
              <h4 style="color:#fff;font-size:0.85rem;margin-bottom:0.35rem;">Extracted Key Topics</h4>
              <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
                ${doc.keyTopics.map(t => `<span class="badge" style="background:rgba(255,255,255,0.06);color:var(--primary-cyan);">${this.escape(t)}</span>`).join("")}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      this.openModal("docModal");
    } catch (err) {
      this.showToast(err.message);
    }
  },

  promptDeleteDocument(docId, filename) {
    this.confirmAction(
      `Delete Document: "${filename}"`,
      `Are you sure you want to delete this document? The file text, pages, and embedding chunks will be permanently deleted.`,
      async () => {
        try {
          await this.api(`/admin/documents/${docId}`, { method: "DELETE" });
          this.showToast("Document deleted successfully.");
          await this.loadDocuments();
        } catch (err) {
          this.showToast(err.message);
        }
      }
    );
  },

  // ── 5. ANALYTICS ──
  async loadAnalytics() {
    try {
      const data = await this.api("/admin/analytics");

      const uEl = document.getElementById("analyticsTotalUsers");
      if (uEl) uEl.textContent = (data.totalUsers || 0).toLocaleString();
      const nEl = document.getElementById("analyticsTotalNotebooks");
      if (nEl) nEl.textContent = (data.totalNotebooks || 0).toLocaleString();
      const dEl = document.getElementById("analyticsTotalDocs");
      if (dEl) dEl.textContent = (data.totalDocuments || 0).toLocaleString();

      const readyCount = data.documentStatusBreakdown?.ready || 0;
      const totalDocs = data.totalDocuments || 0;
      const pct = totalDocs > 0 ? Math.round((readyCount / totalDocs) * 100) : 100;
      const rEl = document.getElementById("analyticsReadyPct");
      if (rEl) rEl.textContent = `${pct}% (${readyCount}/${totalDocs})`;

      // Users over time
      const usersBody = document.getElementById("analyticsUsersTimeBody");
      if (usersBody) {
        const uList = data.usersOverTime || [];
        if (!uList.length) {
          usersBody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);">No timeline data.</td></tr>`;
        } else {
          usersBody.innerHTML = uList.map(item => `
            <tr>
              <td style="font-family:var(--font-mono);">${item.date}</td>
              <td style="font-weight:600;color:var(--primary-blue);">${item.count}</td>
            </tr>
          `).join("");
        }
      }

      // Docs over time
      const docsBody = document.getElementById("analyticsDocsTimeBody");
      if (docsBody) {
        const dList = data.documentsOverTime || [];
        if (!dList.length) {
          docsBody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);">No timeline data.</td></tr>`;
        } else {
          docsBody.innerHTML = dList.map(item => `
            <tr>
              <td style="font-family:var(--font-mono);">${item.date}</td>
              <td style="font-weight:600;color:var(--success);">${item.count}</td>
            </tr>
          `).join("");
        }
      }
    } catch (err) {
      this.showToast("Failed to load analytics.");
    }
  },

  // ── 6. SYSTEM HEALTH ──
  async loadHealth() {
    try {
      const data = await this.api("/admin/health");

      const uptimeSec = data.backend?.uptimeSeconds || 0;
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const utEl = document.getElementById("healthUptime");
      if (utEl) utEl.textContent = `${hours}h ${mins}m`;

      const dbModeEl = document.getElementById("healthDbMode");
      if (dbModeEl) dbModeEl.textContent = data.database?.label || "Database Connected";

      const dbBadge = document.getElementById("healthDbBadge");
      if (dbBadge) {
        dbBadge.textContent = data.database?.status || "Connected";
        dbBadge.className = `health-badge ${data.database?.mode === 'mongodb' ? 'connected' : 'fallback'}`;
      }

      const geminiBadge = document.getElementById("healthGeminiBadge");
      if (geminiBadge) {
        geminiBadge.textContent = data.geminiApi?.status || "Configured";
        geminiBadge.className = `health-badge ${data.geminiApi?.configured ? 'configured' : 'not-configured'}`;
      }
      const modelEl = document.getElementById("healthGeminiModel");
      if (modelEl) modelEl.textContent = data.geminiApi?.primaryModel || "gemini-3.8-flash";
    } catch (err) {
      this.showToast("Failed to load system health.");
    }
  },

  // ── 7. SETTINGS ──
  async loadSettings() {
    try {
      const res = await fetch("/api/auth/config");
      if (res.ok) {
        const cfg = await res.json();
        const cidEl = document.getElementById("settingsGoogleClientIdDisplay");
        if (cidEl) {
          cidEl.textContent = cfg.googleClientId ? cfg.googleClientId : "Not configured in environment";
        }
      }
    } catch (e) {
      // quiet fallback
    }
  },

  // ── 8. AUDIT LOGS ──
  async loadAuditLogs() {
    try {
      const data = await this.api("/admin/audit-logs?limit=50");
      this.allAuditLogs = data.logs || [];
      this.renderAuditLogs(this.allAuditLogs);
    } catch (err) {
      this.showToast("Failed to load audit logs.");
    }
  },

  renderAuditLogs(logs) {
    const tbody = document.getElementById("auditTableBody");
    if (!tbody) return;

    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem;">No administrative audit events recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const time = l.timestamp ? new Date(l.timestamp).toLocaleString() : "—";
      const adminEmail = l.adminUser ? l.adminUser.email : "system";
      const metaStr = l.metadata ? JSON.stringify(l.metadata) : "{}";

      return `
        <tr>
          <td style="color:var(--text-muted);font-size:0.78rem;font-family:var(--font-mono);">${time}</td>
          <td style="color:var(--text-main);font-weight:600;">${this.escape(adminEmail)}</td>
          <td><span class="badge" style="background:rgba(255,255,255,0.06);color:var(--primary-cyan);font-family:var(--font-mono);">${this.escape(l.action)}</span></td>
          <td style="color:var(--text-sub);">${this.escape(l.affectedEntity)}</td>
          <td><code style="font-size:0.72rem;color:var(--text-muted);">${this.escape(metaStr)}</code></td>
        </tr>
      `;
    }).join("");
  },

  // ── MODALS & HELPERS ──
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add("show");
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove("show");
  },

  confirmAction(title, desc, onConfirm) {
    document.getElementById("confirmModalTitle").textContent = title;
    document.getElementById("confirmModalDesc").textContent = desc;

    const btn = document.getElementById("confirmModalActionBtn");
    // Clone button to strip old listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", async () => {
      this.closeModal("confirmModal");
      await onConfirm();
    });

    this.openModal("confirmModal");
  },

  showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  },

  escape(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  AdminApp.init();
});
