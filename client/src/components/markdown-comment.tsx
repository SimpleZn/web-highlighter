import ReactMarkdown from "react-markdown";

export function MarkdownComment({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${className ?? ""}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="my-1 pl-4 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 pl-4 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith("language-");
            if (isBlock) {
              return (
                <pre className="bg-muted rounded-md p-2 overflow-x-auto my-1">
                  <code className="text-xs font-mono">{children}</code>
                </pre>
              );
            }
            return (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-1 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <p className="font-bold text-base my-1">{children}</p>,
          h2: ({ children }) => <p className="font-bold text-sm my-1">{children}</p>,
          h3: ({ children }) => <p className="font-semibold text-sm my-1">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
