import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';

// Conectar a MongoDB
async function conectarDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

// Usuarios de ejemplo con diferentes roles
const usuariosEjemplo = [
  {
    clerkId: 'user_admin_example_001',
    name: 'María González',
    email: 'admin@inventario.com',
    role: UserRole.ADMINISTRADOR
  },
  {
    clerkId: 'user_mech_example_002',
    name: 'Carlos Rodríguez',
    email: 'mecanico@inventario.com',
    role: UserRole.MECANICO
  },
  {
    clerkId: 'user_pilot_example_003',
    name: 'Ana López',
    email: 'copiloto@inventario.com',
    role: UserRole.COPILOTO
  },
  {
    clerkId: 'user_spec_example_004',
    name: 'Luis Martínez',
    email: 'especialista@inventario.com',
    role: UserRole.ESPECIALISTA
  },
  {
    clerkId: 'user_spec_example_005',
    name: 'Elena Vásquez',
    email: 'especialista2@inventario.com',
    role: UserRole.ESPECIALISTA // Rol por defecto
  }
];

async function poblarUsuarios() {
  await conectarDB();

  try {
    console.log('🚀 Iniciando población de usuarios de ejemplo...');

    // Verificar usuarios existentes
    const usuariosExistentes = await User.find({});
    console.log(`📊 Usuarios existentes: ${usuariosExistentes.length}`);

    // Solo crear usuarios de ejemplo si no existen usuarios con esos clerkIds
    for (const usuarioData of usuariosEjemplo) {
      const usuarioExistente = await User.findOne({ clerkId: usuarioData.clerkId });
      
      if (!usuarioExistente) {
        const nuevoUsuario = new User(usuarioData);
        await nuevoUsuario.save();
        console.log(`✅ Usuario creado: ${usuarioData.name} (${usuarioData.role})`);
      } else {
        console.log(`⚠️ Usuario ya existe: ${usuarioData.name}`);
      }
    }

    // Mostrar resumen final
    const totalUsuarios = await User.countDocuments();
    const usuariosPorRol = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 RESUMEN DE USUARIOS:');
    console.log(`Total usuarios: ${totalUsuarios}`);
    console.log('Usuarios por rol:');
    usuariosPorRol.forEach(grupo => {
      console.log(`  - ${grupo._id}: ${grupo.count}`);
    });

    console.log('\n✅ Población de usuarios completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error poblando usuarios:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  poblarUsuarios();
}

export { poblarUsuarios };