import express from 'express';
import OrdenTrabajo, { TipoMantenimiento, PrioridadOrden, EstadoOrden } from '../models/OrdenTrabajo';
import { requireAuth } from '../middleware/clerkAuth';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/mantenimiento/ordenes - Obtener todas las órdenes de trabajo
router.get('/', requireAuth, async (req, res) => {
  try {
    const { estado, prioridad, tipo, aeronave, tecnico } = req.query;
    
    logger.info('Obteniendo lista de órdenes de trabajo', { filtros: { estado, prioridad, tipo, aeronave, tecnico } });

    // Construir filtros dinámicamente
    const filtros: any = {};
    if (estado) filtros.estado = estado;
    if (prioridad) filtros.prioridad = prioridad;
    if (tipo) filtros.tipo = tipo;
    if (aeronave) filtros.aeronave = aeronave;
    if (tecnico) filtros.tecnicoAsignado = tecnico;

    const ordenes = await OrdenTrabajo.find(filtros)
      .populate('aeronave', 'matricula modelo tipo')
      .populate('tecnicoAsignado', 'name email')
      .populate('supervisorAsignado', 'name email')
      .sort({ fechaCreacion: -1 });

    logger.info(`Se encontraron ${ordenes.length} órdenes de trabajo`);

    res.json({
      success: true,
      data: ordenes,
      total: ordenes.length
    });

  } catch (error) {
    logger.error('Error al obtener órdenes de trabajo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/ordenes/stats - Estadísticas de órdenes de trabajo
router.get('/stats', requireAuth, async (req, res) => {
  try {
    logger.info('Obteniendo estadísticas de órdenes de trabajo');

    const [
      totalOrdenes,
      ordenesPendientes,
      ordenesEnProceso,
      ordenesCompletadas,
      ordenesCriticas,
      ordenesPorTipo,
      tiempoPromedioResolucion
    ] = await Promise.all([
      OrdenTrabajo.countDocuments(),
      OrdenTrabajo.countDocuments({ estado: EstadoOrden.PENDIENTE }),
      OrdenTrabajo.countDocuments({ estado: EstadoOrden.EN_PROCESO }),
      OrdenTrabajo.countDocuments({ estado: EstadoOrden.COMPLETADA }),
      OrdenTrabajo.countDocuments({ prioridad: PrioridadOrden.CRITICA, estado: { $ne: EstadoOrden.COMPLETADA } }),
      OrdenTrabajo.aggregate([
        {
          $group: {
            _id: '$tipo',
            cantidad: { $sum: 1 }
          }
        },
        { $sort: { cantidad: -1 } }
      ]),
      OrdenTrabajo.aggregate([
        {
          $match: {
            estado: EstadoOrden.COMPLETADA,
            fechaInicio: { $exists: true },
            fechaFinalizacion: { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            tiempoPromedio: {
              $avg: {
                $divide: [
                  { $subtract: ['$fechaFinalizacion', '$fechaInicio'] },
                  1000 * 60 * 60 * 24 // Convertir a días
                ]
              }
            }
          }
        }
      ])
    ]);

    const stats = {
      totalOrdenes,
      ordenesPendientes,
      ordenesEnProceso,
      ordenesCompletadas,
      ordenesCriticas,
      porcentajeCompletadas: totalOrdenes > 0 ? Math.round((ordenesCompletadas / totalOrdenes) * 100) : 0,
      distribucionPorTipo: ordenesPorTipo,
      tiempoPromedioResolucion: tiempoPromedioResolucion[0]?.tiempoPromedio || 0
    };

    logger.info('Estadísticas de órdenes obtenidas:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de órdenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/ordenes/vencimientos - Órdenes próximas a vencer
router.get('/vencimientos', requireAuth, async (req, res) => {
  try {
    const { dias = 7 } = req.query;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + Number(dias));
    
    logger.info(`Obteniendo órdenes que vencen en los próximos ${dias} días`);

    const ordenesProximasVencer = await OrdenTrabajo.find({
      fechaVencimiento: { $lte: fechaLimite },
      estado: { $nin: [EstadoOrden.COMPLETADA, EstadoOrden.CANCELADA] }
    })
      .populate('aeronave', 'matricula modelo')
      .populate('tecnicoAsignado', 'name email')
      .sort({ fechaVencimiento: 1 });

    res.json({
      success: true,
      data: ordenesProximasVencer,
      total: ordenesProximasVencer.length
    });

  } catch (error) {
    logger.error('Error al obtener órdenes próximas a vencer:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/ordenes/tecnico/:technicoId - Órdenes asignadas a un técnico
router.get('/tecnico/:tecnicoId', requireAuth, async (req, res) => {
  try {
    const { tecnicoId } = req.params;
    const { incluirCompletadas = false } = req.query;
    
    logger.info(`Obteniendo órdenes del técnico: ${tecnicoId}`);

    const filtros: any = { tecnicoAsignado: tecnicoId };
    if (!incluirCompletadas) {
      filtros.estado = { $ne: EstadoOrden.COMPLETADA };
    }

    const ordenes = await OrdenTrabajo.find(filtros)
      .populate('aeronave', 'matricula modelo tipo')
      .sort({ prioridad: -1, fechaVencimiento: 1 });

    res.json({
      success: true,
      data: ordenes,
      total: ordenes.length
    });

  } catch (error) {
    logger.error('Error al obtener órdenes del técnico:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/ordenes/:id - Obtener orden por ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Obteniendo orden de trabajo con ID: ${id}`);

    const orden = await OrdenTrabajo.findById(id)
      .populate('aeronave', 'matricula modelo tipo fabricante')
      .populate('componente', 'numeroSerie numeroParte nombre')
      .populate('tecnicoAsignado', 'name email')
      .populate('supervisorAsignado', 'name email')
      .populate('registrosTrabajo.tecnico', 'name email');

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de trabajo no encontrada'
      });
    }

    res.json({
      success: true,
      data: orden
    });

  } catch (error) {
    logger.error('Error al obtener orden de trabajo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// POST /api/mantenimiento/ordenes - Crear nueva orden de trabajo
router.post('/', requireAuth, async (req, res) => {
  try {
    const ordenData = req.body;
    logger.info(`Creando nueva orden de trabajo para aeronave: ${ordenData.aeronave}`);

    const nuevaOrden = new OrdenTrabajo(ordenData);
    const ordenGuardada = await nuevaOrden.save();

    logger.info(`Orden de trabajo creada exitosamente: ${ordenGuardada.numeroOrden}`);

    res.status(201).json({
      success: true,
      message: 'Orden de trabajo creada exitosamente',
      data: ordenGuardada
    });

  } catch (error) {
    logger.error('Error al crear orden de trabajo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/mantenimiento/ordenes/:id - Actualizar orden de trabajo
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;
    
    logger.info(`Actualizando orden de trabajo con ID: ${id}`);

    const ordenActualizada = await OrdenTrabajo.findByIdAndUpdate(
      id,
      actualizaciones,
      { new: true, runValidators: true }
    ).populate('aeronave', 'matricula modelo')
      .populate('tecnicoAsignado', 'name email');

    if (!ordenActualizada) {
      return res.status(404).json({
        success: false,
        message: 'Orden de trabajo no encontrada'
      });
    }

    logger.info(`Orden de trabajo actualizada exitosamente: ${ordenActualizada.numeroOrden}`);

    res.json({
      success: true,
      message: 'Orden de trabajo actualizada exitosamente',
      data: ordenActualizada
    });

  } catch (error) {
    logger.error('Error al actualizar orden de trabajo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/mantenimiento/ordenes/:id/estado - Cambiar estado de orden
router.put('/:id/estado', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevoEstado, observaciones } = req.body;
    
    logger.info(`Cambiando estado de orden ${id} a ${nuevoEstado}`);

    const orden = await OrdenTrabajo.findById(id);
    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de trabajo no encontrada'
      });
    }

    const estadoAnterior = orden.estado;
    orden.estado = nuevoEstado;

    // Actualizar fechas según el nuevo estado
    if (nuevoEstado === EstadoOrden.EN_PROCESO && !orden.fechaInicio) {
      orden.fechaInicio = new Date();
    } else if (nuevoEstado === EstadoOrden.COMPLETADA && !orden.fechaFinalizacion) {
      orden.fechaFinalizacion = new Date();
    }

    // Agregar observaciones si se proporcionan
    if (observaciones) {
      orden.observaciones = (orden.observaciones || '') + `\n[${new Date().toISOString()}] Cambio de estado de ${estadoAnterior} a ${nuevoEstado}: ${observaciones}`;
    }

    await orden.save();

    logger.info(`Estado de orden cambiado exitosamente: ${orden.numeroOrden}`);

    res.json({
      success: true,
      message: 'Estado de orden actualizado exitosamente',
      data: orden
    });

  } catch (error) {
    logger.error('Error al cambiar estado de orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// POST /api/mantenimiento/ordenes/:id/trabajo - Agregar registro de trabajo
router.post('/:id/trabajo', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tecnico, horasInvertidas, descripcionTrabajo, observaciones } = req.body;
    
    logger.info(`Agregando registro de trabajo a orden ${id}`);

    const orden = await OrdenTrabajo.findById(id);
    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de trabajo no encontrada'
      });
    }

    orden.registrosTrabajo.push({
      fecha: new Date(),
      tecnico,
      horasInvertidas,
      descripcionTrabajo,
      observaciones
    });

    await orden.save();

    logger.info(`Registro de trabajo agregado exitosamente a orden: ${orden.numeroOrden}`);

    res.json({
      success: true,
      message: 'Registro de trabajo agregado exitosamente',
      data: orden
    });

  } catch (error) {
    logger.error('Error al agregar registro de trabajo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// DELETE /api/mantenimiento/ordenes/:id - Eliminar orden de trabajo
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Eliminando orden de trabajo con ID: ${id}`);

    const ordenEliminada = await OrdenTrabajo.findByIdAndDelete(id);

    if (!ordenEliminada) {
      return res.status(404).json({
        success: false,
        message: 'Orden de trabajo no encontrada'
      });
    }

    logger.info(`Orden de trabajo eliminada exitosamente: ${ordenEliminada.numeroOrden}`);

    res.json({
      success: true,
      message: 'Orden de trabajo eliminada exitosamente',
      data: ordenEliminada
    });

  } catch (error) {
    logger.error('Error al eliminar orden de trabajo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

export default router;