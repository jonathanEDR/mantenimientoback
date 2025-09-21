import express from 'express';
import catalogosRoutes from './catalogos';

const router = express.Router();

// Montar sub-rutas de herramientas
router.use('/catalogos', catalogosRoutes);

export default router;