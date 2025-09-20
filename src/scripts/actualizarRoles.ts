import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';

async function actualizarUsuariosExistentes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    console.log(`🔌 Conectando a: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Buscar usuarios sin rol definido
    const usuariosSinRol = await User.find({ 
      $or: [
        { role: { $exists: false } },
        { role: null },
        { role: undefined }
      ]
    });

    console.log(`\n👥 Usuarios sin rol encontrados: ${usuariosSinRol.length}`);

    if (usuariosSinRol.length > 0) {
      console.log('\n🔄 Actualizando usuarios existentes...');
      
      for (const usuario of usuariosSinRol) {
        // Asignar rol por defecto (ESPECIALISTA)
        usuario.role = UserRole.ESPECIALISTA;
        await usuario.save();
        console.log(`✅ Actualizado: ${usuario.name} -> ${usuario.role}`);
      }
    }

    // Verificar todos los usuarios después de la actualización
    const todosLosUsuarios = await User.find({});
    console.log(`\n📊 Resumen final de usuarios:`);
    todosLosUsuarios.forEach((usuario, index) => {
      console.log(`${index + 1}. ${usuario.name} - ${usuario.role}`);
    });

    // Estadísticas actualizadas por rol
    const usuariosPorRol = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📈 Estadísticas actualizadas por rol:');
    usuariosPorRol.forEach(grupo => {
      console.log(`  - ${grupo._id}: ${grupo.count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Ejecutar actualización
actualizarUsuariosExistentes();