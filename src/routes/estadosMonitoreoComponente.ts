import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { EstadoMonitoreoComponente, IEstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { CatalogoControlMonitoreo } from '../models/CatalogoControlMonitoreo';
import Componente from '../models/Componente';
import { MonitoreoGranularService } from '../services/MonitoreoGranularService';
import { requireAuth } from '../middleware/clerkAuth';
import logger from '../utils/logger';

const router = Router();

// Obtener todos los estados de monitoreo de un componente
router.get('/componente/:componenteId', async (req: Request, res: Response) => {
  try {
    const { componenteId } = req.params;

    if (!Types.ObjectId.isValid(componenteId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de componente inválido'
      });
    }

    // CACHÉ INTELIGENTE - 30 segundos para reducir carga en BD
    // Esto permite navegación fluida sin sacrificar frescura de datos
    res.set({
      'Cache-Control': 'public, max-age=30',
      'Vary': 'Accept-Encoding'
    });
    
    // OPTIMIZACIÓN: Usar .lean() para retornar objetos planos
    // Esto elimina overhead de Mongoose y mejora rendimiento ~40%
    const estados = await EstadoMonitoreoComponente
      .find({ componenteId })
      .populate('catalogoControlId', 'descripcionCodigo horaInicial horaFinal')
      .populate('componenteId', 'numeroSerie nombre categoria')
      .sort({ fechaProximaRevision: 1 })
      .lean() // ✅ Retorna objetos JS planos, no documentos Mongoose
      .exec();
    
    res.json({
      success: true,
      data: estados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error al obtener estados de monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Obtener estados de monitoreo para múltiples componentes (batch)
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { componenteIds } = req.body;

    // Validar que componenteIds sea un array
    if (!Array.isArray(componenteIds)) {
      return res.status(400).json({
        success: false,
        message: 'componenteIds debe ser un array'
      });
    }

    // Validar que todos los IDs sean válidos
    const idsValidos = componenteIds.every(id => Types.ObjectId.isValid(id));
    if (!idsValidos) {
      return res.status(400).json({
        success: false,
        message: 'Uno o más IDs de componente son inválidos'
      });
    }

    // CACHÉ INTELIGENTE - 30 segundos para reducir carga en BD
    res.set({
      'Cache-Control': 'public, max-age=30',
      'Vary': 'Accept-Encoding'
    });
    
    // OPTIMIZACIÓN: Usar .lean() y consulta $in para cargar múltiples estados en una sola query
    // Esto elimina el problema N+1 que causaba lentitud en PDF exports
    const estados = await EstadoMonitoreoComponente
      .find({ componenteId: { $in: componenteIds } })
      .populate('catalogoControlId', 'descripcionCodigo horaInicial horaFinal')
      .populate('componenteId', 'numeroSerie nombre categoria')
      .sort({ componenteId: 1, fechaProximaRevision: 1 })
      .lean() // ✅ Retorna objetos JS planos, no documentos Mongoose
      .exec();
    
    // Agrupar estados por componenteId para fácil acceso en frontend
    const estadosPorComponente: Record<string, any[]> = {};
    estados.forEach((estado: any) => {
      const compId = estado.componenteId?._id?.toString() || estado.componenteId?.toString();
      if (!estadosPorComponente[compId]) {
        estadosPorComponente[compId] = [];
      }
      estadosPorComponente[compId].push(estado);
    });
    
    res.json({
      success: true,
      data: estadosPorComponente,
      timestamp: new Date().toISOString(),
      stats: {
        componentesConsultados: componenteIds.length,
        estadosEncontrados: estados.length
      }
    });

  } catch (error) {
    logger.error('Error al obtener estados de monitoreo en batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Crear nuevo estado de monitoreo para un componente
router.post('/componente/:componenteId', async (req: Request, res: Response) => {
  try {
    const { componenteId } = req.params;
    const {
      catalogoControlId,
      valorActual,
      valorLimite,
      unidad,
      fechaProximaRevision,
      observaciones,
      configuracionPersonalizada,
      configuracionOverhaul,
      basadoEnAeronave,
      offsetInicial
    } = req.body;

    if (!Types.ObjectId.isValid(componenteId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de componente inválido'
      });
    }

    if (!Types.ObjectId.isValid(catalogoControlId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de catálogo de control inválido'
      });
    }

    // Verificar que el componente existe
    const componente = await Componente.findById(componenteId).populate('aeronaveActual', 'horasVuelo matricula');
    if (!componente) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado'
      });
    }

    // Verificar que el catálogo de control existe
    const catalogoControl = await CatalogoControlMonitoreo.findById(catalogoControlId);
    if (!catalogoControl) {
      return res.status(404).json({
        success: false,
        message: 'Catálogo de control no encontrado'
      });
    }

    // Verificar que no existe ya un estado para este componente y control
    const estadoExistente = await EstadoMonitoreoComponente.findOne({
      componenteId,
      catalogoControlId
    });

    if (estadoExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un estado de monitoreo para este componente y control'
      });
    }

    // ========== CÁLCULO AUTOMÁTICO DE offsetInicial Y valorActual ==========
    
    // Determinar si está basado en aeronave (por defecto: true)
    const usaHorasAeronave = basadoEnAeronave ?? true;
    
    // Calcular offsetInicial automáticamente si no se proporciona
    let offsetCalculado = offsetInicial || 0;
    let valorActualCalculado = valorActual || 0;
    
    if (usaHorasAeronave && componente.aeronaveActual) {
      // Obtener horas actuales de la aeronave
      const aeronave = componente.aeronaveActual as any; // Ya está poblado
      const horasAeronave = aeronave?.horasVuelo || 0;
      
      // Obtener horas acumuladas del componente
      const vidaUtilHoras = componente.vidaUtil.find((vida: any) => vida.unidad === 'HORAS');
      const horasComponente = vidaUtilHoras?.acumulado || 0;
      
      // ⚠️ CRÍTICO: Para componentes nuevos (horasComponente = 0)
      // offsetInicial debe ser las horas actuales de la aeronave
      if (horasComponente === 0) {
        offsetCalculado = horasAeronave;
        valorActualCalculado = 0; // El componente inicia en 0 horas
        
        logger.info(`[ESTADO MONITOREO] 🆕 Componente NUEVO - offsetInicial configurado automáticamente:`, {
          componenteId: componente._id,
          numeroSerie: componente.numeroSerie,
          aeronave: aeronave.matricula,
          horasAeronave,
          horasComponente,
          offsetCalculado,
          valorActualCalculado
        });
      } else {
        // Para componentes existentes con horas acumuladas
        // Si no se proporcionó offset, calcularlo desde la diferencia
        if (offsetInicial === undefined) {
          offsetCalculado = Number(horasAeronave) - Number(horasComponente);
        }
        valorActualCalculado = Number(horasComponente);
        
        logger.info(`[ESTADO MONITOREO] ♻️ Componente EXISTENTE - offset calculado:`, {
          componenteId: componente._id,
          numeroSerie: componente.numeroSerie,
          aeronave: aeronave.matricula,
          horasAeronave,
          horasComponente,
          offsetCalculado,
          valorActualCalculado
        });
      }
    } else {
      // No está basado en aeronave o no tiene aeronave asignada
      // Usar el valorActual proporcionado o 0
      valorActualCalculado = valorActual || 0;
      offsetCalculado = 0;
      
      logger.info(`[ESTADO MONITOREO] 📊 Componente SIN sincronización con aeronave:`, {
        componenteId: componente._id,
        numeroSerie: componente.numeroSerie,
        valorActualCalculado,
        basadoEnAeronave: usaHorasAeronave
      });
    }

    // ========== CONFIGURACIÓN AUTOMÁTICA DE UMBRALES PARA OVERHAUL ==========
    let configuracionOverhaulFinal = configuracionOverhaul;
    
    if (configuracionOverhaul?.habilitarOverhaul && configuracionOverhaul.intervaloOverhaul) {
      const { calcularUmbralesParaOverhaul, validarYCorregirUmbralesOverhaul } = require('../utils/overhaulUmbrales');
      
      // Si tiene semáforo personalizado configurado, validarlo y corregirlo si es necesario
      if (configuracionOverhaul.semaforoPersonalizado) {
        configuracionOverhaulFinal.semaforoPersonalizado = validarYCorregirUmbralesOverhaul(
          configuracionOverhaul.semaforoPersonalizado,
          configuracionOverhaul.intervaloOverhaul,
          valorLimite
        );
        
        logger.info(`[CREAR ESTADO] ✅ Umbrales validados y corregidos para overhaul`, {
          intervaloOverhaul: configuracionOverhaul.intervaloOverhaul,
          umbrales: configuracionOverhaulFinal.semaforoPersonalizado?.umbrales
        });
      } else {
        // Si no tiene semáforo configurado, crear uno automáticamente
        configuracionOverhaulFinal.semaforoPersonalizado = calcularUmbralesParaOverhaul(
          configuracionOverhaul.intervaloOverhaul,
          'ESTANDAR'
        );
        
        logger.info(`[CREAR ESTADO] 🆕 Umbrales calculados automáticamente para overhaul`, {
          intervaloOverhaul: configuracionOverhaul.intervaloOverhaul,
          umbrales: configuracionOverhaulFinal.semaforoPersonalizado.umbrales
        });
      }
    }

    // Crear el nuevo estado con valores calculados
    const nuevoEstado = new EstadoMonitoreoComponente({
      componenteId,
      catalogoControlId,
      valorActual: valorActualCalculado,
      valorLimite,
      unidad: unidad || 'HORAS',
      fechaProximaRevision: fechaProximaRevision || new Date(),
      observaciones,
      basadoEnAeronave: usaHorasAeronave,
      offsetInicial: offsetCalculado,
      configuracionPersonalizada,
      configuracionOverhaul: configuracionOverhaulFinal
    });

    await nuevoEstado.save();

    // Popular los datos para la respuesta
    await nuevoEstado.populate([
      { path: 'catalogoControlId', select: 'descripcionCodigo horaInicial horaFinal' },
      { path: 'componenteId', select: 'numeroSerie nombre categoria' }
    ]);

    // Deshabilitar cache para que el frontend reciba datos actualizados
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.status(201).json({
      success: true,
      data: nuevoEstado,
      message: 'Estado de monitoreo creado exitosamente'
    });

  } catch (error) {
    logger.error('Error al crear estado de monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Actualizar estado de monitoreo
router.put('/:estadoId', async (req: Request, res: Response) => {
  try {
    const { estadoId } = req.params;
    const {
      valorActual,
      valorLimite,
      unidad,
      fechaProximaRevision,
      observaciones,
      configuracionPersonalizada,
      configuracionOverhaul
    } = req.body;

    if (!Types.ObjectId.isValid(estadoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado inválido'
      });
    }

    const estado = await EstadoMonitoreoComponente.findById(estadoId);
    if (!estado) {
      return res.status(404).json({
        success: false,
        message: 'Estado de monitoreo no encontrado'
      });
    }

    // Actualizar campos
    if (valorActual !== undefined) estado.valorActual = valorActual;
    if (valorLimite !== undefined) estado.valorLimite = valorLimite;
    if (unidad !== undefined) estado.unidad = unidad;
    if (fechaProximaRevision !== undefined) estado.fechaProximaRevision = fechaProximaRevision;
    if (observaciones !== undefined) estado.observaciones = observaciones;
    if (configuracionPersonalizada !== undefined) {
      estado.configuracionPersonalizada = {
        ...estado.configuracionPersonalizada,
        ...configuracionPersonalizada
      };
    }
    if (configuracionOverhaul !== undefined) {
      // ========== VALIDAR Y CORREGIR UMBRALES SI ES NECESARIO ==========
      let configuracionOverhaulFinal = configuracionOverhaul;
      
      if (configuracionOverhaul.habilitarOverhaul && configuracionOverhaul.intervaloOverhaul) {
        const { calcularUmbralesParaOverhaul, validarYCorregirUmbralesOverhaul } = require('../utils/overhaulUmbrales');
        
        // Si tiene semáforo personalizado configurado, validarlo y corregirlo
        if (configuracionOverhaul.semaforoPersonalizado) {
          configuracionOverhaulFinal.semaforoPersonalizado = validarYCorregirUmbralesOverhaul(
            configuracionOverhaul.semaforoPersonalizado,
            configuracionOverhaul.intervaloOverhaul,
            valorLimite || estado.valorLimite
          );
          
          logger.info(`[ACTUALIZAR ESTADO] ✅ Umbrales validados y corregidos`, {
            estadoId,
            intervaloOverhaul: configuracionOverhaul.intervaloOverhaul,
            umbrales: configuracionOverhaulFinal.semaforoPersonalizado?.umbrales
          });
        } else {
          // Si no tiene semáforo configurado, crear uno automáticamente
          configuracionOverhaulFinal.semaforoPersonalizado = calcularUmbralesParaOverhaul(
            configuracionOverhaul.intervaloOverhaul,
            'ESTANDAR'
          );
          
          logger.info(`[ACTUALIZAR ESTADO] 🆕 Umbrales calculados automáticamente`, {
            estadoId,
            intervaloOverhaul: configuracionOverhaul.intervaloOverhaul,
            umbrales: configuracionOverhaulFinal.semaforoPersonalizado.umbrales
          });
        }
      }
      
      estado.configuracionOverhaul = {
        ...estado.configuracionOverhaul,
        ...configuracionOverhaulFinal
      };
    }

    await estado.save();

    // Popular los datos para la respuesta
    await estado.populate([
      { path: 'catalogoControlId', select: 'descripcionCodigo horaInicial horaFinal' },
      { path: 'componenteId', select: 'numeroSerie nombre categoria' }
    ]);

    res.json({
      success: true,
      data: estado,
      message: 'Estado de monitoreo actualizado exitosamente'
    });

  } catch (error) {
    logger.error('Error al actualizar estado de monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Eliminar estado de monitoreo
router.delete('/:estadoId', async (req: Request, res: Response) => {
  try {
    const { estadoId } = req.params;

    if (!Types.ObjectId.isValid(estadoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado inválido'
      });
    }

    const estado = await EstadoMonitoreoComponente.findByIdAndDelete(estadoId);
    if (!estado) {
      return res.status(404).json({
        success: false,
        message: 'Estado de monitoreo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Estado de monitoreo eliminado exitosamente'
    });

  } catch (error) {
    logger.error('Error al eliminar estado de monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Obtener resumen de estados por aeronave
router.get('/aeronave/:aeronaveId/resumen', async (req: Request, res: Response) => {
  try {
    const { aeronaveId } = req.params;

    if (!Types.ObjectId.isValid(aeronaveId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de aeronave inválido'
      });
    }

    // Obtener componentes de la aeronave
    const componentes = await Componente.find({ aeronaveActual: aeronaveId });
    const componenteIds = componentes.map(c => c._id);

    if (componenteIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalEstados: 0,
          estadosOK: 0,
          estadosProximos: 0,
          estadosVencidos: 0,
          estadosPorComponente: []
        }
      });
    }

    // Obtener todos los estados de monitoreo de los componentes
    const estados = await EstadoMonitoreoComponente
      .find({ componenteId: { $in: componenteIds } })
      .populate('catalogoControlId', 'descripcionCodigo')
      .populate('componenteId', 'numeroSerie nombre categoria');

    // Calcular estadísticas
    const totalEstados = estados.length;
    const estadosOK = estados.filter(e => e.estado === 'OK').length;
    const estadosProximos = estados.filter(e => e.estado === 'PROXIMO').length;
    const estadosVencidos = estados.filter(e => e.estado === 'VENCIDO').length;

    // Agrupar por componente
    const estadosPorComponente = componentes.map(componente => {
      const estadosComponente = estados.filter(e => 
        e.componenteId._id.toString() === componente._id.toString()
      );

      return {
        componente: {
          id: componente._id,
          numeroSerie: componente.numeroSerie,
          nombre: componente.nombre,
          categoria: componente.categoria
        },
        estados: estadosComponente,
        resumen: {
          total: estadosComponente.length,
          ok: estadosComponente.filter(e => e.estado === 'OK').length,
          proximos: estadosComponente.filter(e => e.estado === 'PROXIMO').length,
          vencidos: estadosComponente.filter(e => e.estado === 'VENCIDO').length
        }
      };
    });

    res.json({
      success: true,
      data: {
        totalEstados,
        estadosOK,
        estadosProximos,
        estadosVencidos,
        estadosPorComponente
      }
    });

  } catch (error) {
    logger.error('Error al obtener resumen de estados por aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// =============================
// ENDPOINTS DE MONITOREO GRANULAR
// =============================

// Obtener estado de monitoreo granular de una aeronave específica
router.get('/granular/aeronave/:aeronaveId', async (req: Request, res: Response) => {
  try {
    const { aeronaveId } = req.params;

    if (!Types.ObjectId.isValid(aeronaveId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de aeronave inválido'
      });
    }

    const estadoGranular = await MonitoreoGranularService.calcularEstadoAeronave(aeronaveId);

    res.json({
      success: true,
      data: estadoGranular
    });

  } catch (error) {
    logger.error('Error al calcular estado granular de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Obtener resumen granular de toda la flota
router.get('/granular/flota', async (req: Request, res: Response) => {
  try {
    const resumenFlota = await MonitoreoGranularService.calcularResumenFlotaGranular();

    res.json({
      success: true,
      data: resumenFlota
    });

  } catch (error) {
    logger.error('Error al calcular resumen granular de flota:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Obtener alertas críticas de una aeronave
router.get('/granular/aeronave/:aeronaveId/criticas', async (req: Request, res: Response) => {
  try {
    const { aeronaveId } = req.params;

    if (!Types.ObjectId.isValid(aeronaveId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de aeronave inválido'
      });
    }

    const alertasCriticas = await MonitoreoGranularService.obtenerAlertasCriticasAeronave(aeronaveId);

    res.json({
      success: true,
      data: alertasCriticas
    });

  } catch (error) {
    logger.error('Error al obtener alertas críticas de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Completar overhaul de un estado de monitoreo
router.post('/:estadoId/completar-overhaul', async (req: Request, res: Response) => {
  try {
    const { estadoId } = req.params;
    const { observaciones } = req.body;

    if (!Types.ObjectId.isValid(estadoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado inválido'
      });
    }

    const estado = await EstadoMonitoreoComponente.findById(estadoId)
      .populate('componenteId', 'numeroSerie nombre categoria aeronaveActual');

    if (!estado) {
      return res.status(404).json({
        success: false,
        message: 'Estado de monitoreo no encontrado'
      });
    }

    // Verificar que el estado tenga overhaul habilitado y requerido
    if (!estado.configuracionOverhaul?.habilitarOverhaul) {
      return res.status(400).json({
        success: false,
        message: 'Este estado no tiene overhauls habilitados'
      });
    }

    if (!estado.configuracionOverhaul?.requiereOverhaul) {
      return res.status(400).json({
        success: false,
        message: 'Este estado no requiere overhaul actualmente'
      });
    }

    // Obtener horas actuales DEL COMPONENTE para el cálculo
    // ❌ PROBLEMA ANTERIOR: Usaba horas de la aeronave completa
    // ✅ SOLUCIÓN: Usar el valorActual del estado del componente
    const horasActualesComponente = estado.valorActual;
    
    logger.info(`[OVERHAUL] 📊 Completando overhaul para componente:`, {
      componenteId: estado.componenteId,
      valorActualComponente: horasActualesComponente,
      cicloAnterior: estado.configuracionOverhaul.cicloActual,
      intervaloOverhaul: estado.configuracionOverhaul.intervaloOverhaul
    });

    // Actualizar configuración de overhaul
    const configOverhaul = estado.configuracionOverhaul;
    const cicloAnterior = configOverhaul.cicloActual;
    
    configOverhaul.cicloActual += 1;
    // ✅ CORRECCIÓN CRÍTICA: Usar horas del componente, no de la aeronave
    configOverhaul.horasUltimoOverhaul = horasActualesComponente;
    configOverhaul.requiereOverhaul = false;
    configOverhaul.fechaUltimoOverhaul = new Date();
    
    // Calcular el próximo overhaul basándose en el nuevo ciclo
    const siguienteOverhaul = (configOverhaul.cicloActual + 1) * configOverhaul.intervaloOverhaul;
    configOverhaul.proximoOverhaulEn = siguienteOverhaul;

    logger.info(`[OVERHAUL] ✅ Overhaul completado:`, {
      cicloNuevo: configOverhaul.cicloActual,
      horasUltimoOverhaul: configOverhaul.horasUltimoOverhaul,
      proximoOverhaulEn: configOverhaul.proximoOverhaulEn,
      TSO_reiniciado: horasActualesComponente - configOverhaul.horasUltimoOverhaul
    });

    if (observaciones) {
      configOverhaul.observacionesOverhaul = observaciones;
    }

    // Actualizar estado - Marcar explícitamente que se modificó la configuración overhaul
    estado.markModified('configuracionOverhaul');
    estado.estado = 'OK';
    estado.alertaActiva = false;
    estado.observaciones = observaciones ? 
      `${estado.observaciones ? estado.observaciones + ' | ' : ''}Overhaul completado: ${observaciones}` : 
      estado.observaciones;

    await estado.save();

    // Popular los datos para la respuesta
    await estado.populate([
      { path: 'catalogoControlId', select: 'descripcionCodigo horaInicial horaFinal' },
      { path: 'componenteId', select: 'numeroSerie nombre categoria' }
    ]);

    res.json({
      success: true,
      data: estado,
      message: `Overhaul completado exitosamente. Ciclo ${configOverhaul.cicloActual} de ${configOverhaul.ciclosOverhaul}`
    });

  } catch (error) {
    logger.error('Error al completar overhaul:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// =============================
// NUEVOS ENDPOINTS PARA ALERTAS INTEGRADAS DE OVERHAULS
// =============================

// Importar el nuevo servicio de alertas integradas
import AlertasOverhaulService from '../services/AlertasOverhaulService';

// Obtener alertas de overhauls para una aeronave específica
router.get('/alertas-overhaul/aeronave/:aeronaveId', async (req: Request, res: Response) => {
  try {
    const { aeronaveId } = req.params;

    if (!Types.ObjectId.isValid(aeronaveId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de aeronave inválido'
      });
    }

    const alertasOverhaul = await AlertasOverhaulService.obtenerAlertasOverhaulAeronave(aeronaveId);

    res.json({
      success: true,
      data: {
        aeronaveId,
        totalAlertas: alertasOverhaul.length,
        alertasCriticas: alertasOverhaul.filter(a => a.criticidad === 'CRITICA').length,
        alertasAltas: alertasOverhaul.filter(a => a.criticidad === 'ALTA').length,
        alertasOverhaul,
        ultimaActualizacion: new Date()
      },
      message: `Se encontraron ${alertasOverhaul.length} alertas de overhaul`
    });

  } catch (error) {
    logger.error('Error al obtener alertas de overhaul para aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Obtener todas las alertas de overhauls de la flota
router.get('/alertas-overhaul/flota', async (req: Request, res: Response) => {
  try {
    const alertasOverhaul = await AlertasOverhaulService.obtenerAlertasOverhaulFlota();

    // Agrupar estadísticas
    const estadisticas = {
      totalAlertas: alertasOverhaul.length,
      alertasCriticas: alertasOverhaul.filter(a => a.criticidad === 'CRITICA').length,
      alertasAltas: alertasOverhaul.filter(a => a.criticidad === 'ALTA').length,
      alertasMedias: alertasOverhaul.filter(a => a.criticidad === 'MEDIA').length,
      alertasBajas: alertasOverhaul.filter(a => a.criticidad === 'BAJA').length,
      requierenOverhaul: alertasOverhaul.filter(a => a.requiereOverhaul).length,
      proximosOverhauls: alertasOverhaul.filter(a => a.estado === 'PROXIMO').length
    };

    res.json({
      success: true,
      data: {
        estadisticas,
        alertasOverhaul,
        ultimaActualizacion: new Date()
      },
      message: `Se encontraron ${alertasOverhaul.length} alertas de overhaul en la flota`
    });

  } catch (error) {
    logger.error('Error al obtener alertas de overhaul de la flota:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Calcular alerta específica para un estado de monitoreo
router.get('/:estadoId/alerta-overhaul', async (req: Request, res: Response) => {
  try {
    const { estadoId } = req.params;

    if (!Types.ObjectId.isValid(estadoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado inválido'
      });
    }

    const estado = await EstadoMonitoreoComponente.findById(estadoId)
      .populate('componenteId', 'numeroSerie nombre categoria')
      .populate('catalogoControlId', 'descripcionCodigo');

    if (!estado) {
      return res.status(404).json({
        success: false,
        message: 'Estado de monitoreo no encontrado'
      });
    }

    if (!estado.configuracionOverhaul?.habilitarOverhaul) {
      return res.status(400).json({
        success: false,
        message: 'Este estado no tiene overhauls habilitados'
      });
    }

    const alertaOverhaul = AlertasOverhaulService.calcularAlertaOverhaul(estado);

    res.json({
      success: true,
      data: {
        estado: {
          id: estado._id,
          componente: estado.componenteId,
          control: estado.catalogoControlId
        },
        alertaOverhaul
      },
      message: 'Alerta de overhaul calculada exitosamente'
    });

  } catch (error) {
    logger.error('Error al calcular alerta de overhaul:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// GET /:estadoId/historial-observaciones - Obtener historial de observaciones de un estado específico
router.get('/:estadoId/historial-observaciones', requireAuth, async (req: Request, res: Response) => {
  try {
    const { estadoId } = req.params;
    const { limite = 50, tipo } = req.query;

    if (!Types.ObjectId.isValid(estadoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado inválido'
      });
    }

    // Obtener el estado de monitoreo
    const estado = await EstadoMonitoreoComponente.findById(estadoId)
      .populate('componenteId', 'numeroSerie nombre categoria')
      .populate('catalogoControlId', 'descripcionCodigo')
      .lean();

    if (!estado) {
      return res.status(404).json({
        success: false,
        message: 'Estado de monitoreo no encontrado'
      });
    }

    // El historial de observaciones puede venir de:
    // 1. Las observaciones del estado mismo
    // 2. El historial de observaciones del componente (si existe)
    let historial: any[] = [];

    // Agregar observación actual del estado si existe
    if (estado.observaciones) {
      historial.push({
        _id: `${estado._id}_actual`,
        tipo: 'MONITOREO',
        observacion: estado.observaciones,
        fecha: estado.fechaUltimaActualizacion,
        usuario: 'Sistema', // Por ahora, después se puede mejorar con tracking de usuarios
        estado: estado.estado,
        valorActual: estado.valorActual,
        valorLimite: estado.valorLimite
      });
    }

    // Agregar observaciones de overhaul si existen
    if (estado.configuracionOverhaul?.observacionesOverhaul) {
      historial.push({
        _id: `${estado._id}_overhaul`,
        tipo: 'OVERHAUL',
        observacion: estado.configuracionOverhaul.observacionesOverhaul,
        fecha: estado.configuracionOverhaul.fechaUltimoOverhaul || estado.fechaUltimaActualizacion,
        usuario: 'Técnico', // Por ahora, después se puede mejorar
        ciclo: estado.configuracionOverhaul.cicloActual,
        horasUltimoOverhaul: estado.configuracionOverhaul.horasUltimoOverhaul
      });
    }

    // Filtrar por tipo si se especifica
    if (tipo && typeof tipo === 'string') {
      historial = historial.filter(obs => obs.tipo === tipo);
    }

    // Ordenar por fecha descendente (más recientes primero)
    historial.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Limitar resultados
    const limiteParsed = parseInt(limite as string, 10);
    if (!isNaN(limiteParsed) && limiteParsed > 0) {
      historial = historial.slice(0, limiteParsed);
    }

    res.json({
      success: true,
      data: {
        estado: {
          _id: estado._id,
          componenteInfo: estado.componenteId,
          catalogoInfo: estado.catalogoControlId,
          valorActual: estado.valorActual,
          valorLimite: estado.valorLimite,
          unidad: estado.unidad,
          estado: estado.estado
        },
        historial,
        totalRegistros: historial.length
      }
    });

  } catch (error) {
    logger.error('Error al obtener historial de observaciones del estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export default router;