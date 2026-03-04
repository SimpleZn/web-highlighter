interface HighlightData {
  url: string;
  pageTitle: string;
  favicon: string;
  selectedText: string;
  comment: string | null;
  styleId: string;
  styleName: string;
  styleColor: string;
  styleBackgroundColor: string;
  xpath: string;
  textOffset: number;
  textLength: number;
}

interface StoredHighlight extends HighlightData {
  id: string;
  createdAt: string;
  synced: boolean;
}

interface HighlightStyle {
  id: string;
  name: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  isDefault: boolean;
  sortOrder: number;
}

interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface SaveResult {
  success: boolean;
  highlight?: StoredHighlight;
}

const CONTEXT_MENU_HIGHLIGHT = "wh-highlight";
const CONTEXT_MENU_COMMENT = "wh-comment";

const DEFAULT_STYLES: HighlightStyle[] = [
  { id: "default-yellow", name: "Yellow", color: "#000000", backgroundColor: "#FFF59D", borderColor: "#F9A825", isDefault: true, sortOrder: 0 },
  { id: "default-green", name: "Green", color: "#000000", backgroundColor: "#A5D6A7", borderColor: "#388E3C", isDefault: false, sortOrder: 1 },
  { id: "default-blue", name: "Blue", color: "#000000", backgroundColor: "#90CAF9", borderColor: "#1976D2", isDefault: false, sortOrder: 2 },
  { id: "default-pink", name: "Pink", color: "#000000", backgroundColor: "#F48FB1", borderColor: "#C2185B", isDefault: false, sortOrder: 3 },
  { id: "default-orange", name: "Orange", color: "#000000", backgroundColor: "#FFCC80", borderColor: "#E65100", isDefault: false, sortOrder: 4 },
  { id: "default-purple", name: "Purple", color: "#000000", backgroundColor: "#CE93D8", borderColor: "#7B1FA2", isDefault: false, sortOrder: 5 },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_HIGHLIGHT,
    title: "Highlight Selection",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENU_COMMENT,
    title: "Highlight & Comment",
    contexts: ["selection"],
  });

  chrome.storage.local.get(["styles"], (result) => {
    if (!result.styles || result.styles.length === 0) {
      chrome.storage.local.set({ styles: DEFAULT_STYLES, enabled: true });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === CONTEXT_MENU_HIGHLIGHT) {
    chrome.tabs.sendMessage(tab.id, {
      type: "HIGHLIGHT_SELECTION",
      text: info.selectionText,
    });
  } else if (info.menuItemId === CONTEXT_MENU_COMMENT) {
    chrome.tabs.sendMessage(tab.id, {
      type: "COMMENT_SELECTION",
      text: info.selectionText,
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SAVE_HIGHLIGHT") {
    saveHighlight(message.data).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === "GET_HIGHLIGHTS_FOR_URL") {
    getHighlightsForUrl(message.url).then((highlights) => {
      sendResponse({ highlights });
    });
    return true;
  }

  if (message.type === "GET_STYLES") {
    chrome.storage.local.get(["styles"], (result) => {
      sendResponse({ styles: result.styles || [] });
    });
    return true;
  }

  if (message.type === "DELETE_HIGHLIGHT") {
    deleteHighlight(message.id).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "SYNC_TO_SERVER") {
    syncToServer().then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === "SYNC_FROM_SERVER") {
    syncFromServer().then((result) => {
      sendResponse(result);
    });
    return true;
  }
});

async function saveHighlight(data: HighlightData): Promise<SaveResult> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["highlights"], (result) => {
      const highlights: StoredHighlight[] = result.highlights || [];
      const highlight: StoredHighlight = {
        id: "hl_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        url: data.url,
        pageTitle: data.pageTitle,
        favicon: data.favicon,
        selectedText: data.selectedText,
        comment: data.comment || null,
        styleId: data.styleId,
        styleName: data.styleName,
        styleColor: data.styleColor,
        styleBackgroundColor: data.styleBackgroundColor,
        xpath: data.xpath,
        textOffset: data.textOffset || 0,
        textLength: data.textLength || 0,
        createdAt: new Date().toISOString(),
        synced: false,
      };
      highlights.push(highlight);
      chrome.storage.local.set({ highlights }, () => {
        resolve({ success: true, highlight });
      });
    });
  });
}

