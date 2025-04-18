import { users, collections, photos, type User, type InsertUser, type Collection, type InsertCollection, type Photo, type InsertPhoto } from "@shared/schema";
import { format } from "date-fns";
import fs from "fs";
import path from "path";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private collections: Map<number, Collection>;
  private photos: Map<number, Photo>;
  private userId: number;
  private collectionId: number;
  private photoId: number;

  constructor() {
    this.users = new Map();
    this.collections = new Map();
    this.photos = new Map();
    this.userId = 1;
    this.collectionId = 1;
    this.photoId = 1;
    
    // Initialize with default collections for demo purposes
    this.initializeDefaultCollections();
    this.initializeDefaultPhotos();
    
    // Scan the uploads directory to include real uploaded photos
    this.scanUploadsDirectory();
  }
  
  // Scan uploads directory to find real user uploads
  private scanUploadsDirectory() {
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      // Create the uploads directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log("Created uploads directory");
        return; // No files to scan in a new directory
      }
      
      const files = fs.readdirSync(uploadsDir);
      
      // Process any files that start with "photo-" (this matches multer naming pattern)
      const uploadedFiles = files.filter(file => file.startsWith('photo-'));
      
      uploadedFiles.forEach(fileName => {
        // Check if we already have this photo in our map (avoid duplicates)
        const existingPhoto = Array.from(this.photos.values()).find(
          photo => photo.fileName === fileName
        );
        
        if (!existingPhoto) {
          // Get default collection (All Photos)
          const defaultCollection = Array.from(this.collections.values()).find(
            c => c.name === "All Photos"
          );
          
          // Try to extract photo metadata from a JSON file if it exists
          const metadataPath = path.join(uploadsDir, `${fileName}.metadata.json`);
          let title = "Uploaded Photo";
          let description = "Uploaded by user";
          let isLiked = false;
          let collectionId = defaultCollection?.id ?? 1;
          
          // If metadata file exists, use it to restore title and other properties
          if (fs.existsSync(metadataPath)) {
            try {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
              title = metadata.title || title;
              description = metadata.description || description;
              isLiked = metadata.isLiked || isLiked;
              collectionId = metadata.collectionId || collectionId;
            } catch (err) {
              console.error(`Error reading metadata for ${fileName}:`, err);
            }
          }
          
          // Create a new photo entry
          const uploadDate = this.extractDateFromFileName(fileName) || new Date();
          const photo: Photo = {
            id: this.photoId++,
            title: title,
            description: description,
            fileName: fileName,
            fileType: this.getFileType(fileName),
            filePath: `/uploads/${fileName}`,
            isLiked: isLiked,
            collectionId: collectionId,
            userId: 1, // Default user
            uploadedAt: uploadDate
          };
          
          this.photos.set(photo.id, photo);
          console.log(`Loaded user upload: ${fileName}`);
        }
      });
    } catch (error) {
      console.error("Error scanning uploads directory:", error);
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
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }

  // Initialize default collections
  private initializeDefaultCollections() {
    const defaultUser: User = { 
      id: this.userId++, 
      username: "demo_user", 
      password: "password" 
    };
    this.users.set(defaultUser.id, defaultUser);

    const collections: InsertCollection[] = [
      { name: "All Photos", description: "Default collection for all photos", type: "custom", userId: defaultUser.id },
      { name: "Nature", description: "Beautiful nature scenes", type: "nature", userId: defaultUser.id },
      { name: "Travels", description: "Adventure travel photos", type: "travels", userId: defaultUser.id },
      { name: "Favorites", description: "My favorite photos", type: "favorites", userId: defaultUser.id },
    ];

    collections.forEach(col => {
      // Ensure all required fields are present
      const collection: Collection = {
        id: this.collectionId++,
        name: col.name,
        description: col.description || null,
        type: col.type || "custom",
        userId: col.userId || 1,
        createdAt: new Date()
      };
      this.collections.set(collection.id, collection);
    });
  }

  // Initialize default photos with stock image data
  private initializeDefaultPhotos() {
    // Nothing to initialize since all default photos have been removed as requested
    // This method is kept for future extensions if needed
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
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Collection operations
  async getCollections(userId: number): Promise<Collection[]> {
    return Array.from(this.collections.values()).filter(
      (collection) => collection.userId === userId,
    );
  }
  
  async getCollection(id: number): Promise<Collection | undefined> {
    return this.collections.get(id);
  }
  
  async createCollection(insertCollection: InsertCollection): Promise<Collection> {
    const id = this.collectionId++;
    const now = new Date();
    
    // Ensure all required fields are present with defaults if needed
    const collection: Collection = { 
      ...insertCollection, 
      id,
      name: insertCollection.name,
      type: insertCollection.type || "custom",
      description: insertCollection.description || null,
      userId: insertCollection.userId || 1,
      createdAt: now 
    };
    
    this.collections.set(id, collection);
    return collection;
  }
  
  async updateCollection(id: number, collectionUpdate: Partial<InsertCollection>): Promise<Collection | undefined> {
    const collection = this.collections.get(id);
    if (!collection) return undefined;
    
    // Ensure we maintain the required types
    const updatedCollection: Collection = {
      ...collection,
      name: collectionUpdate.name || collection.name,
      type: collectionUpdate.type || collection.type,
      description: collectionUpdate.description !== undefined ? collectionUpdate.description : collection.description,
      userId: collectionUpdate.userId !== undefined ? collectionUpdate.userId : collection.userId,
      id: collection.id,
      createdAt: collection.createdAt
    };
    
    this.collections.set(id, updatedCollection);
    return updatedCollection;
  }
  
  async deleteCollection(id: number): Promise<boolean> {
    return this.collections.delete(id);
  }
  
  // Photo operations
  async getPhotos(userId: number, collectionId?: number): Promise<Photo[]> {
    return Array.from(this.photos.values())
      .filter((photo) => {
        if (photo.userId !== userId) return false;
        if (collectionId && photo.collectionId !== collectionId) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = a.uploadedAt instanceof Date ? a.uploadedAt : new Date(a.uploadedAt || 0);
        const dateB = b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
  }
  
  async getPhoto(id: number): Promise<Photo | undefined> {
    return this.photos.get(id);
  }
  
  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const id = this.photoId++;
    const now = new Date();
    
    // Ensure all required fields are present with defaults if needed
    const photo: Photo = { 
      ...insertPhoto, 
      id,
      title: insertPhoto.title,
      fileName: insertPhoto.fileName,
      fileType: insertPhoto.fileType,
      filePath: insertPhoto.filePath,
      description: insertPhoto.description || null,
      userId: insertPhoto.userId || 1,
      isLiked: insertPhoto.isLiked || false,
      collectionId: insertPhoto.collectionId || 1,
      uploadedAt: now 
    };
    
    this.photos.set(id, photo);
    
    // Save metadata to a JSON file to persist title and other information across restarts
    this.savePhotoMetadata(photo);
    
    return photo;
  }
  
  async updatePhoto(id: number, photoUpdate: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const photo = this.photos.get(id);
    if (!photo) return undefined;
    
    // Ensure we maintain the required types
    const updatedPhoto: Photo = {
      ...photo,
      title: photoUpdate.title || photo.title,
      fileName: photoUpdate.fileName || photo.fileName,
      fileType: photoUpdate.fileType || photo.fileType,
      filePath: photoUpdate.filePath || photo.filePath,
      description: photoUpdate.description !== undefined ? photoUpdate.description : photo.description,
      userId: photoUpdate.userId !== undefined ? photoUpdate.userId : photo.userId,
      isLiked: photoUpdate.isLiked !== undefined ? photoUpdate.isLiked : photo.isLiked,
      collectionId: photoUpdate.collectionId !== undefined ? photoUpdate.collectionId : photo.collectionId,
      id: photo.id,
      uploadedAt: photo.uploadedAt
    };
    
    this.photos.set(id, updatedPhoto);
    
    // Save updated metadata
    this.savePhotoMetadata(updatedPhoto);
    
    return updatedPhoto;
  }
  
  async deletePhoto(id: number): Promise<boolean> {
    const photo = this.photos.get(id);
    if (photo) {
      // Try to delete metadata file if it exists
      try {
        const uploadsDir = path.join(process.cwd(), "uploads");
        const metadataPath = path.join(uploadsDir, `${photo.fileName}.metadata.json`);
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
        }
      } catch (error) {
        console.error(`Error deleting metadata for photo ${id}:`, error);
      }
    }
    return this.photos.delete(id);
  }
  
  async toggleLikePhoto(id: number): Promise<Photo | undefined> {
    const photo = this.photos.get(id);
    if (!photo) return undefined;
    
    const updatedPhoto: Photo = {
      ...photo,
      isLiked: !photo.isLiked,
    };
    this.photos.set(id, updatedPhoto);
    
    // Save updated metadata
    this.savePhotoMetadata(updatedPhoto);
    
    return updatedPhoto;
  }
}

export const storage = new MemStorage();