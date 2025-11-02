import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../utils/db';
import User, { UserRole } from '../models/User';
import logger from '../utils/logger';

// Cargar variables de entorno
dotenv.config();

/**
 * Script para verificar y diagnosticar usuarios en MongoDB
 * Uso: npm run verify-users
 */

interface UserStats {
  total: number;
  activos: number;
  inactivos: number;
  porRol: Record<UserRole, number>;
  sinClerkId: number;
  sinEmail: number;
  sinIsActive: number;
}

async function verificarUsuarios() {
  try {
    console.log('🔍 Iniciando verificación de usuarios...\n');

    // Conectar a la base de datos
    await connectDB();
    console.log('✅ Conectado a MongoDB\n');

    // Obtener todos los usuarios
    const usuarios = await User.find({});
    console.log(`📊 Total de usuarios en la base de datos: ${usuarios.length}\n`);

    if (usuarios.length === 0) {
      console.log('⚠️  No hay usuarios en la base de datos');
      console.log('💡 Sugerencia: Registra un usuario a través de Clerk o usa el endpoint /auth/register\n');
      await disconnectDB();
      return;
    }

    // Calcular estadísticas
    const stats: UserStats = {
      total: usuarios.length,
      activos: 0,
      inactivos: 0,
      porRol: {
        [UserRole.ADMINISTRADOR]: 0,
        [UserRole.MECANICO]: 0,
        [UserRole.ESPECIALISTA]: 0,
        [UserRole.PILOTO]: 0
      },
      sinClerkId: 0,
      sinEmail: 0,
      sinIsActive: 0
    };

    // Analizar cada usuario
    const problemas: Array<{ usuario: string; problema: string }> = [];

    usuarios.forEach(usuario => {
      // Contar por estado
      if (usuario.isActive === true) {
        stats.activos++;
      } else if (usuario.isActive === false) {
        stats.inactivos++;
      } else {
        stats.sinIsActive++;
      }

      // Contar por rol
      if (usuario.role && Object.values(UserRole).includes(usuario.role)) {
        stats.porRol[usuario.role]++;
      }

      // Detectar problemas
      if (!usuario.clerkId) {
        stats.sinClerkId++;
        problemas.push({
          usuario: usuario.email || usuario._id.toString(),
          problema: 'Sin clerkId'
        });
      }

      if (!usuario.email) {
        stats.sinEmail++;
        problemas.push({
          usuario: usuario.clerkId || usuario._id.toString(),
          problema: 'Sin email'
        });
      }

      if (usuario.isActive === undefined || usuario.isActive === null) {
        problemas.push({
          usuario: usuario.email || usuario.clerkId || usuario._id.toString(),
          problema: 'Campo isActive no definido (migración pendiente)'
        });
      }
    });

    // Mostrar estadísticas
    console.log('═══════════════════════════════════════════════');
    console.log('📊 ESTADÍSTICAS DE USUARIOS');
    console.log('═══════════════════════════════════════════════\n');

    console.log(`Total de usuarios:     ${stats.total}`);
    console.log(`  ✅ Activos:          ${stats.activos}`);
    console.log(`  ❌ Inactivos:        ${stats.inactivos}`);
    console.log(`  ⚠️  Sin isActive:    ${stats.sinIsActive}\n`);

    console.log('👥 DISTRIBUCIÓN POR ROL:');
    console.log(`  🔑 Administradores:  ${stats.porRol[UserRole.ADMINISTRADOR]}`);
    console.log(`  🔧 Mecánicos:        ${stats.porRol[UserRole.MECANICO]}`);
    console.log(`  📋 Especialistas:    ${stats.porRol[UserRole.ESPECIALISTA]}`);
    console.log(`  ✈️  Pilotos:          ${stats.porRol[UserRole.PILOTO]}\n`);

    if (stats.sinClerkId > 0 || stats.sinEmail > 0) {
      console.log('⚠️  PROBLEMAS DE INTEGRIDAD:');
      console.log(`  Sin clerkId:         ${stats.sinClerkId}`);
      console.log(`  Sin email:           ${stats.sinEmail}\n`);
    }

    // Mostrar problemas detallados
    if (problemas.length > 0) {
      console.log('═══════════════════════════════════════════════');
      console.log('⚠️  PROBLEMAS DETECTADOS');
      console.log('═══════════════════════════════════════════════\n');

      problemas.forEach((p, index) => {
        console.log(`${index + 1}. Usuario: ${p.usuario}`);
        console.log(`   Problema: ${p.problema}\n`);
      });

      console.log('💡 Recomendaciones:');
      if (stats.sinIsActive > 0) {
        console.log('  - Ejecutar migración: npm run migrate-users');
      }
      if (stats.sinClerkId > 0) {
        console.log('  - Usuarios sin clerkId deben eliminarse o sincronizarse con Clerk');
      }
      if (stats.sinEmail > 0) {
        console.log('  - Usuarios sin email deben actualizarse manualmente');
      }
      console.log();
    }

    // Mostrar lista de usuarios (primeros 10)
    console.log('═══════════════════════════════════════════════');
    console.log('📋 LISTA DE USUARIOS (primeros 10)');
    console.log('═══════════════════════════════════════════════\n');

    usuarios.slice(0, 10).forEach((usuario, index) => {
      const usuarioObj: any = usuario.toObject();
      console.log(`${index + 1}. ${usuario.name || 'Sin nombre'}`);
      console.log(`   Email:     ${usuario.email || 'Sin email'}`);
      console.log(`   ClerkId:   ${usuario.clerkId ? usuario.clerkId.substring(0, 20) + '...' : 'Sin clerkId'}`);
      console.log(`   Rol:       ${usuario.role || 'Sin rol'}`);
      console.log(`   Estado:    ${usuario.isActive === true ? '✅ Activo' : usuario.isActive === false ? '❌ Inactivo' : '⚠️  No definido'}`);
      console.log(`   Creado:    ${usuarioObj.createdAt ? new Date(usuarioObj.createdAt).toLocaleDateString() : 'Desconocido'}`);
      console.log();
    });

    if (usuarios.length > 10) {
      console.log(`... y ${usuarios.length - 10} usuarios más\n`);
    }

    // Verificar si hay al menos un administrador activo
    const adminActivo = usuarios.find(u =>
      u.role === UserRole.ADMINISTRADOR && u.isActive === true
    );

    if (!adminActivo) {
      console.log('═══════════════════════════════════════════════');
      console.log('⚠️  ADVERTENCIA CRÍTICA');
      console.log('═══════════════════════════════════════════════\n');
      console.log('❌ No hay administradores activos en el sistema');
      console.log('💡 Asigna el rol de ADMINISTRADOR a al menos un usuario\n');
    }

    console.log('═══════════════════════════════════════════════');
    console.log('✅ Verificación completada');
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    logger.error('Error en verificarUsuarios:', error);
  } finally {
    await disconnectDB();
    console.log('👋 Desconectado de MongoDB');
  }
}

// Ejecutar el script
verificarUsuarios()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
