import mongoose from 'mongoose';
import User from '../models/User';

async function verificarUsuarios() {
  try {
    // Usar la misma URI del archivo .env
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    console.log(`🔌 Conectando a: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Listar todas las colecciones
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Colecciones existentes:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    // Verificar usuarios existentes
    const usuarios = await User.find({}).select('name email role clerkId');
    console.log(`\n👥 Total usuarios encontrados: ${usuarios.length}`);
    
    if (usuarios.length > 0) {
      console.log('\n📊 Usuarios en la base de datos:');
      usuarios.forEach((usuario, index) => {
        console.log(`${index + 1}. ${usuario.name}`);
        console.log(`   Email: ${usuario.email}`);
        console.log(`   Rol: ${usuario.role || 'SIN ROL'}`);
        console.log(`   Clerk ID: ${usuario.clerkId}`);
        console.log('   ---');
      });

      // Estadísticas por rol
      const usuariosPorRol = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);

      console.log('\n📈 Estadísticas por rol:');
      usuariosPorRol.forEach(grupo => {
        console.log(`  - ${grupo._id || 'SIN ROL'}: ${grupo.count}`);
      });
    } else {
      console.log('\n⚠️ No se encontraron usuarios en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Ejecutar verificación
verificarUsuarios();