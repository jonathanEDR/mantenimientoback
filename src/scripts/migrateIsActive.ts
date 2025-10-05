import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../utils/db';
import User from '../models/User';
import logger from '../utils/logger';

// Cargar variables de entorno
dotenv.config();

/**
 * Script de migración única para agregar el campo isActive a usuarios existentes
 * Uso: npm run migrate-isactive
 */

async function migrateIsActive() {
  try {
    console.log('🔄 Iniciando migración del campo isActive...\n');

    // Conectar a la base de datos
    await connectDB();
    console.log('✅ Conectado a MongoDB\n');

    // Buscar usuarios sin el campo isActive o con valor null/undefined
    const usuariosSinIsActive = await User.find({
      $or: [
        { isActive: { $exists: false } },
        { isActive: null }
      ]
    });

    if (usuariosSinIsActive.length === 0) {
      console.log('✅ Todos los usuarios ya tienen el campo isActive definido');
      console.log('📊 No se requiere migración\n');
      await disconnectDB();
      return;
    }

    console.log(`📊 Usuarios encontrados sin isActive: ${usuariosSinIsActive.length}\n`);

    // Migrar cada usuario
    let migrados = 0;
    let errores = 0;

    for (const usuario of usuariosSinIsActive) {
      try {
        console.log(`  Migrando: ${usuario.email || usuario.clerkId || usuario._id}`);

        usuario.isActive = true;
        await usuario.save();

        migrados++;
        console.log(`    ✅ Migrado exitosamente`);
      } catch (error) {
        errores++;
        console.error(`    ❌ Error migrando usuario:`, error);
        logger.error(`Error migrando usuario ${usuario._id}:`, error);
      }
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`Total de usuarios procesados: ${usuariosSinIsActive.length}`);
    console.log(`  ✅ Migrados exitosamente:   ${migrados}`);
    console.log(`  ❌ Errores:                 ${errores}\n`);

    if (migrados > 0) {
      console.log('✅ Migración completada exitosamente');
      console.log('💡 Ahora puedes remover el código de migración automática en roleAuth.ts\n');
    }

    if (errores > 0) {
      console.log('⚠️  Algunos usuarios no pudieron ser migrados');
      console.log('📋 Revisa los logs para más detalles\n');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    logger.error('Error en migrateIsActive:', error);
  } finally {
    await disconnectDB();
    console.log('👋 Desconectado de MongoDB');
  }
}

// Ejecutar el script
migrateIsActive()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
