import express from 'express';
import componentesRoutes from './componentes';
import ordenesTrabajoRoutes from './ordenesTrabajo';
import dashboardRoutes from './dashboardMantenimiento';

const router = express.Router();

// Montar sub-rutas de mantenimiento
router.use('/componentes', componentesRoutes);
router.use('/ordenes', ordenesTrabajoRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;