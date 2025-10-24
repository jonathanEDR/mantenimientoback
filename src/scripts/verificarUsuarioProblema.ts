import User from '../models/User';
import { connectDB } from '../utils/db';

async function verificarUsuarioProblema() {
  try {
    await connectDB();
    console.log('🔍 Buscando usuarios en la base de datos...');
    
    // Todos los usuarios
    const usuarios = await User.find({}).select('name email clerkId role isActive');
    
    console.log('📋 Usuarios encontrados:', usuarios.length);
    usuarios.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   - ClerkId: ${user.clerkId}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Activo: ${user.isActive}`);
      console.log('');
    });
    
    // Buscar específicamente el email problemático
    const usuarioProblema = await User.findOne({ email: 'gscutic@gmail.com' });
    if (usuarioProblema) {
      console.log('🔍 Usuario problemático encontrado:');
      console.log('   Email:', usuarioProblema.email);
      console.log('   ClerkId:', usuarioProblema.clerkId || 'NO TIENE');
      console.log('   Activo:', usuarioProblema.isActive);
      console.log('   Role:', usuarioProblema.role);
      
      if (!usuarioProblema.clerkId) {
        console.log('⚠️ PROBLEMA: Usuario sin clerkId - esto causa el error 500');
      }
    } else {
      console.log('❌ Usuario gscutic@gmail.com NO encontrado en BD');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

verificarUsuarioProblema();