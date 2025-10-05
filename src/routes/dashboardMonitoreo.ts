import express from 'express';
import { requireAuth } from '../middleware/clerkAuth';
import Aeronave from '../models/Aeronave';
import Componente from '../models/Componente';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';

const router = express.Router();

// CACHE PARA DASHBOARD COMPLETO
let dashboardCache: any = null;
let dashboardCacheTime = 0;
const DASHBOARD_CACHE_TTL = 2 * 60 * 1000; // 2 minutos (más frecuente por criticidad)

// Invalidar cache inmediatamente para forzar recálculo
dashboardCache = null;
dashboardCacheTime = 0;

// Endpoint SUPER OPTIMIZADO para monitoreo completo
router.get('/monitoreo-completo', requireAuth, async (req, res) => {
  try {
    // Verificar cache primero
    const now = Date.now();
    if (dashboardCache && (now - dashboardCacheTime) < DASHBOARD_CACHE_TTL) {
      return res.json({
        success: true,
        data: { ...dashboardCache, fromCache: true, cacheAge: now - dashboardCacheTime }
      });
    }

        // PAGINACIÓN PARA DASHBOARD - Solo primeras 20 aeronaves por defecto
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    // 1. MEGA AGREGACIÓN OPTIMIZADA - TODO EN UNA CONSULTA
    const aeronavesProcesadas = await Aeronave.aggregate([
      // Filtrar aeronaves operativas
      { 
        $match: { 
          estado: { $in: ['Operativo', 'En Mantenimiento'] } 
        } 
      },
      // Paginación a nivel de BD
      { $skip: skip },
      { $limit: limit },
      // Lookup componentes instalados
      {
        $lookup: {
          from: 'componentes',
          let: { aeronaveId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { $eq: ['$aeronaveActual', '$$aeronaveId'] },
                estado: 'INSTALADO'
              } 
            },
            {
              $project: {
                numeroSerie: 1,
                nombre: 1,
                categoria: 1,
                vidaUtil: 1
              }
            }
          ],
          as: 'componentes'
        }
      },
      // Lookup estados de monitoreo en batch
      {
        $lookup: {
          from: 'estadosMonitoreoComponente',
          let: { componenteIds: '$componentes._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$componenteId', '$$componenteIds'] }
              }
            },
            {
              $lookup: {
                from: 'catalogoControlMonitoreo',
                localField: 'catalogoControlId',
                foreignField: '_id',
                as: 'control',
                pipeline: [
                  { $project: { descripcionCodigo: 1 } }
                ]
              }
            },
            {
              $project: {
                componenteId: 1,
                valorActual: 1,
                valorLimite: 1,
                alertaActiva: 1,
                configuracionOverhaul: 1,
                control: { $arrayElemAt: ['$control', 0] }
              }
            }
          ],
          as: 'estadosMonitoreo'
        }
      },
      // Procesar datos en la agregación misma
      {
        $addFields: {
          componentesProcesados: {
            $map: {
              input: '$componentes',
              as: 'comp',
              in: {
                _id: '$$comp._id',
                numeroSerie: '$$comp.numeroSerie',
                nombre: '$$comp.nombre',
                categoria: '$$comp.categoria',
                horasAcumuladas: {
                  $let: {
                    vars: {
                      vidaUtilHoras: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$$comp.vidaUtil',
                              cond: { $eq: ['$$this.unidad', 'HORAS'] }
                            }
                          },
                          0
                        ]
                      }
                    },
                    in: { $ifNull: ['$$vidaUtilHoras.acumulado', 0] }
                  }
                },
                estadosMonitoreo: {
                  $filter: {
                    input: '$estadosMonitoreo',
                    cond: { $eq: ['$$this.componenteId', '$$comp._id'] }
                  }
                },
                alertasActivas: {
                  $size: {
                    $filter: {
                      input: '$estadosMonitoreo',
                      cond: { 
                        $and: [
                          { $eq: ['$$this.componenteId', '$$comp._id'] },
                          { $eq: ['$$this.alertaActiva', true] }
                        ]
                      }
                    }
                  }
                },
                requiereOverhaul: {
                  $anyElementTrue: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$estadosMonitoreo',
                          cond: { $eq: ['$$this.componenteId', '$$comp._id'] }
                        }
                      },
                      as: 'estado',
                      in: '$$estado.configuracionOverhaul.requiereOverhaul'
                    }
                  }
                }
              }
            }
          }
        }
      },
      // Calcular resumen por aeronave
      {
        $addFields: {
          resumen: {
            totalComponentes: { $size: '$componentesProcesados' },
            componentesOK: {
              $size: {
                $filter: {
                  input: '$componentesProcesados',
                  cond: { $eq: ['$$this.alertasActivas', 0] }
                }
              }
            },
            componentesProximos: {
              $size: {
                $filter: {
                  input: '$componentesProcesados',
                  cond: { 
                    $and: [
                      { $gt: ['$$this.alertasActivas', 0] },
                      { $eq: ['$$this.requiereOverhaul', false] }
                    ]
                  }
                }
              }
            },
            componentesOverhaul: {
              $size: {
                $filter: {
                  input: '$componentesProcesados',
                  cond: { $eq: ['$$this.requiereOverhaul', true] }
                }
              }
            },
            alertasActivas: {
              $sum: '$componentesProcesados.alertasActivas'
            }
          }
        }
      },
      // Proyección final
      {
        $project: {
          matricula: 1,
          modelo: 1,
          horasVuelo: 1,
          estado: 1,
          componentes: '$componentesProcesados',
          resumen: 1
        }
      }
    ]);

    // 2. Calcular totales para paginación
    const totalAeronaves = await Aeronave.countDocuments({ 
      estado: { $in: ['Operativo', 'En Mantenimiento'] } 
    });

    // 3. Calcular resumen general
    const resumenGeneral = {
      totalAeronaves: aeronavesProcesadas.length,
      totalComponentes: aeronavesProcesadas.reduce((sum: number, a: any) => sum + a.componentes.length, 0),
      totalAlertas: aeronavesProcesadas.reduce((sum: number, a: any) => sum + a.resumen.alertasActivas, 0),
      componentesRequierenOverhaul: aeronavesProcesadas.reduce((sum: number, a: any) => sum + a.resumen.componentesOverhaul, 0)
    };

    const result = {
      aeronaves: aeronavesProcesadas,
      resumenGeneral,
      pagination: {
        page,
        limit,
        total: totalAeronaves,
        pages: Math.ceil(totalAeronaves / limit),
        hasNext: skip + limit < totalAeronaves,
        hasPrev: page > 1
      }
    };

    // Actualizar cache
    dashboardCache = result;
    dashboardCacheTime = now;

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [DASHBOARD-MONITOREO] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Endpoint ligero para resumen rápido (sin detalles de componentes)
router.get('/resumen-rapido', requireAuth, async (req, res) => {
  try {
    const [resumen] = await Aeronave.aggregate([
      {
        $group: {
          _id: null,
          totalAeronaves: { $sum: 1 },
          aeronaveOperativas: {
            $sum: { $cond: [{ $eq: ['$estado', 'Operativo'] }, 1, 0] }
          },
          aeronaveEnMantenimiento: {
            $sum: { $cond: [{ $eq: ['$estado', 'En Mantenimiento'] }, 1, 0] }
          }
        }
      }
    ]);

    // Componentes con alertas
    const componentesConAlertas = await Componente.countDocuments({ 
      alertasActivas: true,
      estado: 'INSTALADO'
    });

    res.json({
      success: true,
      data: {
        ...(resumen || { totalAeronaves: 0, aeronaveOperativas: 0, aeronaveEnMantenimiento: 0 }),
        componentesConAlertas
      }
    });

  } catch (error) {
    console.error('Error en resumen rápido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Invalidar cache del dashboard
const invalidateDashboardCache = () => {
  dashboardCacheTime = 0;
  dashboardCache = null;
};

// Middleware para invalidar cache en operaciones de escritura
router.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (req.method !== 'GET' && res.statusCode < 400) {
      invalidateDashboardCache();
    }
    return originalSend.call(this, data);
  };
  next();
});

export default router;