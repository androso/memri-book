import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { LoginRequest } from "@shared/schema";
import { databaseSessionStore } from "./databaseSessionStore";

// Session configuration
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // Refresh if less than 24 hours remaining

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        displayName: string;
        profilePicture?: string;
      };
      sessionId?: string;
    }
  }
}

export class AuthService {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate session ID
  static generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Create session
  static async createSession(userId: number, username: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    
    await databaseSessionStore.set(sessionId, {
      userId,
      username,
      expiresAt
    });

    return sessionId;
  }

  // Get session
  static async getSession(sessionId: string) {
    const session = await databaseSessionStore.get(sessionId);
    if (!session) return null;

    // Check if session is expired (already handled in databaseSessionStore.get)
    // Auto-refresh session if it's close to expiring
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD) {
      session.expiresAt = new Date(Date.now() + SESSION_DURATION);
      await databaseSessionStore.set(sessionId, session);
    }

    return session;
  }

  // Delete session
  static async deleteSession(sessionId: string): Promise<void> {
    await databaseSessionStore.delete(sessionId);
  }

  // Clean expired sessions
  static async cleanExpiredSessions(): Promise<void> {
    await databaseSessionStore.cleanExpiredSessions();
  }

  // Login user
  static async login(credentials: LoginRequest): Promise<{ user: any; sessionId: string } | null> {
    try {
      const user = await storage.getUserByUsername(credentials.username);
      if (!user) {
        return null;
      }

      const isValidPassword = await this.verifyPassword(credentials.password, user.password);
      if (!isValidPassword) {
        return null;
      }

      const sessionId = await this.createSession(user.id, user.username);

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      
      return {
        user: userWithoutPassword,
        sessionId
      };
    } catch (error) {
      console.error("Login error:", error);
      return null;
    }
  }

  // Logout user
  static async logout(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId);
  }
}

// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionId;

  if (!sessionId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  AuthService.getSession(sessionId).then(session => {
    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Attach session info to request
    req.sessionId = sessionId;
    
    // Get full user info and attach to request
    storage.getUser(session.userId).then(user => {
      if (user) {
        const { password, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
        next();
      } else {
        return res.status(401).json({ message: 'User not found' });
      }
    }).catch(error => {
      console.error("Auth middleware error:", error);
      return res.status(500).json({ message: 'Authentication error' });
    });
  }).catch(error => {
    console.error("Session retrieval error:", error);
    return res.status(500).json({ message: 'Authentication error' });
  });
}

// Optional authentication middleware (doesn't fail if no auth)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionId;

  if (!sessionId) {
    return next();
  }

  AuthService.getSession(sessionId).then(session => {
    if (!session) {
      return next();
    }

    req.sessionId = sessionId;
    
    storage.getUser(session.userId).then(user => {
      if (user) {
        const { password, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
      }
      next();
    }).catch(error => {
      console.error("Optional auth middleware error:", error);
      next();
    });
  }).catch(error => {
    console.error("Optional auth session retrieval error:", error);
    next();
  });
}

// Clean expired sessions every hour
setInterval(async () => {
  await AuthService.cleanExpiredSessions();
}, 60 * 60 * 1000); 