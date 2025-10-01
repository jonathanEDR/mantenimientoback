import express from 'express';
import { requireAuth } from '../middleware/clerkAuth';
import Aeronave from '../models/Aeronave';
import Componente from '../models/Componente';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { CatalogoControlMonitoreo } from '../models/CatalogoControlMonitoreo';

const router = express.Router();

// Endpoint para obtener monitoreo completo de aeronaves y componentes
router.get('/monitoreo-completo', requireAuth, async (req, res) => {
  try {
    // 1. Obtener todas las aeronaves operativas y en mantenimiento
    const aeronaves = await Aeronave.find({ 
      estado: { $in: ['Operativo', 'En Mantenimiento'] } 
    }).lean();

    // 2. Procesar cada aeronave y sus componentes
    const aeronavesProcesadas = await Promise.all(
      aeronaves.map(async (aeronave: any) => {
        // Obtener componentes instalados de la aeronave
        const componentes = await Componente.find({ 
          aeronaveActual: aeronave._id,
          estado: 'INSTALADO'
        }).lean();

        // Procesar cada componente
        const componentesProcesados = await Promise.all(
          componentes.map(async (componente: any) => {
            // Obtener estados de monitoreo del componente
            const estadosMonitoreo = await EstadoMonitoreoComponente.find({
              componenteId: componente._id 
            })
              .populate('catalogoControlId', 'descripcionCodigo horaInicial horaFinal estado')
              .lean();

            // Procesar estados de monitoreo
            const estadosProcesados = estadosMonitoreo.map((estado: any) => {
              const control = estado.catalogoControlId as any;
              
              // Calcular valores actuales - corregir acceso a vidaUtil
              const vidaUtilHoras = Array.isArray(componente.vidaUtil) 
                ? componente.vidaUtil.find((v: any) => v.unidad === 'HORAS')
                : null;
              const horasComponente = vidaUtilHoras?.acumulado || 0;
              const valorActual = horasComponente + (estado.offsetInicial || 0);
              const valorLimite = estado.valorLimite || 0;
              const progreso = valorLimite > 0 ? Math.round((valorActual / valorLimite) * 100) : 0;

              // Determinar estado
              let estadoCalculado = 'OK';
              let alertaActiva = estado.alertaActiva || false;

              if (estado.configuracionOverhaul?.habilitarOverhaul && estado.configuracionOverhaul?.requiereOverhaul) {
                estadoCalculado = 'OVERHAUL_REQUERIDO';
                alertaActiva = true;
              } else if (progreso >= 100) {
                estadoCalculado = 'VENCIDO';
                alertaActiva = true;
              } else if (progreso >= 90) {
                estadoCalculado = 'PROXIMO';
                alertaActiva = true;
              }

              return {
                _id: estado._id,
                controlId: control?.descripcionCodigo || 'N/A',
                descripcionControl: control?.descripcionCodigo || 'Sin descripción',
                valorActual,
                valorLimite,
                unidad: estado.unidad || 'HORAS',
                estado: estadoCalculado,
                progreso: Math.min(progreso, 100),
                criticidad: estado.configuracionPersonalizada?.criticidad || 'MEDIA',
                alertaActiva,
                configuracionOverhaul: estado.configuracionOverhaul
              };
            });

            // Calcular métricas del componente
            const alertasActivas = estadosProcesados.filter((e: any) => e.alertaActiva).length;
            const requiereOverhaul = estadosProcesados.some((e: any) => e.estado === 'OVERHAUL_REQUERIDO');

            // Buscar vida útil en horas del componente
            const vidaUtilHoras = Array.isArray(componente.vidaUtil) 
              ? componente.vidaUtil.find((v: any) => v.unidad === 'HORAS')
              : null;
            const horasAcumuladas = vidaUtilHoras?.acumulado || 0;

            return {
              _id: componente._id,
              numeroSerie: componente.numeroSerie,
              nombre: componente.nombre,
              categoria: componente.categoria,
              horasAcumuladas,
              estadosMonitoreo: estadosProcesados,
              alertasActivas,
              requiereOverhaul
            };
          })
        );

        // Calcular resumen de la aeronave
        const resumen = {
          totalComponentes: componentesProcesados.length,
          componentesOK: componentesProcesados.filter((c: any) => 
            c.estadosMonitoreo.every((e: any) => e.estado === 'OK')
          ).length,
          componentesProximos: componentesProcesados.filter((c: any) => 
            c.estadosMonitoreo.some((e: any) => e.estado === 'PROXIMO')
          ).length,
          componentesVencidos: componentesProcesados.filter((c: any) => 
            c.estadosMonitoreo.some((e: any) => e.estado === 'VENCIDO')
          ).length,
          componentesOverhaul: componentesProcesados.filter((c: any) => c.requiereOverhaul).length,
          alertasActivas: componentesProcesados.reduce((sum: number, c: any) => sum + c.alertasActivas, 0)
        };

        return {
          _id: aeronave._id,
          matricula: aeronave.matricula,
          modelo: aeronave.modelo,
          horasVuelo: aeronave.horasVuelo || 0,
          estado: aeronave.estado,
          componentes: componentesProcesados,
          resumen
        };
      })
    );

    // 3. Calcular resumen general
    const resumenGeneral = {
      totalAeronaves: aeronavesProcesadas.length,
      totalComponentes: aeronavesProcesadas.reduce((sum: number, a: any) => sum + a.componentes.length, 0),
      totalAlertas: aeronavesProcesadas.reduce((sum: number, a: any) => sum + a.resumen.alertasActivas, 0),
      componentesRequierenOverhaul: aeronavesProcesadas.reduce((sum: number, a: any) => sum + a.resumen.componentesOverhaul, 0)
    };

    res.json({
      success: true,
      data: {
        aeronaves: aeronavesProcesadas,
        resumenGeneral
      }
    });

  } catch (error) {
    console.error('❌ [DASHBOARD-MONITOREO] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de monitoreo completo',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Endpoint para actualizar estado específico de componente
router.patch('/componente/:componenteId/estado/:estadoId', requireAuth, async (req, res) => {
  try {
    const { componenteId, estadoId } = req.params;
    const actualizaciones = req.body;

    const estadoActualizado = await EstadoMonitoreoComponente.findByIdAndUpdate(
      estadoId,
      { $set: actualizaciones },
      { new: true, runValidators: true }
    );

    if (!estadoActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Estado de monitoreo no encontrado'
      });
    }

    res.json({
      success: true,
      data: estadoActualizado
    });

  } catch (error) {
    console.error('❌ [DASHBOARD-MONITOREO] Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado de monitoreo',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Endpoint para completar overhaul de componente
router.post('/componente/:componenteId/completar-overhaul', requireAuth, async (req, res) => {
  try {
    const { componenteId } = req.params;
    const { estadoIds, observaciones } = req.body;

    // Actualizar todos los estados que requieren overhaul
    const actualizaciones = await Promise.all(
      estadoIds.map(async (estadoId: string) => {
        return await EstadoMonitoreoComponente.findByIdAndUpdate(
          estadoId,
          {
            $set: {
              'configuracionOverhaul.requiereOverhaul': false,
              'configuracionOverhaul.cicloActual': 0,
              'fechaUltimaRevision': new Date(),
              observaciones: observaciones || `Overhaul completado el ${new Date().toLocaleString()}`
            }
          },
          { new: true }
        );
      })
    );

    res.json({
      success: true,
      data: actualizaciones,
      message: 'Overhaul completado correctamente'
    });

  } catch (error) {
    console.error('❌ [DASHBOARD-MONITOREO] Error al completar overhaul:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar overhaul',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;