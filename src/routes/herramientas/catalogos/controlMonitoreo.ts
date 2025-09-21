import express from 'express';
import { CatalogoControlMonitoreo } from '../../../models/CatalogoControlMonitoreo';
import { requireAuth } from '../../../middleware/clerkAuth';
import { requirePermission } from '../../../middleware/roleAuth';
import logger from '../../../utils/logger';

const router = express.Router();

// Obtener todos los elementos del catálogo
router.get('/', requireAuth, requirePermission('VIEW_CATALOGS'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const filtros: any = {};
    
    if (req.query.descripcionCodigo) {
      filtros.descripcionCodigo = { $regex: req.query.descripcionCodigo, $options: 'i' };
    }
    
    if (req.query.estado) {
      filtros.estado = req.query.estado;
    }

    logger.info('Obteniendo catálogo de control y monitoreo', { 
      filtros, 
      paginacion: { page, limit } 
    });

    const elementos = await CatalogoControlMonitoreo.find(filtros)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CatalogoControlMonitoreo.countDocuments(filtros);

    logger.info(`Obtenidos ${elementos.length} elementos del catálogo de control y monitoreo`);

    res.json({
      elementos,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error al obtener catálogo de control y monitoreo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Crear nuevo elemento
router.post('/', requireAuth, requirePermission('MANAGE_CATALOGS'), async (req, res) => {
  try {
    const { descripcionCodigo, horaInicial, horaFinal, estado } = req.body;

    logger.info('Creando nuevo elemento en catálogo de control y monitoreo', { descripcionCodigo });

    const nuevoElemento = new CatalogoControlMonitoreo({
      descripcionCodigo,
      horaInicial,
      horaFinal,
      estado
    });

    await nuevoElemento.save();

    logger.info('Elemento creado exitosamente en catálogo de control y monitoreo', { id: nuevoElemento._id });
    res.status(201).json(nuevoElemento);
  } catch (error) {
    logger.error('Error al crear elemento en catálogo de control y monitoreo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Actualizar elemento
router.put('/:id', requireAuth, requirePermission('MANAGE_CATALOGS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcionCodigo, horaInicial, horaFinal, estado } = req.body;

    logger.info('Actualizando elemento en catálogo de control y monitoreo', { id });

    const elemento = await CatalogoControlMonitoreo.findByIdAndUpdate(
      id,
      { descripcionCodigo, horaInicial, horaFinal, estado },
      { new: true }
    );

    if (!elemento) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }

    logger.info('Elemento actualizado exitosamente en catálogo de control y monitoreo', { id });
    res.json(elemento);
  } catch (error) {
    logger.error('Error al actualizar elemento en catálogo de control y monitoreo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Eliminar elemento
router.delete('/:id', requireAuth, requirePermission('MANAGE_CATALOGS'), async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Eliminando elemento de catálogo de control y monitoreo', { id });

    const elemento = await CatalogoControlMonitoreo.findByIdAndDelete(id);

    if (!elemento) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }

    logger.info('Elemento eliminado exitosamente de catálogo de control y monitoreo', { id });
    res.json({ message: 'Elemento eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar elemento de catálogo de control y monitoreo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;