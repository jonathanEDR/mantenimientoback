import express from 'express';
import Componente, { EstadoComponente } from '../models/Componente';
import OrdenTrabajo, { EstadoOrden, PrioridadOrden } from '../models/OrdenTrabajo';
import Inspeccion, { EstadoInspeccion, TipoInspeccion } from '../models/Inspeccion';
import Aeronave from '../models/Aeronave';
import { requireAuth } from '../middleware/clerkAuth';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/mantenimiento/dashboard - Redirección a resumen
router.get('/', requireAuth, async (req, res) => {
  // Redirigir a la ruta de resumen
  return res.redirect('/api/mantenimiento/dashboard/resumen');
});

// GET /api/mantenimiento/dashboard/resumen - Resumen general del dashboard
router.get('/resumen', requireAuth, async (req, res) => {
  try {
    logger.info('Obteniendo resumen del dashboard de mantenimiento');

    const [
      // Estadísticas de aeronaves
      totalAeronaves,
      aeronavesOperativas,
      aeronavesMantenimiento,
      
      // Estadísticas de componentes
      totalComponentes,
      componentesConAlertas,
      componentesVencidos,
      
      // Estadísticas de órdenes
      totalOrdenes,
      ordenesPendientes,
      ordenesEnProceso,
      ordenesCriticas,
      
      // Estadísticas de inspecciones
      inspeccionesPendientes,
      inspeccionesVencidas,
      
      // Próximos vencimientos
      proximosVencimientos
    ] = await Promise.all([
      // Aeronaves
      Aeronave.countDocuments(),
      Aeronave.countDocuments({ estado: 'Operativo' }),
      Aeronave.countDocuments({ estado: 'En Mantenimiento' }),
      
      // Componentes
      Componente.countDocuments(),
      Componente.countDocuments({ alertasActivas: true }),
      Componente.countDocuments({ 
        proximaInspeccion: { $lt: new Date() }
      }),
      
      // Órdenes
      OrdenTrabajo.countDocuments(),
      OrdenTrabajo.countDocuments({ estado: EstadoOrden.PENDIENTE }),
      OrdenTrabajo.countDocuments({ estado: EstadoOrden.EN_PROCESO }),
      OrdenTrabajo.countDocuments({ 
        prioridad: PrioridadOrden.CRITICA, 
        estado: { $nin: [EstadoOrden.COMPLETADA, EstadoOrden.CANCELADA] }
      }),
      
      // Inspecciones
      Inspeccion.countDocuments({ estado: EstadoInspeccion.PROGRAMADA }),
      Inspeccion.countDocuments({ 
        fechaProgramada: { $lt: new Date() },
        estado: { $ne: EstadoInspeccion.COMPLETADA }
      }),
      
      // Próximos vencimientos (próximos 30 días)
      Componente.find({
        proximaInspeccion: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }).populate('aeronaveActual', 'matricula').limit(10).sort({ proximaInspeccion: 1 })
    ]);

    const resumen = {
      aeronaves: {
        total: totalAeronaves,
        operativas: aeronavesOperativas,
        enMantenimiento: aeronavesMantenimiento,
        porcentajeOperativas: totalAeronaves > 0 ? Math.round((aeronavesOperativas / totalAeronaves) * 100) : 0
      },
      componentes: {
        total: totalComponentes,
        conAlertas: componentesConAlertas,
        vencidos: componentesVencidos,
        porcentajeAlertas: totalComponentes > 0 ? Math.round((componentesConAlertas / totalComponentes) * 100) : 0
      },
      ordenes: {
        total: totalOrdenes,
        pendientes: ordenesPendientes,
        enProceso: ordenesEnProceso,
        criticas: ordenesCriticas
      },
      inspecciones: {
        pendientes: inspeccionesPendientes,
        vencidas: inspeccionesVencidas
      },
      proximosVencimientos: proximosVencimientos
    };

    logger.info('Resumen del dashboard obtenido exitosamente');

    res.json({
      success: true,
      data: resumen
    });

  } catch (error) {
    logger.error('Error al obtener resumen del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/dashboard/alertas - Alertas críticas del sistema
router.get('/alertas', requireAuth, async (req, res) => {
  try {
    logger.info('Obteniendo alertas críticas del sistema');

    const [
      componentesVencidos,
      ordenesVencidas,
      inspeccionesVencidas,
      aeronavesProblemas
    ] = await Promise.all([
      // Componentes con vencimientos pasados
      Componente.find({
        proximaInspeccion: { $lt: new Date() }
      }).populate('aeronaveActual', 'matricula').limit(5),
      
      // Órdenes vencidas
      OrdenTrabajo.find({
        fechaVencimiento: { $lt: new Date() },
        estado: { $nin: [EstadoOrden.COMPLETADA, EstadoOrden.CANCELADA] }
      }).populate('aeronave', 'matricula').limit(5),
      
      // Inspecciones vencidas
      Inspeccion.find({
        fechaProgramada: { $lt: new Date() },
        estado: { $ne: EstadoInspeccion.COMPLETADA }
      }).populate('aeronave', 'matricula').limit(5),
      
      // Aeronaves con problemas (múltiples órdenes críticas)
      OrdenTrabajo.aggregate([
        {
          $match: {
            prioridad: PrioridadOrden.CRITICA,
            estado: { $nin: [EstadoOrden.COMPLETADA, EstadoOrden.CANCELADA] }
          }
        },
        {
          $group: {
            _id: '$aeronave',
            ordenesAbiertas: { $sum: 1 }
          }
        },
        {
          $match: {
            ordenesAbiertas: { $gte: 2 }
          }
        },
        {
          $lookup: {
            from: 'aeronaves',
            localField: '_id',
            foreignField: 'matricula',
            as: 'aeronaveInfo'
          }
        }
      ])
    ]);

    const alertas = {
      componentesVencidos: componentesVencidos.map(comp => ({
        tipo: 'componente_vencido',
        severidad: 'critica',
        mensaje: `Componente ${comp.numeroSerie} vencido desde ${comp.proximaInspeccion}`,
        componente: comp.numeroSerie,
        aeronave: comp.aeronaveActual,
        fechaVencimiento: comp.proximaInspeccion
      })),
      
      ordenesVencidas: ordenesVencidas.map(orden => ({
        tipo: 'orden_vencida',
        severidad: 'alta',
        mensaje: `Orden ${orden.numeroOrden} vencida`,
        numeroOrden: orden.numeroOrden,
        aeronave: orden.aeronave,
        fechaVencimiento: orden.fechaVencimiento
      })),
      
      inspeccionesVencidas: inspeccionesVencidas.map(insp => ({
        tipo: 'inspeccion_vencida',
        severidad: 'alta',
        mensaje: `Inspección ${insp.tipo} vencida`,
        numeroInspeccion: insp.numeroInspeccion,
        aeronave: insp.aeronave,
        fechaVencimiento: insp.fechaProgramada
      })),
      
      aeronavesProblemas: aeronavesProblemas.map((item: any) => ({
        tipo: 'aeronave_problemas',
        severidad: 'media',
        mensaje: `Aeronave con ${item.ordenesAbiertas} órdenes críticas abiertas`,
        aeronave: item._id,
        ordenesAbiertas: item.ordenesAbiertas
      }))
    };

    // Combinar todas las alertas y ordenar por severidad
    const todasLasAlertas = [
      ...alertas.componentesVencidos,
      ...alertas.ordenesVencidas,
      ...alertas.inspeccionesVencidas,
      ...alertas.aeronavesProblemas
    ].sort((a, b) => {
      const severidadOrden = { critica: 3, alta: 2, media: 1 };
      return severidadOrden[b.severidad as keyof typeof severidadOrden] - severidadOrden[a.severidad as keyof typeof severidadOrden];
    });

    res.json({
      success: true,
      data: {
        alertas: todasLasAlertas,
        resumen: {
          total: todasLasAlertas.length,
          criticas: alertas.componentesVencidos.length,
          altas: alertas.ordenesVencidas.length + alertas.inspeccionesVencidas.length,
          medias: alertas.aeronavesProblemas.length
        }
      }
    });

  } catch (error) {
    logger.error('Error al obtener alertas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/dashboard/tendencias - Tendencias y métricas
router.get('/tendencias', requireAuth, async (req, res) => {
  try {
    const { periodo = 30 } = req.query; // Días hacia atrás
    const fechaInicio = new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000);
    
    logger.info(`Obteniendo tendencias de los últimos ${periodo} días`);

    const [
      ordenesCompletadasPorDia,
      tiposMantenimientoFrecuencia,
      componentesMasFallados,
      eficienciaTecnicos
    ] = await Promise.all([
      // Órdenes completadas por día
      OrdenTrabajo.aggregate([
        {
          $match: {
            fechaFinalizacion: { $gte: fechaInicio },
            estado: EstadoOrden.COMPLETADA
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$fechaFinalizacion' }
            },
            cantidad: { $sum: 1 },
            horasPromedio: { $avg: '$tiempoTotal' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Frecuencia de tipos de mantenimiento
      OrdenTrabajo.aggregate([
        {
          $match: {
            fechaCreacion: { $gte: fechaInicio }
          }
        },
        {
          $group: {
            _id: '$tipo',
            cantidad: { $sum: 1 }
          }
        },
        { $sort: { cantidad: -1 } }
      ]),
      
      // Componentes que más fallan
      Componente.aggregate([
        {
          $match: {
            'historialUso.fechaRemocion': { $gte: fechaInicio },
            'historialUso.motivoRemocion': { $regex: /falla|defecto|problema/i }
          }
        },
        {
          $group: {
            _id: '$categoria',
            fallas: { $sum: 1 }
          }
        },
        { $sort: { fallas: -1 } },
        { $limit: 10 }
      ]),
      
      // Eficiencia de técnicos (órdenes completadas)
      OrdenTrabajo.aggregate([
        {
          $match: {
            fechaFinalizacion: { $gte: fechaInicio },
            estado: EstadoOrden.COMPLETADA,
            tecnicoAsignado: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$tecnicoAsignado',
            ordenesCompletadas: { $sum: 1 },
            horasPromedio: { $avg: '$tiempoTotal' }
          }
        },
        { $sort: { ordenesCompletadas: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'tecnicoInfo'
          }
        }
      ])
    ]);

    const tendencias = {
      ordenesCompletadasPorDia,
      tiposMantenimientoFrecuencia,
      componentesMasFallados,
      eficienciaTecnicos: eficienciaTecnicos.map((item: any) => ({
        tecnico: item.tecnicoInfo[0]?.name || 'Desconocido',
        ordenesCompletadas: item.ordenesCompletadas,
        horasPromedio: Math.round(item.horasPromedio * 100) / 100
      }))
    };

    res.json({
      success: true,
      data: tendencias
    });

  } catch (error) {
    logger.error('Error al obtener tendencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/dashboard/aeronave/:matricula - Estado específico de una aeronave
router.get('/aeronave/:matricula', requireAuth, async (req, res) => {
  try {
    const { matricula } = req.params;
    logger.info(`Obteniendo estado de mantenimiento de aeronave: ${matricula}`);

    const [
      aeronave,
      componentesAeronave,
      ordenesAbiertas,
      ultimasInspecciones,
      proximoMantenimiento
    ] = await Promise.all([
      Aeronave.findOne({ matricula }),
      
      Componente.find({ aeronaveActual: matricula }),
      
      OrdenTrabajo.find({
        aeronave: matricula,
        estado: { $nin: [EstadoOrden.COMPLETADA, EstadoOrden.CANCELADA] }
      }).populate('tecnicoAsignado', 'name'),
      
      Inspeccion.find({ aeronave: matricula })
        .sort({ fechaFinalizacion: -1 })
        .limit(5)
        .populate('inspectorPrincipal', 'name'),
      
      Componente.find({
        aeronaveActual: matricula,
        proximaInspeccion: { $exists: true }
      }).sort({ proximaInspeccion: 1 }).limit(5)
    ]);

    if (!aeronave) {
      return res.status(404).json({
        success: false,
        message: 'Aeronave no encontrada'
      });
    }

    const estadoAeronave = {
      aeronave,
      resumen: {
        totalComponentes: componentesAeronave.length,
        componentesConAlertas: componentesAeronave.filter(comp => comp.alertasActivas).length,
        ordenesAbiertas: ordenesAbiertas.length,
        ordenesCriticas: ordenesAbiertas.filter(orden => orden.prioridad === PrioridadOrden.CRITICA).length
      },
      componentes: componentesAeronave,
      ordenesAbiertas,
      ultimasInspecciones,
      proximoMantenimiento
    };

    res.json({
      success: true,
      data: estadoAeronave
    });

  } catch (error) {
    logger.error('Error al obtener estado de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

export default router;