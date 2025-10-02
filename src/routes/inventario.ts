import express from 'express';
import Aeronave from '../models/Aeronave';
import Componente from '../models/Componente';
import { requireAuth } from '../middleware/clerkAuth';
import { requirePermission } from '../middleware/roleAuth';
import logger from '../utils/logger';
import { propagarHorasAComponentes, validarEstadoAeronave, obtenerProximosMantenimientos } from '../utils/inventarioUtils';
import AuditoriaInventario from '../utils/auditoriaInventario';

const router = express.Router();

// CACHE INTERMEDIO PARA ESTADÍSTICAS (5 minutos)
let inventarioStatsCache: any = null;
let inventarioStatsCacheTime = 0;
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// GET /api/inventario - OPTIMIZADO con paginación
router.get('/', requireAuth, requirePermission('VIEW_INVENTORY'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50); // Máximo 50
    const skip = (page - 1) * limit;
    
    const search = req.query.search as string;
    const tipo = req.query.tipo as string;
    const estado = req.query.estado as string;

    // Construir filtros
    const filtros: any = {};
    if (search) {
      filtros.$or = [
        { matricula: { $regex: search, $options: 'i' } },
        { modelo: { $regex: search, $options: 'i' } },
        { fabricante: { $regex: search, $options: 'i' } }
      ];
    }
    if (tipo) filtros.tipo = tipo;
    if (estado) filtros.estado = estado;

    // CONSULTA OPTIMIZADA CON AGREGACIÓN
    const [aeronaves, total] = await Promise.all([
      Aeronave.find(filtros)
        .select('matricula tipo modelo fabricante estado ubicacionActual horasVuelo createdAt') // Solo campos necesarios
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Mejora rendimiento
      Aeronave.countDocuments(filtros)
    ]);

    logger.info(`Aeronaves obtenidas: ${aeronaves.length}/${total} (página ${page})`);

    res.json({
      success: true,
      data: aeronaves,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    logger.error('Error al obtener aeronaves:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/inventario/stats - OPTIMIZADO con cache y agregación
router.get('/stats', requireAuth, requirePermission('VIEW_INVENTORY'), async (req, res) => {
  try {
    // Verificar cache
    const now = Date.now();
    if (inventarioStatsCache && (now - inventarioStatsCacheTime) < STATS_CACHE_TTL) {
      logger.info('Estadísticas de inventario obtenidas del cache');
      return res.json({
        success: true,
        data: { ...inventarioStatsCache, fromCache: true }
      });
    }

    logger.info('Calculando estadísticas de inventario desde BD');

    // AGREGACIÓN OPTIMIZADA - UNA SOLA CONSULTA
    const [estadisticas] = await Aeronave.aggregate([
      {
        $group: {
          _id: null,
          totalAeronaves: { $sum: 1 },
          helicopteros: { 
            $sum: { $cond: [{ $eq: ['$tipo', 'Helicóptero'] }, 1, 0] } 
          },
          aviones: { 
            $sum: { $cond: [{ $eq: ['$tipo', 'Avión'] }, 1, 0] } 
          },
          operativas: { 
            $sum: { $cond: [{ $eq: ['$estado', 'Operativo'] }, 1, 0] } 
          },
          enMantenimiento: { 
            $sum: { $cond: [{ $eq: ['$estado', 'En Mantenimiento'] }, 1, 0] } 
          },
          fueraServicio: { 
            $sum: { $cond: [{ $eq: ['$estado', 'Fuera de Servicio'] }, 1, 0] } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalAeronaves: 1,
          helicopteros: 1,
          aviones: 1,
          operativas: 1,
          enMantenimiento: 1,
          fueraServicio: 1,
          porcentajeOperativas: {
            $cond: [
              { $gt: ['$totalAeronaves', 0] },
              { $round: [{ $multiply: [{ $divide: ['$operativas', '$totalAeronaves'] }, 100] }, 0] },
              0
            ]
          }
        }
      }
    ]);

    const stats = estadisticas || {
      totalAeronaves: 0,
      helicopteros: 0,
      aviones: 0,
      operativas: 0,
      enMantenimiento: 0,
      fueraServicio: 0,
      porcentajeOperativas: 0
    };

    // Actualizar cache
    inventarioStatsCache = stats;
    inventarioStatsCacheTime = now;

    logger.info('Estadísticas de inventario calculadas y guardadas en cache');

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/inventario/:id - Obtener una aeronave por ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Obteniendo aeronave con ID: ${id}`);

    const aeronave = await Aeronave.findById(id);

    if (!aeronave) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    logger.info(`Aeronave encontrada: ${aeronave.matricula}`);

    res.json({
      success: true,
      data: aeronave
    });

  } catch (error) {
    logger.error('Error al obtener aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// POST /api/inventario - Crear nueva aeronave
router.post('/', requireAuth, async (req, res) => {
  try {
    const { matricula, tipo, modelo, fabricante, anoFabricacion, estado, ubicacionActual, horasVuelo, observaciones } = req.body;
    
    logger.info(`Creando nueva aeronave con matrícula: ${matricula}`);

    // Validar campos requeridos
    if (!matricula || !tipo || !modelo || !fabricante || !anoFabricacion || !ubicacionActual) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }

    // Verificar si ya existe una aeronave con esa matrícula
    const aeronaveExistente = await Aeronave.findOne({ matricula: matricula.toUpperCase() });
    if (aeronaveExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una aeronave con esa matrícula'
      });
    }

    const nuevaAeronave = new Aeronave({
      matricula: matricula.toUpperCase(),
      tipo,
      modelo,
      fabricante,
      anoFabricacion,
      estado: estado || 'Operativo',
      ubicacionActual,
      horasVuelo: horasVuelo || 0,
      observaciones
    });

    const aeronaveGuardada = await nuevaAeronave.save();

    logger.info(`Aeronave creada exitosamente: ${aeronaveGuardada.matricula}`);

    res.status(201).json({
      success: true,
      message: 'Aeronave creada exitosamente',
      data: aeronaveGuardada
    });

  } catch (error) {
    logger.error('Error al crear aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/inventario/:id - Actualizar aeronave
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { matricula, tipo, modelo, fabricante, anoFabricacion, estado, ubicacionActual, horasVuelo, observaciones } = req.body;
    
    logger.info(`Actualizando aeronave con ID: ${id}`);

    // Verificar si la aeronave existe
    const aeronaveExistente = await Aeronave.findById(id);
    if (!aeronaveExistente) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    // Si se está cambiando la matrícula, verificar que no exista otra con la misma
    if (matricula && matricula.toUpperCase() !== aeronaveExistente.matricula) {
      const matriculaExistente = await Aeronave.findOne({ 
        matricula: matricula.toUpperCase(),
        _id: { $ne: id }
      });
      if (matriculaExistente) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otra aeronave con esa matrícula'
        });
      }
    }

    const aeronaveActualizada = await Aeronave.findByIdAndUpdate(
      id,
      {
        matricula: matricula?.toUpperCase() || aeronaveExistente.matricula,
        tipo: tipo || aeronaveExistente.tipo,
        modelo: modelo || aeronaveExistente.modelo,
        fabricante: fabricante || aeronaveExistente.fabricante,
        anoFabricacion: anoFabricacion || aeronaveExistente.anoFabricacion,
        estado: estado || aeronaveExistente.estado,
        ubicacionActual: ubicacionActual || aeronaveExistente.ubicacionActual,
        horasVuelo: horasVuelo !== undefined ? horasVuelo : aeronaveExistente.horasVuelo,
        observaciones: observaciones !== undefined ? observaciones : aeronaveExistente.observaciones
      },
      { new: true, runValidators: true }
    );

    logger.info(`Aeronave actualizada exitosamente: ${aeronaveActualizada?.matricula}`);

    res.json({
      success: true,
      message: 'Aeronave actualizada exitosamente',
      data: aeronaveActualizada
    });

  } catch (error) {
    logger.error('Error al actualizar aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// DELETE /api/inventario/:id - Eliminar aeronave
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Eliminando aeronave con ID: ${id}`);

    const aeronaveEliminada = await Aeronave.findByIdAndDelete(id);

    if (!aeronaveEliminada) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    logger.info(`Aeronave eliminada exitosamente: ${aeronaveEliminada.matricula}`);

    res.json({
      success: true,
      message: 'Aeronave eliminada exitosamente',
      data: aeronaveEliminada
    });

  } catch (error) {
    logger.error('Error al eliminar aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/inventario/:id/horas-con-propagacion - Actualizar horas con propagación a componentes
router.put('/:id/horas-con-propagacion', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { horasVuelo, observacion } = req.body;
    
    logger.info(`Actualizando horas con propagación para aeronave ID: ${id}, nuevas horas: ${horasVuelo}`);

    // Validar que horasVuelo sea un número válido
    if (typeof horasVuelo !== 'number' || horasVuelo < 0) {
      return res.status(400).json({
        success: false,
        message: 'Las horas de vuelo deben ser un número válido mayor o igual a 0'
      });
    }

    // Verificar si la aeronave existe
    const aeronaveExistente = await Aeronave.findById(id);
    if (!aeronaveExistente) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    // Ejecutar propagación de horas usando la función robusta
    const resultadoPropagacion = await propagarHorasAComponentes(id, horasVuelo);

    if (!resultadoPropagacion.success && resultadoPropagacion.errores.length > 0) {
      // Si hay errores críticos en la propagación, no actualizar la aeronave
      return res.status(400).json({
        success: false,
        message: 'Error en la propagación de horas',
        errors: resultadoPropagacion.errores,
        detalles: resultadoPropagacion.detalles
      });
    }

    // Actualizar la aeronave solo si la propagación fue exitosa
    const aeronaveActualizada = await Aeronave.findByIdAndUpdate(
      id,
      {
        horasVuelo,
        ...(observacion !== undefined && { observaciones: observacion })
      },
      { new: true, runValidators: true }
    );

    // Obtener próximos mantenimientos después de la actualización
    const proximosMantenimientos = await obtenerProximosMantenimientos(id);

    // Logging de auditoría
    AuditoriaInventario.logActualizacionHoras({
      aeronaveId: id,
      matricula: aeronaveActualizada?.matricula || 'DESCONOCIDA',
      horasAnteriores: resultadoPropagacion.detalles.horasAnteriores,
      horasNuevas: horasVuelo,
      incremento: resultadoPropagacion.detalles.incrementoHoras,
      componentesAfectados: resultadoPropagacion.componentesActualizados,
      timestamp: new Date(),
      detallesComponentes: resultadoPropagacion.detalles.componentesProcessados
    });

    // Log de alertas de mantenimiento si existen
    if (proximosMantenimientos && proximosMantenimientos.length > 0) {
      AuditoriaInventario.logAlertasMantenimiento(id, aeronaveActualizada?.matricula || 'DESCONOCIDA', proximosMantenimientos);
    }

    logger.info(`Horas actualizadas exitosamente para aeronave ${aeronaveActualizada?.matricula}: ${resultadoPropagacion.componentesActualizados} componentes actualizados`);

    res.json({
      success: true,
      message: 'Horas actualizadas exitosamente con propagación a componentes',
      data: {
        aeronave: aeronaveActualizada,
        propagacion: {
          horasAnteriores: resultadoPropagacion.detalles.horasAnteriores,
          horasNuevas: horasVuelo,
          incrementoHoras: resultadoPropagacion.detalles.incrementoHoras,
          componentesActualizados: resultadoPropagacion.componentesActualizados,
          componentesProcessados: resultadoPropagacion.detalles.componentesProcessados
        },
        proximosMantenimientos,
        warnings: resultadoPropagacion.errores.length > 0 ? resultadoPropagacion.errores : undefined
      }
    });

  } catch (error) {
    AuditoriaInventario.logErrorCritico(
      'ERROR_ACTUALIZACION_HORAS',
      req.params.id,
      'DESCONOCIDA',
      error,
      { horasVueloSolicitadas: req.body.horasVuelo, observacion: req.body.observacion }
    );
    
    logger.error('Error al actualizar horas con propagación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/inventario/:id/estado - Actualizar solo el estado de la aeronave
router.put('/:id/estado', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    logger.info(`Actualizando estado de aeronave ID: ${id} a: ${estado}`);

    // Validar que se proporcione el estado
    if (!estado) {
      return res.status(400).json({
        success: false,
        message: 'El estado es requerido'
      });
    }

    // Validar que el estado sea válido
    if (!validarEstadoAeronave(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido. Valores permitidos: Operativo, En Mantenimiento, Fuera de Servicio, En Reparación'
      });
    }

    // Verificar si la aeronave existe
    const aeronaveExistente = await Aeronave.findById(id);
    if (!aeronaveExistente) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    const estadoAnterior = aeronaveExistente.estado;

    const aeronaveActualizada = await Aeronave.findByIdAndUpdate(
      id,
      { estado },
      { new: true, runValidators: true }
    );

    // Logging de auditoría
    AuditoriaInventario.logCambioEstado({
      aeronaveId: id,
      matricula: aeronaveActualizada?.matricula || 'DESCONOCIDA',
      estadoAnterior,
      estadoNuevo: estado,
      timestamp: new Date()
    });

    logger.info(`Estado de aeronave ${aeronaveActualizada?.matricula} actualizado de '${estadoAnterior}' a '${estado}'`);

    res.json({
      success: true,
      message: 'Estado de aeronave actualizado exitosamente',
      data: {
        aeronave: aeronaveActualizada,
        cambio: {
          estadoAnterior,
          estadoNuevo: estado
        }
      }
    });

  } catch (error) {
    logger.error('Error al actualizar estado de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/inventario/:id/observaciones - Actualizar solo las observaciones de la aeronave
router.put('/:id/observaciones', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    
    logger.info(`Actualizando observaciones de aeronave ID: ${id}`);

    // Verificar si la aeronave existe
    const aeronaveExistente = await Aeronave.findById(id);
    if (!aeronaveExistente) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    const observacionesAnteriores = aeronaveExistente.observaciones;

    const aeronaveActualizada = await Aeronave.findByIdAndUpdate(
      id,
      { observaciones: observaciones || '' },
      { new: true, runValidators: true }
    );

    // Logging de auditoría
    AuditoriaInventario.logActualizacionObservaciones({
      aeronaveId: id,
      matricula: aeronaveActualizada?.matricula || 'DESCONOCIDA',
      observacionesAnteriores,
      observacionesNuevas: observaciones || '',
      timestamp: new Date()
    });

    logger.info(`Observaciones de aeronave ${aeronaveActualizada?.matricula} actualizadas`);

    res.json({
      success: true,
      message: 'Observaciones de aeronave actualizadas exitosamente',
      data: aeronaveActualizada
    });

  } catch (error) {
    logger.error('Error al actualizar observaciones de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/inventario/:id/componentes - Obtener componentes de una aeronave específica
router.get('/:id/componentes', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Obteniendo componentes de aeronave ID: ${id}`);

    // Verificar si la aeronave existe
    const aeronaveExistente = await Aeronave.findById(id);
    if (!aeronaveExistente) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    // Obtener todos los componentes instalados en la aeronave
    const componentes = await Componente.find({
      aeronaveActual: id
    }).sort({ categoria: 1, nombre: 1 });

    logger.info(`Se encontraron ${componentes.length} componentes para aeronave ${aeronaveExistente.matricula}`);

    res.json({
      success: true,
      data: {
        aeronave: {
          id: aeronaveExistente._id,
          matricula: aeronaveExistente.matricula,
          horasVuelo: aeronaveExistente.horasVuelo
        },
        componentes
      }
    });

  } catch (error) {
    logger.error('Error al obtener componentes de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Invalidar cache cuando se modifique una aeronave
const invalidateStatsCache = () => {
  inventarioStatsCacheTime = 0;
  inventarioStatsCache = null;
};

// Hook para invalidar cache en operaciones de escritura
router.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (req.method !== 'GET' && res.statusCode < 400) {
      invalidateStatsCache();
    }
    return originalSend.call(this, data);
  };
  next();
});

export default router;