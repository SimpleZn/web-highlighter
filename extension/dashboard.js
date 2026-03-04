document.addEventListener("DOMContentLoaded", () => {
  let allHighlights = [];
  let allStyles = [];
  let currentView = "dashboard";

  loadAllData();
  setupNavigation();
  setupSettings();

  function loadAllData() {
    chrome.storage.local.get(["highlights", "styles", "serverUrl"], (result) => {
      allHighlights = result.highlights || [];
      allStyles = result.styles || [];
      renderDashboard();
      renderAllHighlights();
      renderSettings(result.serverUrl || "");
    });
  }

  function setupNavigation() {
    document.querySelectorAll(".nav-item[data-view]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        switchView(link.dataset.view);
      });
    });

    document.getElementById("back-btn").addEventListener("click", () => {
      switchView("dashboard");
    });

    document.getElementById("search-input").addEventListener("input", (e) => {
      renderAllHighlights(e.target.value);
    });
  }

  function switchView(view) {
    currentView = view;
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    document.getElementById("view-" + view).classList.add("active");
    const navLink = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (navLink) navLink.classList.add("active");
  }

  function renderDashboard() {
    const pages = groupByPage(allHighlights);
    const pageCount = Object.keys(pages).length;
    const commentCount = allHighlights.filter((h) => h.comment).length;

    document.getElementById("stats-row").innerHTML = `
      <div class="stat-card">
        <div class="stat-icon pages">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
        </div>
        <div>
          <div class="stat-value">${pageCount}</div>
          <div class="stat-label">Pages</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon highlights">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
        </div>
        <div>
          <div class="stat-value">${allHighlights.length}</div>
          <div class="stat-label">Highlights</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon comments">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div>
          <div class="stat-value">${commentCount}</div>
          <div class="stat-label">Comments</div>
        </div>
      </div>
    `;

    const pagesList = document.getElementById("pages-list");
    const pagesEmpty = document.getElementById("pages-empty");

    if (pageCount === 0) {
      pagesList.style.display = "none";
      pagesEmpty.style.display = "flex";
      return;
    }

    pagesList.style.display = "grid";
    pagesEmpty.style.display = "none";
    pagesList.innerHTML = "";

    Object.entries(pages).forEach(([url, highlights]) => {
      const pageTitle = highlights[0].pageTitle || getDomain(url);
      const domain = getDomain(url);
      const commCount = highlights.filter((h) => h.comment).length;

      const card = document.createElement("div");
      card.className = "page-card";
      card.innerHTML = `
        <div class="page-card-header">
          <img class="page-favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32" alt="" onerror="this.style.display='none'">
          <span class="page-domain">${escapeHtml(domain)}</span>
        </div>
        <div class="page-title">${escapeHtml(pageTitle)}</div>
        <div class="page-stats">
          <span class="page-stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
            ${highlights.length}
          </span>
          ${commCount > 0 ? `
            <span class="page-stat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${commCount}
            </span>
          ` : ""}
        </div>
        <div class="page-previews">
          ${highlights.slice(0, 2).map((h) => `
            <div class="page-preview">
              <span class="page-preview-dot" style="background:${h.styleBackgroundColor || "#FFF59D"}"></span>
              <span class="page-preview-text">${escapeHtml(truncate(h.selectedText, 60))}</span>
            </div>
          `).join("")}
        </div>
      `;

      card.addEventListener("click", () => {
        openPageDetail(url, highlights);
      });

      pagesList.appendChild(card);
    });
  }

  function renderAllHighlights(query) {
    const list = document.getElementById("all-highlights-list");
    const empty = document.getElementById("highlights-empty");
    let filtered = allHighlights;

    if (query) {
      const q = query.toLowerCase();
      filtered = allHighlights.filter(
        (h) =>
          (h.selectedText && h.selectedText.toLowerCase().includes(q)) ||
          (h.comment && h.comment.toLowerCase().includes(q)) ||
          (h.url && h.url.toLowerCase().includes(q)) ||
          (h.pageTitle && h.pageTitle.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      list.style.display = "none";
      empty.style.display = "flex";
      return;
    }

    list.style.display = "flex";
    empty.style.display = "none";
    list.innerHTML = "";

    filtered.forEach((h) => {
      list.appendChild(createHighlightCard(h, true));
    });
  }

  function openPageDetail(url, highlights) {
    document.getElementById("detail-title").textContent = highlights[0].pageTitle || getDomain(url);
    document.getElementById("detail-url").textContent = url;

    const list = document.getElementById("detail-highlights");
    list.innerHTML = "";

    highlights.forEach((h) => {
      list.appendChild(createHighlightCard(h, false));
    });

    switchView("page-detail");
  }

  function createHighlightCard(h, showPage) {
    const card = document.createElement("div");
    card.className = "highlight-card";

    const bg = h.styleBackgroundColor || "#FFF59D";
    const styleName = h.styleName || "Highlight";
    const time = h.createdAt ? formatTime(h.createdAt) : "";

    card.innerHTML = `
      ${showPage ? `
        <div class="highlight-card-page">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
          ${escapeHtml(getDomain(h.url || ""))}
        </div>
      ` : ""}
      <div class="highlight-text-block" style="background:${bg}30; border-left: 3px solid ${bg}">
        ${escapeHtml(h.selectedText || "")}
      </div>
      <div class="highlight-meta">
        <span class="highlight-style-badge">
          <span class="highlight-style-dot" style="background:${bg}"></span>
          ${escapeHtml(styleName)}
        </span>
        ${time ? `<span class="highlight-time">${time}</span>` : ""}
        ${h.comment ? `<span class="highlight-comment-count">1 comment</span>` : ""}
      </div>
      ${h.comment ? `
        <div class="highlight-comments">
          <div class="highlight-comment-text">${renderMarkdown(h.comment)}</div>
        </div>
      ` : ""}
      <div class="highlight-actions">
        <button class="delete-btn" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    card.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "DELETE_HIGHLIGHT", id: h.id }, () => {
        allHighlights = allHighlights.filter((x) => x.id !== h.id);
        renderDashboard();
        renderAllHighlights(document.getElementById("search-input").value);
        showToast("Highlight deleted", "success");
      });
    });

    return card;
  }

  function setupSettings() {
    document.getElementById("btn-save-server").addEventListener("click", () => {
      const url = document.getElementById("settings-server-url").value.trim().replace(/\/$/, "");
      chrome.storage.local.set({ serverUrl: url }, () => {
        showToast("Server URL saved", "success");
      });
    });

    document.getElementById("btn-test-server").addEventListener("click", () => {
      const url = document.getElementById("settings-server-url").value.trim().replace(/\/$/, "");
      const statusEl = document.getElementById("server-status");
      if (!url) {
        statusEl.textContent = "Please enter a server URL";
        statusEl.className = "server-status error";
        statusEl.style.display = "block";
        return;
      }
      statusEl.textContent = "Testing...";
      statusEl.className = "server-status";
      statusEl.style.display = "block";

      fetch(url + "/api/styles")
        .then((r) => {
          if (r.ok) {
            statusEl.textContent = "Connected successfully!";
            statusEl.className = "server-status success";
          } else {
            statusEl.textContent = "Server returned error " + r.status;
            statusEl.className = "server-status error";
          }
        })
        .catch((err) => {
          statusEl.textContent = "Connection failed: " + err.message;
          statusEl.className = "server-status error";
        });
    });

    document.getElementById("btn-sync-up").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "SYNC_TO_SERVER" }, (result) => {
        if (result && result.success) {
          showToast(result.message || "Synced successfully", "success");
        } else {
          showToast(result?.error || "Sync failed", "error");
        }
      });
    });

    document.getElementById("btn-sync-down").addEventListener("click", () => {
      const url = document.getElementById("settings-server-url").value.trim().replace(/\/$/, "");
      if (!url) {
        showToast("Set a server URL first", "error");
        return;
      }
      fetch(url + "/api/styles")
        .then((r) => r.json())
        .then((styles) => {
          chrome.storage.local.set({ styles }, () => {
            allStyles = styles;
            renderSettings(url);
            showToast(`Synced ${styles.length} styles from server`, "success");
          });
        })
        .catch(() => showToast("Failed to sync styles", "error"));
    });

    document.getElementById("btn-export-data").addEventListener("click", () => {
      chrome.storage.local.get(null, (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `web-highlighter-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Data exported", "success");
      });
    });

    document.getElementById("btn-clear-data").addEventListener("click", () => {
      if (confirm("Are you sure you want to delete all highlights and comments? This cannot be undone.")) {
        chrome.storage.local.set({ highlights: [] }, () => {
          allHighlights = [];
          renderDashboard();
          renderAllHighlights();
          showToast("All data cleared", "success");
        });
      }
    });
  }

  function renderSettings(serverUrl) {
    document.getElementById("settings-server-url").value = serverUrl;

    const stylesList = document.getElementById("settings-styles-list");
    stylesList.innerHTML = "";

    allStyles.forEach((style) => {
      const row = document.createElement("div");
      row.className = "style-row";
      row.innerHTML = `
        <span class="style-swatch" style="background:${style.backgroundColor}"></span>
        <span class="style-name">${escapeHtml(style.name)}</span>
        ${style.isDefault ? '<span class="style-default-label">Default</span>' : ""}
      `;
      stylesList.appendChild(row);
    });

    if (allStyles.length === 0) {
      stylesList.innerHTML = '<div style="color:#94a3b8; font-size:13px; padding:8px 0;">No styles configured. Sync from server to load styles.</div>';
    }
  }

  function groupByPage(highlights) {
    const pages = {};
    highlights.forEach((h) => {
      if (!h.url) return;
      if (!pages[h.url]) pages[h.url] = [];
      pages[h.url].push(h);
    });
    return pages;
  }

  function getDomain(url) {
    try { return new URL(url).hostname; } catch { return url; }
  }

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  function formatTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre style="background:#f1f5f9;padding:6px 8px;border-radius:4px;overflow-x:auto;margin:4px 0;font-size:12px;"><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:12px;font-family:monospace;">$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, label, href) {
      if (/^https?:\/\/|^mailto:/i.test(href)) {
        return '<a href="' + href + '" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:underline;">' + label + '</a>';
      }
      return label;
    });
    html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote style="border-left:2px solid #cbd5e1;padding-left:8px;color:#64748b;margin:4px 0;font-style:italic;">$1</blockquote>');
    html = html.replace(/^#{3}\s+(.*)$/gm, '<strong style="font-size:13px;">$1</strong>');
    html = html.replace(/^#{2}\s+(.*)$/gm, '<strong style="font-size:14px;">$1</strong>');
    html = html.replace(/^#{1}\s+(.*)$/gm, '<strong style="font-size:15px;">$1</strong>');
    var lines = html.split("\n");
    var out = [];
    var inUl = false;
    var inOl = false;
    for (var i = 0; i < lines.length; i++) {
      var ulMatch = lines[i].match(/^[-*]\s+(.*)/);
      var olMatch = lines[i].match(/^\d+\.\s+(.*)/);
      if (ulMatch) {
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (!inUl) { out.push('<ul style="margin:4px 0;padding-left:20px;">'); inUl = true; }
        out.push("<li>" + ulMatch[1] + "</li>");
      } else if (olMatch) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (!inOl) { out.push('<ol style="margin:4px 0;padding-left:20px;">'); inOl = true; }
        out.push("<li>" + olMatch[1] + "</li>");
      } else {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (inOl) { out.push("</ol>"); inOl = false; }
        out.push(lines[i]);
      }
    }
    if (inUl) out.push("</ul>");
    if (inOl) out.push("</ol>");
    html = out.join("\n");
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function showToast(message, type) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "toast " + type;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 3000);
  }
});
