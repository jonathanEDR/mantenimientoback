import express from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import inventarioRoutes from './inventario';
import mantenimientoRoutes from './mantenimiento';

const router = express.Router();

// Mount sub-routers here
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/mantenimiento', mantenimientoRoutes);

export default router;
