// Crear estados de monitoreo para los componentes existentes
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';

const estadoSchema = new mongoose.Schema({
  componenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Componente', required: true },
  catalogoControlId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogoControlMonitoreo', required: true },
  valorActual: { type: Number, required: true },
  valorLimite: { type: Number, required: true },
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

const catalogoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true },
  descripcionCodigo: { type: String, required: true },
  horaInicial: { type: Number, required: true },
  horaFinal: { type: Number, required: true },
  unidad: { type: String, default: 'Horas' }
}, {
  collection: 'catalogocontrolmonitoreo'
});

const EstadoMonitoreoComponente = mongoose.model('EstadoMonitoreoComponente', estadoSchema);
const Componente = mongoose.model('Componente', componenteSchema);
const CatalogoControlMonitoreo = mongoose.model('CatalogoControlMonitoreo', catalogoSchema);

async function crearEstados() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. Obtener controles de monitoreo disponibles
    console.log('\n📋 CONTROLES DE MONITOREO DISPONIBLES:');
    const controles = await CatalogoControlMonitoreo.find();
    console.log(`Total controles: ${controles.length}`);
    
    controles.forEach(control => {
      console.log(`  - ${control.codigo}: ${control.descripcionCodigo} (${control.horaInicial}-${control.horaFinal} ${control.unidad})`);
    });

    if (controles.length === 0) {
      console.log('❌ NO HAY CONTROLES DE MONITOREO - Creando controles básicos...');
      
      // Crear controles básicos si no existen
      const controlesBasicos = [
        {
          codigo: 'INSPECCION_100H',
          descripcionCodigo: 'Inspección cada 100 horas',
          horaInicial: 0,
          horaFinal: 100,
          unidad: 'Horas'
        },
        {
          codigo: 'INSPECCION_500H',
          descripcionCodigo: 'Inspección cada 500 horas',
          horaInicial: 0,
          horaFinal: 500,
          unidad: 'Horas'
        },
        {
          codigo: 'OVERHAUL_1000H',
          descripcionCodigo: 'Overhaul cada 1000 horas',
          horaInicial: 0,
          horaFinal: 1000,
          unidad: 'Horas'
        }
      ];

      await CatalogoControlMonitoreo.insertMany(controlesBasicos);
      console.log('✅ Controles básicos creados');
    }

    // 2. Obtener componentes
    console.log('\n📦 OBTENIENDO COMPONENTES...');
    const componentes = await Componente.find();
    
    // 3. Obtener controles actualizados
    const controlesActualizados = await CatalogoControlMonitoreo.find();
    
    // 4. Crear estados para cada componente
    console.log('\n🔧 CREANDO ESTADOS DE MONITOREO...');
    
    const estadosACrear = [];
    
    for (const componente of componentes) {
      for (const control of controlesActualizados) {
        // Verificar si ya existe este estado
        const estadoExistente = await EstadoMonitoreoComponente.findOne({
          componenteId: componente._id,
          catalogoControlId: control._id
        });

        if (!estadoExistente) {
          const fechaProxima = new Date();
          fechaProxima.setDate(fechaProxima.getDate() + 30); // 30 días en el futuro
          
          estadosACrear.push({
            componenteId: componente._id,
            catalogoControlId: control._id,
            valorActual: Math.floor(Math.random() * 50), // Valor random entre 0-50
            valorLimite: control.horaFinal,
            unidad: control.unidad,
            fechaProximaRevision: fechaProxima,
            observaciones: `Estado inicial para ${componente.numeroSerie} - ${control.descripcionCodigo}`
          });
          
          console.log(`➕ Preparando estado: ${componente.numeroSerie} (${componente.categoria}) -> ${control.descripcionCodigo}`);
        } else {
          console.log(`⏭️ Ya existe estado: ${componente.numeroSerie} -> ${control.descripcionCodigo}`);
        }
      }
    }

    if (estadosACrear.length > 0) {
      await EstadoMonitoreoComponente.insertMany(estadosACrear);
      console.log(`✅ ${estadosACrear.length} estados de monitoreo creados`);
    } else {
      console.log('ℹ️ No hay nuevos estados para crear');
    }

    // 5. Verificación final
    console.log('\n📊 VERIFICACIÓN FINAL:');
    const totalEstados = await EstadoMonitoreoComponente.countDocuments();
    console.log(`Total estados en la base de datos: ${totalEstados}`);

    // Mostrar estados por componente
    for (const componente of componentes) {
      const estadosComponente = await EstadoMonitoreoComponente.find({ componenteId: componente._id })
        .populate('catalogoControlId', 'descripcionCodigo');
      
      console.log(`🔧 ${componente.numeroSerie} (${componente.categoria}): ${estadosComponente.length} estados`);
      estadosComponente.forEach(estado => {
        console.log(`   - ${estado.catalogoControlId.descripcionCodigo}: ${estado.valorActual}/${estado.valorLimite} ${estado.unidad}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔐 Desconectado de MongoDB');
  }
}

crearEstados();