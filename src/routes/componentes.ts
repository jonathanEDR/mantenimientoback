import express from 'express';
import Componente, { ComponenteCategoria, EstadoComponente } from '../models/Componente';
import { requireAuth } from '../middleware/clerkAuth';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/mantenimiento/componentes - Obtener todos los componentes
router.get('/', requireAuth, async (req, res) => {
  try {
    const { categoria, estado, aeronave, alertas } = req.query;
    
    logger.info('Obteniendo lista de componentes', { filtros: { categoria, estado, aeronave, alertas } });

    // Construir filtros dinámicamente
    const filtros: any = {};
    if (categoria) filtros.categoria = categoria;
    if (estado) filtros.estado = estado;
    if (aeronave) filtros.aeronaveActual = aeronave;
    if (alertas === 'true') filtros.alertasActivas = true;

    const componentes = await Componente.find(filtros)
      .populate('aeronaveActual', 'matricula modelo')
      .sort({ createdAt: -1 });

    logger.info(`Se encontraron ${componentes.length} componentes`);

    res.json({
      success: true,
      data: componentes,
      total: componentes.length
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

// GET /api/mantenimiento/componentes/stats - Estadísticas de componentes
router.get('/stats', requireAuth, async (req, res) => {
  try {
    logger.info('Obteniendo estadísticas de componentes');

    const [
      totalComponentes,
      componentesInstalados,
      componentesEnAlmacen,
      componentesEnReparacion,
      componentesConAlertas,
      componentesPorCategoria
    ] = await Promise.all([
      Componente.countDocuments(),
      Componente.countDocuments({ estado: EstadoComponente.INSTALADO }),
      Componente.countDocuments({ estado: EstadoComponente.EN_ALMACEN }),
      Componente.countDocuments({ estado: EstadoComponente.EN_REPARACION }),
      Componente.countDocuments({ alertasActivas: true }),
      Componente.aggregate([
        {
          $group: {
            _id: '$categoria',
            cantidad: { $sum: 1 }
          }
        },
        { $sort: { cantidad: -1 } }
      ])
    ]);

    const stats = {
      totalComponentes,
      componentesInstalados,
      componentesEnAlmacen,
      componentesEnReparacion,
      componentesConAlertas,
      porcentajeInstalados: totalComponentes > 0 ? Math.round((componentesInstalados / totalComponentes) * 100) : 0,
      distribucionPorCategoria: componentesPorCategoria
    };

    logger.info('Estadísticas de componentes obtenidas:', stats);

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
router.get('/alertas', requireAuth, async (req, res) => {
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

// GET /api/mantenimiento/componentes/aeronave/:matricula - Componentes de una aeronave
router.get('/aeronave/:matricula', requireAuth, async (req, res) => {
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
    logger.error('Error al obtener componentes de aeronave:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /api/mantenimiento/componentes/:id - Obtener componente por ID
router.get('/:id', requireAuth, async (req, res) => {
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

// POST /api/mantenimiento/componentes - Crear nuevo componente
router.post('/', requireAuth, async (req, res) => {
  try {
    const componenteData = req.body;
    logger.info(`Creando nuevo componente: ${componenteData.numeroSerie}`);

    // Verificar si ya existe un componente con ese número de serie
    const componenteExistente = await Componente.findOne({ 
      numeroSerie: componenteData.numeroSerie 
    });
    
    if (componenteExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un componente con ese número de serie'
      });
    }

    const nuevoComponente = new Componente(componenteData);
    const componenteGuardado = await nuevoComponente.save();

    logger.info(`Componente creado exitosamente: ${componenteGuardado.numeroSerie}`);

    res.status(201).json({
      success: true,
      message: 'Componente creado exitosamente',
      data: componenteGuardado
    });

  } catch (error) {
    logger.error('Error al crear componente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// PUT /api/mantenimiento/componentes/:id - Actualizar componente
router.put('/:id', requireAuth, async (req, res) => {
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
router.put('/:id/instalar', requireAuth, async (req, res) => {
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
router.put('/:id/remover', requireAuth, async (req, res) => {
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

// DELETE /api/mantenimiento/componentes/:id - Eliminar componente
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Eliminando componente con ID: ${id}`);

    const componenteEliminado = await Componente.findByIdAndDelete(id);

    if (!componenteEliminado) {
      return res.status(404).json({
        success: false,
        message: 'Componente no encontrado'
      });
    }

    logger.info(`Componente eliminado exitosamente: ${componenteEliminado.numeroSerie}`);

    res.json({
      success: true,
      message: 'Componente eliminado exitosamente',
      data: componenteEliminado
    });

  } catch (error) {
    logger.error('Error al eliminar componente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

export default router;