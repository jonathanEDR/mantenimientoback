import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { EstadoMonitoreoComponente, IEstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { CatalogoControlMonitoreo } from '../models/CatalogoControlMonitoreo';
import Componente from '../models/Componente';
import { MonitoreoGranularService } from '../services/MonitoreoGranularService';
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

    // DESHABILITAR CACHE COMPLETAMENTE - HEADERS ANTI-CACHE
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString(),
      'ETag': '' // Deshabilitar ETag
    });
    
    const estados = await EstadoMonitoreoComponente
      .find({ componenteId })
      .populate('catalogoControlId', 'descripcionCodigo horaInicial horaFinal')
      .populate('componenteId', 'numeroSerie nombre categoria')
      .sort({ fechaProximaRevision: 1 });
    
    res.json({
      success: true,
      data: estados,
      timestamp: new Date().toISOString() // Forzar respuesta única
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
    const componente = await Componente.findById(componenteId);
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

    // Crear el nuevo estado
    const nuevoEstado = new EstadoMonitoreoComponente({
      componenteId,
      catalogoControlId,
      valorActual: valorActual || 0,
      valorLimite,
      unidad: unidad || 'HORAS',
      fechaProximaRevision: fechaProximaRevision || new Date(),
      observaciones,
      basadoEnAeronave: basadoEnAeronave ?? true,
      offsetInicial: offsetInicial || 0,
      configuracionPersonalizada,
      configuracionOverhaul
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
      estado.configuracionOverhaul = {
        ...estado.configuracionOverhaul,
        ...configuracionOverhaul
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

    // Obtener horas actuales de la aeronave para el cálculo
    let horasActuales = estado.valorActual;
    if (estado.basadoEnAeronave) {
      const componente = await Componente.findById(estado.componenteId)
        .populate('aeronaveActual', 'horasVuelo')
        .lean();

      if (componente && componente.aeronaveActual && typeof componente.aeronaveActual === 'object') {
        horasActuales = Math.max(0, (componente.aeronaveActual as any).horasVuelo - estado.offsetInicial);
      }
    }

    // Actualizar configuración de overhaul
    const configOverhaul = estado.configuracionOverhaul;
    const cicloAnterior = configOverhaul.cicloActual;
    
    configOverhaul.cicloActual += 1;
    configOverhaul.horasUltimoOverhaul = horasActuales;
    configOverhaul.requiereOverhaul = false;
    configOverhaul.fechaUltimoOverhaul = new Date();
    
    // Calcular el próximo overhaul basándose en el nuevo ciclo
    const siguienteOverhaul = (configOverhaul.cicloActual + 1) * configOverhaul.intervaloOverhaul;
    configOverhaul.proximoOverhaulEn = siguienteOverhaul;

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

export default router;