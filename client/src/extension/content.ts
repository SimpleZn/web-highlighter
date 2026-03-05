interface StoredHighlight {
  id: string;
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

interface PendingSelection {
  text: string;
  rangeInfo?: {
    startContainer: Node;
    startOffset: number;
    endContainer: Node;
    endOffset: number;
  };
}

(function () {
  "use strict";

  let isEnabled = true;
  let styles: HighlightStyle[] = [];
  let currentStyleIndex = 0;
  let toolbar: HTMLDivElement | null = null;
  let commentDialog: HTMLDivElement | null = null;
  let pendingSelection: PendingSelection | null = null;

  init();

  function init(): void {
    chrome.storage.local.get(["styles", "enabled"], (result) => {
      styles = result.styles || [];
      isEnabled = result.enabled !== false;
      restoreHighlights();
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "HIGHLIGHT_SELECTION") {
        handleHighlightFromContextMenu();
        sendResponse({ success: true });
      } else if (message.type === "COMMENT_SELECTION") {
        handleCommentFromContextMenu();
        sendResponse({ success: true });
      } else if (message.type === "TOGGLE") {
        isEnabled = message.enabled;
        sendResponse({ success: true });
      } else if (message.type === "SET_STYLE_INDEX") {
        currentStyleIndex = message.index;
        sendResponse({ success: true });
      } else if (message.type === "REFRESH_STYLES") {
        chrome.storage.local.get(["styles"], (r) => {
          styles = r.styles || [];
          sendResponse({ success: true });
        });
        return true;
      } else if (message.type === "REMOVE_HIGHLIGHT_FROM_PAGE") {
        removeHighlightMark(message.id);
        sendResponse({ success: true });
      }
    });

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
  }

  function shouldSkipHighlightNode(parent: Element | null): boolean {
    if (!parent) return true;
    if (parent.closest(".wh-ext-mark, .wh-ext-toolbar, .wh-ext-popover, .wh-ext-comment-dialog, #wh-ext-toolbar, #wh-ext-popover, #wh-ext-comment-dialog")) {
      return true;
    }
    const tag = parent.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || tag === "BUTTON") {
      return true;
    }
    if (parent.closest("[contenteditable]")) {
      return true;
    }
    return false;
  }

  function wrapRangeWithMarks(range: Range, opts: { id: string; backgroundColor: string; color: string }): HTMLElement[] {
    const marks: HTMLElement[] = [];
    if (range.collapsed) return marks;

    // Step 1: Collect text-node segments that overlap with the range.
    // Use range.intersectsNode() for containment (same approach as Hypothes.is / Rangy).
    // Character offsets only need special handling when the text node IS the
    // range boundary container; all other intersecting nodes are fully selected.
    const segments: Array<{ node: Text; start: number; end: number }> = [];
    const root = range.commonAncestorContainer;

    if (root.nodeType === Node.TEXT_NODE) {
      // Entire range lives inside a single text node
      const textNode = root as Text;
      if (textNode.length > 0 && !shouldSkipHighlightNode(textNode.parentElement)) {
        segments.push({ node: textNode, start: range.startOffset, end: range.endOffset });
      }
    } else {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current: Node | null;
      while ((current = walker.nextNode())) {
        const textNode = current as Text;
        if (textNode.length === 0) continue;
        if (shouldSkipHighlightNode(textNode.parentElement)) continue;
        if (!range.intersectsNode(textNode)) continue;

        let start = 0;
        let end = textNode.length;

        if (textNode === range.startContainer) {
          start = range.startOffset;
        }
        if (textNode === range.endContainer) {
          end = range.endOffset;
        }

        if (end > start) {
          segments.push({ node: textNode, start, end });
        }
      }
    }

    if (segments.length === 0) return marks;

    // Step 2: Wrap each segment by splitting the text node and inserting a <mark>.
    // Split trailing portion *before* leading portion so the start offset stays valid.
    for (const seg of segments) {
      try {
        let targetNode = seg.node;

        if (seg.end < targetNode.length) {
          targetNode.splitText(seg.end);
        }
        if (seg.start > 0) {
          targetNode = targetNode.splitText(seg.start);
        }

        const mark = document.createElement("mark");
        mark.className = "wh-ext-mark";
        mark.style.backgroundColor = opts.backgroundColor;
        mark.style.color = opts.color;
        mark.dataset.whId = opts.id;
        targetNode.parentNode?.insertBefore(mark, targetNode);
        mark.appendChild(targetNode);
        marks.push(mark);
      } catch (_e) { /* ignore */ }
    }

    return marks;
  }

  function getCurrentStyle(): HighlightStyle | null {
    if (styles.length === 0) return null;
    const defaultStyle = styles.find((s) => s.isDefault);
    return styles[currentStyleIndex] || defaultStyle || styles[0];
  }

  function onMouseDown(e: MouseEvent): void {
    if (toolbar && !toolbar.contains(e.target as Node)) {
      removeToolbar();
    }
    if (commentDialog && !commentDialog.contains(e.target as Node)) {
      removeCommentDialog();
    }
  }

  function onMouseUp(e: MouseEvent): void {
    if (!isEnabled) return;
    if (toolbar && toolbar.contains(e.target as Node)) return;
    if (commentDialog && commentDialog.contains(e.target as Node)) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showToolbar(rect, selection, text);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      removeToolbar();
      removeCommentDialog();
    }
  }

  function handleHighlightFromContextMenu(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;
    doHighlight(selection, text, null);
  }

  function handleCommentFromContextMenu(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;

    pendingSelection = { text };
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    try {
      pendingSelection.rangeInfo = {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      };
    } catch (_e) { /* ignore */ }

    showCommentDialog(rect);
  }

  function showToolbar(rect: DOMRect, _selection: Selection, _text: string): void {
    removeToolbar();

    toolbar = document.createElement("div");
    toolbar.id = "wh-ext-toolbar";
    toolbar.className = "wh-ext-toolbar";

    toolbar.innerHTML = `
      <div class="wh-ext-toolbar-row">
        <button class="wh-ext-btn wh-ext-btn-highlight" data-action="highlight" title="Highlight">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 11-6 6v3h9l3-3"></path>
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
          </svg>
          <span>Highlight</span>
        </button>
        <button class="wh-ext-btn wh-ext-btn-comment" data-action="comment" title="Highlight & Comment">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Comment</span>
        </button>
      </div>
      <div class="wh-ext-toolbar-colors"></div>
    `;

    const colorsContainer = toolbar.querySelector<HTMLDivElement>(".wh-ext-toolbar-colors");
    if (colorsContainer) {
      styles.forEach((s, i) => {
        const btn = document.createElement("button");
        btn.className = `wh-ext-color-btn ${i === currentStyleIndex ? "wh-ext-color-active" : ""}`;
        btn.dataset.index = String(i);
        btn.title = s.name;
        if (CSS.supports("color", s.backgroundColor)) {
          btn.style.backgroundColor = s.backgroundColor;
        }
        const borderColor = s.borderColor || s.backgroundColor;
        if (CSS.supports("color", borderColor)) {
          btn.style.borderColor = borderColor;
        }
        colorsContainer.appendChild(btn);
      });
    }

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const left = rect.left + scrollX + rect.width / 2;
    const top = rect.top + scrollY - 8;

    toolbar.style.left = left + "px";
    toolbar.style.top = top + "px";

    document.body.appendChild(toolbar);

    const tbRect = toolbar.getBoundingClientRect();
    if (tbRect.left < 8) {
      toolbar.style.left = 8 + scrollX + "px";
      toolbar.style.transform = "translateY(-100%)";
    }
    if (tbRect.right > window.innerWidth - 8) {
      toolbar.style.left = window.innerWidth - tbRect.width - 8 + scrollX + "px";
      toolbar.style.transform = "translateY(-100%)";
    }

    toolbar.querySelectorAll<HTMLButtonElement>(".wh-ext-color-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentStyleIndex = parseInt(btn.dataset.index || "0");
        toolbar!.querySelectorAll(".wh-ext-color-btn").forEach((b) => b.classList.remove("wh-ext-color-active"));
        btn.classList.add("wh-ext-color-active");
      });
    });

    toolbar.querySelector<HTMLButtonElement>('[data-action="highlight"]')!.addEventListener("click", (e) => {
      e.stopPropagation();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        doHighlight(sel, sel.toString().trim(), null);
      }
      removeToolbar();
    });

    toolbar.querySelector<HTMLButtonElement>('[data-action="comment"]')!.addEventListener("click", (e) => {
      e.stopPropagation();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        const selText = sel.toString().trim();
        const range = sel.getRangeAt(0);
        pendingSelection = {
          text: selText,
          rangeInfo: {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
          },
        };
        const selRect = range.getBoundingClientRect();
        removeToolbar();
        showCommentDialog(selRect);
      }
    });
  }

  function showCommentDialog(rect: DOMRect): void {
    removeCommentDialog();

    commentDialog = document.createElement("div");
    commentDialog.id = "wh-ext-comment-dialog";
    commentDialog.className = "wh-ext-comment-dialog";

    commentDialog.innerHTML = `
      <div class="wh-ext-dialog-header">Add Comment</div>
      <textarea class="wh-ext-dialog-input" placeholder="Enter your comment..." rows="3" autofocus></textarea>
      <div class="wh-ext-dialog-actions">
        <button class="wh-ext-dialog-btn wh-ext-dialog-cancel">Cancel</button>
        <button class="wh-ext-dialog-btn wh-ext-dialog-save">Save</button>
      </div>
    `;

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    commentDialog.style.left = rect.left + scrollX + rect.width / 2 + "px";
    commentDialog.style.top = rect.bottom + scrollY + 8 + "px";

    document.body.appendChild(commentDialog);

    const textarea = commentDialog.querySelector<HTMLTextAreaElement>("textarea")!;
    setTimeout(() => textarea.focus(), 50);

    const dRect = commentDialog.getBoundingClientRect();
    if (dRect.right > window.innerWidth - 8) {
      commentDialog.style.left = window.innerWidth - dRect.width - 8 + scrollX + "px";
      commentDialog.style.transform = "translateX(0)";
    }

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitComment();
      }
    });

    commentDialog.querySelector<HTMLButtonElement>(".wh-ext-dialog-cancel")!.addEventListener("click", () => {
      removeCommentDialog();
    });

    commentDialog.querySelector<HTMLButtonElement>(".wh-ext-dialog-save")!.addEventListener("click", () => {
      submitComment();
    });
  }

  function submitComment(): void {
    if (!pendingSelection || !commentDialog) return;
    const textarea = commentDialog.querySelector<HTMLTextAreaElement>("textarea")!;
    const comment = textarea.value.trim();

    let sel = window.getSelection();
    if (pendingSelection.rangeInfo && sel) {
      try {
        const range = document.createRange();
        range.setStart(pendingSelection.rangeInfo.startContainer, pendingSelection.rangeInfo.startOffset);
        range.setEnd(pendingSelection.rangeInfo.endContainer, pendingSelection.rangeInfo.endOffset);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_e) { /* ignore */ }
    }

    if (sel && !sel.isCollapsed) {
      doHighlight(sel, pendingSelection.text, comment || null);
    }

    removeCommentDialog();
    pendingSelection = null;
  }

  function doHighlight(selection: Selection, text: string, comment: string | null): void {
    const style = getCurrentStyle();
    if (!style) return;

    const range = selection.getRangeAt(0);
    const textOffset = getTextOffset(range);
    let xpath = "";
    try {
      xpath = getXPath((range.startContainer.parentElement || range.startContainer) as Element);
    } catch (_e) { /* ignore */ }

    const marks = wrapRangeWithMarks(range, {
      id: "pending",
      backgroundColor: style.backgroundColor,
      color: style.color,
    });
    if (marks.length === 0) return;

    selection.removeAllRanges();

    const data = {
      url: normalizeUrl(window.location.href),
      pageTitle: document.title,
      favicon: getFavicon(),
      selectedText: text,
      comment: comment,
      styleId: style.id,
      styleName: style.name,
      styleColor: style.color,
      styleBackgroundColor: style.backgroundColor,
      xpath: xpath,
      textOffset: textOffset,
      textLength: text.length,
    };

    chrome.runtime.sendMessage({ type: "SAVE_HIGHLIGHT", data }, (response) => {
      if (response && response.success) {
        marks.forEach((m) => {
          m.dataset.whId = response.highlight.id;
          addHighlightTooltip(m, response.highlight);
        });
      } else {
        marks.forEach((m) => {
          const parent = m.parentNode;
          if (parent) {
            while (m.firstChild) {
              parent.insertBefore(m.firstChild, m);
            }
            parent.removeChild(m);
            (parent as Element).normalize?.();
          } else {
            m.remove();
          }
        });
      }
    });
  }

  function addHighlightTooltip(mark: HTMLElement, highlight: StoredHighlight): void {
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      showHighlightPopover(mark, highlight);
    });
  }

  function showHighlightPopover(mark: HTMLElement, highlight: StoredHighlight): void {
    const existing = document.getElementById("wh-ext-popover");
    if (existing) existing.remove();

    const popover = document.createElement("div");
    popover.id = "wh-ext-popover";
    popover.className = "wh-ext-popover";

    let commentHtml = "";
    if (highlight.comment) {
      commentHtml = `<div class="wh-ext-popover-comment">${renderMarkdown(highlight.comment)}</div>`;
    }

    popover.innerHTML = `
      <div class="wh-ext-popover-header">
        <span class="wh-ext-popover-style" style="background-color: ${highlight.styleBackgroundColor}">${escapeHtml(highlight.styleName || "Highlight")}</span>
        <button class="wh-ext-popover-close" title="Close">&times;</button>
      </div>
      ${commentHtml}
      <div class="wh-ext-popover-actions">
        <button class="wh-ext-popover-btn wh-ext-popover-delete" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          Remove
        </button>
      </div>
    `;

    const rect = mark.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    popover.style.left = rect.left + scrollX + rect.width / 2 + "px";
    popover.style.top = rect.bottom + scrollY + 6 + "px";

    document.body.appendChild(popover);

    const pRect = popover.getBoundingClientRect();
    if (pRect.right > window.innerWidth - 8) {
      popover.style.left = window.innerWidth - pRect.width - 8 + scrollX + "px";
      popover.style.transform = "translateX(0)";
    }

    popover.querySelector<HTMLButtonElement>(".wh-ext-popover-close")!.addEventListener("click", () => {
      popover.remove();
    });

    popover.querySelector<HTMLButtonElement>(".wh-ext-popover-delete")!.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "DELETE_HIGHLIGHT", id: highlight.id }, () => {
        removeHighlightMark(highlight.id);
        popover.remove();
      });
    });

    const closeOnClick = (e: MouseEvent): void => {
      if (!popover.contains(e.target as Node) && !mark.contains(e.target as Node)) {
        popover.remove();
        document.removeEventListener("mousedown", closeOnClick);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closeOnClick), 100);
  }

  function removeHighlightMark(id: string): void {
    const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
    const marks = document.querySelectorAll<HTMLElement>(`.wh-ext-mark[data-wh-id=\"${safeId}\"]`);
    marks.forEach((mark) => {
      const parent = mark.parentNode!;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      (parent as Element).normalize?.();
    });
  }

  function restoreHighlights(): void {
    const url = normalizeUrl(window.location.href);
    chrome.storage.local.get(["highlights"], (result) => {
      const highlights: StoredHighlight[] = result.highlights || [];
      const pageHighlights = highlights.filter((h) => normalizeUrl(h.url) === url);
      if (pageHighlights.length === 0) return;

      const doRestore = (): void => {
        pageHighlights.forEach((h) => tryRestoreHighlight(h));
      };

      if (document.readyState === "complete") {
        doRestore();
      } else {
        window.addEventListener("load", doRestore);
      }
    });
  }

  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = "";
      return u.href.replace(/\/+$/, "");
    } catch (_e) {
      return url;
    }
  }

  interface TextNodeEntry {
    node: Text;
    start: number;
    len: number;
  }

  function collectTextNodes(): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node: Node): number {
          if (!node.textContent) return NodeFilter.FILTER_REJECT;
          const parent = (node as Text).parentElement;
          if (!parent) return NodeFilter.FILTER_ACCEPT;
          if (parent.closest(".wh-ext-mark, .wh-ext-toolbar, .wh-ext-popover, .wh-ext-comment-dialog, #wh-ext-toolbar, #wh-ext-popover, #wh-ext-comment-dialog")) {
            return NodeFilter.FILTER_REJECT;
          }
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    let n: Node | null;
    while ((n = walker.nextNode())) {
      nodes.push(n as Text);
    }
    return nodes;
  }

  function tryRestoreHighlight(highlight: StoredHighlight): void {
    const text = highlight.selectedText;
    if (!text) return;

    const existing = document.querySelector(`.wh-ext-mark[data-wh-id="${highlight.id}"]`);
    if (existing) return;

    const textNodes = collectTextNodes();
    if (textNodes.length === 0) return;

    const textOffset = Number(highlight.textOffset);
    if (Number.isFinite(textOffset) && textOffset >= 0 && highlight.textLength > 0) {
      const rangeFromOffset = buildRangeFromGlobalOffset(textNodes, textOffset, highlight.textLength);
      if (rangeFromOffset) {
        const rangeText = rangeFromOffset.toString();
        if (rangeText === text || normalizeSpaces(rangeText) === normalizeSpaces(text)) {
          applyMarkFromRange(rangeFromOffset, highlight);
          return;
        }
      }
    }

    for (let i = 0; i < textNodes.length; i++) {
      const nodeText = textNodes[i].textContent || "";
      const idx = nodeText.indexOf(text);
      if (idx !== -1) {
        try {
          const range = document.createRange();
          range.setStart(textNodes[i], idx);
          range.setEnd(textNodes[i], idx + text.length);
          applyMarkFromRange(range, highlight);
          return;
        } catch (_e) { /* ignore */ }
      }
    }

    let concat = "";
    const entries: TextNodeEntry[] = [];
    for (let i = 0; i < textNodes.length; i++) {
      const t = textNodes[i].textContent || "";
      entries.push({ node: textNodes[i], start: concat.length, len: t.length });
      concat += t;
    }

    let searchText = text;
    let textIndex = concat.indexOf(searchText);

    if (textIndex === -1) {
      const normalizedConcat = concat.replace(/\s+/g, " ");
      const normalizedSearch = searchText.replace(/\s+/g, " ");
      const normalizedIndex = normalizedConcat.indexOf(normalizedSearch);
      if (normalizedIndex === -1) return;

      let normPos = 0;
      const charMap: number[] = [];
      for (let i = 0; i < concat.length; i++) {
        if (/\s/.test(concat[i])) {
          if (normPos === 0 || !/\s/.test(concat[i - 1])) {
            charMap.push(i);
            normPos++;
          }
        } else {
          charMap.push(i);
          normPos++;
        }
      }

      if (charMap[normalizedIndex] !== undefined && charMap[normalizedIndex + normalizedSearch.length - 1] !== undefined) {
        textIndex = charMap[normalizedIndex];
        const endIdx = charMap[normalizedIndex + normalizedSearch.length - 1] + 1;
        searchText = concat.substring(textIndex, endIdx);
      } else {
        return;
      }
    }

    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;

    for (const entry of entries) {
      const entryEnd = entry.start + entry.len;
      if (!startNode && entryEnd > textIndex) {
        startNode = entry.node;
        startOffset = textIndex - entry.start;
      }
      if (startNode && entryEnd >= textIndex + searchText.length) {
        endNode = entry.node;
        endOffset = textIndex + searchText.length - entry.start;
        break;
      }
    }

    if (!startNode || !endNode) return;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      applyMarkFromRange(range, highlight);
    } catch (_e) { /* ignore */ }
  }

  function applyMarkFromRange(range: Range, highlight: StoredHighlight): void {
    const marks = wrapRangeWithMarks(range, {
      id: highlight.id,
      backgroundColor: highlight.styleBackgroundColor || "#FFF59D",
      color: highlight.styleColor || "#000000",
    });
    marks.forEach((m) => addHighlightTooltip(m, highlight));
  }

  function normalizeSpaces(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  function buildRangeFromGlobalOffset(textNodes: Text[], globalStart: number, length: number): Range | null {
    if (length <= 0) return null;
    let startNode: Text | null = null;
    let endNode: Text | null = null;
    let startOffset = 0;
    let endOffset = 0;
    let cursor = 0;
    const globalEnd = globalStart + length;

    for (const node of textNodes) {
      const nodeText = node.textContent || "";
      const nodeStart = cursor;
      const nodeEnd = nodeStart + nodeText.length;

      if (!startNode && globalStart >= nodeStart && globalStart <= nodeEnd) {
        startNode = node;
        startOffset = Math.max(0, globalStart - nodeStart);
      }
      if (startNode && globalEnd >= nodeStart && globalEnd <= nodeEnd) {
        endNode = node;
        endOffset = Math.max(0, globalEnd - nodeStart);
        break;
      }

      cursor = nodeEnd;
    }

    if (!startNode || !endNode) return null;
    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    } catch (_e) {
      return null;
    }
  }

  function removeToolbar(): void {
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
  }

  function removeCommentDialog(): void {
    if (commentDialog) {
      commentDialog.remove();
      commentDialog = null;
    }
  }

  function getXPath(element: Element): string {
    if (!element) return "";
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === current.tagName) index++;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(current.tagName.toLowerCase() + "[" + index + "]");
      current = current.parentElement;
    }
    return "/body/" + parts.join("/");
  }

  function getFavicon(): string {
    const link =
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]') ||
      document.querySelector('link[rel*="icon"]');
    if (link) {
      try {
        return new URL((link as HTMLLinkElement).href, window.location.origin).href;
      } catch (_e) { /* ignore */ }
    }
    return window.location.origin + "/favicon.ico";
  }

  function escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function decodeHtml(str: string): string {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = str;
    return textarea.value;
  }

  function escapeAttribute(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getTextOffset(range: Range): number {
    try {
      const preRange = document.createRange();
      preRange.selectNodeContents(document.body);
      preRange.setEnd(range.startContainer, range.startOffset);
      return preRange.toString().length;
    } catch (_e) {
      return 0;
    }
  }

  function renderMarkdown(text: string): string {
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre style="background:#f1f5f9;padding:6px 8px;border-radius:4px;overflow-x:auto;margin:4px 0;font-size:12px;"><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:12px;font-family:monospace;">$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_m: string, label: string, href: string) {
      const rawHref = decodeHtml(href).trim();
      try {
        const parsed = new URL(rawHref, window.location.href);
        if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
          return '<a href=\"' + escapeAttribute(parsed.toString()) + '\" target=\"_blank\" rel=\"noopener\" style=\"color:#3b82f6;text-decoration:underline;\">' + label + "</a>";
        }
      } catch (_e) { /* ignore */ }
      return label;
    });
    html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote style="border-left:2px solid #cbd5e1;padding-left:8px;color:#64748b;margin:4px 0;font-style:italic;">$1</blockquote>');
    html = html.replace(/^#{3}\s+(.*)$/gm, '<strong style="font-size:13px;">$1</strong>');
    html = html.replace(/^#{2}\s+(.*)$/gm, '<strong style="font-size:14px;">$1</strong>');
    html = html.replace(/^#{1}\s+(.*)$/gm, '<strong style="font-size:15px;">$1</strong>');
    const lines = html.split("\n");
    const out: string[] = [];
    let inUl = false;
    let inOl = false;
    for (let i = 0; i < lines.length; i++) {
      const ulMatch = lines[i].match(/^[-*]\s+(.*)/);
      const olMatch = lines[i].match(/^\d+\.\s+(.*)/);
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
})();
