document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  setupListeners();

  function loadSettings() {
    chrome.storage.local.get(["serverUrl", "styles", "highlights"], (result) => {
      document.getElementById("server-url").value = result.serverUrl || "";
      renderStyles(result.styles || []);
      renderDataStats(result.highlights || []);
    });
  }

  function renderStyles(styles) {
    const list = document.getElementById("styles-list");
    list.innerHTML = "";

    styles.forEach((style, index) => {
      const row = document.createElement("div");
      row.className = "style-row";
      row.innerHTML = `
        <div class="style-color-preview" style="background-color: ${style.backgroundColor}"></div>
        <span class="style-name">${escapeHtml(style.name)}</span>
        ${style.isDefault ? '<span class="style-default-badge">Default</span>' : ""}
        ${!style.isDefault ? `<button class="style-action-btn default-btn" data-index="${index}">Set Default</button>` : ""}
        <button class="style-action-btn delete-btn" data-index="${index}">Delete</button>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll(".default-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        chrome.storage.local.get(["styles"], (result) => {
          const updated = (result.styles || []).map((s, i) => ({ ...s, isDefault: i === idx }));
          chrome.storage.local.set({ styles: updated }, () => {
            loadSettings();
            showToast("Default style updated", "success");
          });
        });
      });
    });

    list.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        chrome.storage.local.get(["styles"], (result) => {
          const styles = result.styles || [];
          if (styles.length <= 1) {
            showToast("Cannot delete the last style", "error");
            return;
          }
          styles.splice(idx, 1);
          if (!styles.some((s) => s.isDefault) && styles.length > 0) {
            styles[0].isDefault = true;
          }
          chrome.storage.local.set({ styles }, () => {
            loadSettings();
            showToast("Style deleted", "success");
          });
        });
      });
    });
  }

  function renderDataStats(highlights) {
    const stats = document.getElementById("data-stats");
    const pages = new Set(highlights.map((h) => h.url)).size;
    const comments = highlights.filter((h) => h.comment).length;
    const unsynced = highlights.filter((h) => !h.synced).length;

    stats.innerHTML = `
      <div class="data-stat">
        <span class="data-stat-value">${highlights.length}</span>
        <span class="data-stat-label">Highlights</span>
      </div>
      <div class="data-stat">
        <span class="data-stat-value">${pages}</span>
        <span class="data-stat-label">Pages</span>
      </div>
      <div class="data-stat">
        <span class="data-stat-value">${comments}</span>
        <span class="data-stat-label">Comments</span>
      </div>
      <div class="data-stat">
        <span class="data-stat-value">${unsynced}</span>
        <span class="data-stat-label">Unsynced</span>
      </div>
    `;
  }

  function setupListeners() {
    document.getElementById("btn-save-url").addEventListener("click", () => {
      const url = document.getElementById("server-url").value.trim().replace(/\/$/, "");
      chrome.storage.local.set({ serverUrl: url }, () => {
        showToast("Server URL saved", "success");
      });
    });

    document.getElementById("btn-test-url").addEventListener("click", async () => {
      const url = document.getElementById("server-url").value.trim().replace(/\/$/, "");
      const status = document.getElementById("connection-status");
      status.style.display = "block";

      if (!url) {
        status.className = "connection-status error";
        status.textContent = "Please enter a URL first";
        return;
      }

      try {
        status.className = "connection-status";
        status.textContent = "Testing connection...";
        status.style.background = "#f1f5f9";
        status.style.color = "#475569";

        const res = await fetch(`${url}/api/styles`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          status.className = "connection-status success";
          status.textContent = `Connected successfully! Found ${data.length} highlight style(s).`;
        } else {
          status.className = "connection-status error";
          status.textContent = `Server returned status ${res.status}`;
        }
      } catch (err) {
        status.className = "connection-status error";
        status.textContent = `Connection failed: ${err.message}`;
      }
    });

    document.getElementById("btn-add-style").addEventListener("click", () => {
      const name = document.getElementById("new-name").value.trim();
      const bgColor = document.getElementById("new-bg-color").value;
      const borderColor = document.getElementById("new-border-color").value;

      if (!name) {
        showToast("Please enter a style name", "error");
        return;
      }

      const newStyle = {
        id: "custom_" + Date.now(),
        name: name,
        color: "#000000",
        backgroundColor: bgColor,
        borderColor: borderColor,
        isDefault: false,
        sortOrder: 99,
      };

      chrome.storage.local.get(["styles"], (result) => {
        const styles = result.styles || [];
        styles.push(newStyle);
        chrome.storage.local.set({ styles }, () => {
          document.getElementById("new-name").value = "";
          loadSettings();
          showToast("Style added", "success");
        });
      });
    });

    const bgColorPicker = document.getElementById("new-bg-color");
    const bgColorText = document.getElementById("new-bg-color-text");
    bgColorPicker.addEventListener("input", () => { bgColorText.value = bgColorPicker.value; });
    bgColorText.addEventListener("input", () => { bgColorPicker.value = bgColorText.value; });

    const borderColorPicker = document.getElementById("new-border-color");
    const borderColorText = document.getElementById("new-border-color-text");
    borderColorPicker.addEventListener("input", () => { borderColorText.value = borderColorPicker.value; });
    borderColorText.addEventListener("input", () => { borderColorPicker.value = borderColorText.value; });

    document.getElementById("btn-sync-up").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "SYNC_TO_SERVER" }, (result) => {
        if (result && result.success) {
          showToast(result.message || "Synced successfully", "success");
          loadSettings();
        } else {
          showToast(result?.error || "Sync failed", "error");
        }
      });
    });

    document.getElementById("btn-sync-down").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "SYNC_FROM_SERVER" }, (result) => {
        if (result && result.success) {
          showToast(result.message || "Styles synced", "success");
          loadSettings();
        } else {
          showToast(result?.error || "Sync failed", "error");
        }
      });
    });

    document.getElementById("btn-export").addEventListener("click", () => {
      chrome.storage.local.get(["highlights", "styles", "serverUrl"], (result) => {
        const data = {
          highlights: result.highlights || [],
          styles: result.styles || [],
          serverUrl: result.serverUrl || "",
          exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `web-highlighter-export-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Data exported", "success");
      });
    });

    document.getElementById("btn-clear").addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all highlights? This cannot be undone.")) {
        chrome.storage.local.set({ highlights: [] }, () => {
          loadSettings();
          showToast("All highlights cleared", "success");
        });
      }
    });
  }

  function showToast(message, type) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
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
