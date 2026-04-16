import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { MarkdownComment } from "@/components/markdown-comment";
import type { HighlightWithComments } from "@shared/schema";

export function CommentInput({ highlightId }: { highlightId: string }) {
  const [text, setText] = useState("");
  const { toast } = useToast();

  const addComment = useMutation({
    mutationFn: () => apiRequest("POST", "/api/comments", { highlightId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      setText("");
      toast({ title: "Comment added" });
    },
  });

  return (
    <div className="flex items-start gap-2 mt-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
        className="min-h-[36px] text-sm resize-none"
        rows={1}
        data-testid={`input-comment-${highlightId}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && text.trim()) {
            e.preventDefault();
            addComment.mutate();
          }
        }}
      />
      <Button
        size="icon"
        variant="ghost"
        disabled={!text.trim() || addComment.isPending}
        onClick={() => addComment.mutate()}
        data-testid={`button-send-comment-${highlightId}`}
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function HighlightEditPanel({ highlight }: { highlight: HighlightWithComments }) {
  const { toast } = useToast();

  const deleteComment = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Comment deleted" });
    },
  });

  return (
    <>
      {highlight.comments.length > 0 && (
        <div className="mt-4 space-y-2 pl-3 border-l-2 border-border">
          {highlight.comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start justify-between gap-2 group"
              data-testid={`card-comment-${comment.id}`}
            >
              <div className="flex-1">
                <MarkdownComment text={comment.text} className="text-sm" />
                {comment.createdAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteComment.mutate(comment.id)}
                data-testid={`button-delete-comment-${comment.id}`}
              >
                <Trash2 className="w-3 h-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <CommentInput highlightId={highlight.id} />
    </>
  );
}
