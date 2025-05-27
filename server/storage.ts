import { users, collections, collectionOwners, photos, comments, type User, type InsertUser, type UpdateUser, type Collection, type InsertCollection, type CollectionOwner, type InsertCollectionOwner, type Photo, type InsertPhoto, type Comment, type InsertComment } from "@shared/schema";
import { format } from "date-fns";
import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

// Load environment variables from .env file
config();

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: UpdateUser): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Collection operations
  getCollections(userId: number): Promise<Collection[]>;
  getCollectionsWithThumbnails(userId: number): Promise<(Collection & { thumbnailUrl?: string })[]>;
  getCollection(id: number): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: number, collection: Partial<InsertCollection>): Promise<Collection | undefined>;
  deleteCollection(id: number): Promise<boolean>;
  checkCollectionOwnership(collectionId: number, userId: number): Promise<boolean>;
  
  // Photo operations
  getPhotos(userId: number, collectionId?: number): Promise<Photo[]>;
  getPhoto(id: number): Promise<Photo | undefined>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: number, photo: Partial<InsertPhoto>): Promise<Photo | undefined>;
  deletePhoto(id: number): Promise<boolean>;
  toggleLikePhoto(id: number): Promise<Photo | undefined>;
  
  // Comment operations (for future use)
  getComments(collectionId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  updateComment(id: number, comment: Partial<InsertComment>): Promise<Comment | undefined>;
  deleteComment(id: number): Promise<boolean>;
  
  // Filesystem operations
  savePhotoToFilesystem(file: Buffer, fileName: string): Promise<string>;
  deletePhotoFromFilesystem(filePath: string): Promise<void>;
}

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

console.log("Connecting to database with URL:", connectionString.replace(/:[^:@]*@/, ':***@'));

// Configure postgres client with better connection settings
const client = postgres(connectionString, {
  max: 20,                    // Maximum number of connections in pool
  idle_timeout: 20,           // Close idle connections after 20 seconds
  connect_timeout: 10,        // Connection timeout in seconds
  prepare: false,             // Disable prepared statements for better compatibility
  onnotice: () => {},         // Disable notices
  debug: false,               // Disable debug logging
  transform: {
    undefined: null,          // Transform undefined to null
  },
});

const db = drizzle(client);

