import mongoose from 'mongoose';
import User from '../models/User';

async function buscarUsuario() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    const clerkId = 'user_32mztGbKipp1tCC9u5lMIxNNFeU';
    console.log(`🔍 Buscando usuario con clerkId: ${clerkId}`);
    
    const usuario = await User.findOne({ clerkId });
    
    if (usuario) {
      console.log('✅ Usuario encontrado:');
      console.log(`  - Nombre: ${usuario.name}`);
      console.log(`  - Email: ${usuario.email}`);
      console.log(`  - Rol: ${usuario.role}`);
    } else {
      console.log('❌ Usuario NO encontrado en la base de datos');
      console.log('📋 Usuarios existentes:');
      
      const todosUsuarios = await User.find({});
      todosUsuarios.forEach(u => {
        console.log(`  - ${u.name} (${u.clerkId})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

buscarUsuario();