// Verificar estados en base de datos
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';

const estadoSchema = new mongoose.Schema({
  componenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Componente' },
  catalogoControlId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogoControlMonitoreo' },
  valorActual: { type: Number },
  valorLimite: { type: Number },
  unidad: { type: String },
  fechaProximaRevision: { type: Date },
  observaciones: { type: String }
}, {
  timestamps: true,
  collection: 'estadosmonitoreocomponente'
});

const componenteSchema = new mongoose.Schema({
  numeroSerie: { type: String },
  nombre: { type: String },
  categoria: { type: String },
  aeronaveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aeronave' }
}, {
  collection: 'componentes'
});

const EstadoMonitoreoComponente = mongoose.model('EstadoMonitoreoComponente', estadoSchema);
const Componente = mongoose.model('Componente', componenteSchema);

async function verificarEstados() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. Buscar todos los componentes
    console.log('\n📋 COMPONENTES EN LA BASE DE DATOS:');
    const componentes = await Componente.find().select('_id numeroSerie nombre categoria aeronaveId');
    console.log(`Total componentes: ${componentes.length}`);
    
    componentes.forEach(comp => {
      console.log(`  - ID: ${comp._id} | Serie: ${comp.numeroSerie} | Nombre: ${comp.nombre} | Categoría: ${comp.categoria}`);
    });

    // 2. Buscar todos los estados
    console.log('\n📊 ESTADOS DE MONITOREO EN LA BASE DE DATOS:');
    const estados = await EstadoMonitoreoComponente.find()
      .populate('componenteId', 'numeroSerie nombre categoria')
      .populate('catalogoControlId', 'descripcionCodigo');
    
    console.log(`Total estados: ${estados.length}`);
    
    if (estados.length > 0) {
      estados.forEach(estado => {
        const comp = estado.componenteId;
        const control = estado.catalogoControlId;
        console.log(`  - Estado ID: ${estado._id}`);
        console.log(`    Componente: ${comp?.numeroSerie} (${comp?.nombre}) - Categoría: ${comp?.categoria}`);
        console.log(`    Control: ${control?.descripcionCodigo}`);
        console.log(`    Valor: ${estado.valorActual}/${estado.valorLimite} ${estado.unidad}`);
        console.log(`    ---`);
      });
    } else {
      console.log('❌ NO HAY ESTADOS DE MONITOREO EN LA BASE DE DATOS');
    }

    // 3. Verificar componentes específicos (FUSELAJE vs otros)
    console.log('\n🔍 ANÁLISIS POR CATEGORÍA:');
    const categorias = [...new Set(componentes.map(c => c.categoria))];
    
    for (const categoria of categorias) {
      const compsCat = componentes.filter(c => c.categoria === categoria);
      const estadosCat = estados.filter(e => e.componenteId?.categoria === categoria);
      
      console.log(`📂 Categoría: ${categoria}`);
      console.log(`   Componentes: ${compsCat.length}`);
      console.log(`   Estados: ${estadosCat.length}`);
      
      compsCat.forEach(comp => {
        const tieneEstados = estados.some(e => e.componenteId?._id.toString() === comp._id.toString());
        console.log(`     ${comp.numeroSerie} (${comp.nombre}) - ${tieneEstados ? '✅ CON ESTADOS' : '❌ SIN ESTADOS'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔐 Desconectado de MongoDB');
  }
}

verificarEstados();