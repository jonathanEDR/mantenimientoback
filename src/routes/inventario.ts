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

// POST /api/inventario - Crear nueva aeronave con manejo robusto de errores
router.post('/', requireAuth, requirePermission('CREATE_INVENTORY'), async (req, res) => {
  try {
    const { matricula, tipo, modelo, fabricante, anoFabricacion, estado, ubicacionActual, horasVuelo, observaciones } = req.body;

    logger.info(`Creando nueva aeronave con matrícula: ${matricula}`);

    // Validar campos requeridos
    if (!matricula || !tipo || !modelo || !fabricante || !anoFabricacion || !ubicacionActual) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos',
        error: {
          type: 'VALIDATION_ERROR',
          camposFaltantes: [
            !matricula && 'matricula',
            !tipo && 'tipo',
            !modelo && 'modelo',
            !fabricante && 'fabricante',
            !anoFabricacion && 'anoFabricacion',
            !ubicacionActual && 'ubicacionActual'
          ].filter(Boolean)
        }
      });
    }

    // Verificar si ya existe una aeronave con esa matrícula
    const aeronaveExistente = await Aeronave.findOne({ matricula: matricula.toUpperCase() });
    if (aeronaveExistente) {
      logger.warn(`Intento de crear aeronave con matrícula duplicada: ${matricula.toUpperCase()}`);
      return res.status(409).json({
        success: false,
        message: 'Ya existe una aeronave con esa matrícula',
        error: {
          type: 'DUPLICATE_MATRICULA',
          matricula: matricula.toUpperCase(),
          aeronaveExistente: {
            id: aeronaveExistente._id,
            matricula: aeronaveExistente.matricula,
            modelo: aeronaveExistente.modelo,
            tipo: aeronaveExistente.tipo
          }
        }
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

    // Invalidar cache de estadísticas
    invalidateStatsCache();

    // Registrar auditoría de creación
    AuditoriaInventario.logCreacionAeronave({
      id: aeronaveGuardada._id,
      matricula: aeronaveGuardada.matricula,
      tipo: aeronaveGuardada.tipo,
      modelo: aeronaveGuardada.modelo,
      fabricante: aeronaveGuardada.fabricante,
      timestamp: new Date()
    });

    logger.info(`✓ Aeronave creada exitosamente: ${aeronaveGuardada.matricula} (ID: ${aeronaveGuardada._id})`);

    res.status(201).json({
      success: true,
      message: 'Aeronave creada exitosamente',
      data: aeronaveGuardada
    });

  } catch (error: any) {
    logger.error('Error al crear aeronave:', error);

    // Manejo específico de error de índice duplicado (E11000)
    if (error.code === 11000 || error.name === 'MongoServerError') {
      const campo = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'desconocido';
      const valor = error.keyValue ? error.keyValue[campo] : 'desconocido';

      logger.error(`Error de duplicado en campo ${campo}: ${valor}`);

      return res.status(409).json({
        success: false,
        message: `Ya existe un registro con ese ${campo}`,
        error: {
          type: 'DUPLICATE_KEY_ERROR',
          field: campo,
          value: valor,
          solucion: campo === 'matricula'
            ? 'Verifique que la matrícula sea única. Si el problema persiste, ejecute: npm run diagnostico-inventario'
            : 'Verifique que el valor sea único'
        }
      });
    }

    // Manejo de errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const erroresValidacion = Object.values(error.errors).map((e: any) => ({
        campo: e.path,
        mensaje: e.message,
        tipo: e.kind,
        valorProporcionado: e.value
      }));

      logger.error('Errores de validación:', erroresValidacion);

      return res.status(400).json({
        success: false,
        message: 'Error de validación en los datos proporcionados',
        error: {
          type: 'VALIDATION_ERROR',
          errores: erroresValidacion
        }
      });
    }

    // Error genérico
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear aeronave',
      error: process.env.NODE_ENV === 'development' ? {
        type: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      } : {}
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

