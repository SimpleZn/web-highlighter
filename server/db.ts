import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
const databasePath = process.env.DATABASE_PATH ?? "./sqlite.db";
const sqlite = new Database(databasePath);

export const db = drizzle(sqlite, { schema });
