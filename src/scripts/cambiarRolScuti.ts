import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';

async function cambiarRolUsuario() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Cambiar Scuti Company a MECÁNICO para que pueda ver gestión de personal
    const usuario = await User.findOne({ name: 'Scuti Company' });
    
    if (usuario) {
      const rolAnterior = usuario.role;
      usuario.role = UserRole.MECANICO;
      await usuario.save();
      
      console.log(`✅ Usuario ${usuario.name} cambiado de ${rolAnterior} a ${usuario.role}`);
      console.log('🎯 Ahora debería poder ver "Gestión de Personal" en el sidebar');
    } else {
      console.log('❌ Usuario Scuti Company no encontrado');
    }

    // Mostrar estado final
    const todosUsuarios = await User.find({});
    console.log('\n📊 Estado actual de usuarios:');
    todosUsuarios.forEach(u => {
      console.log(`  - ${u.name}: ${u.role}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

cambiarRolUsuario();