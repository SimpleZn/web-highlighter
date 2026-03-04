import type { PageWithHighlights, HighlightWithComments, HighlightStyle, Comment } from "@shared/schema";

interface ChromeHighlight {
  id: string;
  url: string;
  pageTitle: string;
  favicon: string | null;
  selectedText: string;
  comment: string | null;
  styleId: string;
  styleName: string;
  styleColor: string;
  styleBackgroundColor: string;
  xpath: string;
  textOffset: number;
  textLength: number;
  createdAt: string;
  synced: boolean;
}

interface ChromeStyle {
  id: string;
  name: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  isDefault: boolean;
  sortOrder: number;
}

function getChromeStorage<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

function setChromeStorage(data: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

function generatePageId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "page_" + Math.abs(hash).toString(36);
}

export async function getChromePages(): Promise<PageWithHighlights[]> {
  const highlights = (await getChromeStorage<ChromeHighlight[]>("highlights")) || [];
  const styles = (await getChromeStorage<ChromeStyle[]>("styles")) || [];

  const pageMap = new Map<string, ChromeHighlight[]>();
  highlights.forEach((h) => {
    if (!h.url) return;
    const existing = pageMap.get(h.url) || [];
    existing.push(h);
    pageMap.set(h.url, existing);
  });

  const pages: PageWithHighlights[] = [];
  for (const [url, pageHighlights] of pageMap) {
    const first = pageHighlights[0];
    const hlWithComments: HighlightWithComments[] = pageHighlights.map((h) => {
      const style = styles.find((s) => s.id === h.styleId) || {
        id: h.styleId,
        name: h.styleName || "Highlight",
        color: h.styleColor || "#000000",
        backgroundColor: h.styleBackgroundColor || "#FFF59D",
        borderColor: null,
        isDefault: false,
        sortOrder: 0,
      };

      const comments: Comment[] = h.comment
        ? [{ id: `comment-${h.id}`, highlightId: h.id, text: h.comment, createdAt: new Date(h.createdAt) }]
        : [];

      return {
        id: h.id,
        pageId: generatePageId(url),
        styleId: h.styleId,
        selectedText: h.selectedText,
        xpath: h.xpath || null,
        textOffset: h.textOffset || null,
        textLength: h.textLength || null,
        createdAt: h.createdAt ? new Date(h.createdAt) : null,
        comments,
        style: style as HighlightStyle,
      };
    });

    const commentCount = hlWithComments.reduce((sum, h) => sum + h.comments.length, 0);

    let latestDate: Date | null = null;
    for (const h of pageHighlights) {
      if (h.createdAt) {
        const d = new Date(h.createdAt);
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }

    pages.push({
      id: generatePageId(url),
      url,
      title: first.pageTitle || url,
      favicon: first.favicon || null,
      lastVisited: latestDate,
      highlights: hlWithComments,
      highlightCount: hlWithComments.length,
      commentCount,
    });
  }

  return pages.sort((a, b) => {
    const aTime = a.lastVisited?.getTime() || 0;
    const bTime = b.lastVisited?.getTime() || 0;
    return bTime - aTime;
  });
}

export async function getChromePage(id: string): Promise<PageWithHighlights | null> {
  const pages = await getChromePages();
  return pages.find((p) => p.id === id) || null;
}

export async function getChromeStyles(): Promise<HighlightStyle[]> {
  const styles = (await getChromeStorage<ChromeStyle[]>("styles")) || [];
  return styles.map((s) => ({
    ...s,
    borderColor: s.borderColor || null,
    isDefault: s.isDefault ?? false,
    sortOrder: s.sortOrder ?? 0,
  }));
}

export async function chromeDeleteHighlight(id: string): Promise<void> {
  const highlights = (await getChromeStorage<ChromeHighlight[]>("highlights")) || [];
  const filtered = highlights.filter((h) => h.id !== id);
  await setChromeStorage({ highlights: filtered });
}

export async function chromeCreateStyle(data: Record<string, unknown>): Promise<HighlightStyle> {
  const styles = (await getChromeStorage<ChromeStyle[]>("styles")) || [];
  const newStyle = {
    id: "custom_" + Date.now(),
    name: data.name as string,
    color: (data.color as string) || "#000000",
    backgroundColor: data.backgroundColor as string,
    borderColor: (data.borderColor as string) || (data.backgroundColor as string),
    isDefault: (data.isDefault as boolean) ?? false,
    sortOrder: (data.sortOrder as number) ?? 99,
  };
  styles.push(newStyle);
  await setChromeStorage({ styles });
  return newStyle as HighlightStyle;
}

export async function chromeUpdateStyle(id: string, data: Record<string, unknown>): Promise<HighlightStyle> {
  const styles = (await getChromeStorage<ChromeStyle[]>("styles")) || [];
  const index = styles.findIndex((s) => s.id === id);
  if (index === -1) throw new Error("Style not found");

  if (data.isDefault) {
    styles.forEach((s) => (s.isDefault = false));
  }

  styles[index] = { ...styles[index], ...data } as ChromeStyle;
  await setChromeStorage({ styles });
  return styles[index] as HighlightStyle;
}

export async function chromeDeleteStyle(id: string): Promise<void> {
  const styles = (await getChromeStorage<ChromeStyle[]>("styles")) || [];
  if (styles.length <= 1) throw new Error("Cannot delete the last style");
  const filtered = styles.filter((s) => s.id !== id);
  if (!filtered.some((s) => s.isDefault) && filtered.length > 0) {
    filtered[0].isDefault = true;
  }
  await setChromeStorage({ styles: filtered });
}

export async function chromeAddComment(data: { highlightId: string; text: string }): Promise<Comment> {
  const highlights = (await getChromeStorage<ChromeHighlight[]>("highlights")) || [];
  const hl = highlights.find((h) => h.id === data.highlightId);
  if (hl) {
    hl.comment = hl.comment ? hl.comment + "\n---\n" + data.text : data.text;
    await setChromeStorage({ highlights });
  }
  return {
    id: `comment-${Date.now()}`,
    highlightId: data.highlightId,
    text: data.text,
    createdAt: new Date(),
  };
}

export async function chromeDeleteComment(id: string): Promise<void> {
  const highlightId = id.replace("comment-", "");
  const highlights = (await getChromeStorage<ChromeHighlight[]>("highlights")) || [];
  const hl = highlights.find((h) => h.id === highlightId);
  if (hl) {
    hl.comment = null;
    await setChromeStorage({ highlights });
  }
}

export async function chromeExportData(): Promise<Record<string, unknown>> {
  const highlights = (await getChromeStorage<ChromeHighlight[]>("highlights")) || [];
  const styles = (await getChromeStorage<ChromeStyle[]>("styles")) || [];
  return { highlights, styles, exportedAt: new Date().toISOString() };
}
