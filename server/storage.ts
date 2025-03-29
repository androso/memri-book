import { users, collections, photos, type User, type InsertUser, type Collection, type InsertCollection, type Photo, type InsertPhoto } from "@shared/schema";
import { format } from "date-fns";

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
      const collection: Collection = {
        ...col,
        id: this.collectionId++,
        createdAt: new Date(),
      };
      this.collections.set(collection.id, collection);
    });
  }

  // Initialize default photos with stock image data
  private initializeDefaultPhotos() {
    const defaultCollections = Array.from(this.collections.values());
    const defaultUserId = 1;
    
    // Stock photo data structure - filenames would need to be replaced with actual uploaded files in production
    const photoData = [
      {
        title: "Mountain Overlook",
        description: "Peaceful view from our weekend hike",
        fileName: "mountain_1.jpg",
        fileType: "image/jpeg",
        filePath: "/uploads/mountain_1.jpg",
        isLiked: true,
        collectionId: defaultCollections.find(c => c.type === "nature")?.id || 1,
        uploadedAt: new Date("2023-04-12")
      },
      {
        title: "Magical Forest",
        description: "Sunlight filtering through ancient trees",
        fileName: "forest_1.jpg",
        fileType: "image/jpeg",
        filePath: "/uploads/forest_1.jpg",
        isLiked: true,
        collectionId: defaultCollections.find(c => c.type === "nature")?.id || 1,
        uploadedAt: new Date("2023-05-03")
      },
      {
        title: "Valley of Mists",
        description: "Early morning fog in the valley",
        fileName: "valley_1.jpg",
        fileType: "image/jpeg",
        filePath: "/uploads/valley_1.jpg",
        isLiked: false,
        collectionId: defaultCollections.find(c => c.type === "nature")?.id || 1,
        uploadedAt: new Date("2023-06-15")
      },
      {
        title: "Crystal Lake",
        description: "The calmest waters I've ever seen",
        fileName: "lake_1.jpg",
        fileType: "image/jpeg",
        filePath: "/uploads/lake_1.jpg",
        isLiked: true,
        collectionId: defaultCollections.find(c => c.type === "travels")?.id || 2,
        uploadedAt: new Date("2023-07-02")
      },
      {
        title: "Flower Meadow",
        description: "Spring blooms in the countryside",
        fileName: "meadow_1.jpg",
        fileType: "image/jpeg",
        filePath: "/uploads/meadow_1.jpg",
        isLiked: false,
        collectionId: defaultCollections.find(c => c.type === "nature")?.id || 1,
        uploadedAt: new Date("2023-04-29")
      },
      {
        title: "Enchanted Path",
        description: "The hidden trail we discovered",
        fileName: "path_1.jpg",
        fileType: "image/jpeg",
        filePath: "/uploads/path_1.jpg",
        isLiked: true,
        collectionId: defaultCollections.find(c => c.type === "travels")?.id || 2,
        uploadedAt: new Date("2023-08-16")
      },
      {
        title: "Sunset Mountains",
        description: "Golden hour in the mountains",
        fileName: "sunset_1.jpg",
        fileType: "image/jpeg",
        filePath: "/uploads/sunset_1.jpg",
        isLiked: false,
        collectionId: defaultCollections.find(c => c.type === "travels")?.id || 2,
        uploadedAt: new Date("2023-09-03")
      }
    ];
    
    photoData.forEach(data => {
      const photo: Photo = {
        ...data,
        id: this.photoId++,
        userId: defaultUserId
      };
      this.photos.set(photo.id, photo);
    });
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
    const collection: Collection = { ...insertCollection, id, createdAt: now };
    this.collections.set(id, collection);
    return collection;
  }
  
  async updateCollection(id: number, collectionUpdate: Partial<InsertCollection>): Promise<Collection | undefined> {
    const collection = this.collections.get(id);
    if (!collection) return undefined;
    
    const updatedCollection: Collection = {
      ...collection,
      ...collectionUpdate,
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
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });
  }
  
  async getPhoto(id: number): Promise<Photo | undefined> {
    return this.photos.get(id);
  }
  
  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const id = this.photoId++;
    const now = new Date();
    const photo: Photo = { ...insertPhoto, id, uploadedAt: now };
    this.photos.set(id, photo);
    return photo;
  }
  
  async updatePhoto(id: number, photoUpdate: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const photo = this.photos.get(id);
    if (!photo) return undefined;
    
    const updatedPhoto: Photo = {
      ...photo,
      ...photoUpdate,
    };
    this.photos.set(id, updatedPhoto);
    return updatedPhoto;
  }
  
  async deletePhoto(id: number): Promise<boolean> {
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
    return updatedPhoto;
  }
}

export const storage = new MemStorage();
