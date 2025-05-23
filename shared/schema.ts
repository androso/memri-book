import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const collectionEnum = pgEnum("collection_type", [
  "nature",
  "travels",
  "favorites",
  "custom"
]);

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: collectionEnum("type").notNull().default("custom"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  filePath: text("file_path").notNull(),
  isLiked: boolean("is_liked").default(false),
  collectionId: integer("collection_id").references(() => collections.id),
  userId: integer("user_id").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCollectionSchema = createInsertSchema(collections).pick({
  name: true,
  description: true,
  type: true,
  userId: true,
});

export const insertPhotoSchema = createInsertSchema(photos).pick({
  title: true,
  description: true,
  fileName: true,
  fileType: true,
  filePath: true,
  isLiked: true,
  collectionId: true,
  userId: true,
  uploadedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;
