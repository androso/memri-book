import fs from 'fs';
import path from 'path';

interface SessionData {
  userId: number;
  username: string;
  expiresAt: Date;
}

interface SerializedSessionData {
  userId: number;
  username: string;
  expiresAt: string;
}

class PersistentSessionStore {
  private sessions = new Map<string, SessionData>();
  private sessionFile: string;

  constructor() {
    this.sessionFile = path.join(process.cwd(), 'sessions.json');
    this.loadSessions();
    
    // Save sessions every 5 minutes
    setInterval(() => {
      this.saveSessions();
    }, 5 * 60 * 1000);
    
    // Clean expired sessions every hour
    setInterval(() => {
      this.cleanExpiredSessions();
    }, 60 * 60 * 1000);
  }

  private loadSessions() {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const data = fs.readFileSync(this.sessionFile, 'utf8');
        const serializedSessions: Record<string, SerializedSessionData> = JSON.parse(data);
        
        for (const [sessionId, sessionData] of Object.entries(serializedSessions)) {
          const expiresAt = new Date(sessionData.expiresAt);
          
          // Only load non-expired sessions
          if (expiresAt > new Date()) {
            this.sessions.set(sessionId, {
              userId: sessionData.userId,
              username: sessionData.username,
              expiresAt
            });
          }
        }
        
        console.log(`Loaded ${this.sessions.size} active sessions from disk`);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  private saveSessions() {
    try {
      const serializedSessions: Record<string, SerializedSessionData> = {};
      
      for (const [sessionId, sessionData] of this.sessions.entries()) {
        serializedSessions[sessionId] = {
          userId: sessionData.userId,
          username: sessionData.username,
          expiresAt: sessionData.expiresAt.toISOString()
        };
      }
      
      fs.writeFileSync(this.sessionFile, JSON.stringify(serializedSessions, null, 2));
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  set(sessionId: string, sessionData: SessionData) {
    this.sessions.set(sessionId, sessionData);
  }

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  entries() {
    return this.sessions.entries();
  }

  cleanExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned ${cleanedCount} expired sessions`);
      this.saveSessions();
    }
  }

  // Graceful shutdown
  shutdown() {
    this.saveSessions();
  }
}

export const sessionStore = new PersistentSessionStore();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Saving sessions before shutdown...');
  sessionStore.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Saving sessions before shutdown...');
  sessionStore.shutdown();
  process.exit(0);
}); 