import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  profilePicture: text("profile_picture"), // URL to profile picture
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  userId: integer("user_id").references(() => users.id), // Keep for backward compatibility
  createdAt: timestamp("created_at").defaultNow(),
});

export const collectionOwners = pgTable("collection_owners", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueCollectionUser: unique().on(table.collectionId, table.userId),
}));

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  filePath: text("file_path").notNull(),
  isLiked: boolean("is_liked").default(false),
  collectionId: integer("collection_id").references(() => collections.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Comments table for photo-level comments
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  photoId: integer("photo_id").references(() => photos.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sessions table for database-based session storage
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  profilePicture: true,
});

export const updateUserSchema = createInsertSchema(users).pick({
  displayName: true,
  profilePicture: true,
  password: true,
}).partial();

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
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
  uploadedAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  photoId: true,
  userId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;

export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

export type CollectionOwner = typeof collectionOwners.$inferSelect;
export type InsertCollectionOwner = typeof collectionOwners.$inferInsert;

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
