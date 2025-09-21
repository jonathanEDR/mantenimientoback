import mongoose from 'mongoose';
import User from '../models/User';

async function actualizarClerkId() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    const email = 'edjonathan5@gmail.com';
    const nuevoClerkId = 'user_32mztGbKipp1tCC9u5lMIxNNFeU';
    
    console.log(`🔍 Buscando usuario con email: ${email}`);
    
    const usuario = await User.findOne({ email });
    
    if (usuario) {
      console.log(`✅ Usuario encontrado: ${usuario.name}`);
      console.log(`📋 ClerkId actual: ${usuario.clerkId}`);
      console.log(`🔄 Actualizando a nuevo ClerkId: ${nuevoClerkId}`);
      
      usuario.clerkId = nuevoClerkId;
      await usuario.save();
      
      console.log('✅ ClerkId actualizado exitosamente');
      console.log(`👤 Usuario: ${usuario.name} (${usuario.role})`);
      
    } else {
      console.log('❌ Usuario no encontrado con ese email');
    }

    // Verificar que no haya usuarios duplicados
    const usuariosConEmail = await User.find({ email });
    console.log(`\n📊 Usuarios con email ${email}: ${usuariosConEmail.length}`);
    
    usuariosConEmail.forEach((u, index) => {
      console.log(`  ${index + 1}. ${u.name} - ${u.clerkId} - ${u.role}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

actualizarClerkId();