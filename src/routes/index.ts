import express from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import inventarioRoutes from './inventario';
import mantenimientoRoutes from './mantenimiento';
import herramientasRoutes from './herramientas';
import monitoreoRoutes from './monitoreo';
import estadosMonitoreoComponenteRoutes from './estadosMonitoreoComponente';
import dashboardMonitoreoRoutes from './dashboardMonitoreo';

const router = express.Router();

// Mount sub-routers here
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/mantenimiento', mantenimientoRoutes);
router.use('/herramientas', herramientasRoutes);
router.use('/monitoreo', monitoreoRoutes);
router.use('/estados-monitoreo-componente', estadosMonitoreoComponenteRoutes);
router.use('/dashboard', dashboardMonitoreoRoutes);

export default router;
