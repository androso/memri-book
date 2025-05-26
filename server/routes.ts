import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCollectionSchema, insertPhotoSchema, loginSchema, updateUserSchema } from "@shared/schema";
import { AuthService, requireAuth, optionalAuth } from "./auth";
import multer from "multer";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import cookieParser from "cookie-parser";

// Extend Request type to include multer file properties
interface MulterRequest extends Request {
  file?: multer.Multer.File;
  files?: multer.Multer.File[];
}

// Set up multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to handle zod validation
function validateSchema<T>(schema: any, data: any): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      throw new Error(validationError.message);
    }
    throw error;
  }
}

// Helper function to generate unique filename
function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000000000);
  const extension = originalName.split('.').pop();
  return `photo-${timestamp}-${randomNum}.${extension}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add cookie parser middleware
  app.use(cookieParser());

  // Authentication routes
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const credentials = validateSchema(loginSchema, req.body);
      const result = await AuthService.login(credentials);
      
      if (!result) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Set session cookie
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      return res.json({ user: result.user, sessionId: result.sessionId });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Login failed' });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.sessionId) {
        AuthService.logout(req.sessionId);
      }
      
      res.clearCookie('sessionId');
      return res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
    return res.json({ user: req.user });
  });

  // User management routes
  app.get('/api/users', requireAuth, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.put('/api/users/profile', requireAuth, upload.single('profilePicture'), async (req: MulterRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const updateData: any = {};
      
      // Handle text fields
      if (req.body.displayName) {
        updateData.displayName = req.body.displayName;
      }
      
      if (req.body.password) {
        updateData.password = await AuthService.hashPassword(req.body.password);
      }
      
      // Handle profile picture upload
      if (req.file) {
        const fileName = generateFileName(req.file.originalname);
        const filePath = await storage.savePhotoToFilesystem(req.file.buffer, fileName);
        updateData.profilePicture = filePath;
      }
      
      const validatedData = validateSchema(updateUserSchema, updateData);
      const updatedUser = await storage.updateUser(req.user.id, validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = updatedUser;
      return res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error('Error updating user profile:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to update profile' });
    }
  });

  // Collections API
  app.get('/api/collections', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const collections = await storage.getCollections(req.user.id);
      return res.json(collections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      return res.status(500).json({ message: 'Failed to fetch collections' });
    }
  });

  app.get('/api/collections/with-thumbnails', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const collections = await storage.getCollectionsWithThumbnails(req.user.id);
      return res.json(collections);
    } catch (error) {
      console.error('Error fetching collections with thumbnails:', error);
      return res.status(500).json({ message: 'Failed to fetch collections with thumbnails' });
    }
  });

  app.post('/api/collections', requireAuth, upload.array('photo'), async (req: MulterRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Parse form data from req.body
      const { name, description, type } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }
      
      // Create collection
      const data = validateSchema(insertCollectionSchema, {
        name,
        description,
        type: type || 'custom',
        userId: req.user.id
      });
      
      const collection = await storage.createCollection(data);
      
      // Handle photo uploads if any
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const photoTitles = Array.isArray(req.body.photoTitle) 
          ? req.body.photoTitle 
          : [req.body.photoTitle];
          
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const title = photoTitles[i] || file.originalname;
          
          // Generate unique filename and save to filesystem
          const fileName = generateFileName(file.originalname);
          const filePath = await storage.savePhotoToFilesystem(file.buffer, fileName);
          
          // Save photo to collection
          await storage.createPhoto({
            title,
            fileName: fileName,
            fileType: file.mimetype,
            filePath: filePath,
            userId: req.user.id,
            collectionId: collection.id,
            isLiked: false
          });
        }
      }
      
      return res.status(201).json(collection);
    } catch (error) {
      console.error('Error creating collection:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to create collection' });
    }
  });

  app.get('/api/collections/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const collectionId = parseInt(req.params.id);
      if (isNaN(collectionId)) {
        return res.status(400).json({ message: 'Invalid collection ID' });
      }

      const collection = await storage.getCollection(collectionId);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      // Check if user is an owner of this collection
      const ownership = await storage.checkCollectionOwnership(collectionId, req.user.id);
      if (!ownership) {
        return res.status(403).json({ message: 'Not authorized to access this collection' });
      }

      return res.json(collection);
    } catch (error) {
      console.error('Error fetching collection:', error);
      return res.status(500).json({ message: 'Failed to fetch collection' });
    }
  });

  app.put('/api/collections/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const collectionId = parseInt(req.params.id);
      if (isNaN(collectionId)) {
        return res.status(400).json({ message: 'Invalid collection ID' });
      }

      const collection = await storage.getCollection(collectionId);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      // Check if user is an owner of this collection
      const ownership = await storage.checkCollectionOwnership(collectionId, req.user.id);
      if (!ownership) {
        return res.status(403).json({ message: 'Not authorized to update this collection' });
      }

      const data = validateSchema(insertCollectionSchema.partial(), req.body);
      const updatedCollection = await storage.updateCollection(collectionId, data);
      return res.json(updatedCollection);
    } catch (error) {
      console.error('Error updating collection:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to update collection' });
    }
  });

  app.delete('/api/collections/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const collectionId = parseInt(req.params.id);
      if (isNaN(collectionId)) {
        return res.status(400).json({ message: 'Invalid collection ID' });
      }

      const collection = await storage.getCollection(collectionId);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      // Check if user is an owner of this collection
      const ownership = await storage.checkCollectionOwnership(collectionId, req.user.id);
      if (!ownership) {
        return res.status(403).json({ message: 'Not authorized to delete this collection' });
      }

      const success = await storage.deleteCollection(collectionId);
      if (success) {
        return res.status(204).end();
      } else {
        return res.status(500).json({ message: 'Failed to delete collection' });
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      return res.status(500).json({ message: 'Failed to delete collection' });
    }
  });

  // Photos API
  app.get('/api/photos', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const collectionId = req.query.collectionId ? parseInt(req.query.collectionId as string) : undefined;
      const photos = await storage.getPhotos(req.user.id, collectionId);
      return res.json(photos);
    } catch (error) {
      console.error('Error fetching photos:', error);
      return res.status(500).json({ message: 'Failed to fetch photos' });
    }
  });

  app.post('/api/photos', requireAuth, upload.single('photo'), async (req: MulterRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const file = req.file;
      
      // Generate unique filename and save to filesystem
      const fileName = generateFileName(file.originalname);
      const filePath = await storage.savePhotoToFilesystem(file.buffer, fileName);
      
      const data = validateSchema(insertPhotoSchema, {
        ...req.body,
        fileName: fileName,
        fileType: file.mimetype,
        filePath: filePath,
        userId: req.user.id,
        collectionId: parseInt(req.body.collectionId),
        isLiked: req.body.isLiked === 'true'
      });

      const photo = await storage.createPhoto(data);
      return res.status(201).json(photo);
    } catch (error) {
      console.error('Error creating photo:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to create photo' });
    }
  });

  app.get('/api/photos/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      // Check if user owns this photo
      if (photo.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to access this photo' });
      }

      return res.json(photo);
    } catch (error) {
      console.error('Error fetching photo:', error);
      return res.status(500).json({ message: 'Failed to fetch photo' });
    }
  });

  app.put('/api/photos/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      if (photo.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to update this photo' });
      }

      const data = validateSchema(insertPhotoSchema.partial(), req.body);
      const updatedPhoto = await storage.updatePhoto(photoId, data);
      return res.json(updatedPhoto);
    } catch (error) {
      console.error('Error updating photo:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to update photo' });
    }
  });

  app.post('/api/photos/:id/like', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      // Check if user owns this photo
      if (photo.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to like this photo' });
      }

      const updatedPhoto = await storage.toggleLikePhoto(photoId);
      return res.json(updatedPhoto);
    } catch (error) {
      console.error('Error toggling like on photo:', error);
      return res.status(500).json({ message: 'Failed to toggle like on photo' });
    }
  });

  app.delete('/api/photos/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      if (photo.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to delete this photo' });
      }

      const success = await storage.deletePhoto(photoId);
      if (success) {
        return res.status(204).end();
      } else {
        return res.status(500).json({ message: 'Failed to delete photo' });
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      return res.status(500).json({ message: 'Failed to delete photo' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
