import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';

async function configurarAdministrador() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    console.log(`🔌 Conectando a: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Mostrar usuarios actuales
    const usuarios = await User.find({});
    console.log('\n👥 Usuarios actuales:');
    usuarios.forEach((usuario, index) => {
      console.log(`${index + 1}. ${usuario.name} (${usuario.email}) - ${usuario.role}`);
    });

    // Preguntar cuál usuario convertir en administrador
    console.log('\n🔧 Convirtiendo el primer usuario en ADMINISTRADOR...');
    
    if (usuarios.length > 0) {
      const usuarioAdmin = usuarios[0];
      usuarioAdmin.role = UserRole.ADMINISTRADOR;
      await usuarioAdmin.save();
      
      console.log(`✅ ${usuarioAdmin.name} ahora es ADMINISTRADOR`);
      
      // Crear un usuario de cada rol para pruebas completas
      console.log('\n🎯 Asignando roles variados para pruebas...');
      
      if (usuarios.length > 1) {
        usuarios[1].role = UserRole.MECANICO;
        await usuarios[1].save();
        console.log(`✅ ${usuarios[1].name} ahora es MECÁNICO`);
      }
      
      // Estadísticas finales
      const usuariosPorRol = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);

      console.log('\n📊 Configuración final de roles:');
      usuariosPorRol.forEach(grupo => {
        console.log(`  - ${grupo._id}: ${grupo.count}`);
      });

      console.log('\n🎉 ¡Sistema de roles configurado exitosamente!');
      console.log('✨ Ahora puedes probar todas las funcionalidades:');
      console.log('  - Acceso al dashboard con diferentes roles');
      console.log('  - Cambio de roles desde la interfaz de administración');
      console.log('  - Restricciones de permisos por rol');
      
    } else {
      console.log('⚠️ No hay usuarios para configurar');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Ejecutar configuración
configurarAdministrador();