import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../utils/db';

dotenv.config();

async function populateMonitoringCatalog() {
  try {
    await connectDB();

    const catalogoControlMonitoreo = mongoose.connection.db?.collection('catalogocontrolmonitoreos');

    // Clear existing data
    await catalogoControlMonitoreo?.deleteMany({});

    // Insert monitoring intervals for helicopters
    const monitoringIntervals = [
      {
        descripcionCodigo: "25H - Inspección diaria",
        horaInicial: 0,
        horaFinal: 25,
        tipoAlerta: "PREVENTIVO",
        prioridad: 3,
        estado: "ACTIVO",
        descripcion: "Inspección diaria de rutina"
      },
      {
        descripcionCodigo: "100H - Inspección semanal",
        horaInicial: 0,
        horaFinal: 100,
        tipoAlerta: "PREVENTIVO",
        prioridad: 2,
        estado: "ACTIVO",
        descripcion: "Inspección semanal preventiva"
      },
      {
        descripcionCodigo: "200H - Inspección mensual",
        horaInicial: 0,
        horaFinal: 200,
        tipoAlerta: "PREVENTIVO",
        prioridad: 1,
        estado: "ACTIVO",
        descripcion: "Inspección mensual mayor"
      },
      {
        descripcionCodigo: "500H - Inspección trimestral",
        horaInicial: 0,
        horaFinal: 500,
        tipoAlerta: "CRITICO",
        prioridad: 1,
        estado: "ACTIVO",
        descripcion: "Inspección trimestral crítica"
      },
      {
        descripcionCodigo: "1000H - Inspección mayor",
        horaInicial: 0,
        horaFinal: 1000,
        tipoAlerta: "CRITICO",
        prioridad: 1,
        estado: "ACTIVO",
        descripcion: "Inspección mayor anual"
      },
      {
        descripcionCodigo: "2000H - Overhaul menor",
        horaInicial: 0,
        horaFinal: 2000,
        tipoAlerta: "CRITICO",
        prioridad: 1,
        estado: "ACTIVO",
        descripcion: "Overhaul menor del motor"
      }
    ];

    const result = await catalogoControlMonitoreo?.insertMany(monitoringIntervals);
    console.log(`✅ Inserted ${result?.insertedCount} monitoring intervals`);

    // Show final count
    const finalCount = await catalogoControlMonitoreo?.countDocuments();
    console.log(`📊 Total monitoring intervals: ${finalCount}`);

    // Show sample data
    const sample = await catalogoControlMonitoreo?.findOne();
    console.log('📋 Sample data:', JSON.stringify(sample, null, 2));

  } catch (error) {
    console.error('❌ Error populating catalog:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

populateMonitoringCatalog();