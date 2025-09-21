import mongoose from 'mongoose';
import User from '../models/User';

async function verificarUsuarioPorClerkId() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Estos son los clerkIds que vemos en el frontend y en los logs
    const clerkIds = [
      'user_32eNmMdenJTEKe558HKybp9gTiO', // SCUTI COMPANY - debería ser ADMINISTRADOR
      'user_32n0uQ7b2REQKi3F2B9C9FwGNXy', // Scuti Company - ESPECIALISTA
      'user_32mztGbKipp1tCC9u5lMIxNNFeU'  // jonathan Elias Delgado - ESPECIALISTA
    ];

    console.log('\n🔍 Verificando usuarios por Clerk ID...\n');

    for (const clerkId of clerkIds) {
      console.log(`📋 Buscando: ${clerkId}`);
      const usuario = await User.findOne({ clerkId });
      
      if (usuario) {
        console.log(`✅ Encontrado:`);
        console.log(`   - Nombre: ${usuario.name}`);
        console.log(`   - Email: ${usuario.email}`);
        console.log(`   - Rol: ${usuario.role}`);
        console.log(`   - ID BD: ${usuario._id}`);
      } else {
        console.log(`❌ No encontrado`);
      }
      console.log('---');
    }

    // Mostrar todos los usuarios para comparar
    console.log('\n📊 TODOS LOS USUARIOS EN LA BD:');
    const todosUsuarios = await User.find({});
    todosUsuarios.forEach((usuario, index) => {
      console.log(`${index + 1}. ${usuario.name}`);
      console.log(`   Email: ${usuario.email}`);
      console.log(`   Rol: ${usuario.role}`);
      console.log(`   Clerk ID: ${usuario.clerkId}`);
      console.log(`   ID BD: ${usuario._id}`);
      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

verificarUsuarioPorClerkId();