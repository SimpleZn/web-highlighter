import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { PageWithHighlights } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, MessageSquare, Highlighter, ExternalLink, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex items-center justify-center w-11 h-11 rounded-md ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold" data-testid={`stat-value-${label.toLowerCase()}`}>{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PageCard({ page }: { page: PageWithHighlights }) {
  const domain = (() => {
    try { return new URL(page.url).hostname; } catch { return page.url; }
  })();

  return (
    <Link href={`/pages/${page.id}`}>
      <Card className="hover-elevate cursor-pointer transition-all duration-200" data-testid={`card-page-${page.id}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {page.favicon ? (
                  <img src={page.favicon} alt="" className="w-4 h-4 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <Globe className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground truncate">{domain}</span>
              </div>
              <h3 className="font-medium text-sm leading-tight mb-3 line-clamp-2" data-testid={`text-page-title-${page.id}`}>
                {page.title}
              </h3>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  <Highlighter className="w-3 h-3 mr-1" />
                  {page.highlightCount}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {page.commentCount}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {page.lastVisited && formatDistanceToNow(new Date(page.lastVisited), { addSuffix: true })}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          {page.highlights.length > 0 && (
            <div className="mt-4 space-y-2">
              {page.highlights.slice(0, 2).map((h) => (
                <div key={h.id} className="flex items-start gap-2">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: h.style?.backgroundColor }}
                  />
                  <p className="text-xs text-muted-foreground line-clamp-1">{h.selectedText}</p>
                </div>
              ))}
              {page.highlights.length > 2 && (
                <p className="text-xs text-muted-foreground pl-4">+{page.highlights.length - 2} more</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-28 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: pages, isLoading } = useQuery<PageWithHighlights[]>({
    queryKey: ["/api/pages"],
  });

  const totalHighlights = pages?.reduce((sum, p) => sum + p.highlightCount, 0) ?? 0;
  const totalComments = pages?.reduce((sum, p) => sum + p.commentCount, 0) ?? 0;
  const totalPages = pages?.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of all your highlights and comments across the web.</p>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Globe} label="Pages" value={totalPages} color="bg-primary/10 text-primary" />
            <StatCard icon={Highlighter} label="Highlights" value={totalHighlights} color="bg-chart-2/10 text-chart-2" />
            <StatCard icon={MessageSquare} label="Comments" value={totalComments} color="bg-chart-4/10 text-chart-4" />
          </div>

          {totalPages === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Highlighter className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-lg mb-2">No highlights yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Install the Chrome extension to start highlighting text and adding comments on any webpage.
                </p>
                <Link href="/extension">
                  <Button className="mt-4" data-testid="button-get-extension">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Get Extension
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div>
              <h2 className="text-lg font-medium mb-4">Recent Pages</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pages?.map((page) => (
                  <PageCard key={page.id} page={page} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
