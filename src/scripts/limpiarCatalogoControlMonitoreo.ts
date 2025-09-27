import { config } from 'dotenv';
config();

import { connectDB } from '../utils/db';
import mongoose from 'mongoose';

// Definir la interfaz del catálogo de control de monitoreo
interface ICatalogoControlMonitoreo {
  _id?: string;
  descripcionCodigo: string;
  horaInicial: number;
  horaFinal: number;
  estado: string;
}

const limpiarCatalogoControlMonitoreo = async () => {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await connectDB();

    const db = mongoose.connection.db;
    const collection = db?.collection('catalogocontrolmonitoreos');

    if (!collection) {
      throw new Error('No se pudo conectar a la colección catalogocontrolmonitoreos');
    }

    console.log('\n📊 Verificando registros actuales...');
    const todosLosRegistros = await collection.find({}).toArray();
    console.log(`Total de registros encontrados: ${todosLosRegistros.length}`);

    // Mostrar algunos ejemplos
    console.log('\n📋 Ejemplos de registros encontrados:');
    todosLosRegistros.slice(0, 5).forEach((registro, index) => {
      console.log(`${index + 1}. ${registro.descripcionCodigo} (${registro.horaInicial} - ${registro.horaFinal}h)`);
    });

    // Identificar registros correctos (deben tener descripcionCodigo válidos como TRR, TSN, etc.)
    const registrosCorrectos = todosLosRegistros.filter((registro: any) => {
      const codigo = registro.descripcionCodigo;
      // Los códigos correctos son: TRR, TSN, etc. (no deben ser "25H - Inspección diaria", etc.)
      return codigo && (
        codigo.startsWith('TRR') || 
        codigo.startsWith('TSN') || 
        codigo.startsWith('TSO') ||
        codigo.includes('TRR') ||
        (codigo.length <= 10 && !codigo.includes('Inspección') && !codigo.includes('-'))
      );
    });

    const registrosIncorrectos = todosLosRegistros.filter((registro: any) => {
      const codigo = registro.descripcionCodigo;
      // Los códigos incorrectos son los que parecen descripciones de intervalos de inspección
      return codigo && (
        codigo.includes('Inspección') ||
        codigo.includes(' - ') ||
        codigo.includes('diaria') ||
        codigo.includes('semanal') ||
        codigo.includes('mensual') ||
        codigo.length > 15
      );
    });

    console.log(`\n✅ Registros correctos encontrados: ${registrosCorrectos.length}`);
    console.log('Ejemplos de registros correctos:');
    registrosCorrectos.slice(0, 3).forEach((registro, index) => {
      console.log(`  ${index + 1}. ${registro.descripcionCodigo}`);
    });

    console.log(`\n❌ Registros incorrectos encontrados: ${registrosIncorrectos.length}`);
    console.log('Ejemplos de registros incorrectos:');
    registrosIncorrectos.slice(0, 3).forEach((registro, index) => {
      console.log(`  ${index + 1}. ${registro.descripcionCodigo}`);
    });

    if (registrosIncorrectos.length > 0) {
      console.log('\n🗑️ Eliminando registros incorrectos...');
      
      // Obtener los IDs de los registros incorrectos
      const idsIncorrectos = registrosIncorrectos.map(registro => registro._id);
      
      // Eliminar los registros incorrectos
      const resultadoEliminacion = await collection.deleteMany({
        _id: { $in: idsIncorrectos }
      });

      console.log(`✅ Se eliminaron ${resultadoEliminacion.deletedCount} registros incorrectos del catálogo de control de monitoreo`);
    } else {
      console.log('\n✅ No se encontraron registros incorrectos para eliminar');
    }

    // Verificar el estado final
    console.log('\n📊 Estado final:');
    const registrosFinales = await collection.find({}).toArray();
    console.log(`Total de registros restantes: ${registrosFinales.length}`);
    
    console.log('\n✅ Limpieza del catálogo de control de monitoreo completada');

  } catch (error) {
    console.error('❌ Error al limpiar el catálogo de control de monitoreo:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de la base de datos');
    process.exit(0);
  }
};

// Ejecutar el script
limpiarCatalogoControlMonitoreo();