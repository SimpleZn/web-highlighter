import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHighlightStyleSchema, insertHighlightSchema, insertCommentSchema, insertPageSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await storage.seedDefaults();

  // Highlight Styles
  app.get("/api/styles", async (_req, res) => {
    const styles = await storage.getStyles();
    res.json(styles);
  });

  app.post("/api/styles", async (req, res) => {
    const parsed = insertHighlightStyleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const style = await storage.createStyle(parsed.data);
    res.status(201).json(style);
  });

  app.patch("/api/styles/:id", async (req, res) => {
    const style = await storage.updateStyle(req.params.id, req.body);
    if (!style) return res.status(404).json({ message: "Style not found" });
    res.json(style);
  });

  app.delete("/api/styles/:id", async (req, res) => {
    const result = await storage.deleteStyle(req.params.id);
    if (result.error) return res.status(400).json({ message: result.error });
    if (!result.deleted) return res.status(404).json({ message: "Style not found" });
    res.json({ success: true });
  });

  // Pages
  app.get("/api/pages", async (_req, res) => {
    const allPages = await storage.getPages();
    res.json(allPages);
  });

  app.get("/api/pages/:id", async (req, res) => {
    const page = await storage.getPage(req.params.id);
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json(page);
  });

  app.post("/api/pages", async (req, res) => {
    const parsed = insertPageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getPageByUrl(parsed.data.url);
    if (existing) return res.json(existing);
    const page = await storage.createPage(parsed.data);
    res.status(201).json(page);
  });

  // Highlights
  app.get("/api/highlights", async (req, res) => {
    const pageId = req.query.pageId as string | undefined;
    const allHighlights = await storage.getHighlights(pageId);
    res.json(allHighlights);
  });

  app.get("/api/highlights/:id", async (req, res) => {
    const highlight = await storage.getHighlight(req.params.id);
    if (!highlight) return res.status(404).json({ message: "Highlight not found" });
    res.json(highlight);
  });

  app.post("/api/highlights", async (req, res) => {
    const parsed = insertHighlightSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const highlight = await storage.createHighlight(parsed.data);
    res.status(201).json(highlight);
  });

  app.delete("/api/highlights/:id", async (req, res) => {
    const deleted = await storage.deleteHighlight(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Highlight not found" });
    res.json({ success: true });
  });

  // Comments
  app.get("/api/highlights/:highlightId/comments", async (req, res) => {
    const allComments = await storage.getComments(req.params.highlightId);
    res.json(allComments);
  });

  app.post("/api/comments", async (req, res) => {
    const parsed = insertCommentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const comment = await storage.createComment(parsed.data);
    res.status(201).json(comment);
  });

  app.patch("/api/comments/:id", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });
    const comment = await storage.updateComment(req.params.id, text);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    res.json(comment);
  });

  app.delete("/api/comments/:id", async (req, res) => {
    const deleted = await storage.deleteComment(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Comment not found" });
    res.json({ success: true });
  });

  // Sync endpoint for extension
  app.post("/api/sync", async (req, res) => {
    const { pages: syncPages, highlights: syncHighlights, comments: syncComments } = req.body;
    try {
      if (syncPages) {
        for (const p of syncPages) {
          const existing = await storage.getPageByUrl(p.url);
          if (!existing) await storage.createPage(p);
        }
      }
      if (syncHighlights) {
        for (const h of syncHighlights) {
          await storage.createHighlight(h);
        }
      }
      if (syncComments) {
        for (const c of syncComments) {
          await storage.createComment(c);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export all data
  app.get("/api/export", async (_req, res) => {
    const allPages = await storage.getPages();
    const styles = await storage.getStyles();
    res.json({ pages: allPages, styles, exportedAt: new Date().toISOString() });
  });

  return httpServer;
}
