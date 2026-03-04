import { useQuery, useMutation } from "@tanstack/react-query";
import type { HighlightWithComments, PageWithHighlights } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Highlighter, Search, Trash2, MessageSquare, Globe, Filter, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import { MarkdownComment } from "@/components/markdown-comment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Highlights() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPageId, setSelectedPageId] = useState<string>("all");
  const [selectedStyleName, setSelectedStyleName] = useState<string>("all");
  const { toast } = useToast();

  const { data: pages, isLoading } = useQuery<PageWithHighlights[]>({
    queryKey: ["/api/pages"],
  });

  const allHighlights = useMemo(() => {
    if (!pages) return [];
    return pages.flatMap((page) =>
      page.highlights.map((h) => ({ ...h, page }))
    );
  }, [pages]);

  const styleNames = useMemo(() => {
    const names = new Set<string>();
    allHighlights.forEach((h) => { if (h.style?.name) names.add(h.style.name); });
    return Array.from(names);
  }, [allHighlights]);

  const filteredHighlights = useMemo(() => {
    return allHighlights.filter((h) => {
      const matchesSearch = !searchQuery || h.selectedText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.comments.some((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPage = selectedPageId === "all" || h.page.id === selectedPageId;
      const matchesStyle = selectedStyleName === "all" || h.style?.name === selectedStyleName;
      return matchesSearch && matchesPage && matchesStyle;
    });
  }, [allHighlights, searchQuery, selectedPageId, selectedStyleName]);

  const deleteHighlight = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/highlights/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Highlight deleted" });
    },
  });

  const hasFilters = searchQuery || selectedPageId !== "all" || selectedStyleName !== "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-highlights-title">All Highlights</h1>
        <p className="text-muted-foreground mt-1">Browse and search all your highlights across pages.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search highlights and comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={selectedPageId} onValueChange={setSelectedPageId}>
          <SelectTrigger className="w-[180px]" data-testid="select-page-filter">
            <Filter className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Filter by page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pages</SelectItem>
            {pages?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStyleName} onValueChange={setSelectedStyleName}>
          <SelectTrigger className="w-[150px]" data-testid="select-style-filter">
            <SelectValue placeholder="Filter by color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colors</SelectItem>
            {styleNames.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchQuery(""); setSelectedPageId("all"); setSelectedStyleName("all"); }}
            data-testid="button-clear-filters"
          >
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filteredHighlights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Highlighter className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-2">
              {hasFilters ? "No matching highlights" : "No highlights yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {hasFilters
                ? "Try adjusting your filters or search query."
                : "Start highlighting text on web pages using the Chrome extension."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{filteredHighlights.length} highlight{filteredHighlights.length !== 1 ? "s" : ""}</p>
          {filteredHighlights.map((highlight) => (
            <Card key={highlight.id} data-testid={`card-highlight-${highlight.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{highlight.page.title}</span>
                    </div>
                    <div
                      className="px-3 py-2 rounded-md text-sm leading-relaxed"
                      style={{
                        backgroundColor: highlight.style?.backgroundColor + "30",
                        borderLeft: `3px solid ${highlight.style?.backgroundColor}`,
                      }}
                    >
                      {highlight.selectedText}
                    </div>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: highlight.style?.backgroundColor }}
                        />
                        <span className="text-xs text-muted-foreground">{highlight.style?.name}</span>
                      </div>
                      {highlight.comments.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {highlight.comments.length}
                        </Badge>
                      )}
                      {highlight.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(highlight.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    {highlight.comments.length > 0 && (
                      <div className="mt-3 space-y-1.5 pl-3 border-l-2 border-border">
                        {highlight.comments.slice(0, 2).map((c) => (
                          <MarkdownComment key={c.id} text={c.text} className="text-xs text-muted-foreground" />
                        ))}
                        {highlight.comments.length > 2 && (
                          <p className="text-xs text-muted-foreground">+{highlight.comments.length - 2} more</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteHighlight.mutate(highlight.id)}
                    data-testid={`button-delete-highlight-${highlight.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
