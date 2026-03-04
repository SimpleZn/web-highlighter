import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Chrome, Code, Highlighter, MessageSquare, Palette, Cloud, CheckCircle2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const MANIFEST_JSON = `{
  "manifest_version": 3,
  "name": "Web Highlighter & Comments",
  "version": "1.0.0",
  "description": "Highlight text and add comments on any webpage",
  "permissions": ["storage", "activeTab", "contextMenus"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "css": ["content.css"],
      "js": ["content.js"]
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}`;

const CONTENT_JS = `// Web Highlighter Content Script
(function() {
  let currentStyle = null;
  let isEnabled = true;

  // Load styles from storage
  chrome.storage.local.get(['styles', 'enabled'], (result) => {
    if (result.styles) currentStyle = result.styles.find(s => s.isDefault) || result.styles[0];
    if (result.enabled !== undefined) isEnabled = result.enabled;
  });

  // Listen for text selection
  document.addEventListener('mouseup', (e) => {
    if (!isEnabled || !currentStyle) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    // Show highlight toolbar
    showToolbar(e.clientX, e.clientY, selection, text);
  });

  function showToolbar(x, y, selection, text) {
    removeToolbar();
    const toolbar = document.createElement('div');
    toolbar.id = 'wh-toolbar';
    toolbar.innerHTML = \\\`
      <button id="wh-highlight-btn" title="Highlight">🖍️</button>
      <button id="wh-comment-btn" title="Comment">💬</button>
    \\\`;
    toolbar.style.cssText = \\\`
      position: fixed; left: \\\${x}px; top: \\\${y - 45}px;
      background: white; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,.15);
      padding: 4px; display: flex; gap: 2px; z-index: 999999;
    \\\`;
    document.body.appendChild(toolbar);

    toolbar.querySelector('#wh-highlight-btn').onclick = () => {
      highlightSelection(selection, text);
      removeToolbar();
    };
    toolbar.querySelector('#wh-comment-btn').onclick = () => {
      const comment = prompt('Add a comment:');
      if (comment) highlightSelection(selection, text, comment);
      removeToolbar();
    };

    setTimeout(() => removeToolbar(), 5000);
  }

  function removeToolbar() {
    const el = document.getElementById('wh-toolbar');
    if (el) el.remove();
  }

  function highlightSelection(selection, text, comment) {
    const range = selection.getRangeAt(0);
    const mark = document.createElement('mark');
    mark.style.backgroundColor = currentStyle.backgroundColor;
    mark.style.color = currentStyle.color;
    mark.style.borderRadius = '2px';
    mark.style.padding = '1px 2px';
    mark.className = 'wh-highlight';
    range.surroundContents(mark);

    const highlight = {
      id: Date.now().toString(),
      url: window.location.href,
      title: document.title,
      text, comment,
      style: currentStyle,
      xpath: getXPath(mark),
      createdAt: new Date().toISOString()
    };

    chrome.storage.local.get(['highlights'], (result) => {
      const highlights = result.highlights || [];
      highlights.push(highlight);
      chrome.storage.local.set({ highlights });
    });

    selection.removeAllRanges();
  }

  function getXPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) index++;
        sibling = sibling.previousSibling;
      }
      parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
      current = current.parentNode;
    }
    return '/' + parts.join('/');
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SET_STYLE') currentStyle = msg.style;
    if (msg.type === 'TOGGLE') isEnabled = msg.enabled;
  });
})();`;

const CONTENT_CSS = `.wh-highlight {
  cursor: pointer;
  transition: opacity 0.2s;
}
.wh-highlight:hover {
  opacity: 0.8;
}
#wh-toolbar button {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}
#wh-toolbar button:hover {
  background: #f0f0f0;
}`;

