import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { PageWithHighlights } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Globe, MessageSquare, Highlighter, Trash2, ExternalLink, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { HighlightEditPanel } from "@/components/highlight-edit-panel";

export default function PageDetail() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: page, isLoading } = useQuery<PageWithHighlights>({
    queryKey: ["/api/pages", params.id],
  });

  const deleteHighlight = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/highlights/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Highlight deleted" });
    },
  });

  const domain = (() => {
    try { return page ? new URL(page.url).hostname : ""; } catch { return page?.url ?? ""; }
  })();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Page not found</p>
        <Link href="/">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button size="icon" variant="ghost" data-testid="button-back" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {page.favicon ? (
                <img src={page.favicon} alt="" className="w-4 h-4 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <Globe className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">{domain}</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">{page.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="secondary">
                <Highlighter className="w-3 h-3 mr-1" />
                {page.highlightCount} highlights
              </Badge>
              <Badge variant="secondary">
                <MessageSquare className="w-3 h-3 mr-1" />
                {page.commentCount} comments
              </Badge>
              {page.lastVisited && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(page.lastVisited), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
        <a href={page.url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" data-testid="button-open-page">
            <ExternalLink className="w-3 h-3 mr-1" />
            Open
          </Button>
        </a>
      </div>

      {page.highlights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Highlighter className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No highlights on this page yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {page.highlights.map((highlight) => (
            <Card key={highlight.id} data-testid={`card-highlight-${highlight.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div
                      className="px-3 py-2 rounded-md text-sm leading-relaxed mb-3"
                      style={{
                        backgroundColor: highlight.style?.backgroundColor + "30",
                        borderLeft: `3px solid ${highlight.style?.backgroundColor}`,
                      }}
                      data-testid={`text-highlight-${highlight.id}`}
                    >
                      {highlight.selectedText}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: highlight.style?.backgroundColor }}
                      />
                      <span>{highlight.style?.name}</span>
                      {highlight.createdAt && (
                        <>
                          <span>-</span>
                          <span>{formatDistanceToNow(new Date(highlight.createdAt), { addSuffix: true })}</span>
                        </>
                      )}
                    </div>
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

                <HighlightEditPanel highlight={highlight} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
