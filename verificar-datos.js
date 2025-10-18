const mongoose = require('mongoose');

async function verificarDatos() {
  await mongoose.connect('mongodb://127.0.0.1:27017/MantenimientosDB');
  console.log('✅ Conectado a MongoDB');
  
  // Buscar componentes
  const Componente = mongoose.model('Componente', new mongoose.Schema({}, { collection: 'componentes' }));
  const componentes = await Componente.find({}).limit(3);
  console.log('🔧 Componentes encontrados:', componentes.length);
  
  if (componentes.length > 0) {
    componentes.forEach((comp, idx) => {
      console.log(`${idx + 1}. ID: ${comp._id}, Serie: ${comp.numeroSerie}, Nombre: ${comp.nombre}`);
    });
  }
  
  // Buscar catálogo de controles
  const CatalogoControl = mongoose.model('CatalogoControlMonitoreo', new mongoose.Schema({}, { collection: 'catalogocontrolmonitoreo' }));
  const controles = await CatalogoControl.find({}).limit(3);
  console.log('📋 Controles encontrados:', controles.length);
  
  if (controles.length > 0) {
    controles.forEach((ctrl, idx) => {
      console.log(`${idx + 1}. ID: ${ctrl._id}, Nombre: ${ctrl.nombre}`);
    });
  }
  
  process.exit(0);
}

verificarDatos().catch(console.error);