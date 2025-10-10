import express from 'express';
import Componente, { ComponenteCategoria, EstadoComponente } from '../models/Componente';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { requireAuth } from '../middleware/clerkAuth';
import { requirePermission } from '../middleware/roleAuth';
import logger from '../utils/logger';

const router = express.Router();

// CACHE PARA ESTADÍSTICAS DE COMPONENTES
let componentesStatsCache: any = null;
let componentesStatsCacheTime = 0;
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// GET /api/mantenimiento/componentes - OPTIMIZADO
router.get('/', requireAuth, requirePermission('VIEW_COMPONENTS'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    
    const { categoria, estado, aeronave, alertas, search } = req.query;
    
    logger.info('Obteniendo componentes con paginación', { 
      page, limit, filtros: { categoria, estado, aeronave, alertas, search } 
    });

    // Construir filtros dinámicamente
    const filtros: any = {};
    if (categoria) filtros.categoria = categoria;
    if (estado) filtros.estado = estado;
    if (aeronave) filtros.aeronaveActual = aeronave;
    if (alertas === 'true') filtros.alertasActivas = true;
    if (search) {
      filtros.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { numeroSerie: { $regex: search, $options: 'i' } },
        { fabricante: { $regex: search, $options: 'i' } }
      ];
    }

    // CONSULTA OPTIMIZADA CON AGREGACIÓN Y PAGINACIÓN
    const [componentes, total] = await Promise.all([
      Componente.find(filtros)
        .populate('aeronaveActual', 'matricula modelo')
        .select('nombre numeroSerie categoria estado fabricante fechaInstalacion alertasActivas vidaUtil')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Componente.countDocuments(filtros)
    ]);

    logger.info(`Componentes obtenidos: ${componentes.length}/${total} (página ${page})`);

    res.json({
      success: true,
      data: componentes,
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
    logger.error('Error al obtener componentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/componentes/stats - SUPER OPTIMIZADO
router.get('/stats', requireAuth, requirePermission('VIEW_COMPONENTS'), async (req, res) => {
  try {
    // Verificar cache
    const now = Date.now();
    if (componentesStatsCache && (now - componentesStatsCacheTime) < STATS_CACHE_TTL) {
      logger.info('Estadísticas de componentes obtenidas del cache');
      return res.json({
        success: true,
        data: { ...componentesStatsCache, fromCache: true }
      });
    }

    logger.info('Calculando estadísticas de componentes desde BD');

    // AGREGACIÓN MEGA OPTIMIZADA - UNA SOLA CONSULTA
    const [estadisticas] = await Componente.aggregate([
      {
        $group: {
          _id: null,
          totalComponentes: { $sum: 1 },
          componentesInstalados: { 
            $sum: { $cond: [{ $eq: ['$estado', EstadoComponente.INSTALADO] }, 1, 0] } 
          },
          componentesEnAlmacen: { 
            $sum: { $cond: [{ $eq: ['$estado', EstadoComponente.EN_ALMACEN] }, 1, 0] } 
          },
          componentesEnReparacion: { 
            $sum: { $cond: [{ $eq: ['$estado', EstadoComponente.EN_REPARACION] }, 1, 0] } 
          },
          componentesConAlertas: { 
            $sum: { $cond: ['$alertasActivas', 1, 0] } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalComponentes: 1,
          componentesInstalados: 1,
          componentesEnAlmacen: 1,
          componentesEnReparacion: 1,
          componentesConAlertas: 1,
          porcentajeInstalados: {
            $cond: [
              { $gt: ['$totalComponentes', 0] },
              { $round: [{ $multiply: [{ $divide: ['$componentesInstalados', '$totalComponentes'] }, 100] }, 0] },
              0
            ]
          }
        }
      }
    ]);

    // Calcular distribución por categoría por separado (más eficiente)
    const distribucionPorCategoria = await Componente.aggregate([
      {
        $group: {
          _id: '$categoria',
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { cantidad: -1 } },
      { $limit: 10 } // Limitar a top 10 categorías
    ]);

    const stats = {
      ...(estadisticas || {
        totalComponentes: 0,
        componentesInstalados: 0,
        componentesEnAlmacen: 0,
        componentesEnReparacion: 0,
        componentesConAlertas: 0,
        porcentajeInstalados: 0
      }),
      distribucionPorCategoria
    };

    // Actualizar cache
    componentesStatsCache = stats;
    componentesStatsCacheTime = now;

    logger.info('Estadísticas de componentes calculadas y guardadas en cache');

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de componentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/componentes/alertas - Componentes con alertas
router.get('/alertas', requireAuth, requirePermission('VIEW_COMPONENTS'), async (req, res) => {
  try {
    logger.info('Obteniendo componentes con alertas');

    const componentesConAlertas = await Componente.find({ alertasActivas: true })
      .populate('aeronaveActual', 'matricula modelo')
      .sort({ proximaInspeccion: 1 });

    res.json({
      success: true,
      data: componentesConAlertas,
      total: componentesConAlertas.length
    });

  } catch (error) {
    logger.error('Error al obtener alertas de componentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/componentes/aeronave/:matricula - Componentes de una aeronave por matrícula
router.get('/aeronave/:matricula', requireAuth, requirePermission('VIEW_COMPONENTS'), async (req, res) => {
  try {
    const { matricula } = req.params;
    logger.info(`Obteniendo componentes de la aeronave: ${matricula}`);

    const componentes = await Componente.find({ aeronaveActual: matricula })
      .sort({ categoria: 1, nombre: 1 });

    res.json({
      success: true,
      data: componentes,
      total: componentes.length
    });

  } catch (error) {
    logger.error(`Error al obtener componentes de aeronave ${req.params.matricula}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/componentes/aeronave/id/:aeronaveId - Componentes de una aeronave por ID
router.get('/aeronave/id/:aeronaveId', requireAuth, requirePermission('VIEW_COMPONENTS'), async (req, res) => {
  try {
    const { aeronaveId } = req.params;
    logger.info(`Obteniendo componentes de la aeronave ID: ${aeronaveId}`);

    const componentes = await Componente.find({ aeronaveActual: aeronaveId })
      .populate('aeronaveActual', 'matricula modelo tipo')
      .sort({ categoria: 1, nombre: 1 });

    res.json({
      success: true,
      data: componentes,
      total: componentes.length
    });

  } catch (error) {
    logger.error(`Error al obtener componentes de aeronave ID ${req.params.aeronaveId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// ✅ NUEVO ENDPOINT OPTIMIZADO: GET /api/mantenimiento/componentes/aeronave/id/:aeronaveId/con-estados
// Obtiene componentes de una aeronave CON sus estados de monitoreo en 1 sola query (evita N+1)
router.get('/aeronave/id/:aeronaveId/con-estados', requireAuth, requirePermission('VIEW_COMPONENTS'), async (req, res) => {
  try {
    const { aeronaveId } = req.params;
    logger.info(`🚀 [OPTIMIZADO] Obteniendo componentes con estados de la aeronave ID: ${aeronaveId}`);

    // 1. Obtener componentes de la aeronave
    const componentes = await Componente.find({ aeronaveActual: aeronaveId })
      .populate('aeronaveActual', 'matricula modelo tipo')
      .sort({ categoria: 1, nombre: 1 })
      .lean(); // .lean() para mejor performance (devuelve POJOs en lugar de documentos Mongoose)

    if (componentes.length === 0) {
      return res.json({
        success: true,
        data: [],
        estadosMap: {},
        total: 0
      });
    }

    // 2. Obtener TODOS los estados de monitoreo de estos componentes en 1 sola query
    const componenteIds = componentes.map(c => c._id);
    const estados = await EstadoMonitoreoComponente.find({
      componenteId: { $in: componenteIds }
    })
    .populate('catalogoControlId', 'descripcionCodigo codigoControl categoria')
    .lean();

    // 3. Crear mapa de estados por componenteId
    const estadosMap: Record<string, any[]> = {};
    estados.forEach((estado: any) => {
      const componenteId = estado.componenteId.toString();
      if (!estadosMap[componenteId]) {
        estadosMap[componenteId] = [];
      }
      estadosMap[componenteId].push(estado);
    });

    logger.info(`✅ [OPTIMIZADO] ${componentes.length} componentes con estados cargados en 2 queries (antes: ${componentes.length + 1})`);

    res.json({
      success: true,
      data: componentes,
      estadosMap, // Mapa de componenteId -> estados[]
      total: componentes.length,
      estadosTotal: estados.length
    });

  } catch (error) {
    logger.error(`Error al obtener componentes con estados de aeronave ID ${req.params.aeronaveId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/componentes/:id - Obtener componente por ID
router.get('/:id', requireAuth, requirePermission('VIEW_COMPONENTS'), async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Obteniendo componente con ID: ${id}`);

    const componente = await Componente.findById(id)
      .populate('aeronaveActual', 'matricula modelo fabricante')
      .populate('historialUso.aeronaveId', 'matricula modelo');

    if (!componente) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado'
      });
    }

    res.json({
      success: true,
      data: componente
    });

  } catch (error) {
    logger.error('Error al obtener componente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// POST /api/mantenimiento/componentes - Crear nuevo componente MEJORADO
router.post('/', requireAuth, requirePermission('CREATE_COMPONENTS'), async (req, res) => {
  try {
    const componenteData = req.body;
    const { numeroSerie, numeroParte, nombre, categoria, fabricante } = componenteData;

    logger.info(`Creando nuevo componente: ${numeroSerie || 'N/A'}`);

    // 1. Validar campos requeridos
    if (!numeroSerie || !numeroParte || !nombre || !categoria || !fabricante) {
      const camposFaltantes = [];
      if (!numeroSerie) camposFaltantes.push('numeroSerie');
      if (!numeroParte) camposFaltantes.push('numeroParte');
      if (!nombre) camposFaltantes.push('nombre');
      if (!categoria) camposFaltantes.push('categoria');
      if (!fabricante) camposFaltantes.push('fabricante');

      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos',
        error: {
          type: 'MISSING_FIELDS',
          camposFaltantes,
          solucion: 'Proporcione todos los campos requeridos'
        }
      });
    }

    // 2. Verificar si ya existe un componente con ese número de serie
    const componenteExistente = await Componente.findOne({
      numeroSerie: numeroSerie.toUpperCase().trim()
    });

    if (componenteExistente) {
      logger.warn(`Intento de crear componente con número de serie duplicado: ${numeroSerie.toUpperCase().trim()}`);
      return res.status(409).json({
        success: false,
        message: `El número de serie ${numeroSerie.toUpperCase().trim()} ya existe en el sistema`,
        error: {
          type: 'DUPLICATE_NUMERO_SERIE',
          numeroSerie: numeroSerie.toUpperCase().trim(),
          componenteExistente: {
            id: componenteExistente._id,
            numeroSerie: componenteExistente.numeroSerie,
            nombre: componenteExistente.nombre,
            categoria: componenteExistente.categoria,
            estado: componenteExistente.estado
          },
          solucion: 'Use un número de serie diferente o edite el componente existente'
        }
      });
    }

    // 3. Crear el componente
    const nuevoComponente = new Componente(componenteData);
    const componenteGuardado = await nuevoComponente.save();

    // 4. Invalidar cache
    invalidateStatsCache();

    logger.info(`Componente creado exitosamente: ${componenteGuardado.numeroSerie} (ID: ${componenteGuardado._id})`);

    res.status(201).json({
      success: true,
      message: 'Componente creado exitosamente',
      data: componenteGuardado
    });

  } catch (error: any) {
    logger.error('Error al crear componente:', error);

    // Manejo específico de error de duplicado (E11000)
    if (error.code === 11000) {
      const campo = Object.keys(error.keyPattern || {})[0] || 'desconocido';
      const valor = error.keyValue ? error.keyValue[campo] : 'N/A';

      return res.status(409).json({
        success: false,
        message: `Ya existe un registro con ese ${campo}`,
        error: {
          type: 'DUPLICATE_KEY_ERROR',
          field: campo,
          value: valor,
          solucion: `Verifique que el ${campo} sea único. Si el problema persiste después de eliminar registros, puede haber un problema con los índices de MongoDB.`
        }
      });
    }

    // Error de validación de Mongoose
    if (error.name === 'ValidationError') {
      const errores = Object.values(error.errors).map((err: any) => ({
        campo: err.path,
        mensaje: err.message,
        tipo: err.kind,
        valorProporcionado: err.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Error de validación en los datos proporcionados',
        error: {
          type: 'VALIDATION_ERROR',
          errores
        }
      });
    }

    // Error genérico
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/mantenimiento/componentes/:id - Actualizar componente
router.put('/:id', requireAuth, requirePermission('EDIT_COMPONENTS'), async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;
    
    logger.info(`Actualizando componente con ID: ${id}`);

    const componenteActualizado = await Componente.findByIdAndUpdate(
      id,
      actualizaciones,
      { new: true, runValidators: true }
    ).populate('aeronaveActual', 'matricula modelo');

    if (!componenteActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado'
      });
    }

    logger.info(`Componente actualizado exitosamente: ${componenteActualizado.numeroSerie}`);

    res.json({
      success: true,
      message: 'Componente actualizado exitosamente',
      data: componenteActualizado
    });

  } catch (error) {
    logger.error('Error al actualizar componente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/mantenimiento/componentes/:id/instalar - Instalar componente en aeronave
router.put('/:id/instalar', requireAuth, requirePermission('EDIT_COMPONENTS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { aeronaveMatricula, posicionInstalacion, horasInstalacion } = req.body;
    
    logger.info(`Instalando componente ${id} en aeronave ${aeronaveMatricula}`);

    const componente = await Componente.findById(id);
    if (!componente) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado'
      });
    }

    // Actualizar estado del componente
    componente.estado = EstadoComponente.INSTALADO;
    componente.aeronaveActual = aeronaveMatricula;
    componente.posicionInstalacion = posicionInstalacion;
    componente.fechaInstalacion = new Date();

    // Agregar registro al historial
    componente.historialUso.push({
      fechaInstalacion: new Date(),
      aeronaveId: aeronaveMatricula as any,
      horasIniciales: horasInstalacion || 0,
      observaciones: `Instalado en posición: ${posicionInstalacion}`
    });

    await componente.save();

    logger.info(`Componente instalado exitosamente: ${componente.numeroSerie}`);

    res.json({
      success: true,
      message: 'Componente instalado exitosamente',
      data: componente
    });

  } catch (error) {
    logger.error('Error al instalar componente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/mantenimiento/componentes/:id/remover - Remover componente de aeronave
router.put('/:id/remover', requireAuth, requirePermission('EDIT_COMPONENTS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { motivoRemocion, horasRemocion, observaciones } = req.body;
    
    logger.info(`Removiendo componente ${id}`);

    const componente = await Componente.findById(id);
    if (!componente) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado'
      });
    }

    // Actualizar el último registro del historial
    if (componente.historialUso.length > 0) {
      const ultimoRegistro = componente.historialUso[componente.historialUso.length - 1];
      ultimoRegistro.fechaRemocion = new Date();
      ultimoRegistro.horasFinales = horasRemocion;
      ultimoRegistro.motivoRemocion = motivoRemocion;
      ultimoRegistro.observaciones = observaciones;
    }

    // Actualizar estado del componente
    componente.estado = EstadoComponente.EN_ALMACEN;
    componente.aeronaveActual = undefined;
    componente.posicionInstalacion = undefined;
    componente.fechaInstalacion = undefined;

    await componente.save();

    logger.info(`Componente removido exitosamente: ${componente.numeroSerie}`);

    res.json({
      success: true,
      message: 'Componente removido exitosamente',
      data: componente
    });

  } catch (error) {
    logger.error('Error al remover componente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/mantenimiento/componentes/:id/historial - Actualizar componente desde módulo de historial
router.put('/:id/historial', requireAuth, requirePermission('EDIT_COMPONENTS'), async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;
    
    logger.info(`Actualizando componente desde historial con ID: ${id}`, { actualizaciones });

    // Validar que el componente existe
    const componenteExistente = await Componente.findById(id);
    if (!componenteExistente) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado'
      });
    }

    // Preparar las actualizaciones
    const updateData: any = {
      ...actualizaciones,
      updatedAt: new Date()
    };

    // Si se está actualizando vidaUtil, agregar al historial de uso
    if (actualizaciones.vidaUtil) {
      const nuevoHistorial = {
        fechaInstalacion: new Date(),
        fechaRemocion: null,
        aeronaveId: componenteExistente.aeronaveActual,
        posicion: componenteExistente.posicionInstalacion || 'No especificada',
        horasOperacion: actualizaciones.vidaUtil[0]?.acumulado || 0,
        observaciones: actualizaciones.observaciones || ''
      };

      // Agregar al historial existente
      const historialActualizado = [...(componenteExistente.historialUso || []), nuevoHistorial];
      updateData.historialUso = historialActualizado;
    }

    // Actualizar componente directamente en la base de datos
    const componenteActualizado = await Componente.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true, 
        runValidators: true,
        useFindAndModify: false 
      }
    ).populate('aeronaveActual', 'matricula modelo');

    if (!componenteActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado después de la actualización'
      });
    }

    logger.info(`Componente actualizado desde historial: ${componenteActualizado.numeroSerie}`);

    res.json({
      success: true,
      message: 'Componente actualizado exitosamente desde historial',
      data: componenteActualizado
    });

  } catch (error: any) {
    logger.error('Error al actualizar componente desde historial:', error);
    
    // Manejar errores de validación específicos
    if (error.name === 'ValidationError') {
      const errores = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errores
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

// DELETE /api/mantenimiento/componentes/:id - Eliminar componente MEJORADO
router.delete('/:id', requireAuth, requirePermission('DELETE_COMPONENTS'), async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    logger.info(`Solicitud de eliminación de componente con ID: ${id}${force ? ' (FORZADA)' : ''}`);

    // 1. Verificar si el componente existe
    const componente = await Componente.findById(id);
    if (!componente) {
      logger.warn(`Intento de eliminar componente inexistente: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado',
        error: {
          type: 'NOT_FOUND',
          id
        }
      });
    }

    // 2. Verificar estados de monitoreo asociados
    const estadosCount = await EstadoMonitoreoComponente.countDocuments({ componenteId: id });

    if (estadosCount > 0 && !force) {
      // Obtener lista de estados asociados para informar al usuario
      const estados = await EstadoMonitoreoComponente.find({ componenteId: id })
        .populate('catalogoControlId', 'descripcionCodigo codigoControl categoria')
        .select('estado valorActual valorLimite unidad catalogoControlId')
        .lean();

      logger.warn(`Intento de eliminar componente ${componente.numeroSerie} con ${estadosCount} estado(s) de monitoreo asociado(s)`);

      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el componente. Tiene ${estadosCount} estado(s) de monitoreo asociado(s)`,
        error: {
          type: 'ESTADOS_MONITOREO_ASOCIADOS',
          estadosCount,
          estados: estados.map((estado: any) => ({
            catalogoControl: estado.catalogoControlId?.descripcionCodigo || 'N/A',
            estado: estado.estado,
            valorActual: estado.valorActual,
            valorLimite: estado.valorLimite,
            unidad: estado.unidad
          })),
          componente: {
            numeroSerie: componente.numeroSerie,
            nombre: componente.nombre,
            categoria: componente.categoria,
            estado: componente.estado
          },
          solucion: 'Debe eliminar todos los estados de monitoreo antes de eliminar el componente, o use force=true para eliminar todo automáticamente'
        }
      });
    }

    // 3. Si force=true, eliminar estados de monitoreo asociados
    let estadosEliminados = 0;
    if (estadosCount > 0 && force) {
      const resultadoEstados = await EstadoMonitoreoComponente.deleteMany({ componenteId: id });
      estadosEliminados = resultadoEstados.deletedCount || 0;

      logger.warn(`Eliminación forzada: ${estadosEliminados} estado(s) de monitoreo eliminados del componente ${componente.numeroSerie}`);
    }

    // 4. Eliminar el componente
    await Componente.findByIdAndDelete(id);

    // 5. Invalidar cache
    invalidateStatsCache();

    // 6. Auditoría
    logger.info(`Componente eliminado exitosamente: ${componente.numeroSerie}${estadosEliminados > 0 ? ` (con ${estadosEliminados} estados de monitoreo)` : ''}`);

    res.json({
      success: true,
      message: 'Componente eliminado exitosamente',
      data: {
        componenteEliminado: {
          id: componente._id,
          numeroSerie: componente.numeroSerie,
          nombre: componente.nombre,
          categoria: componente.categoria,
          estado: componente.estado,
          fabricante: componente.fabricante,
          aeronaveActual: componente.aeronaveActual,
          estadosMonitoreoAsociados: estadosCount
        },
        estadosEliminados
      }
    });

  } catch (error: any) {
    logger.error('Error al eliminar componente:', error);

    // Manejo específico de error de CastError (ID inválido)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID de componente inválido',
        error: {
          type: 'INVALID_ID',
          id: req.params.id
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ENDPOINT BATCH PARA ESTADOS DE MONITOREO - NUEVA OPTIMIZACIÓN CRÍTICA
router.get('/estados-monitoreo/aeronave/:aeronaveId', requireAuth, async (req, res) => {
  try {
    const { aeronaveId } = req.params;
    
    logger.info(`Obteniendo estados de monitoreo en batch para aeronave ${aeronaveId}`);

    // MEGA OPTIMIZACIÓN: Una sola consulta para todos los estados
    const estadosMonitoreo = await EstadoMonitoreoComponente.aggregate([
      // 1. Buscar componentes de la aeronave
      {
        $lookup: {
          from: 'componentes',
          localField: 'componenteId',
          foreignField: '_id',
          as: 'componente',
          pipeline: [
            { $match: { aeronaveActual: aeronaveId } },
            { $project: { _id: 1, numeroSerie: 1, nombre: 1 } }
          ]
        }
      },
      // 2. Filtrar solo estados de componentes de esta aeronave
      { $match: { componente: { $ne: [] } } },
      // 3. Poblar información del catálogo de control
      {
        $lookup: {
          from: 'catalogocontrolmonitoreos',
          localField: 'catalogoControlId',
          foreignField: '_id',
          as: 'catalogoControl',
          pipeline: [
            { $project: { descripcionCodigo: 1, horaInicial: 1, horaFinal: 1 } }
          ]
        }
      },
      // 4. Proyectar campos necesarios
      {
        $project: {
          componenteId: 1,
          valorActual: 1,
          valorLimite: 1,
          alertaActiva: 1,
          fechaProximaRevision: 1,
          configuracionOverhaul: 1,
          catalogoControl: { $arrayElemAt: ['$catalogoControl', 0] },
          componente: { $arrayElemAt: ['$componente', 0] }
        }
      },
      // 5. Agrupar por componente
      {
        $group: {
          _id: '$componenteId',
          estados: { $push: '$$ROOT' },
          totalEstados: { $sum: 1 },
          alertasActivas: { 
            $sum: { $cond: ['$alertaActiva', 1, 0] } 
          }
        }
      }
    ]);

    // Convertir a formato esperado por el frontend
    const estadosPorComponente = estadosMonitoreo.reduce((acc: any, item: any) => {
      acc[item._id.toString()] = item.estados;
      return acc;
    }, {});

    logger.info(`Estados de monitoreo batch obtenidos para ${Object.keys(estadosPorComponente).length} componentes`);

    res.json({
      success: true,
      data: estadosPorComponente,
      totalComponentes: Object.keys(estadosPorComponente).length
    });

  } catch (error) {
    logger.error('Error al obtener estados de monitoreo en batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Invalidar cache
const invalidateStatsCache = () => {
  componentesStatsCacheTime = 0;
  componentesStatsCache = null;
};

// Middleware para invalidar cache en operaciones de escritura
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