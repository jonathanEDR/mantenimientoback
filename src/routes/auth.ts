import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/clerkAuth';
import User from '../models/User';

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  clerkId: z.string().min(1), // Clerk ID es requerido
});

// Endpoint para registro inicial (después de Clerk signup)
// Use express.text on this route so we can log the raw payload when JSON parsing fails
router.post('/register', async (req, res) => {
  try {
    const rawBody = (req as any).rawBody ?? req.body;
    console.log('[auth] POST /register raw body type:', typeof rawBody);
    console.log('[auth] POST /register raw preview:', String(rawBody).slice(0, 300));

    // Attempt to parse JSON safely. If it's already parsed by upstream middleware, use it.
  let parsedBody: any = rawBody;
    if (typeof rawBody === 'string') {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (err) {
        console.warn('[auth] raw body is not valid JSON:', (err as Error).message);
        // let zod produce a helpful error below
      }
    }

    const { name, email, clerkId } = registerSchema.parse(parsedBody);

    // Verificar si el usuario ya existe
  const existingUser = await User.findOne({ clerkId });
  console.log('[auth] existingUser:', !!existingUser);
    if (existingUser) {
      return res.status(200).json({
        message: 'Usuario ya registrado',
        user: existingUser
      });
    }

    // Crear nuevo usuario
    const user = new User({
      clerkId,
      name,
      email,
    });

  await user.save();
  console.log('[auth] user saved with _id:', user._id);
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      console.error('Error en registro:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// Endpoint protegido para obtener datos del usuario autenticado
router.get('/me', requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).user.sub;
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Webhook endpoint for Clerk (server-to-server) - recommended for reliable sync
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('[auth:webhook] Received webhook:', req.headers['x-clerk-signature'] ? 'with-signature' : 'no-signature');
    const event = req.body;
    console.log('[auth:webhook] event.type:', event?.type);

    // Basic handling for user.created event
    if (event?.type === 'user.created' && event?.data) {
      const payload = event.data;
      const clerkId = payload.id || payload.user?.id || payload.user_id;
      const email = payload.email || payload.primary_email_address || payload.user?.primary_email_address?.email_address;
      const name = payload.full_name || `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || payload.user?.first_name || payload.user?.last_name;

      if (!clerkId) {
        console.warn('[auth:webhook] user.created missing clerkId, skipping');
        return res.status(400).json({ error: 'missing clerkId' });
      }

      const existing = await User.findOne({ clerkId });
      if (existing) {
        console.log('[auth:webhook] User already exists, skipping save for', clerkId);
        return res.status(200).json({ message: 'already_exists' });
      }

      const user = new User({ clerkId, name: name || 'Usuario', email });
      await user.save();
      console.log('[auth:webhook] User created via webhook:', user._id.toString());
      return res.status(201).json({ message: 'created', user });
    }

    res.status(200).json({ message: 'ignored' });
  } catch (err) {
    console.error('[auth:webhook] Error processing webhook:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
