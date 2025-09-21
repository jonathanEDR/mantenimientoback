import express from 'express';
import componentesRoutes from './componentes';
import controlMonitoreoRoutes from './controlMonitoreo';

const router = express.Router();

// Montar sub-rutas de catálogos
router.use('/componentes', componentesRoutes);
router.use('/control-monitoreo', controlMonitoreoRoutes);

export default router;