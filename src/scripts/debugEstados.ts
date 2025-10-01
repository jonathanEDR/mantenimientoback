import mongoose from 'mongoose';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';

const verificarEstados = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/MantenimientosDB');
    console.log('🔍 Verificando estados de monitoreo...');
    
    // Obtener todos los estados
    const todosEstados = await EstadoMonitoreoComponente.find({});
    console.log('📊 Total estados de monitoreo:', todosEstados.length);
    
    // Mostrar algunos ejemplos
    todosEstados.slice(0, 3).forEach((estado: any, index: number) => {
      console.log(`📈 Estado ${index + 1}:`, {
        id: estado._id,
        componenteId: estado.componenteId,
        catalogoControlId: estado.catalogoControlId,
        valorActual: estado.valorActual,
        valorLimite: estado.valorLimite,
        estado: estado.estado
      });
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

verificarEstados();