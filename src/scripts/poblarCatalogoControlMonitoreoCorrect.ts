import { config } from 'dotenv';
config();

import { connectDB } from '../utils/db';
import mongoose from 'mongoose';

const poblarCatalogoControlMonitoreoCorrectoos = async () => {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await connectDB();

    const db = mongoose.connection.db;
    const collection = db?.collection('catalogocontrolmonitoreos');

    if (!collection) {
      throw new Error('No se pudo conectar a la colección catalogocontrolmonitoreos');
    }

    // Datos correctos basados en la primera imagen
    const controlesCorrectos = [
      {
        descripcionCodigo: "TRR",
        horaInicial: 0,
        horaFinal: 60,
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      },
      {
        descripcionCodigo: "TSNmmmmmm",
        horaInicial: 2,
        horaFinal: 80,
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      },
      {
        descripcionCodigo: "TRRaa",
        horaInicial: 0,
        horaFinal: 105,
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      }
    ];

    console.log('\n📊 Verificando registros actuales...');
    const registrosExistentes = await collection.find({}).toArray();
    console.log(`Total de registros existentes: ${registrosExistentes.length}`);

    if (registrosExistentes.length === 0) {
      console.log('\n✅ Insertando controles de monitoreo correctos...');
      
      const resultado = await collection.insertMany(controlesCorrectos);
      console.log(`✅ Se insertaron ${resultado.insertedCount} controles de monitoreo correctos`);

      // Mostrar los registros insertados
      console.log('\n📋 Controles insertados:');
      controlesCorrectos.forEach((control, index) => {
        console.log(`  ${index + 1}. ${control.descripcionCodigo} (${control.horaInicial} - ${control.horaFinal}h)`);
      });

    } else {
      console.log('\n⚠️ Ya existen registros en el catálogo:');
      registrosExistentes.forEach((registro: any, index) => {
        console.log(`  ${index + 1}. ${registro.descripcionCodigo} (${registro.horaInicial} - ${registro.horaFinal}h)`);
      });
    }

    // Verificar el estado final
    console.log('\n📊 Estado final del catálogo:');
    const registrosFinales = await collection.find({}).toArray();
    console.log(`Total de controles de monitoreo: ${registrosFinales.length}`);
    
    console.log('\n✅ Catálogo de control de monitoreo configurado correctamente');

  } catch (error) {
    console.error('❌ Error al poblar el catálogo de control de monitoreo:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de la base de datos');
    process.exit(0);
  }
};

// Ejecutar el script
poblarCatalogoControlMonitoreoCorrectoos();