async function getHighlightsForUrl(url: string): Promise<StoredHighlight[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["highlights"], (result) => {
      const highlights: StoredHighlight[] = result.highlights || [];
      resolve(highlights.filter((h) => h.url === url));
    });
  });
}

async function deleteHighlight(id: string): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["highlights"], (result) => {
      const highlights = (result.highlights as StoredHighlight[] || []).filter((h) => h.id !== id);
      chrome.storage.local.set({ highlights }, () => {
        resolve({ success: true });
      });
    });
  });
}

async function syncToServer(): Promise<SyncResult> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["highlights", "serverUrl"], async (result) => {
      const serverUrl = result.serverUrl as string | undefined;
      if (!serverUrl) {
        resolve({ success: false, error: "Server URL not configured" });
        return;
      }

      const highlights = ((result.highlights || []) as StoredHighlight[]).filter((h) => !h.synced);
      if (highlights.length === 0) {
        resolve({ success: true, message: "Nothing to sync" });
        return;
      }

      try {
        const pageMap: Record<string, { id: string }> = {};
        for (const h of highlights) {
          if (!pageMap[h.url]) {
            const pageRes = await fetch(`${serverUrl}/api/pages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: h.url,
                title: h.pageTitle || "Untitled",
                favicon: h.favicon || null,
              }),
            });
            pageMap[h.url] = await pageRes.json();
          }
        }

        const stylesRes = await fetch(`${serverUrl}/api/styles`);
        const serverStyles: HighlightStyle[] = await stylesRes.json();

        for (const h of highlights) {
          const page = pageMap[h.url];
          let matchedStyle = serverStyles.find(
            (s) => s.name.toLowerCase() === (h.styleName || "").toLowerCase()
          );
          if (!matchedStyle && serverStyles.length > 0) {
            matchedStyle = serverStyles.find((s) => s.isDefault) || serverStyles[0];
          }
          if (!matchedStyle) continue;

          const hlRes = await fetch(`${serverUrl}/api/highlights`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageId: page.id,
              styleId: matchedStyle.id,
              selectedText: h.selectedText,
              xpath: h.xpath || null,
              textOffset: h.textOffset || 0,
              textLength: h.textLength || h.selectedText.length,
            }),
          });

          if (hlRes.ok && h.comment) {
            const hlData = await hlRes.json();
            await fetch(`${serverUrl}/api/comments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                highlightId: hlData.id,
                text: h.comment,
              }),
            });
          }

          h.synced = true;
        }

        chrome.storage.local.get(["highlights"], (res) => {
          const all = (res.highlights || []) as StoredHighlight[];
          const updated = all.map((existing) => {
            const synced = highlights.find((s) => s.id === existing.id);
            return synced ? { ...existing, synced: true } : existing;
          });
          chrome.storage.local.set({ highlights: updated });
        });

        resolve({ success: true, message: `Synced ${highlights.length} highlight(s)` });
      } catch (err) {
        resolve({ success: false, error: (err as Error).message });
      }
    });
  });
}

async function syncFromServer(): Promise<SyncResult> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["serverUrl"], async (result) => {
      const serverUrl = result.serverUrl as string | undefined;
      if (!serverUrl) {
        resolve({ success: false, error: "Server URL not configured" });
        return;
      }

      try {
        const stylesRes = await fetch(`${serverUrl}/api/styles`);
        if (stylesRes.ok) {
          const styles = await stylesRes.json();
          chrome.storage.local.set({ styles });
        }
        resolve({ success: true, message: "Styles synced from server" });
      } catch (err) {
        resolve({ success: false, error: (err as Error).message });
      }
    });
  });
}
