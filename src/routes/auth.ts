import express from 'express';
import { z } from 'zod';
import { Webhook } from 'svix';
import { requireAuth } from '../middleware/clerkAuth';
import User, { UserRole } from '../models/User';

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  clerkId: z.string().min(1), // Clerk ID es requerido
  role: z.enum([UserRole.ADMINISTRADOR, UserRole.MECANICO, UserRole.COPILOTO, UserRole.ESPECIALISTA]).optional()
});

// Endpoint para registro inicial (después de Clerk signup)
// Use express.text on this route so we can log the raw payload when JSON parsing fails
router.post('/register', async (req, res) => {
  try {
    const rawBody = (req as any).rawBody ?? req.body;

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

    const { name, email, clerkId, role } = registerSchema.parse(parsedBody);

    console.log(`🔍 [AUTH/REGISTER] Registrando usuario - ClerkId: ${clerkId}, Email: ${email}`);

    // Verificar si el usuario ya existe por clerkId o email
    let existingUser = await User.findOne({ clerkId });
    
    if (existingUser) {
      console.log(`✅ [AUTH/REGISTER] Usuario ya existe por clerkId: ${email}`);
      return res.status(200).json({
        message: 'Usuario ya registrado',
        user: existingUser
      });
    }

    // Verificar si existe por email (caso de clerkId desactualizado)
    existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`🔄 [AUTH/REGISTER] Usuario existe por email, actualizando clerkId: ${email}`);
      existingUser.clerkId = clerkId;
      existingUser.name = name; // Actualizar nombre también
      existingUser.updatedBy = 'auth-register';
      await existingUser.save();
      
      return res.status(200).json({
        message: 'Usuario sincronizado exitosamente',
        user: existingUser
      });
    }

    // Crear nuevo usuario
    console.log(`➕ [AUTH/REGISTER] Creando nuevo usuario: ${email}`);
    const user = new User({
      clerkId,
      name,
      email,
      role: role || UserRole.ESPECIALISTA, // Rol por defecto si no se especifica
      isActive: true,
      createdBy: 'auth-register'
    });

    await user.save();
    console.log(`✅ [AUTH/REGISTER] Usuario creado exitosamente: ${email} (${user.role})`);
    
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
    const clerkEmail = (req as any).user.email;
    
    console.log(`🔍 [AUTH/ME] Buscando usuario - ClerkId: ${clerkId}, Email: ${clerkEmail}`);
    
    // 1. Buscar primero por clerkId (caso normal)
    let user = await User.findOne({ clerkId });

    // 2. Si no existe por clerkId, buscar por email (usuario existente con clerkId desactualizado)
    if (!user && clerkEmail) {
      console.log(`⚠️ [AUTH/ME] Usuario no encontrado por clerkId, buscando por email: ${clerkEmail}`);
      user = await User.findOne({ email: clerkEmail });
      
      // 3. Si existe por email, actualizar el clerkId
      if (user) {
        console.log(`🔄 [AUTH/ME] Usuario encontrado por email, actualizando clerkId de ${user.clerkId} a ${clerkId}`);
        user.clerkId = clerkId;
        user.updatedBy = 'auth-sync';
        await user.save();
        console.log(`✅ [AUTH/ME] ClerkId actualizado exitosamente para ${clerkEmail}`);
      }
    }

    // 4. Si aún no existe, retornar 404 para que el frontend registre al usuario
    if (!user) {
      console.log(`❌ [AUTH/ME] Usuario no encontrado - ClerkId: ${clerkId}, Email: ${clerkEmail}`);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    console.log(`✅ [AUTH/ME] Usuario encontrado: ${user.email} (${user.role})`);
    res.json({ user });
  } catch (error) {
    console.error('❌ [AUTH/ME] Error:', (error as Error).message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Webhook endpoint for Clerk (server-to-server) - recommended for reliable sync
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      console.error('[auth:webhook] CLERK_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Verify webhook signature for security using Svix
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: 'Missing svix headers' });
    }

    const wh = new Webhook(WEBHOOK_SECRET);
    let event: any;

    try {
      event = wh.verify(req.body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('[auth:webhook] Webhook verification failed');
      return res.status(400).json({ error: 'Webhook verification failed' });
    }

    // Handle different webhook events
    const { type, data } = event;

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[auth:webhook] Unhandled event type: ${type}`);
        }
    }

    return res.status(200).json({ message: 'success' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[auth:webhook] Error processing webhook:', (err as Error).message);
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Handler functions for different webhook events
async function handleUserCreated(userData: any) {
  try {
    const clerkId = userData.id;
    const email = userData.email_addresses?.[0]?.email_address || '';
    const firstName = userData.first_name || '';
    const lastName = userData.last_name || '';
    const name = userData.full_name || `${firstName} ${lastName}`.trim() || 'Usuario';

    if (!clerkId) {
      throw new Error('Missing clerkId in user.created event');
    }

    // Check if user already exists
    const existing = await User.findOne({ clerkId });
    if (existing) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[auth:webhook] User already exists:', clerkId);
      }
      return;
    }

    // Create new user
    const user = new User({
      clerkId,
      name,
      email,
      role: UserRole.ESPECIALISTA,
      isActive: true,
      createdBy: 'webhook'
    });

    await user.save();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth:webhook] User created successfully:', clerkId);
    }
  } catch (error) {
    console.error('[auth:webhook] Error in handleUserCreated:', (error as Error).message);
    throw error;
  }
}

async function handleUserUpdated(userData: any) {
  try {
    const clerkId = userData.id;
    const email = userData.email_addresses?.[0]?.email_address || '';
    const firstName = userData.first_name || '';
    const lastName = userData.last_name || '';
    const name = userData.full_name || `${firstName} ${lastName}`.trim() || 'Usuario';

    if (!clerkId) {
      throw new Error('Missing clerkId in user.updated event');
    }

    // Update existing user
    const user = await User.findOneAndUpdate(
      { clerkId },
      { 
        name, 
        email,
        updatedBy: 'webhook'
      },
      { new: true }
    );

    if (!user) {
      // If user doesn't exist, create it
      await handleUserCreated(userData);
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth:webhook] User updated successfully:', clerkId);
    }
  } catch (error) {
    console.error('[auth:webhook] Error in handleUserUpdated:', (error as Error).message);
    throw error;
  }
}

async function handleUserDeleted(userData: any) {
  try {
    const clerkId = userData.id;

    if (!clerkId) {
      throw new Error('Missing clerkId in user.deleted event');
    }

    // Soft delete - mark as inactive instead of removing
    const user = await User.findOneAndUpdate(
      { clerkId },
      { 
        isActive: false,
        updatedBy: 'webhook'
      },
      { new: true }
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth:webhook] User deactivated successfully:', clerkId);
    }
  } catch (error) {
    console.error('[auth:webhook] Error in handleUserDeleted:', (error as Error).message);
    throw error;
  }
}

export default router;
