import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const highlightStyles = pgTable("highlight_styles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull(),
  backgroundColor: text("background_color").notNull(),
  borderColor: text("border_color"),
  isDefault: boolean("is_default").default(false),
  sortOrder: integer("sort_order").default(0),
});

export const pages = pgTable("pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  title: text("title").notNull(),
  favicon: text("favicon"),
  lastVisited: timestamp("last_visited").defaultNow(),
});

export const highlights = pgTable("highlights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull(),
  styleId: varchar("style_id").notNull(),
  selectedText: text("selected_text").notNull(),
  xpath: text("xpath"),
  textOffset: integer("text_offset"),
  textLength: integer("text_length"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  highlightId: varchar("highlight_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
