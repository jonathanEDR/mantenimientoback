import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/clerk-sdk-node';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = String(authHeader || '').replace(/^Bearer\s+/i, '') || undefined;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        issuer: process.env.CLERK_ISSUER || 'https://clerk.clerk.accounts.dev',
      });
      
      // Extraer el userId del payload de Clerk
      const userId = (payload as any).sub;
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token format' });
      }
      
      (req as any).user = { userId, sub: userId };
      return next();
    } catch (err) {
      // Log error without sensitive information in production
      if (process.env.NODE_ENV !== 'production') {
        console.error('[clerkAuth] verifyToken failed:', (err as Error).message);
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[clerkAuth] unexpected error:', (error as Error).message);
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};
