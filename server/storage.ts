import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  highlightStyles, highlights, comments, pages,
  type HighlightStyle, type InsertHighlightStyle,
  type Page, type InsertPage,
  type Highlight, type InsertHighlight,
  type Comment, type InsertComment,
  type HighlightWithComments, type PageWithHighlights,
} from "@shared/schema";

export interface IStorage {
  getStyles(): Promise<HighlightStyle[]>;
  getStyle(id: string): Promise<HighlightStyle | undefined>;
  createStyle(style: InsertHighlightStyle): Promise<HighlightStyle>;
  updateStyle(id: string, style: Partial<InsertHighlightStyle>): Promise<HighlightStyle | undefined>;
  deleteStyle(id: string): Promise<{ deleted: boolean; error?: string }>;

  getPages(): Promise<PageWithHighlights[]>;
  getPage(id: string): Promise<PageWithHighlights | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  getPageByUrl(url: string): Promise<Page | undefined>;

  getHighlights(pageId?: string): Promise<HighlightWithComments[]>;
  getHighlight(id: string): Promise<HighlightWithComments | undefined>;
  createHighlight(highlight: InsertHighlight): Promise<Highlight>;
  deleteHighlight(id: string): Promise<boolean>;

  getComments(highlightId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  updateComment(id: string, text: string): Promise<Comment | undefined>;
  deleteComment(id: string): Promise<boolean>;

  seedDefaults(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getStyles(): Promise<HighlightStyle[]> {
    return db.select().from(highlightStyles).orderBy(highlightStyles.sortOrder);
  }

  async getStyle(id: string): Promise<HighlightStyle | undefined> {
    const [style] = await db.select().from(highlightStyles).where(eq(highlightStyles.id, id));
    return style;
  }

  async createStyle(style: InsertHighlightStyle): Promise<HighlightStyle> {
    const [created] = await db.insert(highlightStyles).values(style).returning();
    return created;
  }

  async updateStyle(id: string, style: Partial<InsertHighlightStyle>): Promise<HighlightStyle | undefined> {
    const [updated] = await db.update(highlightStyles).set(style).where(eq(highlightStyles.id, id)).returning();
    return updated;
  }

  async deleteStyle(id: string): Promise<{ deleted: boolean; error?: string }> {
    const usedBy = await db.select().from(highlights).where(eq(highlights.styleId, id));
    if (usedBy.length > 0) {
      return { deleted: false, error: `Style is used by ${usedBy.length} highlight(s). Remove those highlights first.` };
    }
    const result = await db.delete(highlightStyles).where(eq(highlightStyles.id, id)).returning();
    return { deleted: result.length > 0 };
  }

  async getPages(): Promise<PageWithHighlights[]> {
    const allPages = await db.select().from(pages).orderBy(desc(pages.lastVisited));
    const result: PageWithHighlights[] = [];
    for (const page of allPages) {
      const pageHighlights = await this.getHighlights(page.id);
      const commentCount = pageHighlights.reduce((sum, h) => sum + h.comments.length, 0);
      result.push({
        ...page,
        highlights: pageHighlights,
        highlightCount: pageHighlights.length,
        commentCount,
      });
    }
    return result;
  }

  async getPage(id: string): Promise<PageWithHighlights | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    if (!page) return undefined;
    const pageHighlights = await this.getHighlights(page.id);
    const commentCount = pageHighlights.reduce((sum, h) => sum + h.comments.length, 0);
    return {
      ...page,
      highlights: pageHighlights,
      highlightCount: pageHighlights.length,
      commentCount,
    };
  }

  async createPage(page: InsertPage): Promise<Page> {
    const [created] = await db.insert(pages).values(page).returning();
    return created;
  }

  async getPageByUrl(url: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.url, url));
    return page;
  }

  async getHighlights(pageId?: string): Promise<HighlightWithComments[]> {
    let query = pageId
      ? await db.select().from(highlights).where(eq(highlights.pageId, pageId)).orderBy(desc(highlights.createdAt))
      : await db.select().from(highlights).orderBy(desc(highlights.createdAt));

    const result: HighlightWithComments[] = [];
    for (const h of query) {
      const hComments = await db.select().from(comments).where(eq(comments.highlightId, h.id)).orderBy(desc(comments.createdAt));
      const style = await this.getStyle(h.styleId);
      result.push({
        ...h,
        comments: hComments,
        style: style!,
      });
    }
    return result;
  }

  async getHighlight(id: string): Promise<HighlightWithComments | undefined> {
    const [h] = await db.select().from(highlights).where(eq(highlights.id, id));
    if (!h) return undefined;
    const hComments = await db.select().from(comments).where(eq(comments.highlightId, h.id)).orderBy(desc(comments.createdAt));
    const style = await this.getStyle(h.styleId);
    return { ...h, comments: hComments, style: style! };
  }

  async createHighlight(highlight: InsertHighlight): Promise<Highlight> {
    const [created] = await db.insert(highlights).values(highlight).returning();
    return created;
  }

  async deleteHighlight(id: string): Promise<boolean> {
    await db.delete(comments).where(eq(comments.highlightId, id));
    const result = await db.delete(highlights).where(eq(highlights.id, id)).returning();
    return result.length > 0;
  }

  async getComments(highlightId: string): Promise<Comment[]> {
    return db.select().from(comments).where(eq(comments.highlightId, highlightId)).orderBy(desc(comments.createdAt));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [created] = await db.insert(comments).values(comment).returning();
    return created;
  }

  async updateComment(id: string, text: string): Promise<Comment | undefined> {
    const [updated] = await db.update(comments).set({ text }).where(eq(comments.id, id)).returning();
    return updated;
  }

  async deleteComment(id: string): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    return result.length > 0;
  }

  async seedDefaults(): Promise<void> {
    const existingStyles = await this.getStyles();
    if (existingStyles.length > 0) return;

    const defaultStyles: InsertHighlightStyle[] = [
      { name: "Yellow", color: "#000000", backgroundColor: "#FFF59D", borderColor: "#F9A825", isDefault: true, sortOrder: 0 },
      { name: "Green", color: "#000000", backgroundColor: "#A5D6A7", borderColor: "#388E3C", isDefault: false, sortOrder: 1 },
      { name: "Blue", color: "#000000", backgroundColor: "#90CAF9", borderColor: "#1976D2", isDefault: false, sortOrder: 2 },
      { name: "Pink", color: "#000000", backgroundColor: "#F48FB1", borderColor: "#C2185B", isDefault: false, sortOrder: 3 },
      { name: "Orange", color: "#000000", backgroundColor: "#FFCC80", borderColor: "#E65100", isDefault: false, sortOrder: 4 },
      { name: "Purple", color: "#000000", backgroundColor: "#CE93D8", borderColor: "#7B1FA2", isDefault: false, sortOrder: 5 },
    ];

    for (const style of defaultStyles) {
      await this.createStyle(style);
    }

    const styles = await this.getStyles();

    const page1 = await this.createPage({
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
      title: "JavaScript Guide - MDN Web Docs",
      favicon: "https://developer.mozilla.org/favicon-48x48.png",
    });

    const page2 = await this.createPage({
      url: "https://react.dev/learn",
      title: "Quick Start - React",
      favicon: "https://react.dev/favicon-32x32.png",
    });

    const page3 = await this.createPage({
      url: "https://web.dev/articles/vitals",
      title: "Web Vitals - web.dev",
      favicon: "https://web.dev/images/favicon-32x32.png",
    });

    const h1 = await this.createHighlight({
      pageId: page1.id,
      styleId: styles[0].id,
      selectedText: "JavaScript is a prototype-based, multi-paradigm, single-threaded, dynamic language, supporting object-oriented, imperative, and declarative styles.",
      xpath: "/html/body/main/article/p[1]",
      textOffset: 0,
      textLength: 148,
    });

    await this.createComment({ highlightId: h1.id, text: "Core definition of JS - important for interviews" });

    const h2 = await this.createHighlight({
      pageId: page1.id,
      styleId: styles[2].id,
      selectedText: "ECMAScript is the standard that defines JavaScript. The ECMAScript specification is a set of requirements for implementing ECMAScript.",
      xpath: "/html/body/main/article/p[3]",
      textOffset: 0,
      textLength: 130,
    });

    await this.createComment({ highlightId: h2.id, text: "ECMAScript vs JavaScript distinction" });
    await this.createComment({ highlightId: h2.id, text: "Check the latest ES2024 features" });

    const h3 = await this.createHighlight({
      pageId: page2.id,
      styleId: styles[1].id,
      selectedText: "React lets you build user interfaces out of individual pieces called components. Create your own React components like Thumbnail, LikeButton, and Video.",
      xpath: "/html/body/main/div/section[1]/p",
      textOffset: 0,
      textLength: 155,
    });

    await this.createComment({ highlightId: h3.id, text: "Component-based architecture is the key concept" });

    const h4 = await this.createHighlight({
      pageId: page2.id,
      styleId: styles[3].id,
      selectedText: "React components are JavaScript functions that return markup. React uses a syntax extension called JSX.",
      xpath: "/html/body/main/div/section[2]/p",
      textOffset: 0,
      textLength: 99,
    });

    const h5 = await this.createHighlight({
      pageId: page3.id,
      styleId: styles[4].id,
      selectedText: "Core Web Vitals are the subset of Web Vitals that apply to all web pages, and each represents a distinct facet of the user experience.",
      xpath: "/html/body/main/article/p[2]",
      textOffset: 0,
      textLength: 132,
    });

    await this.createComment({ highlightId: h5.id, text: "LCP, FID, CLS are the three core metrics" });
    await this.createComment({ highlightId: h5.id, text: "Need to optimize our landing page for these" });

    const h6 = await this.createHighlight({
      pageId: page3.id,
      styleId: styles[5].id,
      selectedText: "Largest Contentful Paint (LCP): measures loading performance. To provide a good user experience, LCP should occur within 2.5 seconds.",
      xpath: "/html/body/main/article/p[4]",
      textOffset: 0,
      textLength: 133,
    });
  }
}

export const storage = new DatabaseStorage();
