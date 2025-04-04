import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCollectionSchema, insertPhotoSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Set up multer for file uploads
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage_config,
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Static file serving for uploads
  app.use('/uploads', express.static(UPLOADS_DIR));
  
  // Default user ID for demo (in a real app, we'd get this from auth)
  const DEFAULT_USER_ID = 1;

  // Collections API
  app.get('/api/collections', async (_req: Request, res: Response) => {
    try {
      const collections = await storage.getCollections(DEFAULT_USER_ID);
      return res.json(collections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      return res.status(500).json({ message: 'Failed to fetch collections' });
    }
  });

  app.post('/api/collections', async (req: Request, res: Response) => {
    try {
      const data = validateSchema(insertCollectionSchema, {
        ...req.body,
        userId: DEFAULT_USER_ID
      });
      
      const collection = await storage.createCollection(data);
      return res.status(201).json(collection);
    } catch (error) {
      console.error('Error creating collection:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to create collection' });
    }
  });

  app.get('/api/collections/:id', async (req: Request, res: Response) => {
    try {
      const collectionId = parseInt(req.params.id);
      if (isNaN(collectionId)) {
        return res.status(400).json({ message: 'Invalid collection ID' });
      }

      const collection = await storage.getCollection(collectionId);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      return res.json(collection);
    } catch (error) {
      console.error('Error fetching collection:', error);
      return res.status(500).json({ message: 'Failed to fetch collection' });
    }
  });

  app.put('/api/collections/:id', async (req: Request, res: Response) => {
    try {
      const collectionId = parseInt(req.params.id);
      if (isNaN(collectionId)) {
        return res.status(400).json({ message: 'Invalid collection ID' });
      }

      const collection = await storage.getCollection(collectionId);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      if (collection.userId !== DEFAULT_USER_ID) {
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

  app.delete('/api/collections/:id', async (req: Request, res: Response) => {
    try {
      const collectionId = parseInt(req.params.id);
      if (isNaN(collectionId)) {
        return res.status(400).json({ message: 'Invalid collection ID' });
      }

      const collection = await storage.getCollection(collectionId);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      if (collection.userId !== DEFAULT_USER_ID) {
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
  app.get('/api/photos', async (req: Request, res: Response) => {
    try {
      const collectionId = req.query.collectionId ? parseInt(req.query.collectionId as string) : undefined;
      const photos = await storage.getPhotos(DEFAULT_USER_ID, collectionId);
      return res.json(photos);
    } catch (error) {
      console.error('Error fetching photos:', error);
      return res.status(500).json({ message: 'Failed to fetch photos' });
    }
  });

  app.post('/api/photos', upload.single('photo'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const file = req.file;
      
      const data = validateSchema(insertPhotoSchema, {
        ...req.body,
        fileName: file.filename,
        fileType: file.mimetype,
        filePath: `/uploads/${file.filename}`,
        userId: DEFAULT_USER_ID,
        collectionId: parseInt(req.body.collectionId) || 1, // Default to first collection if not specified
        isLiked: req.body.isLiked === 'true'
      });

      const photo = await storage.createPhoto(data);
      return res.status(201).json(photo);
    } catch (error) {
      console.error('Error creating photo:', error);
      // Clean up uploaded file if there was an error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('Error deleting file after failed upload:', err);
        }
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to create photo' });
    }
  });

  app.get('/api/photos/:id', async (req: Request, res: Response) => {
    try {
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      return res.json(photo);
    } catch (error) {
      console.error('Error fetching photo:', error);
      return res.status(500).json({ message: 'Failed to fetch photo' });
    }
  });

  app.put('/api/photos/:id', async (req: Request, res: Response) => {
    try {
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      if (photo.userId !== DEFAULT_USER_ID) {
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

  app.post('/api/photos/:id/like', async (req: Request, res: Response) => {
    try {
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      const updatedPhoto = await storage.toggleLikePhoto(photoId);
      return res.json(updatedPhoto);
    } catch (error) {
      console.error('Error toggling like on photo:', error);
      return res.status(500).json({ message: 'Failed to toggle like on photo' });
    }
  });

  app.delete('/api/photos/:id', async (req: Request, res: Response) => {
    try {
      const photoId = parseInt(req.params.id);
      if (isNaN(photoId)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }

      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      if (photo.userId !== DEFAULT_USER_ID) {
        return res.status(403).json({ message: 'Not authorized to delete this photo' });
      }

      // Delete the file from the filesystem
      try {
        const filePath = path.join(process.cwd(), photo.filePath.slice(1));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Error deleting file:', err);
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

import express from "express";
