import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';

async function conectarDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/invmant';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function testRolPorDefecto() {
  await conectarDB();

  try {
    console.log('🧪 Probando rol por defecto para nuevos usuarios...');

    // Crear usuario sin especificar rol (debería usar ESPECIALISTA por defecto)
    const nuevoUsuario = new User({
      clerkId: 'test_default_role_001',
      name: 'Usuario de Prueba',
      email: 'test@default.com'
      // Nota: NO especificamos el rol para probar el default
    });

    await nuevoUsuario.save();
    console.log(`✅ Usuario creado: ${nuevoUsuario.name}`);
    console.log(`🎯 Rol asignado automáticamente: ${nuevoUsuario.role}`);

    // Verificar que el rol sea ESPECIALISTA
    if (nuevoUsuario.role === UserRole.ESPECIALISTA) {
      console.log('✅ ¡CORRECTO! El rol por defecto es ESPECIALISTA');
    } else {
      console.log(`❌ ERROR: Se esperaba ESPECIALISTA pero se obtuvo ${nuevoUsuario.role}`);
    }

    // Limpiar usuario de prueba
    await User.deleteOne({ clerkId: 'test_default_role_001' });
    console.log('🧹 Usuario de prueba eliminado');

  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar prueba
testRolPorDefecto();