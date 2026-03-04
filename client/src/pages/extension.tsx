import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chrome, Code, Highlighter, MessageSquare, Palette, Cloud, CheckCircle2, Copy, MousePointerClick, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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
    { icon: MousePointerClick, title: "Right-Click Menu", desc: "Select text, right-click to highlight or add a comment instantly" },
    { icon: Highlighter, title: "Inline Toolbar", desc: "A floating toolbar appears on text selection for quick highlighting" },
    { icon: MessageSquare, title: "Inline Comments", desc: "Add comments directly on highlighted text with a popup dialog" },
    { icon: Palette, title: "Multiple Styles", desc: "Choose from 6 default colors or create custom highlight styles" },
    { icon: Cloud, title: "Server Sync", desc: "Sync your highlights to this dashboard for cloud backup" },
    { icon: Settings, title: "Configurable", desc: "Options page to manage styles, server URL, and data export" },
  ];

  const steps = [
    { num: "1", title: "Build the Extension", desc: "Run the build command in the Replit shell to generate the extension package." },
    { num: "2", title: "Open Chrome Extensions", desc: "Navigate to chrome://extensions in your Chrome browser." },
    { num: "3", title: "Enable Developer Mode", desc: "Toggle the 'Developer mode' switch in the top right corner." },
    { num: "4", title: "Load Unpacked", desc: "Click 'Load unpacked' and select the dist/extension folder from this project." },
    { num: "5", title: "Configure Server URL", desc: "Click the extension icon, go to Settings, and enter this dashboard's URL for sync." },
  ];

  const usageSteps = [
    { icon: MousePointerClick, title: "Select Text", desc: "Select any text on a webpage. A floating toolbar appears, or right-click for the context menu." },
    { icon: Highlighter, title: "Highlight", desc: "Click 'Highlight' to mark the text, or choose a color first from the toolbar." },
    { icon: MessageSquare, title: "Comment", desc: "Click 'Comment' to add a note. A dialog appears where you can type your comment." },
    { icon: Zap, title: "Manage", desc: "Click highlighted text to see options. Use the popup to view all highlights on the current page." },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-extension-title">Chrome Extension</h1>
        <p className="text-muted-foreground mt-1">Highlight text and add comments on any webpage, synced to this dashboard.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary flex-shrink-0">
                <f.icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-medium text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground flex-shrink-0">
              <Chrome className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Installation</h2>
              <p className="text-sm text-muted-foreground">Set up the extension in your Chrome browser</p>
            </div>
          </div>
          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.num} className="flex items-start gap-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-sm font-semibold flex-shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-medium text-sm">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.desc}</p>
                  {step.num === "1" && (
                    <div className="mt-2 bg-muted rounded-md px-3 py-2">
                      <code className="text-xs font-mono">npx tsx script/build-extension.ts</code>
                    </div>
                  )}
                  {step.num === "5" && (
                    <div className="mt-2 bg-muted rounded-md px-3 py-2">
                      <code className="text-xs font-mono text-muted-foreground">
                        Enter this dashboard URL in the extension's Settings page
                      </code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">How to Use</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {usageSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary flex-shrink-0">
                  <step.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{step.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Code className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Extension Architecture</h2>
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Core Files</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">manifest.json</Badge>
                    <span className="text-xs text-muted-foreground">Extension configuration (Manifest V3)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">src/content.js</Badge>
                    <span className="text-xs text-muted-foreground">Injected into pages for highlighting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">src/content.css</Badge>
                    <span className="text-xs text-muted-foreground">Styles for toolbar and highlights</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">src/background.js</Badge>
                    <span className="text-xs text-muted-foreground">Service worker for context menu & sync</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">UI Pages</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">popup.html</Badge>
                    <span className="text-xs text-muted-foreground">Quick access popup with stats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">popup.js</Badge>
                    <span className="text-xs text-muted-foreground">Popup logic and highlight list</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">options.html</Badge>
                    <span className="text-xs text-muted-foreground">Full settings page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">options.js</Badge>
                    <span className="text-xs text-muted-foreground">Style management & server config</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="font-medium text-sm mb-2">Data Flow</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Content script detects text selection and shows a toolbar or responds to context menu.
                Highlights are saved to <code className="px-1 py-0.5 bg-muted rounded text-[11px]">chrome.storage.local</code>.
                The background service worker handles context menus and syncs data to the platform API when requested.
                Styles can be synced bidirectionally between the extension and the server.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
