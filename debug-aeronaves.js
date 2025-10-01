import mongoose from 'mongoose';
import AeronaveModel from './src/models/Aeronave.js';

mongoose.connect('mongodb://127.0.0.1:27017/MantenimientosDB').then(async () => {
  console.log('🔍 Verificando aeronaves...');
  
  const todasAeronaves = await AeronaveModel.find({});
  console.log('📊 Total aeronaves:', todasAeronaves.length);
  
  todasAeronaves.forEach(aeronave => {
    console.log('✈️ Aeronave:', {
      id: aeronave._id,
      matricula: aeronave.matricula,
      activo: aeronave.activo,
      estado: aeronave.estado
    });
  });
  
  const activasFilter = await AeronaveModel.find({ activo: true });
  console.log('🟢 Aeronaves activas (activo: true):', activasFilter.length);
  
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});