// Add database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export class DbStorage implements IStorage {
  private uploadsDir: string;

  constructor() {
    // Set up uploads directory
    this.uploadsDir = path.join(process.cwd(), "uploads");
    this.initialize();
  }
  
  private async initialize() {
    try {
      console.log("Initializing database and filesystem...");
      
      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
        console.log("Created uploads directory");
      }
      
      // Check if users exist and create them
      await this.initializeUsers();
      
      console.log("Database initialization complete");
    } catch (error) {
      console.error("Error initializing database:", error);
    }
  }
  
  // Filesystem operations
  async savePhotoToFilesystem(file: Buffer, fileName: string): Promise<string> {
    try {
      const filePath = path.join(this.uploadsDir, fileName);
      await fs.promises.writeFile(filePath, file);
      return `/uploads/${fileName}`;
    } catch (error) {
      console.error("Error saving photo to filesystem:", error);
      throw new Error("Failed to save photo");
    }
  }

  async deletePhotoFromFilesystem(filePath: string): Promise<void> {
    try {
      // Extract filename from path like "/uploads/filename.jpg"
      const fileName = filePath.replace('/uploads/', '');
      const fullPath = path.join(this.uploadsDir, fileName);
      
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
      
      // Also try to delete metadata file
      const metadataPath = `${fullPath}.metadata.json`;
      if (fs.existsSync(metadataPath)) {
        await fs.promises.unlink(metadataPath);
      }
    } catch (error) {
      console.error("Error deleting photo from filesystem:", error);
      // Don't throw here as we still want to delete from database
    }
  }
  
  private async createMetadataFile(fileName: string, metadata: any): Promise<void> {
    try {
      const metadataPath = path.join(this.uploadsDir, `${fileName}.metadata.json`);
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error("Error creating metadata file:", error);
    }
  }
  
  private async initializeUsers() {
    try {
      // Import bcrypt here to avoid circular dependency
      const bcrypt = await import("bcryptjs");
      
      // Check if users exist
      const karold = await this.getUserByUsername("karold");
      const androso = await this.getUserByUsername("androso");
      
      if (!karold) {
        console.log("Creating user: karold");
        const hashedPassword = await bcrypt.hash("karold123", 12);
        await this.createUser({
          username: "karold",
          password: hashedPassword,
          displayName: "Karold",
          profilePicture: null
        });
      }
      
      if (!androso) {
        console.log("Creating user: androso");
        const hashedPassword = await bcrypt.hash("androso123", 12);
        await this.createUser({
          username: "androso", 
          password: hashedPassword,
          displayName: "Androso",
          profilePicture: null
        });
      }
      
      console.log("User initialization complete");
    } catch (error) {
      console.error("Error initializing users:", error);
    }
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }
  
  async updateUser(id: number, userUpdate: UpdateUser): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...userUpdate, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  // Collection operations
  async getCollections(userId: number): Promise<Collection[]> {
    // Get collections where the user is an owner
    const result = await db
      .select({
        id: collections.id,
        name: collections.name,
        description: collections.description,
        type: collections.type,
        userId: collections.userId,
        createdAt: collections.createdAt,
      })
      .from(collections)
      .innerJoin(collectionOwners, eq(collections.id, collectionOwners.collectionId))
      .where(eq(collectionOwners.userId, userId))
      .orderBy(desc(collections.createdAt));
    
    return result;
  }
  
  async getCollectionsWithThumbnails(userId: number): Promise<(Collection & { thumbnailUrl?: string })[]> {
    // Get collections where the user is an owner
    const userCollections = await db
      .select({
        id: collections.id,
        name: collections.name,
        description: collections.description,
        type: collections.type,
        userId: collections.userId,
        createdAt: collections.createdAt,
      })
      .from(collections)
      .innerJoin(collectionOwners, eq(collections.id, collectionOwners.collectionId))
      .where(eq(collectionOwners.userId, userId))
      .orderBy(desc(collections.createdAt));
    
    // For each collection, get the first photo if any
    const collectionsWithThumbnails = await Promise.all(
      userCollections.map(async (collection) => {
        const firstPhoto = await db.select()
          .from(photos)
          .where(eq(photos.collectionId, collection.id))
          .orderBy(desc(photos.uploadedAt))
          .limit(1);
        
        return {
          ...collection,
          thumbnailUrl: firstPhoto.length > 0 ? firstPhoto[0].filePath : undefined
        };
      })
    );
    
    return collectionsWithThumbnails;
  }
  
  async getCollection(id: number): Promise<Collection | undefined> {
    const result = await db.select().from(collections).where(eq(collections.id, id));
    return result[0];
  }
  
  async createCollection(insertCollection: InsertCollection): Promise<Collection> {
    const result = await db.insert(collections).values({
      ...insertCollection,
      createdAt: new Date()
    }).returning();
    
    const collection = result[0];
    
    // Add both users as owners of the collection
    const allUsers = await this.getAllUsers();
    const ownershipPromises = allUsers.map(user => 
      db.insert(collectionOwners).values({
        collectionId: collection.id,
        userId: user.id,
        createdAt: new Date()
      })
    );
    
    await Promise.all(ownershipPromises);
    
    return collection;
  }
  
  async updateCollection(id: number, collectionUpdate: Partial<InsertCollection>): Promise<Collection | undefined> {
    const result = await db.update(collections)
      .set(collectionUpdate)
      .where(eq(collections.id, id))
      .returning();
    return result[0];
  }
  
  async deleteCollection(id: number): Promise<boolean> {
    // First, get all photos in this collection
    const collectionPhotos = await db.select().from(photos).where(eq(photos.collectionId, id));
    
    // Delete all photos from filesystem and database
    for (const photo of collectionPhotos) {
      // Delete from filesystem
      await this.deletePhotoFromFilesystem(photo.filePath);
      
      // Delete from database
      await db.delete(photos).where(eq(photos.id, photo.id));
    }
    
    // Delete collection ownership records (will cascade automatically due to foreign key constraints)
    // Finally, delete the collection itself
    const result = await db.delete(collections).where(eq(collections.id, id)).returning();
    return result.length > 0;
  }

  async checkCollectionOwnership(collectionId: number, userId: number): Promise<boolean> {
    const ownership = await db
      .select()
      .from(collectionOwners)
      .where(and(
        eq(collectionOwners.collectionId, collectionId),
        eq(collectionOwners.userId, userId)
      ))
      .limit(1);
    
    return ownership.length > 0;
  }
  
  // Photo operations
  async getPhotos(userId: number, collectionId?: number): Promise<Photo[]> {
    if (collectionId) {
      const result = await db.select().from(photos)
        .where(and(eq(photos.userId, userId), eq(photos.collectionId, collectionId)))
        .orderBy(desc(photos.uploadedAt));
      return result;
    } else {
      const result = await db.select().from(photos)
        .where(eq(photos.userId, userId))
        .orderBy(desc(photos.uploadedAt));
      return result;
    }
  }
  
  async getPhoto(id: number): Promise<Photo | undefined> {
    const result = await db.select().from(photos).where(eq(photos.id, id));
    return result[0];
  }
  
  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const result = await db.insert(photos).values({
      ...insertPhoto,
      isLiked: insertPhoto.isLiked || false
    }).returning();
    
    const photo = result[0];
    
    // Create metadata file for filesystem backup
    await this.createMetadataFile(photo.fileName, {
      title: photo.title,
      description: photo.description,
      isLiked: photo.isLiked,
      collectionId: photo.collectionId,
      uploadedAt: photo.uploadedAt
    });
    
    return photo;
  }
  
  async updatePhoto(id: number, photoUpdate: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const result = await db.update(photos)
      .set(photoUpdate)
      .where(eq(photos.id, id))
      .returning();
    
    const photo = result[0];
    if (photo) {
      // Update metadata file
      await this.createMetadataFile(photo.fileName, {
        title: photo.title,
        description: photo.description,
        isLiked: photo.isLiked,
        collectionId: photo.collectionId,
        uploadedAt: photo.uploadedAt
      });
    }
    
    return photo;
  }
  
  async deletePhoto(id: number): Promise<boolean> {
    // Get photo information
    const photo = await this.getPhoto(id);
    if (!photo) return false;
    
    // Delete from filesystem
    await this.deletePhotoFromFilesystem(photo.filePath);
    
    // Delete from database
    const result = await db.delete(photos).where(eq(photos.id, id)).returning();
    return result.length > 0;
  }
  
  async toggleLikePhoto(id: number): Promise<Photo | undefined> {
    // Get current photo to check liked status
    const photo = await this.getPhoto(id);
    if (!photo) return undefined;
    
    // Toggle the liked status
    const result = await db.update(photos)
      .set({ isLiked: !photo.isLiked })
      .where(eq(photos.id, id))
      .returning();
    
    const updatedPhoto = result[0];
    if (updatedPhoto) {
      // Update metadata file
      await this.createMetadataFile(updatedPhoto.fileName, {
        title: updatedPhoto.title,
        description: updatedPhoto.description,
        isLiked: updatedPhoto.isLiked,
        collectionId: updatedPhoto.collectionId,
        uploadedAt: updatedPhoto.uploadedAt
      });
    }
    
    return updatedPhoto;
  }
  
  // Comment operations (for future use)
  async getComments(collectionId: number): Promise<Comment[]> {
    return await db.select().from(comments)
      .where(eq(comments.collectionId, collectionId))
      .orderBy(desc(comments.createdAt));
  }
  
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values({
      ...insertComment,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async updateComment(id: number, commentUpdate: Partial<InsertComment>): Promise<Comment | undefined> {
    const result = await db.update(comments)
      .set({ ...commentUpdate, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return result[0];
  }
  
  async deleteComment(id: number): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    return result.length > 0;
  }
}

// Create and export the storage instance
export const storage = new DbStorage();