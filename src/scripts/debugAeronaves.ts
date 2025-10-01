import mongoose from 'mongoose';
import AeronaveModel from '../models/Aeronave';

const verificarAeronaves = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/MantenimientosDB');
    console.log('🔍 Verificando aeronaves...');
    
    // Obtener todas las aeronaves sin filtros
    const todasAeronaves = await AeronaveModel.find({});
    console.log('📊 Total aeronaves en DB:', todasAeronaves.length);
    
    // Mostrar estructura de cada aeronave
    todasAeronaves.forEach((aeronave: any, index: number) => {
      console.log(`✈️ Aeronave ${index + 1}:`, {
        id: aeronave._id,
        matricula: aeronave.matricula,
        modelo: aeronave.modelo,
        estado: aeronave.estado,
        tipo: aeronave.tipo,
        horasVuelo: aeronave.horasVuelo
      });
    });
    
    // Probar filtro correcto
    const operativas = await AeronaveModel.find({ 
      estado: { $in: ['Operativo', 'En Mantenimiento'] } 
    });
    console.log('🟢 Aeronaves operativas:', operativas.length);
    
    operativas.forEach((aeronave: any, index: number) => {
      console.log(`   ✅ ${index + 1}. ${aeronave.matricula} - ${aeronave.estado}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

verificarAeronaves();