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

// Helper function to handle database connection issues
async function withDatabaseRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // If it's a connection timeout, wait before retrying
      if (error instanceof Error && (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET'))) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // For non-connection errors, don't retry
      throw error;
    }
  }
  
  throw lastError!;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add cookie parser middleware
  app.use(cookieParser());

  // Health check endpoint
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      const { checkDatabaseHealth } = await import('./storage');
      const dbHealthy = await checkDatabaseHealth();
      
      const health = {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected',
        uptime: process.uptime(),
      };
      
      res.status(dbHealthy ? 200 : 503).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        uptime: process.uptime(),
      });
    }
  });

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
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
      
      console.log(`Creating collection for user ${req.user.username} (${req.user.id})`);
      
      // Parse form data from req.body
      const { name, description, type } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }
      
      // Create collection with retry logic
      const data = validateSchema(insertCollectionSchema, {
        name,
        description,
        type: type || 'custom',
        userId: req.user.id
      });
      
      const collection = await withDatabaseRetry(() => storage.createCollection(data));
      console.log(`Collection created successfully: ${collection.id}`);
      
      // Handle photo uploads if any
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        console.log(`Processing ${req.files.length} photo uploads`);
        const photoTitles = Array.isArray(req.body.photoTitle) 
          ? req.body.photoTitle 
          : [req.body.photoTitle];
          
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const title = photoTitles[i] || file.originalname;
          
          console.log(`Processing photo ${i + 1}/${req.files.length}: ${title}`);
          
          // Generate unique filename and save to filesystem
          const fileName = generateFileName(file.originalname);
          const filePath = await storage.savePhotoToFilesystem(file.buffer, fileName);
          
          // Save photo to collection with retry logic
          await withDatabaseRetry(() => storage.createPhoto({
            title,
            fileName: fileName,
            fileType: file.mimetype,
            filePath: filePath,
            userId: req.user.id,
            collectionId: collection.id,
            isLiked: false
          }));
          
          console.log(`Photo ${i + 1} saved successfully`);
        }
      }
      
      return res.status(201).json(collection);
    } catch (error) {
      console.error('Error creating collection:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('ETIMEDOUT')) {
          return res.status(503).json({ 
            message: 'Database connection timeout. Please try again in a moment.',
            code: 'DATABASE_TIMEOUT'
          });
        }
        if (error.message.includes('ECONNRESET')) {
          return res.status(503).json({ 
            message: 'Database connection was reset. Please try again.',
            code: 'CONNECTION_RESET'
          });
        }
      }
      
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to create collection',
        code: 'CREATION_FAILED'
      });
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
      console.log(`Uploading photo for user ${req.user.username}: ${file.originalname} (${file.size} bytes)`);
      
      // Generate unique filename and save to filesystem
      const fileName = generateFileName(file.originalname);
      const filePath = await storage.savePhotoToFilesystem(file.buffer, fileName);
      console.log(`Photo saved to filesystem: ${filePath}`);
      
      const data = validateSchema(insertPhotoSchema, {
        ...req.body,
        fileName: fileName,
        fileType: file.mimetype,
        filePath: filePath,
        userId: req.user.id,
        collectionId: parseInt(req.body.collectionId),
        isLiked: req.body.isLiked === 'true'
      });

      const photo = await withDatabaseRetry(() => storage.createPhoto(data));
      console.log(`Photo saved to database successfully: ${photo.id}`);
      
      return res.status(201).json(photo);
    } catch (error) {
      console.error('Error creating photo:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('ETIMEDOUT')) {
          return res.status(503).json({ 
            message: 'Database connection timeout. Please try again in a moment.',
            code: 'DATABASE_TIMEOUT'
          });
        }
        if (error.message.includes('ECONNRESET')) {
          return res.status(503).json({ 
            message: 'Database connection was reset. Please try again.',
            code: 'CONNECTION_RESET'
          });
        }
      }
      
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to create photo',
        code: 'CREATION_FAILED'
      });
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