const POPUP_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { width: 320px; font-family: system-ui; padding: 16px; margin: 0; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    .stats { display: flex; gap: 12px; margin-bottom: 16px; }
    .stat { flex: 1; text-align: center; padding: 8px; background: #f5f5f5; border-radius: 8px; }
    .stat-value { font-size: 20px; font-weight: 600; }
    .stat-label { font-size: 11px; color: #666; }
    .btn { width: 100%; padding: 10px; border: none; border-radius: 8px;
      background: #3b82f6; color: white; cursor: pointer; font-size: 13px; margin-top: 8px; }
    .btn:hover { background: #2563eb; }
    .btn-outline { background: white; color: #333; border: 1px solid #ddd; }
    .btn-outline:hover { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Web Highlighter</h1>
  <div class="stats">
    <div class="stat"><div class="stat-value" id="h-count">0</div><div class="stat-label">Highlights</div></div>
    <div class="stat"><div class="stat-value" id="c-count">0</div><div class="stat-label">Comments</div></div>
  </div>
  <button class="btn" id="toggle-btn">Disable Highlighting</button>
  <button class="btn btn-outline" id="dashboard-btn">Open Dashboard</button>
  <script src="popup.js"></script>
</body>
</html>`;

const POPUP_JS = `chrome.storage.local.get(['highlights', 'enabled'], (result) => {
  const highlights = result.highlights || [];
  const comments = highlights.filter(h => h.comment).length;
  document.getElementById('h-count').textContent = highlights.length;
  document.getElementById('c-count').textContent = comments;

  const enabled = result.enabled !== false;
  const btn = document.getElementById('toggle-btn');
  btn.textContent = enabled ? 'Disable Highlighting' : 'Enable Highlighting';
  btn.onclick = () => {
    chrome.storage.local.set({ enabled: !enabled });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', enabled: !enabled });
    });
    btn.textContent = !enabled ? 'Disable Highlighting' : 'Enable Highlighting';
  };
});

document.getElementById('dashboard-btn').onclick = () => {
  chrome.tabs.create({ url: 'DASHBOARD_URL' });
};`;

const BACKGROUND_JS = `chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'highlight-selection',
    title: 'Highlight Selection',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'highlight-selection') {
    chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT_SELECTION' });
  }
});`;

function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: `Copied ${filename}` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between bg-muted px-4 py-2 rounded-t-md border border-b-0 border-border">
        <span className="text-xs font-mono text-muted-foreground">{filename}</span>
        <Button size="sm" variant="ghost" onClick={handleCopy} data-testid={`button-copy-${filename}`}>
          {copied ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="bg-card border border-border rounded-b-md p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[400px] overflow-y-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Extension() {
  const features = [
    { icon: Highlighter, title: "Text Highlighting", desc: "Select any text on a webpage and highlight it with customizable colors" },
    { icon: MessageSquare, title: "Inline Comments", desc: "Add comments to your highlights for notes and context" },
    { icon: Palette, title: "Custom Styles", desc: "Configure multiple highlight styles with different colors" },
    { icon: Cloud, title: "Cloud Sync Ready", desc: "Data stored locally with API endpoints ready for cloud sync" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-extension-title">Chrome Extension</h1>
        <p className="text-muted-foreground mt-1">Get the browser extension to start highlighting text on any webpage.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((f, i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 text-primary flex-shrink-0">
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 text-primary flex-shrink-0">
              <Chrome className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-medium">Installation Guide</h2>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Create a new folder on your computer for the extension files</li>
                <li>Copy each file below into the folder with the exact filename shown</li>
                <li>Open Chrome and navigate to <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">chrome://extensions</code></li>
                <li>Enable "Developer mode" in the top right corner</li>
                <li>Click "Load unpacked" and select your extension folder</li>
                <li>The extension icon will appear in your toolbar</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Code className="w-5 h-5" />
          Extension Source Files
        </h2>
        <Tabs defaultValue="manifest" className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="manifest" data-testid="tab-manifest">manifest.json</TabsTrigger>
            <TabsTrigger value="content-js" data-testid="tab-content-js">content.js</TabsTrigger>
            <TabsTrigger value="content-css" data-testid="tab-content-css">content.css</TabsTrigger>
            <TabsTrigger value="popup-html" data-testid="tab-popup-html">popup.html</TabsTrigger>
            <TabsTrigger value="popup-js" data-testid="tab-popup-js">popup.js</TabsTrigger>
            <TabsTrigger value="background" data-testid="tab-background">background.js</TabsTrigger>
          </TabsList>
          <TabsContent value="manifest"><CodeBlock code={MANIFEST_JSON} filename="manifest.json" /></TabsContent>
          <TabsContent value="content-js"><CodeBlock code={CONTENT_JS} filename="content.js" /></TabsContent>
          <TabsContent value="content-css"><CodeBlock code={CONTENT_CSS} filename="content.css" /></TabsContent>
          <TabsContent value="popup-html"><CodeBlock code={POPUP_HTML} filename="popup.html" /></TabsContent>
          <TabsContent value="popup-js"><CodeBlock code={POPUP_JS} filename="popup.js" /></TabsContent>
          <TabsContent value="background"><CodeBlock code={BACKGROUND_JS} filename="background.js" /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
