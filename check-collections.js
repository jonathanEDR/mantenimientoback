require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./dist/utils/db.js');

async function checkCollections() {
  try {
    await connectDB();
    const collections = await mongoose.connection.db.listCollections().toArray();
    const relevantCollections = collections.filter(c => 
      c.name.toLowerCase().includes('estado') || 
      c.name.toLowerCase().includes('monitoreo')
    );
    console.log('Colecciones relacionadas con estados/monitoreo:');
    relevantCollections.forEach(c => console.log('- ' + c.name));
    
    // Verificar cuál tiene datos
    for (const col of relevantCollections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`${col.name}: ${count} documentos`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCollections();