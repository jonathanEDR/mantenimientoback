import express from 'express';
import componentesRoutes from './componentes';
import ordenesTrabajoRoutes from './ordenesTrabajo';
import dashboardRoutes from './dashboardMantenimiento';
import estadosMonitoreoComponenteRoutes from './estadosMonitoreoComponente';

const router = express.Router();

// Montar sub-rutas de mantenimiento
router.use('/componentes', componentesRoutes);
router.use('/ordenes', ordenesTrabajoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/estados-monitoreo-componente', estadosMonitoreoComponenteRoutes);

export default router;