// DELETE /api/inventario/:id - Eliminar aeronave con validaciones de seguridad
router.delete('/:id', requireAuth, requirePermission('DELETE_INVENTORY'), async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true'; // Parámetro opcional para forzar eliminación

    logger.info(`Solicitud de eliminación de aeronave con ID: ${id}${force ? ' (FORZADA)' : ''}`);

    // 1. Verificar si la aeronave existe
    const aeronave = await Aeronave.findById(id);

    if (!aeronave) {
      logger.warn(`Intento de eliminar aeronave inexistente: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    // 2. Verificar componentes asociados
    const componentesCount = await Componente.countDocuments({ aeronaveActual: id });

    if (componentesCount > 0 && !force) {
      logger.warn(`Intento de eliminar aeronave ${aeronave.matricula} con ${componentesCount} componente(s) asociado(s)`);

      // Obtener lista de componentes para mostrar al usuario
      const componentes = await Componente.find({ aeronaveActual: id })
        .select('numeroSerie nombre categoria estado')
        .limit(10); // Limitar a 10 para no sobrecargar la respuesta

      return res.status(400).json({
        success: false,
        message: `No se puede eliminar la aeronave. Tiene ${componentesCount} componente(s) asociado(s)`,
        error: {
          type: 'COMPONENTES_ASOCIADOS',
          componentesCount,
          componentes: componentes.map(c => ({
            numeroSerie: c.numeroSerie,
            nombre: c.nombre,
            categoria: c.categoria,
            estado: c.estado
          })),
          solucion: 'Debe desinstalar o reasignar todos los componentes antes de eliminar la aeronave, o use force=true para eliminar y limpiar referencias automáticamente'
        }
      });
    }

    // 3. Si force=true y hay componentes, limpiar referencias
    if (componentesCount > 0 && force) {
      logger.info(`Limpiando ${componentesCount} componente(s) asociado(s) a aeronave ${aeronave.matricula}`);

      const resultadoLimpieza = await Componente.updateMany(
        { aeronaveActual: id },
        {
          $set: {
            aeronaveActual: null,
            estado: 'EN_ALMACEN',
            fechaInstalacion: null,
            posicionInstalacion: null
          }
        }
      );

      logger.info(`Referencias limpiadas: ${resultadoLimpieza.modifiedCount} componentes movidos a almacén`);

      // Registrar auditoría de limpieza
      AuditoriaInventario.logEliminacionConLimpieza({
        aeronaveId: id,
        matricula: aeronave.matricula,
        componentesLimpiados: resultadoLimpieza.modifiedCount,
        timestamp: new Date()
      });
    }

    // 4. Verificar órdenes de trabajo pendientes o inspecciones
    // TODO: Implementar cuando tengamos el módulo de órdenes de trabajo
    // const ordenesPendientes = await OrdenTrabajo.countDocuments({ aeronaveId: id, estado: { $in: ['PENDIENTE', 'EN_PROGRESO'] } });

    // 5. Guardar datos de la aeronave para auditoría antes de eliminar
    const aeronaveData = {
      id: aeronave._id,
      matricula: aeronave.matricula,
      tipo: aeronave.tipo,
      modelo: aeronave.modelo,
      fabricante: aeronave.fabricante,
      estado: aeronave.estado,
      horasVuelo: aeronave.horasVuelo,
      componentesAsociados: componentesCount
    };

    // 6. Eliminar la aeronave
    await Aeronave.findByIdAndDelete(id);

    // 7. Invalidar cache de estadísticas
    invalidateStatsCache();

    // 8. Registrar auditoría de eliminación
    AuditoriaInventario.logEliminacionAeronave({
      ...aeronaveData,
      forzada: force,
      timestamp: new Date()
    });

    logger.info(`✓ Aeronave eliminada exitosamente: ${aeronaveData.matricula} (ID: ${id})`);

    res.json({
      success: true,
      message: 'Aeronave eliminada exitosamente',
      data: {
        aeronaveEliminada: aeronaveData,
        componentesLimpiados: force ? componentesCount : 0
      }
    });

  } catch (error: any) {
    logger.error('Error al eliminar aeronave:', error);

    // Manejo específico de errores
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID de aeronave inválido',
        error: {
          type: 'INVALID_ID',
          details: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar aeronave',
      error: process.env.NODE_ENV === 'development' ? {
        type: error.name,
        message: error.message,
        stack: error.stack
      } : {}
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

    // ✅ VALIDACIÓN: Prevenir decremento de horas
    if (horasVuelo < aeronaveExistente.horasVuelo) {
      const decremento = aeronaveExistente.horasVuelo - horasVuelo;
      logger.warn(`Intento de decrementar horas de aeronave ${aeronaveExistente.matricula}: ${aeronaveExistente.horasVuelo}h → ${horasVuelo}h (-${decremento}h)`);

      return res.status(400).json({
        success: false,
        message: 'No se puede reducir las horas de vuelo de una aeronave',
        error: {
          type: 'INVALID_HOURS_DECREMENT',
          horasActuales: aeronaveExistente.horasVuelo,
          horasSolicitadas: horasVuelo,
          decremento: decremento,
          matricula: aeronaveExistente.matricula,
          solucion: 'Las horas de vuelo solo pueden incrementarse. Si necesita corregir un error, contacte al administrador del sistema o verifique los datos ingresados.'
        }
      });
    }

    // ✅ VALIDACIÓN: Alertar sobre incrementos muy grandes (posibles errores de captura)
    const incremento = horasVuelo - aeronaveExistente.horasVuelo;
    const force = req.query.force === 'true';

    if (incremento > 100 && !force) {
      logger.warn(`Incremento de horas sospechoso para aeronave ${aeronaveExistente.matricula}: +${incremento}h (${aeronaveExistente.horasVuelo}h → ${horasVuelo}h)`);

      return res.status(400).json({
        success: false,
        message: `El incremento de ${incremento} horas parece muy alto. ¿Es correcto?`,
        error: {
          type: 'SUSPICIOUS_INCREMENT',
          horasActuales: aeronaveExistente.horasVuelo,
          horasNuevas: horasVuelo,
          incremento: incremento,
          matricula: aeronaveExistente.matricula,
          requiereConfirmacion: true,
          solucion: 'Verifique el valor ingresado. Si el incremento es correcto, agregue el parámetro ?force=true a la URL de la petición para confirmar.'
        }
      });
    }

    // ✅ VALIDACIÓN: Incremento de cero horas (innecesario)
    if (incremento === 0) {
      logger.info(`Intento de actualizar horas de aeronave ${aeronaveExistente.matricula} con el mismo valor: ${horasVuelo}h`);

      return res.status(400).json({
        success: false,
        message: 'Las horas nuevas son iguales a las actuales. No hay cambios que realizar.',
        error: {
          type: 'NO_HOURS_CHANGE',
          horasActuales: aeronaveExistente.horasVuelo,
          horasNuevas: horasVuelo,
          matricula: aeronaveExistente.matricula,
          solucion: 'Ingrese un valor de horas mayor al actual para realizar la actualización.'
        }
      });
    }

    logger.info(`Incremento de horas validado para aeronave ${aeronaveExistente.matricula}: +${incremento}h (${aeronaveExistente.horasVuelo}h → ${horasVuelo}h)${force ? ' [FORZADO]' : ''}`);

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
    const updateData: any = { horasVuelo };
    
    // Agregar observación si se proporciona
    if (observacion !== undefined) {
      updateData.observaciones = observacion;
    }
    
    // Crear entrada para el historial de observaciones
    const nuevaEntradaHistorial = {
      fecha: new Date(),
      texto: `Horas actualizadas de ${aeronaveExistente.horasVuelo}h a ${horasVuelo}h (+${horasVuelo - aeronaveExistente.horasVuelo}h)${observacion ? ` - ${observacion}` : ''}`,
      usuario: (req as any).user?.userId || 'Sistema',
      tipo: 'horas_actualizadas' as const
    };
    
    // Crear entrada específica para el historial de horas de vuelo
    const nuevaEntradaHoras = {
      fecha: new Date(),
      horasAnteriores: aeronaveExistente.horasVuelo,
      horasNuevas: horasVuelo,
      incremento: horasVuelo - aeronaveExistente.horasVuelo,
      usuario: (req as any).user?.userId || 'Sistema',
      observacion: observacion || undefined,
      motivo: 'vuelo_operacional' as const
    };
    
    updateData.$push = {
      historialObservaciones: nuevaEntradaHistorial,
      historialHorasVuelo: nuevaEntradaHoras
    };

    const aeronaveActualizada = await Aeronave.findByIdAndUpdate(
      id,
      updateData,
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

    // Crear entrada para el historial del cambio de estado
    const nuevaEntradaHistorial = {
      fecha: new Date(),
      texto: `Estado cambiado de "${estadoAnterior}" a "${estado}"`,
      usuario: (req as any).user?.userId || 'Sistema',
      tipo: 'cambio_estado' as const
    };

    const aeronaveActualizada = await Aeronave.findByIdAndUpdate(
      id,
      { 
        estado,
        $push: {
          historialObservaciones: nuevaEntradaHistorial
        }
      },
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

    // Crear entrada para el historial si hay observaciones nuevas
    const updateData: any = { observaciones: observaciones || '' };
    
    if (observaciones && observaciones.trim() !== '') {
      const nuevaEntradaHistorial = {
        fecha: new Date(),
        texto: observaciones.trim(),
        usuario: (req as any).user?.userId || 'Sistema',
        tipo: 'observacion' as const
      };
      
      // Agregar al historial
      updateData.$push = {
        historialObservaciones: nuevaEntradaHistorial
      };
    }

    const aeronaveActualizada = await Aeronave.findByIdAndUpdate(
      id,
      updateData,
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

// Obtener historial de horas de vuelo de una aeronave
router.get('/:aeronaveId/historial-horas-vuelo', requireAuth, requirePermission('VIEW_INVENTORY'), async (req, res) => {
  try {
    const { aeronaveId } = req.params;
    const { limite = 50, motivo } = req.query;

    // Verificar que la aeronave existe
    const aeronave = await Aeronave.findById(aeronaveId)
      .select('matricula modelo tipo horasVuelo historialHorasVuelo')
      .lean();

    if (!aeronave) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    let historial = aeronave.historialHorasVuelo || [];

    // Filtrar por motivo si se especifica
    if (motivo && typeof motivo === 'string') {
      historial = historial.filter((entrada: any) => entrada.motivo === motivo);
    }

    // Ordenar por fecha descendente (más recientes primero)
    historial.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Limitar resultados
    const limiteParsed = parseInt(limite as string, 10);
    if (!isNaN(limiteParsed) && limiteParsed > 0) {
      historial = historial.slice(0, limiteParsed);
    }

    // Calcular estadísticas del historial
    const totalIncrementos = historial.reduce((sum: number, entrada: any) => sum + Math.max(0, entrada.incremento), 0);
    const promedioIncremento = historial.length > 0 ? totalIncrementos / historial.filter((e: any) => e.incremento > 0).length : 0;

    res.json({
      success: true,
      data: {
        aeronave: {
          _id: aeronave._id,
          matricula: aeronave.matricula,
          modelo: aeronave.modelo,
          tipo: aeronave.tipo,
          horasActuales: aeronave.horasVuelo
        },
        historial: historial,
        estadisticas: {
          totalRegistros: historial.length,
          totalHorasAcumuladas: totalIncrementos,
          promedioIncrementoPorVuelo: Math.round(promedioIncremento * 100) / 100,
          ultimoIncremento: historial.length > 0 ? historial[0].incremento : 0
        }
      },
      message: 'Historial de horas de vuelo obtenido exitosamente'
    });

  } catch (error) {
    logger.error('Error al obtener historial de horas de vuelo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Obtener historial de observaciones de una aeronave
router.get('/:aeronaveId/historial-observaciones', requireAuth, requirePermission('VIEW_INVENTORY'), async (req, res) => {
  try {
    const { aeronaveId } = req.params;
    const { limite = 50, tipo } = req.query;

    // Verificar que la aeronave existe
    const aeronave = await Aeronave.findById(aeronaveId)
      .select('matricula modelo tipo historialObservaciones')
      .lean();

    if (!aeronave) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    let historial = aeronave.historialObservaciones || [];

    // Filtrar por tipo si se especifica
    if (tipo && typeof tipo === 'string') {
      historial = historial.filter((obs: any) => obs.tipo === tipo);
    }

    // Ordenar por fecha descendente (más recientes primero)
    historial.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Limitar resultados
    const limiteParsed = parseInt(limite as string, 10);
    if (!isNaN(limiteParsed) && limiteParsed > 0) {
      historial = historial.slice(0, limiteParsed);
    }

    res.json({
      success: true,
      data: {
        aeronave: {
          _id: aeronave._id,
          matricula: aeronave.matricula,
          modelo: aeronave.modelo,
          tipo: aeronave.tipo
        },
        historial: historial,
        total: historial.length
      },
      message: 'Historial de observaciones obtenido exitosamente'
    });

  } catch (error) {
    logger.error('Error al obtener historial de observaciones de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

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