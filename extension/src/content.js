(function () {
  "use strict";

  let isEnabled = true;
  let styles = [];
  let currentStyleIndex = 0;
  let toolbar = null;
  let commentDialog = null;
  let pendingSelection = null;

  init();

  function init() {
    chrome.storage.local.get(["styles", "enabled"], (result) => {
      styles = result.styles || [];
      isEnabled = result.enabled !== false;
      restoreHighlights();
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  function getCurrentStyle() {
    if (styles.length === 0) return null;
    const defaultStyle = styles.find((s) => s.isDefault);
    return styles[currentStyleIndex] || defaultStyle || styles[0];
  }

  function onMouseDown(e) {
    if (toolbar && !toolbar.contains(e.target)) {
      removeToolbar();
    }
    if (commentDialog && !commentDialog.contains(e.target)) {
      removeCommentDialog();
    }
  }

  function onMouseUp(e) {
    if (!isEnabled) return;
    if (toolbar && toolbar.contains(e.target)) return;
    if (commentDialog && commentDialog.contains(e.target)) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showToolbar(rect, selection, text);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      removeToolbar();
      removeCommentDialog();
    }
  }

  function handleHighlightFromContextMenu() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;
    doHighlight(selection, text, null);
  }

  function handleCommentFromContextMenu() {
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
    } catch (e) {}

    showCommentDialog(rect);
  }

  function showToolbar(rect, selection, text) {
    removeToolbar();

    toolbar = document.createElement("div");
    toolbar.id = "wh-ext-toolbar";
    toolbar.className = "wh-ext-toolbar";

    const style = getCurrentStyle();

    let stylesHtml = styles
      .map(
        (s, i) =>
          `<button class="wh-ext-color-btn ${i === currentStyleIndex ? "wh-ext-color-active" : ""}" 
            data-index="${i}" title="${s.name}"
            style="background-color: ${s.backgroundColor}; border-color: ${s.borderColor || s.backgroundColor}"></button>`
      )
      .join("");

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
      <div class="wh-ext-toolbar-colors">${stylesHtml}</div>
    `;

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

    toolbar.querySelectorAll(".wh-ext-color-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentStyleIndex = parseInt(btn.dataset.index);
        toolbar.querySelectorAll(".wh-ext-color-btn").forEach((b) => b.classList.remove("wh-ext-color-active"));
        btn.classList.add("wh-ext-color-active");
      });
    });

    toolbar.querySelector('[data-action="highlight"]').addEventListener("click", (e) => {
      e.stopPropagation();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        doHighlight(sel, sel.toString().trim(), null);
      }
      removeToolbar();
    });

    toolbar.querySelector('[data-action="comment"]').addEventListener("click", (e) => {
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

  function showCommentDialog(rect) {
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

    const textarea = commentDialog.querySelector("textarea");
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

    commentDialog.querySelector(".wh-ext-dialog-cancel").addEventListener("click", () => {
      removeCommentDialog();
    });

    commentDialog.querySelector(".wh-ext-dialog-save").addEventListener("click", () => {
      submitComment();
    });
  }

  function submitComment() {
    if (!pendingSelection) return;
    const textarea = commentDialog.querySelector("textarea");
    const comment = textarea.value.trim();

    let sel = window.getSelection();
    if (pendingSelection.rangeInfo) {
      try {
        const range = document.createRange();
        range.setStart(pendingSelection.rangeInfo.startContainer, pendingSelection.rangeInfo.startOffset);
        range.setEnd(pendingSelection.rangeInfo.endContainer, pendingSelection.rangeInfo.endOffset);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {}
    }

    if (sel && !sel.isCollapsed) {
      doHighlight(sel, pendingSelection.text, comment || null);
    }

    removeCommentDialog();
    pendingSelection = null;
  }

  function doHighlight(selection, text, comment) {
    const style = getCurrentStyle();
    if (!style) return;

    const range = selection.getRangeAt(0);
    let xpath = "";
    try {
      xpath = getXPath(range.startContainer.parentElement || range.startContainer);
    } catch (e) {}

    const mark = document.createElement("mark");
    mark.className = "wh-ext-mark";
    mark.style.backgroundColor = style.backgroundColor;
    mark.style.color = style.color;
    mark.dataset.whId = "pending";

    try {
      range.surroundContents(mark);
    } catch (e) {
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    }

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
      textOffset: 0,
      textLength: text.length,
    };

    chrome.runtime.sendMessage({ type: "SAVE_HIGHLIGHT", data }, (response) => {
      if (response && response.success) {
        mark.dataset.whId = response.highlight.id;
        addHighlightTooltip(mark, response.highlight);
      }
    });
  }

  function addHighlightTooltip(mark, highlight) {
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      showHighlightPopover(mark, highlight);
    });
  }

  function showHighlightPopover(mark, highlight) {
    const existing = document.getElementById("wh-ext-popover");
    if (existing) existing.remove();

    const popover = document.createElement("div");
    popover.id = "wh-ext-popover";
    popover.className = "wh-ext-popover";

    let commentHtml = "";
    if (highlight.comment) {
      commentHtml = `<div class="wh-ext-popover-comment">${escapeHtml(highlight.comment)}</div>`;
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

    popover.querySelector(".wh-ext-popover-close").addEventListener("click", () => {
      popover.remove();
    });

    popover.querySelector(".wh-ext-popover-delete").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "DELETE_HIGHLIGHT", id: highlight.id }, () => {
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
        popover.remove();
      });
    });

    const closeOnClick = (e) => {
      if (!popover.contains(e.target) && !mark.contains(e.target)) {
        popover.remove();
        document.removeEventListener("mousedown", closeOnClick);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closeOnClick), 100);
  }

  function removeHighlightMark(id) {
    const marks = document.querySelectorAll(`.wh-ext-mark[data-wh-id="${id}"]`);
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function restoreHighlights() {
    const url = normalizeUrl(window.location.href);
    chrome.storage.local.get(["highlights"], (result) => {
      const highlights = result.highlights || [];
      const pageHighlights = highlights.filter((h) => normalizeUrl(h.url) === url);
      if (pageHighlights.length === 0) return;

      if (document.readyState === "complete") {
        pageHighlights.forEach((h) => tryRestoreHighlight(h));
      } else {
        window.addEventListener("load", () => {
          pageHighlights.forEach((h) => tryRestoreHighlight(h));
        });
      }
    });
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      u.hash = "";
      return u.href.replace(/\/+$/, "");
    } catch (e) {
      return url;
    }
  }

  function tryRestoreHighlight(highlight) {
    const text = highlight.selectedText;
    if (!text) return;

    const existing = document.querySelector(`.wh-ext-mark[data-wh-id="${highlight.id}"]`);
    if (existing) return;

    const treeWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (node.parentElement && node.parentElement.closest(".wh-ext-mark, .wh-ext-toolbar, .wh-ext-popover, .wh-ext-comment-dialog")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node;
    while ((node = treeWalker.nextNode())) {
      const nodeText = node.textContent || "";
      const index = nodeText.indexOf(text);
      if (index === -1) continue;

      try {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);

        const mark = document.createElement("mark");
        mark.className = "wh-ext-mark";
        mark.style.backgroundColor = highlight.styleBackgroundColor || "#FFF59D";
        mark.style.color = highlight.styleColor || "#000000";
        mark.dataset.whId = highlight.id;

        range.surroundContents(mark);
        addHighlightTooltip(mark, highlight);
        return;
      } catch (e) {
        // surroundContents failed; try extractContents approach
      }
    }

    tryRestoreHighlightCrossElement(highlight);
  }

  function tryRestoreHighlightCrossElement(highlight) {
    const text = highlight.selectedText;
    if (!text) return;

    const bodyText = document.body.innerText || "";
    const textIndex = bodyText.indexOf(text);
    if (textIndex === -1) return;

    const treeWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (node.parentElement && node.parentElement.closest(".wh-ext-mark, .wh-ext-toolbar, .wh-ext-popover, .wh-ext-comment-dialog")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let charCount = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    let node;

    while ((node = treeWalker.nextNode())) {
      const len = node.textContent.length;
      if (!startNode && charCount + len > textIndex) {
        startNode = node;
        startOffset = textIndex - charCount;
      }
      if (startNode && charCount + len >= textIndex + text.length) {
        endNode = node;
        endOffset = textIndex + text.length - charCount;
        break;
      }
      charCount += len;
    }

    if (!startNode || !endNode) return;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      const mark = document.createElement("mark");
      mark.className = "wh-ext-mark";
      mark.style.backgroundColor = highlight.styleBackgroundColor || "#FFF59D";
      mark.style.color = highlight.styleColor || "#000000";
      mark.dataset.whId = highlight.id;

      if (startNode === endNode) {
        range.surroundContents(mark);
      } else {
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      }
      addHighlightTooltip(mark, highlight);
    } catch (e) {}
  }

  function removeToolbar() {
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
  }

  function removeCommentDialog() {
    if (commentDialog) {
      commentDialog.remove();
      commentDialog = null;
    }
  }

  function getXPath(element) {
    if (!element) return "";
    const parts = [];
    let current = element;
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

  function getFavicon() {
    const link =
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]') ||
      document.querySelector('link[rel*="icon"]');
    if (link) {
      try {
        return new URL(link.href, window.location.origin).href;
      } catch (e) {}
    }
    return window.location.origin + "/favicon.ico";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
