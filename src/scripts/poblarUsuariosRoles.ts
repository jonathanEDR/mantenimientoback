import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';
import { config } from 'dotenv';

// Cargar variables de entorno
config();

// Usuarios de ejemplo con diferentes roles
const usuariosEjemplo = [
  {
    clerkId: 'user_admin_example',
    name: 'Admin Principal',
    email: 'admin@aviation.com',
    role: UserRole.ADMINISTRADOR
  },
  {
    clerkId: 'user_mech_example_1',
    name: 'Juan Carlos Méndez',
    email: 'jmendez@aviation.com',
    role: UserRole.MECANICO
  },
  {
    clerkId: 'user_mech_example_2',
    name: 'María Elena González',
    email: 'mgonzalez@aviation.com',
    role: UserRole.MECANICO
  },
  {
    clerkId: 'user_pilot_example_1',
    name: 'Capitán Roberto Silva',
    email: 'rsilva@aviation.com',
    role: UserRole.COPILOTO
  },
  {
    clerkId: 'user_pilot_example_2',
    name: 'Ana Lucía Torres',
    email: 'atorres@aviation.com',
    role: UserRole.COPILOTO
  },
  {
    clerkId: 'user_spec_example_1',
    name: 'Dr. Carlos Avionic',
    email: 'cavionic@aviation.com',
    role: UserRole.ESPECIALISTA
  },
  {
    clerkId: 'user_spec_example_2',
    name: 'Ing. Patricia NDT',
    email: 'pndt@aviation.com',
    role: UserRole.ESPECIALISTA
  }
];

async function poblarUsuarios() {
  try {
    console.log('🔄 Iniciando población de usuarios con roles...');

    // Conectar a MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mantenimiento';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existen usuarios
    const usuariosExistentes = await User.countDocuments();
    console.log(`📊 Usuarios existentes en la base de datos: ${usuariosExistentes}`);

    // Crear o actualizar usuarios de ejemplo
    for (const usuarioData of usuariosEjemplo) {
      try {
        const usuarioExistente = await User.findOne({ clerkId: usuarioData.clerkId });
        
        if (usuarioExistente) {
          // Actualizar rol si es diferente
          if (usuarioExistente.role !== usuarioData.role) {
            await User.updateOne(
              { clerkId: usuarioData.clerkId },
              { role: usuarioData.role }
            );
            console.log(`🔄 Actualizado rol de ${usuarioData.name}: ${usuarioExistente.role} -> ${usuarioData.role}`);
          } else {
            console.log(`✅ Usuario ${usuarioData.name} ya existe con el rol correcto: ${usuarioData.role}`);
          }
        } else {
          // Crear nuevo usuario
          const nuevoUsuario = new User(usuarioData);
          await nuevoUsuario.save();
          console.log(`➕ Creado nuevo usuario: ${usuarioData.name} (${usuarioData.role})`);
        }
      } catch (error) {
        console.error(`❌ Error procesando usuario ${usuarioData.name}:`, error);
      }
    }

    // Mostrar estadísticas finales
    console.log('\n📈 Estadísticas finales de usuarios por rol:');
    for (const role of Object.values(UserRole)) {
      const count = await User.countDocuments({ role });
      console.log(`   ${role}: ${count} usuarios`);
    }

    const totalUsuarios = await User.countDocuments();
    console.log(`\n🎯 Total de usuarios en la base de datos: ${totalUsuarios}`);

    // Mostrar información sobre permisos
    console.log('\n🔐 Información de roles y permisos:');
    console.log('   ADMINISTRADOR: Control total del sistema, gestión de usuarios');
    console.log('   MECANICO: Gestión completa de mantenimiento, componentes y órdenes');
    console.log('   ESPECIALISTA: Permisos para inspecciones y certificaciones');
    console.log('   COPILOTO: Solo lectura en dashboards y reportes');

    console.log('\n✅ Población de usuarios completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en la población de usuarios:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  poblarUsuarios()
    .then(() => {
      console.log('🎉 Script de población completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error ejecutando script:', error);
      process.exit(1);
    });
}

export default poblarUsuarios;