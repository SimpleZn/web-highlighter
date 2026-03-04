document.addEventListener("DOMContentLoaded", () => {
  let currentStyleIndex = 0;

  loadData();
  setupListeners();

  function loadData() {
    chrome.storage.local.get(["highlights", "styles", "enabled"], (result) => {
      const highlights = result.highlights || [];
      const styles = result.styles || [];
      const enabled = result.enabled !== false;

      document.getElementById("toggle-enabled").checked = enabled;

      const totalCount = highlights.length;
      const commentCount = highlights.filter((h) => h.comment).length;
      document.getElementById("total-count").textContent = totalCount;
      document.getElementById("comment-count").textContent = commentCount;

      renderStyles(styles);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0]?.url || "";
        const pageHighlights = highlights.filter((h) => h.url === currentUrl);
        document.getElementById("page-count").textContent = pageHighlights.length;
        document.getElementById("page-badge").textContent = pageHighlights.length;
        renderHighlights(pageHighlights);
      });
    });
  }

  function renderStyles(styles) {
    const grid = document.getElementById("styles-grid");
    grid.innerHTML = "";
    styles.forEach((style, index) => {
      const chip = document.createElement("button");
      chip.className = `style-chip ${style.isDefault || index === currentStyleIndex ? "active" : ""}`;
      chip.innerHTML = `<span class="style-dot" style="background-color: ${style.backgroundColor}"></span>${style.name}`;
      chip.addEventListener("click", () => {
        currentStyleIndex = index;
        grid.querySelectorAll(".style-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "SET_STYLE_INDEX", index });
          }
        });
      });
      grid.appendChild(chip);
    });
  }

  function renderHighlights(highlights) {
    const list = document.getElementById("highlights-list");
    const empty = document.getElementById("empty-state");

    if (highlights.length === 0) {
      list.style.display = "none";
      empty.style.display = "flex";
      return;
    }

    list.style.display = "flex";
    empty.style.display = "none";
    list.innerHTML = "";

    highlights.forEach((h) => {
      const item = document.createElement("div");
      item.className = "highlight-item";
      item.innerHTML = `
        <div class="highlight-color-bar" style="background-color: ${h.styleBackgroundColor || "#FFF59D"}"></div>
        <div class="highlight-content">
          <div class="highlight-text">${escapeHtml(h.selectedText)}</div>
          ${h.comment ? `<div class="highlight-comment">${escapeHtml(h.comment)}</div>` : ""}
        </div>
        <button class="highlight-delete" data-id="${h.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll(".highlight-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        chrome.runtime.sendMessage({ type: "DELETE_HIGHLIGHT", id }, () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(tabs[0].id, { type: "REMOVE_HIGHLIGHT_FROM_PAGE", id });
            }
          });
          loadData();
        });
      });
    });
  }

  function setupListeners() {
    document.getElementById("toggle-enabled").addEventListener("change", (e) => {
      const enabled = e.target.checked;
      chrome.storage.local.set({ enabled });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE", enabled });
        }
      });
    });

    document.getElementById("btn-sync").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "SYNC_TO_SERVER" }, (result) => {
        if (result && result.success) {
          showToast(result.message || "Synced successfully", "success");
        } else {
          showToast(result?.error || "Sync failed", "error");
        }
      });
    });

    document.getElementById("btn-dashboard").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    });

    document.getElementById("btn-settings").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  function showToast(message, type) {
    const existing = document.querySelector(".status-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `status-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
