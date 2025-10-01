import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { CatalogoControlMonitoreo } from '../models/CatalogoControlMonitoreo';

const verificarPopulate = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/MantenimientosDB');
    console.log('🔍 Verificando populate de estados de monitoreo...');
    
    // Obtener un estado sin populate
    const estadoSinPopulate = await EstadoMonitoreoComponente.findOne({}).lean();
    console.log('📈 Estado SIN populate:', {
      id: estadoSinPopulate?._id,
      componenteId: estadoSinPopulate?.componenteId,
      catalogoControlId: estadoSinPopulate?.catalogoControlId,
      catalogoControlIdType: typeof estadoSinPopulate?.catalogoControlId
    });
    
    // Obtener el mismo estado CON populate
    const estadoConPopulate = await EstadoMonitoreoComponente.findById(estadoSinPopulate?._id)
      .populate('catalogoControlId', 'nombre descripcion unidadMedida')
      .lean();
    
    console.log('📈 Estado CON populate:', {
      id: estadoConPopulate?._id,
      catalogoControlId: estadoConPopulate?.catalogoControlId,
      catalogoControlIdPopulated: estadoConPopulate?.catalogoControlId
    });
    
    // Verificar si existe el catálogo control referenciado
    const catalogoControl = await CatalogoControlMonitoreo.findById(estadoSinPopulate?.catalogoControlId);
    console.log('📋 Catálogo control encontrado:', {
      id: catalogoControl?._id,
      descripcionCodigo: (catalogoControl as any)?.descripcionCodigo,
      horaInicial: (catalogoControl as any)?.horaInicial,
      horaFinal: (catalogoControl as any)?.horaFinal,
      estado: (catalogoControl as any)?.estado
    });
    
    // Listar todos los catálogos disponibles
    const todosCatalogos = await CatalogoControlMonitoreo.find({});
    console.log('📚 Total catálogos disponibles:', todosCatalogos.length);
    todosCatalogos.forEach((catalogo: any, index: number) => {
      console.log(`   ${index + 1}. ${catalogo._id} - ${catalogo.descripcionCodigo}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

verificarPopulate();