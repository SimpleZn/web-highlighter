import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const highlightStyles = sqliteTable("highlight_styles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  color: text("color").notNull(),
  backgroundColor: text("background_color").notNull(),
  borderColor: text("border_color"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  sortOrder: integer("sort_order").default(0),
});

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  url: text("url").notNull(),
  title: text("title").notNull(),
  favicon: text("favicon"),
  lastVisited: integer("last_visited", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
});

export const highlights = sqliteTable("highlights", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  pageId: text("page_id").notNull(),
  styleId: text("style_id").notNull(),
  selectedText: text("selected_text").notNull(),
  xpath: text("xpath"),
  textOffset: integer("text_offset"),
  textLength: integer("text_length"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  highlightId: text("highlight_id").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`),
});

export const insertHighlightStyleSchema = createInsertSchema(highlightStyles).omit({ id: true });
export const insertPageSchema = createInsertSchema(pages).omit({ id: true });
export const insertHighlightSchema = createInsertSchema(highlights).omit({ id: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true });

export type HighlightStyle = typeof highlightStyles.$inferSelect;
export type InsertHighlightStyle = z.infer<typeof insertHighlightStyleSchema>;
export type Page = typeof pages.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Highlight = typeof highlights.$inferSelect;
export type InsertHighlight = z.infer<typeof insertHighlightSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type HighlightWithComments = Highlight & {
  comments: Comment[];
  style: HighlightStyle;
};

export type PageWithHighlights = Page & {
  highlights: HighlightWithComments[];
  highlightCount: number;
  commentCount: number;
};
