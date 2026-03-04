import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Highlighter, MessageSquare, Globe, Trash2, RefreshCw, LayoutDashboard, Settings } from "lucide-react";
import { MarkdownComment } from "@/components/markdown-comment";

interface ChromeHighlight {
  id: string;
  url: string;
  pageTitle: string;
  selectedText: string;
  comment: string | null;
  styleName: string;
  styleBackgroundColor: string;
  createdAt: string;
}

interface ChromeStyle {
  id: string;
  name: string;
  backgroundColor: string;
  borderColor: string;
  isDefault: boolean;
}

export default function PopupApp() {
  const [enabled, setEnabled] = useState(true);
  const [highlights, setHighlights] = useState<ChromeHighlight[]>([]);
  const [pageHighlights, setPageHighlights] = useState<ChromeHighlight[]>([]);
  const [styles, setStyles] = useState<ChromeStyle[]>([]);
  const [activeStyleIndex, setActiveStyleIndex] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const loadData = useCallback(() => {
    chrome.storage.local.get(["highlights", "styles", "enabled"], (result) => {
      const allHighlights = result.highlights || [];
      const allStyles = result.styles || [];
      setHighlights(allHighlights);
      setStyles(allStyles);
      setEnabled(result.enabled !== false);

      const defaultIdx = allStyles.findIndex((s: ChromeStyle) => s.isDefault);
      if (defaultIdx >= 0) setActiveStyleIndex(defaultIdx);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0]?.url || "";
        setPageHighlights(allHighlights.filter((h: ChromeHighlight) => h.url === currentUrl));
      });
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleToggle = (value: boolean) => {
    setEnabled(value);
    chrome.storage.local.set({ enabled: value });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE", enabled: value });
      }
    });
  };

  const handleStyleClick = (index: number) => {
    setActiveStyleIndex(index);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "SET_STYLE_INDEX", index });
      }
    });
  };

  const handleDelete = (id: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_HIGHLIGHT", id }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "REMOVE_HIGHLIGHT_FROM_PAGE", id });
        }
      });
      loadData();
    });
  };

  const handleSync = () => {
    setSyncing(true);
    chrome.runtime.sendMessage({ type: "SYNC_TO_SERVER" }, (result) => {
      setSyncing(false);
      if (result?.success) {
        setToast({ message: result.message || "Synced successfully", type: "success" });
      } else {
        setToast({ message: result?.error || "Sync failed", type: "error" });
      }
    });
  };

  const commentCount = highlights.filter((h) => h.comment).length;

  return (
    <div className="w-[360px] bg-background text-foreground" data-testid="popup-root">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground">
            <Highlighter className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm">Web Highlighter</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="toggle-ext" className="text-xs text-muted-foreground">
            {enabled ? "On" : "Off"}
          </Label>
          <Switch
            id="toggle-ext"
            checked={enabled}
            onCheckedChange={handleToggle}
            data-testid="switch-toggle-enabled"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <div className="text-center p-2 rounded-md bg-muted/50">
          <div className="text-lg font-semibold" data-testid="stat-total">{highlights.length}</div>
          <div className="text-[10px] text-muted-foreground">Total</div>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <div className="text-lg font-semibold" data-testid="stat-page">{pageHighlights.length}</div>
          <div className="text-[10px] text-muted-foreground">This Page</div>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <div className="text-lg font-semibold" data-testid="stat-comments">{commentCount}</div>
          <div className="text-[10px] text-muted-foreground">Comments</div>
        </div>
      </div>

      {styles.length > 0 && (
        <div className="px-3 pb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Style</div>
          <div className="flex gap-1.5 flex-wrap">
            {styles.map((style, i) => (
              <button
                key={style.id}
                onClick={() => handleStyleClick(i)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors ${
                  i === activeStyleIndex
                    ? "border-foreground/30 bg-muted"
                    : "border-transparent hover:bg-muted/50"
                }`}
                data-testid={`button-style-${style.id}`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: style.backgroundColor }}
                />
                {style.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <Globe className="w-3 h-3" />
            This Page
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {pageHighlights.length}
            </Badge>
          </span>
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          {pageHighlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Highlighter className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                No highlights on this page yet. Select text to get started.
              </p>
            </div>
          ) : (
            <div className="px-3 pb-2 space-y-1.5">
              {pageHighlights.map((h) => (
                <Card key={h.id} className="border-border" data-testid={`card-highlight-${h.id}`}>
                  <CardContent className="p-2.5">
                    <div className="flex items-start gap-2">
                      <div
                        className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: h.styleBackgroundColor || "#FFF59D" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed line-clamp-2">{h.selectedText}</p>
                        {h.comment && (
                          <MarkdownComment
                            text={h.comment}
                            className="text-[11px] text-muted-foreground mt-1 line-clamp-2"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5 flex-shrink-0"
                        data-testid={`button-delete-${h.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border p-2 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={handleSync}
          disabled={syncing}
          data-testid="button-sync"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
          Sync
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/index.html") })}
          data-testid="button-dashboard"
        >
          <LayoutDashboard className="w-3 h-3 mr-1" />
          Dashboard
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={() => chrome.runtime.openOptionsPage()}
          data-testid="button-settings"
        >
          <Settings className="w-3 h-3 mr-1" />
          Settings
        </Button>
      </div>

      {toast && (
        <div
          className={`fixed bottom-2 left-2 right-2 px-3 py-2 rounded-md text-xs text-center ${
            toast.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
