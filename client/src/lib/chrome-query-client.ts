import { QueryClient } from "@tanstack/react-query";
import {
  getChromePages,
  getChromePage,
  getChromeStyles,
  chromeDeleteHighlight,
  chromeCreateStyle,
  chromeUpdateStyle,
  chromeDeleteStyle,
  chromeAddComment,
  chromeDeleteComment,
  chromeExportData,
} from "./chrome-storage";

async function chromeApiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  if (method === "DELETE" && url.match(/^\/api\/highlights\//)) {
    const id = url.split("/").pop()!;
    await chromeDeleteHighlight(id);
    return new Response("OK", { status: 200 });
  }

  if (method === "DELETE" && url.match(/^\/api\/styles\//)) {
    const id = url.split("/").pop()!;
    try {
      await chromeDeleteStyle(id);
      return new Response("OK", { status: 200 });
    } catch (err) {
      return new Response((err as Error).message, { status: 400 });
    }
  }

  if (method === "POST" && url === "/api/styles") {
    const result = await chromeCreateStyle(data as Record<string, unknown>);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "PATCH" && url.match(/^\/api\/styles\//)) {
    const id = url.split("/").pop()!;
    const result = await chromeUpdateStyle(id, data as Record<string, unknown>);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "POST" && url === "/api/comments") {
    const result = await chromeAddComment(data as { highlightId: string; text: string });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "DELETE" && url.match(/^\/api\/comments\//)) {
    const id = url.split("/").pop()!;
    await chromeDeleteComment(id);
    return new Response("OK", { status: 200 });
  }

  throw new Error(`Unsupported operation: ${method} ${url}`);
}

const chromeQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }): Promise<unknown> => {
  const path = queryKey[0] as string;

  if (path === "/api/pages" && queryKey.length === 1) {
    return getChromePages();
  }

  if (path === "/api/pages" && queryKey.length === 2) {
    return getChromePage(queryKey[1] as string);
  }

  if (path === "/api/styles") {
    return getChromeStyles();
  }

  throw new Error(`Unknown query path: ${path}`);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: chromeQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const apiRequest = chromeApiRequest;

export async function exportData(): Promise<unknown> {
  return chromeExportData();
}
