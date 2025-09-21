import express from 'express';
import CatalogoComponente, { EstadoCatalogo } from '../../../models/CatalogoComponente';
import { requireAuth } from '../../../middleware/clerkAuth';
import { requirePermission } from '../../../middleware/roleAuth';
import logger from '../../../utils/logger';

const router = express.Router();

// GET /api/herramientas/catalogos/componentes - Obtener todos los elementos del catálogo
router.get('/', requireAuth, requirePermission('VIEW_CATALOGS'), async (req, res) => {
  try {
    const { estado, search, page = 1, limit = 50 } = req.query;
    
    logger.info('Obteniendo catálogo de componentes', { 
      filtros: { estado, search },
      paginacion: { page, limit }
    });

    // Construir filtros
    const filtros: any = {};
    if (estado) filtros.estado = estado;

    // Preparar consulta base
    let query = CatalogoComponente.find(filtros);

    // Aplicar búsqueda de texto si se proporciona
    if (search) {
      const searchQuery = {
        $or: [
          { descripcion: { $regex: search, $options: 'i' } },
          { codigo: { $regex: search, $options: 'i' } }
        ]
      };
      query = CatalogoComponente.find({ ...filtros, ...searchQuery });
    }

    // Aplicar paginación
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [elementos, total] = await Promise.all([
      query.sort({ codigo: 1 }).skip(skip).limit(limitNum),
      CatalogoComponente.countDocuments({ ...filtros, ...(search ? {
        $or: [
          { descripcion: { $regex: search, $options: 'i' } },
          { codigo: { $regex: search, $options: 'i' } }
        ]
      } : {}) })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    logger.info(`Obtenidos ${elementos.length} elementos del catálogo de componentes`);

    res.json({
      success: true,
      data: {
        elementos,
        paginacion: {
          paginaActual: pageNum,
          totalPaginas: totalPages,
          totalElementos: total,
          elementosPorPagina: limitNum
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener catálogo de componentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener catálogo de componentes',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/herramientas/catalogos/componentes/:id - Obtener un elemento específico
router.get('/:id', requireAuth, requirePermission('VIEW_CATALOGS'), async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info('Obteniendo elemento del catálogo de componentes', { id });

    const elemento = await CatalogoComponente.findById(id);
    
    if (!elemento) {
      return res.status(404).json({
        success: false,
        message: 'Elemento no encontrado'
      });
    }

    res.json({
      success: true,
      data: elemento
    });
  } catch (error) {
    logger.error('Error al obtener elemento del catálogo de componentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener elemento del catálogo de componentes',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// POST /api/herramientas/catalogos/componentes - Crear nuevo elemento
router.post('/', requireAuth, requirePermission('CREATE_CATALOGS'), async (req, res) => {
  try {
    const { codigo, descripcion, estado } = req.body;
    
    logger.info('Creando nuevo elemento del catálogo de componentes', { codigo, descripcion, estado });

    // Validaciones básicas
    if (!codigo || !descripcion || !estado) {
      return res.status(400).json({
        success: false,
        message: 'Código, descripción y estado son requeridos'
      });
    }

    // Verificar si el código ya existe
    const existente = await CatalogoComponente.findOne({ codigo: codigo.toUpperCase() });
    if (existente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un elemento con este código'
      });
    }

    const nuevoElemento = new CatalogoComponente({
      codigo: codigo.toUpperCase(),
      descripcion: descripcion.trim(),
      estado
    });

    await nuevoElemento.save();
    
    logger.info('Elemento del catálogo de componentes creado exitosamente', { id: nuevoElemento._id });

    res.status(201).json({
      success: true,
      message: 'Elemento creado exitosamente',
      data: nuevoElemento
    });
  } catch (error) {
    logger.error('Error al crear elemento del catálogo de componentes:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear elemento del catálogo de componentes',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// PUT /api/herramientas/catalogos/componentes/:id - Actualizar elemento
router.put('/:id', requireAuth, requirePermission('EDIT_CATALOGS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, descripcion, estado } = req.body;
    
    logger.info('Actualizando elemento del catálogo de componentes', { id, codigo, descripcion, estado });

    // Validaciones básicas
    if (!codigo || !descripcion || !estado) {
      return res.status(400).json({
        success: false,
        message: 'Código, descripción y estado son requeridos'
      });
    }

    // Verificar si el elemento existe
    const elemento = await CatalogoComponente.findById(id);
    if (!elemento) {
      return res.status(404).json({
        success: false,
        message: 'Elemento no encontrado'
      });
    }

    // Verificar si el código ya existe en otro elemento
    if (codigo.toUpperCase() !== elemento.codigo) {
      const existente = await CatalogoComponente.findOne({ 
        codigo: codigo.toUpperCase(),
        _id: { $ne: id }
      });
      if (existente) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro elemento con este código'
        });
      }
    }

    // Actualizar elemento
    elemento.codigo = codigo.toUpperCase();
    elemento.descripcion = descripcion.trim();
    elemento.estado = estado;

    await elemento.save();
    
    logger.info('Elemento del catálogo de componentes actualizado exitosamente', { id });

    res.json({
      success: true,
      message: 'Elemento actualizado exitosamente',
      data: elemento
    });
  } catch (error) {
    logger.error('Error al actualizar elemento del catálogo de componentes:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar elemento del catálogo de componentes',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// DELETE /api/herramientas/catalogos/componentes/:id - Eliminar elemento
router.delete('/:id', requireAuth, requirePermission('DELETE_CATALOGS'), async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info('Eliminando elemento del catálogo de componentes', { id });

    const elemento = await CatalogoComponente.findById(id);
    if (!elemento) {
      return res.status(404).json({
        success: false,
        message: 'Elemento no encontrado'
      });
    }

    await CatalogoComponente.findByIdAndDelete(id);
    
    logger.info('Elemento del catálogo de componentes eliminado exitosamente', { id });

    res.json({
      success: true,
      message: 'Elemento eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error al eliminar elemento del catálogo de componentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar elemento del catálogo de componentes',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;