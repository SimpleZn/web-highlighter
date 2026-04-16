interface StoredComment {
  id: string;
  text: string;
  createdAt: string;
}

interface StoredHighlight {
  id: string;
  url: string;
  pageTitle: string;
  favicon: string;
  selectedText: string;
  comments: StoredComment[];
  styleId: string;
  styleName: string;
  styleColor: string;
  styleBackgroundColor: string;
  styleBorderColor?: string;
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

(function () {
  "use strict";

  let isEnabled = true;
  let styles: HighlightStyle[] = [];
  let currentStyleIndex = 0;
  let toolbar: HTMLDivElement | null = null;

  init();

  function init(): void {
    chrome.storage.local.get(["styles", "enabled"], (result: Record<string, any>) => {
      styles = result["styles"] || [];
      isEnabled = result["enabled"] !== false;
      restoreHighlights();
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "HIGHLIGHT_SELECTION") {
        handleHighlightFromContextMenu();
        sendResponse({ success: true });
      } else if (message.type === "TOGGLE") {
        isEnabled = message.enabled;
        sendResponse({ success: true });
      } else if (message.type === "SET_STYLE_INDEX") {
        currentStyleIndex = message.index;
        sendResponse({ success: true });
      } else if (message.type === "REFRESH_STYLES") {
        chrome.storage.local.get(["styles"], (r: Record<string, any>) => {
          styles = r["styles"] || [];
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
    if (parent.closest(".wh-ext-mark, .wh-ext-toolbar, .wh-ext-popover, #wh-ext-toolbar, #wh-ext-popover")) {
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

    const segments: Array<{ node: Text; start: number; end: number }> = [];
    const root = range.commonAncestorContainer;

    if (root.nodeType === Node.TEXT_NODE) {
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

        if (textNode === range.startContainer) start = range.startOffset;
        if (textNode === range.endContainer) end = range.endOffset;

        if (end > start) segments.push({ node: textNode, start, end });
      }
    }

    if (segments.length === 0) return marks;

    for (const seg of segments) {
      try {
        let targetNode = seg.node;
        if (seg.end < targetNode.length) targetNode.splitText(seg.end);
        if (seg.start > 0) targetNode = targetNode.splitText(seg.start);

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
  }

  function onMouseUp(e: MouseEvent): void {
    if (!isEnabled) return;
    if (toolbar && toolbar.contains(e.target as Node)) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showToolbar(rect, selection);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      removeToolbar();
      closePopover();
    }
  }

  function handleHighlightFromContextMenu(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;
    doHighlight(selection, text);
  }

  function showToolbar(rect: DOMRect, _selection: Selection): void {
    removeToolbar();

    toolbar = document.createElement("div");
    toolbar.id = "wh-ext-toolbar";
    toolbar.className = "wh-ext-toolbar";

    toolbar.innerHTML = `
      <div class="wh-ext-toolbar-row">
        <div class="wh-ext-split-btn">
          <button class="wh-ext-btn wh-ext-btn-highlight" data-action="highlight" title="Highlight">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 11-6 6v3h9l3-3"></path>
              <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
            </svg>
            <span>Highlight</span>
            <span class="wh-ext-current-dot"></span>
          </button>
          <button class="wh-ext-btn-chevron" title="Change color">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><polyline points="2 3.5 5 6.5 8 3.5"/></svg>
          </button>
        </div>
      </div>
      <div class="wh-ext-toolbar-colors"></div>
    `;

    const colorsContainer = toolbar.querySelector<HTMLDivElement>(".wh-ext-toolbar-colors");
    if (colorsContainer) {
      styles.forEach((s, i) => {
        const btn = document.createElement("button");
        const isActive = i === currentStyleIndex;
        btn.className = `wh-ext-color-btn${isActive ? " wh-ext-color-active" : ""}`;
        btn.dataset.index = String(i);
        btn.title = s.name;
        btn.style.backgroundColor = s.backgroundColor;
        btn.style.boxShadow = isActive
          ? `0 0 0 2px #fff, 0 0 0 3.5px ${s.borderColor || "#1f2937"}`
          : "0 1px 3px rgba(0,0,0,0.18)";
        colorsContainer.appendChild(btn);
      });
    }

    // Initial color dot
    const currentDot = toolbar.querySelector<HTMLSpanElement>(".wh-ext-current-dot")!;
    const initStyle = styles[currentStyleIndex];
    if (initStyle) {
      currentDot.style.backgroundColor = initStyle.backgroundColor;
      currentDot.style.borderColor = initStyle.borderColor || initStyle.backgroundColor;
    }

    // Chevron toggle
    const chevron = toolbar.querySelector<HTMLButtonElement>(".wh-ext-btn-chevron")!;
    chevron.addEventListener("click", (e) => {
      e.stopPropagation();
      colorsContainer?.classList.toggle("wh-ext-colors-open");
      chevron.classList.toggle("wh-ext-chevron-open");
    });

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
        const activeStyle = styles[currentStyleIndex];
        toolbar!.querySelectorAll<HTMLButtonElement>(".wh-ext-color-btn").forEach((b, idx) => {
          b.classList.remove("wh-ext-color-active");
          b.style.boxShadow = "0 1px 3px rgba(0,0,0,0.18)";
        });
        btn.classList.add("wh-ext-color-active");
        btn.style.boxShadow = `0 0 0 2px #fff, 0 0 0 3.5px ${activeStyle?.borderColor || "#1f2937"}`;
        // Sync dot
        const dot = toolbar!.querySelector<HTMLSpanElement>(".wh-ext-current-dot");
        if (dot && activeStyle) {
          dot.style.backgroundColor = activeStyle.backgroundColor;
          dot.style.borderColor = activeStyle.borderColor || activeStyle.backgroundColor;
        }
      });
    });

    toolbar.querySelector<HTMLButtonElement>('[data-action="highlight"]')!.addEventListener("click", (e) => {
      e.stopPropagation();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        doHighlight(sel, sel.toString().trim());
      }
      removeToolbar();
    });
  }

  function doHighlight(selection: Selection, text: string): void {
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
          attachPopoverTrigger(m, response.highlight.id);
        });
      } else {
        marks.forEach((m) => {
          const parent = m.parentNode;
          if (parent) {
            while (m.firstChild) parent.insertBefore(m.firstChild, m);
            parent.removeChild(m);
            (parent as Element).normalize?.();
          } else {
            m.remove();
          }
        });
      }
    });
  }

  // ─── Popover ──────────────────────────────────────────────────────────────

  function attachPopoverTrigger(mark: HTMLElement, highlightId: string): void {
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      openPopover(mark, highlightId);
    });
  }

  function closePopover(): void {
    const existing = document.getElementById("wh-ext-popover");
    if (existing) existing.remove();
  }

  function openPopover(anchor: HTMLElement, highlightId: string): void {
    closePopover();

    const popover = document.createElement("div");
    popover.id = "wh-ext-popover";
    popover.className = "wh-ext-popover";
    popover.innerHTML = `<div class="wh-ext-popover-loading">Loading…</div>`;
    positionPopover(popover, anchor);
    document.body.appendChild(popover);

    chrome.runtime.sendMessage({ type: "GET_HIGHLIGHT", id: highlightId }, (response) => {
      const highlight: StoredHighlight | null = response?.highlight || null;
      if (!highlight) { popover.remove(); return; }
      renderPopover(popover, anchor, highlight);
    });

    const closeOnOutsideClick = (e: MouseEvent): void => {
      if (!popover.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
        popover.remove();
        document.removeEventListener("mousedown", closeOnOutsideClick);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closeOnOutsideClick), 100);
  }

  function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    popover.style.left = rect.left + scrollX + rect.width / 2 + "px";
    popover.style.top = rect.bottom + scrollY + 8 + "px";

    // Arrow element pointing up to anchor
    const arrow = document.createElement("div");
    arrow.className = "wh-ext-popover-arrow";
    arrow.style.cssText = [
      "all:initial",
      "position:absolute !important",
      `left:${rect.left + scrollX + rect.width / 2}px !important`,
      `top:${rect.bottom + scrollY + 1}px !important`,
      "transform:translateX(-50%) !important",
      "width:0 !important",
      "height:0 !important",
      "border-left:7px solid transparent !important",
      "border-right:7px solid transparent !important",
      "border-bottom:7px solid rgba(0,0,0,0.07) !important",
      `z-index:${2147483646} !important`,
      "pointer-events:none !important",
    ].join(";");

    const arrowInner = document.createElement("div");
    arrowInner.style.cssText = [
      "all:initial",
      "position:absolute !important",
      "left:-6px !important",
      "top:2px !important",
      "width:0 !important",
      "height:0 !important",
      "border-left:6px solid transparent !important",
      "border-right:6px solid transparent !important",
      "border-bottom:6px solid #ffffff !important",
    ].join(";");
    arrow.appendChild(arrowInner);
    document.body.appendChild(arrow);

    // Remove arrow when popover is removed (use MutationObserver)
    const obs = new MutationObserver(() => {
      if (!document.body.contains(popover)) { arrow.remove(); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: false });
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function truncateText(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
  }

  function renderPopover(popover: HTMLElement, anchor: HTMLElement, highlight: StoredHighlight): void {
    const comments = highlight.comments || [];

    popover.innerHTML = `
      <div class="wh-ext-popover-header">
        <span class="wh-ext-popover-badge" style="background-color:${highlight.styleBackgroundColor}">
          <span class="wh-ext-badge-dot" style="background-color:${highlight.styleBorderColor || highlight.styleBackgroundColor}"></span>
          <span class="wh-ext-badge-name">${escapeHtml(highlight.styleName || "Highlight")}</span>
        </span>
        <div class="wh-ext-style-palette"></div>
        <button class="wh-ext-popover-close" title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
        </button>
      </div>
      <div class="wh-ext-popover-quote" style="border-left-color:${highlight.styleBackgroundColor}">${escapeHtml(truncateText(highlight.selectedText, 120))}</div>
      <div class="wh-ext-comments-list"></div>
      <div class="wh-ext-add-comment">
        <textarea class="wh-ext-add-comment-input" placeholder="Add a comment…" rows="1"></textarea>
        <div class="wh-ext-add-comment-actions">
          <span class="wh-ext-add-comment-hint">↵ save &nbsp;·&nbsp; ⇧↵ newline</span>
          <button class="wh-ext-add-comment-btn">Add</button>
        </div>
      </div>
      <div class="wh-ext-popover-footer">
        <button class="wh-ext-popover-delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          Remove highlight
        </button>
      </div>
    `;

    renderCommentList(popover, highlight.id, comments);

    // Style palette
    const palette = popover.querySelector<HTMLDivElement>(".wh-ext-style-palette")!;
    styles.forEach((style) => {
      const dot = document.createElement("button");
      dot.className = "wh-ext-style-dot" + (style.id === highlight.styleId ? " wh-ext-style-dot-active" : "");
      dot.title = style.name;
      dot.style.cssText = [
        `background-color:${style.backgroundColor}`,
        style.id === highlight.styleId
          ? `box-shadow:0 0 0 2px #fff,0 0 0 3.5px ${style.borderColor || "#1f2937"}`
          : "box-shadow:0 1px 3px rgba(0,0,0,0.18)",
      ].join(";");
      dot.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "UPDATE_HIGHLIGHT_STYLE", id: highlight.id, style }, (resp) => {
          if (!resp?.success) return;
          highlight.styleId = style.id;
          highlight.styleName = style.name;
          highlight.styleColor = style.color;
          highlight.styleBackgroundColor = style.backgroundColor;
          highlight.styleBorderColor = style.borderColor;

          // Update DOM marks on the page
          const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(highlight.id) : highlight.id;
          document.querySelectorAll<HTMLElement>(`.wh-ext-mark[data-wh-id="${safeId}"]`).forEach((mark) => {
            mark.style.backgroundColor = style.backgroundColor;
          });

          // Update badge
          const badge = popover.querySelector<HTMLElement>(".wh-ext-popover-badge")!;
          badge.style.backgroundColor = style.backgroundColor;
          badge.querySelector<HTMLElement>(".wh-ext-badge-dot")!.style.backgroundColor = style.borderColor || style.backgroundColor;
          badge.querySelector<HTMLElement>(".wh-ext-badge-name")!.textContent = style.name;

          // Update quote accent
          const quote = popover.querySelector<HTMLElement>(".wh-ext-popover-quote");
          if (quote) quote.style.borderLeftColor = style.backgroundColor;

          // Update active dot
          palette.querySelectorAll<HTMLButtonElement>(".wh-ext-style-dot").forEach((d) => {
            d.classList.remove("wh-ext-style-dot-active");
            d.style.boxShadow = "0 1px 3px rgba(0,0,0,0.18)";
          });
          dot.classList.add("wh-ext-style-dot-active");
          dot.style.boxShadow = `0 0 0 2px #fff,0 0 0 3.5px ${style.borderColor || "#1f2937"}`;
        });
      });
      palette.appendChild(dot);
    });

    popover.querySelector<HTMLButtonElement>(".wh-ext-popover-close")!.addEventListener("click", () => {
      popover.remove();
    });

    // Clamp horizontal position after render
    requestAnimationFrame(() => {
      const pRect = popover.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      if (pRect.right > window.innerWidth - 8) {
        popover.style.left = window.innerWidth - pRect.width - 8 + scrollX + "px";
        popover.style.transform = "translateX(0)";
      }
    });

    // Add comment
    const addCommentSection = popover.querySelector<HTMLDivElement>(".wh-ext-add-comment")!;
    const textarea = popover.querySelector<HTMLTextAreaElement>(".wh-ext-add-comment-input")!;
    const addBtn = popover.querySelector<HTMLButtonElement>(".wh-ext-add-comment-btn")!;

    // Auto-grow textarea
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    });

    // Expand/collapse actions on focus
    textarea.addEventListener("focus", () => addCommentSection.classList.add("is-focused"));
    textarea.addEventListener("blur", () => {
      if (!textarea.value.trim()) addCommentSection.classList.remove("is-focused");
    });

    const submitAdd = () => {
      const text = textarea.value.trim();
      if (!text) return;
      addBtn.disabled = true;
      chrome.runtime.sendMessage({ type: "ADD_COMMENT", highlightId: highlight.id, text }, (resp) => {
        if (resp?.success) {
          highlight.comments = [...(highlight.comments || []), resp.comment];
          renderCommentList(popover, highlight.id, highlight.comments);
          textarea.value = "";
        }
        addBtn.disabled = false;
      });
    };

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitAdd();
      }
    });
    addBtn.addEventListener("click", submitAdd);

    // Delete highlight
    popover.querySelector<HTMLButtonElement>(".wh-ext-popover-delete")!.addEventListener("click", (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = "Removing…";
      chrome.runtime.sendMessage({ type: "DELETE_HIGHLIGHT", id: highlight.id }, () => {
        removeHighlightMark(highlight.id);
        popover.remove();
      });
    });
  }

  function renderCommentList(popover: HTMLElement, highlightId: string, comments: StoredComment[]): void {
    const list = popover.querySelector<HTMLDivElement>(".wh-ext-comments-list")!;
    list.innerHTML = "";

    if (comments.length === 0) {
      list.innerHTML = `<div class="wh-ext-no-comments">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>No comments yet</span>
      </div>`;
      return;
    }

    for (const comment of comments) {
      const item = document.createElement("div");
      item.className = "wh-ext-comment-item";
      item.dataset.id = comment.id;
      item.innerHTML = `
        <div class="wh-ext-comment-body">
          <div class="wh-ext-comment-content">
            <div class="wh-ext-comment-text">${renderMarkdown(comment.text)}</div>
            <span class="wh-ext-comment-time">${timeAgo(comment.createdAt)}</span>
          </div>
          <div class="wh-ext-comment-item-actions">
            <button class="wh-ext-comment-edit-btn" title="Edit">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="wh-ext-comment-delete-btn" title="Delete comment">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;

      // Edit
      item.querySelector<HTMLButtonElement>(".wh-ext-comment-edit-btn")!.addEventListener("click", () => {
        startEditComment(item, highlightId, comment, (updated) => {
          const idx = comments.findIndex((c) => c.id === comment.id);
          if (idx !== -1) { comments[idx] = updated; comment.text = updated.text; }
          renderCommentList(popover, highlightId, comments);
        });
      });

      // Delete
      item.querySelector<HTMLButtonElement>(".wh-ext-comment-delete-btn")!.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "DELETE_COMMENT", highlightId, commentId: comment.id }, (resp) => {
          if (resp?.success) {
            const remaining = comments.filter((c) => c.id !== comment.id);
            comments.length = 0;
            remaining.forEach((c) => comments.push(c));
            renderCommentList(popover, highlightId, comments);
          }
        });
      });

      list.appendChild(item);
    }
  }

  function startEditComment(
    item: HTMLElement,
    highlightId: string,
    comment: StoredComment,
    onSaved: (updated: StoredComment) => void,
  ): void {
    const body = item.querySelector<HTMLDivElement>(".wh-ext-comment-body")!;
    body.innerHTML = `
      <div class="wh-ext-edit-wrap">
        <textarea class="wh-ext-edit-input">${escapeHtml(comment.text)}</textarea>
        <div class="wh-ext-edit-actions">
          <button class="wh-ext-edit-cancel" title="Cancel (Esc)">
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
          </button>
          <button class="wh-ext-edit-save" title="Save (Enter)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 6.5 4.5 9.5 10.5 2.5"/></svg>
          </button>
        </div>
      </div>
    `;

    const textarea = body.querySelector<HTMLTextAreaElement>(".wh-ext-edit-input")!;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

    const save = () => {
      const text = textarea.value.trim();
      if (!text) return;
      chrome.runtime.sendMessage(
        { type: "UPDATE_COMMENT", highlightId, commentId: comment.id, text },
        (resp) => { if (resp?.success) onSaved(resp.comment); },
      );
    };

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
      if (e.key === "Escape") onSaved(comment); // cancel — re-render with original
    });
    body.querySelector<HTMLButtonElement>(".wh-ext-edit-cancel")!.addEventListener("click", () => onSaved(comment));
    body.querySelector<HTMLButtonElement>(".wh-ext-edit-save")!.addEventListener("click", save);
  }

  // ─── Highlight restoration ────────────────────────────────────────────────

  function removeHighlightMark(id: string): void {
    const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
    const marks = document.querySelectorAll<HTMLElement>(`.wh-ext-mark[data-wh-id="${safeId}"]`);
    marks.forEach((mark) => {
      const parent = mark.parentNode!;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      (parent as Element).normalize?.();
    });
  }

  function restoreHighlights(): void {
    const url = normalizeUrl(window.location.href);
    chrome.storage.local.get(["highlights"], (result: Record<string, any>) => {
      const highlights: StoredHighlight[] = result["highlights"] || [];
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
          if (parent.closest(".wh-ext-mark, .wh-ext-toolbar, .wh-ext-popover, #wh-ext-toolbar, #wh-ext-popover")) {
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
    while ((n = walker.nextNode())) nodes.push(n as Text);
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
    marks.forEach((m) => attachPopoverTrigger(m, highlight.id));
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
          return '<a href="' + escapeAttribute(parsed.toString()) + '" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:underline;">' + label + "</a>";
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
