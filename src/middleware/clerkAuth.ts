import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/clerk-sdk-node';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('[clerkAuth] Authorization header present:', !!authHeader);
    const token = String(authHeader || '').replace(/^Bearer\s+/i, '') || undefined;

    if (!token) {
      console.warn('[clerkAuth] No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    // Log a small, non-sensitive preview to help debug token format issues
    const preview = `${token.slice(0, 8)}...${token.slice(-8)}`;
    const dotCount = (token.match(/\./g) || []).length;
    console.log('[clerkAuth] token preview:', preview, 'len=', token.length, 'dots=', dotCount);

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        issuer: process.env.CLERK_ISSUER || 'https://clerk.clerk.accounts.dev',
      });
      console.log('[clerkAuth] verifyToken payload:', payload && (payload as any).sub ? { sub: (payload as any).sub } : '(no sub)');
      
      // Extraer el userId del payload de Clerk
      const userId = (payload as any).sub;
      if (!userId) {
        console.error('[clerkAuth] No sub found in payload');
        return res.status(401).json({ error: 'Invalid token format' });
      }
      
      (req as any).user = { userId };
      return next();
    } catch (err) {
      // Emit full error in server logs to diagnose why token is rejected
      console.error('[clerkAuth] verifyToken failed:', {
        message: err && (err as Error).message ? (err as Error).message : err,
        stack: err && (err as Error).stack ? (err as Error).stack : '(no stack)',
        token: token,
        jwksUrl: process.env.CLERK_ISSUER ? `${process.env.CLERK_ISSUER}/.well-known/jwks.json` : 'undefined',
      });
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('[clerkAuth] unexpected error:', {
      message: error && (error as Error).message ? (error as Error).message : error,
      stack: error && (error as Error).stack ? (error as Error).stack : '(no stack)',
    });
    res.status(401).json({ error: 'Invalid token' });
  }
};
