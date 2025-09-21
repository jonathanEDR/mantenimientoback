import mongoose from 'mongoose';
import CatalogoComponente, { EstadoCatalogo } from '../models/CatalogoComponente';
import logger from '../utils/logger';

// Configuración de la base de datos
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/helicopteros';

// Datos de ejemplo simplificados
const elementosCatalogo = [
  {
    codigo: 'ENG001',
    descripcion: 'Motor Principal Turboshaft',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'ROT001',
    descripcion: 'Rotor Principal Completo',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'FUS001',
    descripcion: 'Fuselaje Principal',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'LND001',
    descripcion: 'Tren de Aterrizaje',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'CTL001',
    descripcion: 'Controles de Vuelo',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'AVN001',
    descripcion: 'Sistema de Aviónica',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'HYD001',
    descripcion: 'Sistema Hidráulico Principal',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'ELE001',
    descripcion: 'Sistema Eléctrico',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'COM001',
    descripcion: 'Sistema de Comunicaciones',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'NAV001',
    descripcion: 'Sistema de Navegación',
    estado: EstadoCatalogo.ACTIVO
  },
  {
    codigo: 'OLD001',
    descripcion: 'Componente Obsoleto',
    estado: EstadoCatalogo.OBSOLETO
  },
  {
    codigo: 'DIS001',
    descripcion: 'Componente Inactivo',
    estado: EstadoCatalogo.INACTIVO
  }
];

async function poblarCatalogos() {
  try {
    logger.info('Iniciando población de catálogos...');

    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URI);
    logger.info('Conectado a MongoDB');

    // Limpiar colección existente
    await CatalogoComponente.deleteMany({});
    logger.info('Colección de catálogo de componentes limpiada');

    // Insertar elementos del catálogo
    const elementosInsertados = await CatalogoComponente.insertMany(elementosCatalogo);
    logger.info(`${elementosInsertados.length} elementos insertados en el catálogo de componentes`);

    // Mostrar estadísticas
    const estadisticas = await CatalogoComponente.aggregate([
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      }
    ]);

    logger.info('Estadísticas del catálogo:');
    estadisticas.forEach(stat => {
      logger.info(`  ${stat._id}: ${stat.count} elementos`);
    });

    logger.info('¡Población de catálogos completada exitosamente!');
    
  } catch (error) {
    logger.error('Error al poblar catálogos:', error);
    throw error;
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    logger.info('Conexión a MongoDB cerrada');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  poblarCatalogos()
    .then(() => {
      console.log('Proceso completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error en el proceso:', error);
      process.exit(1);
    });
}

export default poblarCatalogos;