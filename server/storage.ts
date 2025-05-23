import { users, collections, photos, type User, type InsertUser, type Collection, type InsertCollection, type Photo, type InsertPhoto } from "@shared/schema";
import { format } from "date-fns";
import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Client } from "@replit/object-storage";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Collection operations
  getCollections(userId: number): Promise<Collection[]>;
  getCollection(id: number): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: number, collection: Partial<InsertCollection>): Promise<Collection | undefined>;
  deleteCollection(id: number): Promise<boolean>;
  
  // Photo operations
  getPhotos(userId: number, collectionId?: number): Promise<Photo[]>;
  getPhoto(id: number): Promise<Photo | undefined>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: number, photo: Partial<InsertPhoto>): Promise<Photo | undefined>;
  deletePhoto(id: number): Promise<boolean>;
  toggleLikePhoto(id: number): Promise<Photo | undefined>;
}

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

export class DbStorage implements IStorage {
  private objectStorage: Client;

  constructor() {
    // Initialize object storage client
    this.objectStorage = new Client();
    // Initialize database schema and data
    this.initialize();
  }
  
  private async initialize() {
    try {
      console.log("Initializing database...");
      
      // Check if default user exists
      const defaultUser = await this.getUserByUsername("demo_user");
      if (!defaultUser) {
        console.log("Creating default user...");
        await this.createUser({
          username: "demo_user",
          password: "password"
        });
        
        // Create default collections
        await this.initializeDefaultCollections();
      }
      
      // Object storage is ready to use - no directory setup needed
      console.log("Object storage initialized");
      
      console.log("Database initialization complete");
    } catch (error) {
      console.error("Error initializing database:", error);
    }
  }
  
  // Object storage methods
  async uploadPhoto(file: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      const objectKey = `photos/${Date.now()}-${fileName}`;
      await this.objectStorage.uploadFromBytes(objectKey, file);
      return objectKey;
    } catch (error) {
      console.error("Error uploading photo to object storage:", error);
      throw new Error("Failed to upload photo");
    }
  }

  async getPhotoUrl(objectKey: string): Promise<string> {
    try {
      return await this.objectStorage.getPublicUrl(objectKey);
    } catch (error) {
      console.error("Error getting photo URL:", error);
      throw new Error("Failed to get photo URL");
    }
  }

  async deletePhotoFromStorage(objectKey: string): Promise<void> {
    try {
      await this.objectStorage.delete(objectKey);
    } catch (error) {
      console.error("Error deleting photo from storage:", error);
      // Don't throw here as we still want to delete from database
    }
  }
  
  private extractDateFromFileName(fileName: string): Date | null {
    try {
      // Extract timestamp from filenames like "photo-1743260503114-360974261.jpg"
      const match = fileName.match(/photo-(\d+)-/);
      if (match && match[1]) {
        const timestamp = parseInt(match[1]);
        if (!isNaN(timestamp)) {
          return new Date(timestamp);
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  
  private getFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }
  
  private async initializeDefaultCollections() {
    try {
      const defaultUser = await this.getUserByUsername("demo_user");
      if (!defaultUser) {
        throw new Error("Default user not found when creating collections");
      }
      
      const collections: InsertCollection[] = [
        { name: "All Photos", description: "Default collection for all photos", type: "custom", userId: defaultUser.id },
        { name: "Nature", description: "Beautiful nature scenes", type: "nature", userId: defaultUser.id },
        { name: "Travels", description: "Adventure travel photos", type: "travels", userId: defaultUser.id },
        { name: "Favorites", description: "My favorite photos", type: "favorites", userId: defaultUser.id },
      ];
      
      for (const col of collections) {
        await this.createCollection(col);
      }
      
      console.log("Created default collections");
    } catch (error) {
      console.error("Error creating default collections:", error);
    }
  }
  
  // Helper to save metadata for a photo
  private savePhotoMetadata(photo: Photo) {
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      const metadataPath = path.join(uploadsDir, `${photo.fileName}.metadata.json`);
      const metadata = {
        title: photo.title,
        description: photo.description,
        isLiked: photo.isLiked,
        collectionId: photo.collectionId
      };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error(`Error saving metadata for photo ${photo.id}:`, error);
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
  
  // Collection operations
  async getCollections(userId: number): Promise<Collection[]> {
    return await db.select().from(collections).where(eq(collections.userId, userId));
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
    return result[0];
  }
  
  async updateCollection(id: number, collectionUpdate: Partial<InsertCollection>): Promise<Collection | undefined> {
    const result = await db.update(collections)
      .set(collectionUpdate)
      .where(eq(collections.id, id))
      .returning();
    return result[0];
  }
  
  async deleteCollection(id: number): Promise<boolean> {
    const result = await db.delete(collections).where(eq(collections.id, id)).returning();
    return result.length > 0;
  }
  
  // Photo operations
  async getPhotos(userId: number, collectionId?: number): Promise<Photo[]> {
    let query = db.select().from(photos).where(eq(photos.userId, userId));
    
    if (collectionId) {
      query = query.where(eq(photos.collectionId, collectionId));
    }
    
    // Sort by uploadedAt in descending order
    const result = await query.orderBy(desc(photos.uploadedAt));
    return result;
  }
  
  async getPhoto(id: number): Promise<Photo | undefined> {
    const result = await db.select().from(photos).where(eq(photos.id, id));
    return result[0];
  }
  
  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const result = await db.insert(photos).values({
      ...insertPhoto,
      uploadedAt: insertPhoto.uploadedAt || new Date(),
      isLiked: insertPhoto.isLiked || false
    }).returning();
    
    const photo = result[0];
    
    // Save metadata to a JSON file to persist title and other information across restarts
    this.savePhotoMetadata(photo);
    
    return photo;
  }
  
  async updatePhoto(id: number, photoUpdate: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const result = await db.update(photos)
      .set(photoUpdate)
      .where(eq(photos.id, id))
      .returning();
    
    const photo = result[0];
    if (photo) {
      // Save updated metadata
      this.savePhotoMetadata(photo);
    }
    
    return photo;
  }
  
  async deletePhoto(id: number): Promise<boolean> {
    // Get photo information
    const photo = await this.getPhoto(id);
    if (!photo) return false;
    
    // Delete metadata file if it exists
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      const metadataPath = path.join(uploadsDir, `${photo.fileName}.metadata.json`);
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
    } catch (error) {
      console.error(`Error deleting metadata for photo ${id}:`, error);
    }
    
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
      // Save updated metadata
      this.savePhotoMetadata(updatedPhoto);
    }
    
    return updatedPhoto;
  }
}

// Create and export the storage instance
export const storage = new DbStorage();