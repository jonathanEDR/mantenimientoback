import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../utils/db';
import logger from '../utils/logger';

dotenv.config();

async function checkMonitoringData() {
  try {
    await connectDB();

    // Check catalogo control monitoreo
    const catalogoControlMonitoreo = mongoose.connection.db?.collection('catalogocontrolmonitoreos');
    const catalogoCount = await catalogoControlMonitoreo?.countDocuments();
    console.log(`📊 CatalogoControlMonitoreo documents: ${catalogoCount}`);

    if (catalogoCount && catalogoCount > 0) {
      const sampleCatalogo = await catalogoControlMonitoreo?.findOne();
      console.log('📋 Sample CatalogoControlMonitoreo:', JSON.stringify(sampleCatalogo, null, 2));
    }

    // Check aeronaves
    const aeronaves = mongoose.connection.db?.collection('aeronaves');
    const aeronavesCount = await aeronaves?.countDocuments();
    console.log(`✈️ Aeronaves documents: ${aeronavesCount}`);

    if (aeronavesCount && aeronavesCount > 0) {
      const sampleAeronave = await aeronaves?.findOne();
      console.log('✈️ Sample Aeronave:', JSON.stringify({
        matricula: sampleAeronave?.matricula,
        horasVuelo: sampleAeronave?.horasVuelo,
        estado: sampleAeronave?.estado
      }, null, 2));
    }

    // List all aeronaves with hours
    const allAeronaves = await aeronaves?.find({}, { projection: { matricula: 1, horasVuelo: 1, estado: 1 } }).toArray();
    console.log('\n✈️ All Aeronaves:');
    allAeronaves?.forEach(a => {
      console.log(`   ${a.matricula}: ${a.horasVuelo || 0} horas - Estado: ${a.estado}`);
    });

  } catch (error) {
    console.error('❌ Error checking data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkMonitoringData();