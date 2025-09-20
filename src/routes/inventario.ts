import express from 'express';
import Aeronave from '../models/Aeronave';
import { requireAuth } from '../middleware/clerkAuth';
import { requirePermission } from '../middleware/roleAuth';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/inventario - Obtener todas las aeronaves
router.get('/', requireAuth, requirePermission('VIEW_INVENTORY'), async (req, res) => {
  try {
    logger.info('Obteniendo lista de todas las aeronaves');

    const aeronaves = await Aeronave.find({}).sort({ createdAt: -1 });

    logger.info(`Se encontraron ${aeronaves.length} aeronaves`);

    res.json({
      success: true,
      data: aeronaves,
      total: aeronaves.length
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

// GET /api/inventario/stats - Obtener estadísticas de inventario
router.get('/stats', requireAuth, requirePermission('VIEW_INVENTORY'), async (req, res) => {
  try {
    logger.info('Obteniendo estadísticas de inventario');

    const totalAeronaves = await Aeronave.countDocuments();
    const helicopteros = await Aeronave.countDocuments({ tipo: 'Helicóptero' });
    const aviones = await Aeronave.countDocuments({ tipo: 'Avión' });
    const operativas = await Aeronave.countDocuments({ estado: 'Operativo' });
    const enMantenimiento = await Aeronave.countDocuments({ estado: 'En Mantenimiento' });
    const fueraServicio = await Aeronave.countDocuments({ estado: 'Fuera de Servicio' });

    const stats = {
      totalAeronaves,
      helicopteros,
      aviones,
      operativas,
      enMantenimiento,
      fueraServicio,
      porcentajeOperativas: totalAeronaves > 0 ? Math.round((operativas / totalAeronaves) * 100) : 0
    };

    logger.info('Estadísticas de inventario obtenidas:', stats);

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

export default router;