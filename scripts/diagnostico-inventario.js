/**
 * SCRIPT DE DIAGNÓSTICO COMPLETO - MÓDULO DE INVENTARIO
 *
 * Este script detecta y soluciona problemas comunes:
 * 1. Índices rotos o faltantes en MongoDB
 * 2. Registros duplicados de matrícula
 * 3. Referencias huérfanas a componentes
 * 4. Inconsistencias en datos
 * 5. Problemas de validación
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.magenta}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}\n`)
};

// Conectar a MongoDB
async function conectarDB() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
    await mongoose.connect(MONGODB_URI);
    log.success('Conectado a MongoDB: ' + MONGODB_URI);
    return mongoose.connection.db;
  } catch (error) {
    log.error('Error al conectar a MongoDB: ' + error.message);
    process.exit(1);
  }
}

// 1. VERIFICAR ÍNDICES
async function verificarIndices(db) {
  log.title('1. VERIFICACIÓN DE ÍNDICES');

  const colecciones = {
    'aeronaves': [
      { key: { matricula: 1 }, name: 'matricula_1', unique: true },
      { key: { estado: 1, createdAt: -1 }, name: 'estado_1_createdAt_-1' },
      { key: { tipo: 1, estado: 1 }, name: 'tipo_1_estado_1' }
    ],
    'componentes': [
      { key: { numeroSerie: 1 }, name: 'numeroSerie_1', unique: true },
      { key: { aeronaveActual: 1, estado: 1 }, name: 'aeronaveActual_1_estado_1' },
      { key: { categoria: 1, estado: 1 }, name: 'categoria_1_estado_1' },
      { key: { alertasActivas: 1, proximaInspeccion: 1 }, name: 'alertasActivas_1_proximaInspeccion_1' }
    ]
  };

  const problemas = [];
  const soluciones = [];

  for (const [coleccion, indicesRequeridos] of Object.entries(colecciones)) {
    log.info(`Verificando colección: ${coleccion}`);

    try {
      const indicesActuales = await db.collection(coleccion).indexes();
      const nombresActuales = indicesActuales.map(idx => idx.name);

      for (const indiceRequerido of indicesRequeridos) {
        const existe = nombresActuales.includes(indiceRequerido.name);

        if (!existe) {
          log.warning(`  ✗ Índice faltante: ${indiceRequerido.name}`);
          problemas.push({
            tipo: 'INDICE_FALTANTE',
            coleccion,
            indice: indiceRequerido.name,
            detalle: indiceRequerido
          });

          // Crear el índice automáticamente
          try {
            await db.collection(coleccion).createIndex(
              indiceRequerido.key,
              {
                name: indiceRequerido.name,
                unique: indiceRequerido.unique || false
              }
            );
            log.success(`  ✓ Índice creado: ${indiceRequerido.name}`);
            soluciones.push(`Índice ${indiceRequerido.name} creado en ${coleccion}`);
          } catch (err) {
            log.error(`  ✗ Error al crear índice ${indiceRequerido.name}: ${err.message}`);
            soluciones.push(`ERROR: No se pudo crear ${indiceRequerido.name} en ${coleccion}`);
          }
        } else {
          log.success(`  ✓ Índice OK: ${indiceRequerido.name}`);
        }
      }

      // Verificar índices rotos o duplicados
      log.info(`  Verificando integridad de índices en ${coleccion}...`);
      try {
        await db.collection(coleccion).validate({ full: true });
        log.success(`  ✓ Validación de colección OK`);
      } catch (err) {
        log.error(`  ✗ Problemas en la colección: ${err.message}`);
        problemas.push({
          tipo: 'COLECCION_CORRUPTA',
          coleccion,
          detalle: err.message
        });
      }

    } catch (error) {
      log.error(`Error verificando ${coleccion}: ${error.message}`);
      problemas.push({
        tipo: 'ERROR_VERIFICACION',
        coleccion,
        detalle: error.message
      });
    }
  }

  return { problemas, soluciones };
}

// 2. VERIFICAR DUPLICADOS DE MATRÍCULA
async function verificarDuplicados(db) {
  log.title('2. VERIFICACIÓN DE DUPLICADOS');

  const aeronaves = db.collection('aeronaves');

  try {
    // Buscar matrículas duplicadas
    const duplicados = await aeronaves.aggregate([
      {
        $group: {
          _id: '$matricula',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          docs: { $push: '$$ROOT' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    if (duplicados.length === 0) {
      log.success('No se encontraron matrículas duplicadas');
      return { problemas: [], soluciones: [] };
    }

    log.warning(`Se encontraron ${duplicados.length} matrículas duplicadas`);

    const problemas = [];
    const soluciones = [];

    for (const dup of duplicados) {
      log.error(`  Matrícula duplicada: ${dup._id} (${dup.count} veces)`);

      problemas.push({
        tipo: 'MATRICULA_DUPLICADA',
        matricula: dup._id,
        cantidad: dup.count,
        ids: dup.ids
      });

      // Mantener el más antiguo, eliminar los demás
      const [mantener, ...eliminar] = dup.docs.sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      );

      log.info(`    Manteniendo: ${mantener._id} (creado: ${mantener.createdAt})`);

      for (const doc of eliminar) {
        log.warning(`    Eliminando duplicado: ${doc._id} (creado: ${doc.createdAt})`);
        // await aeronaves.deleteOne({ _id: doc._id });
        soluciones.push(`RECOMENDACIÓN: Eliminar aeronave duplicada ${doc._id} con matrícula ${dup._id}`);
      }
    }

    return { problemas, soluciones };

  } catch (error) {
    log.error('Error verificando duplicados: ' + error.message);
    return {
      problemas: [{ tipo: 'ERROR_DUPLICADOS', detalle: error.message }],
      soluciones: []
    };
  }
}

// 3. VERIFICAR REFERENCIAS HUÉRFANAS
async function verificarReferencias(db) {
  log.title('3. VERIFICACIÓN DE REFERENCIAS');

  const aeronaves = db.collection('aeronaves');
  const componentes = db.collection('componentes');

  const problemas = [];
  const soluciones = [];

  try {
    // Obtener todos los IDs de aeronaves
    const idsAeronaves = await aeronaves.find({}, { projection: { _id: 1 } }).toArray();
    const idsValidosSet = new Set(idsAeronaves.map(a => a._id.toString()));

    log.info(`Total de aeronaves en BD: ${idsValidosSet.size}`);

    // Buscar componentes con aeronaveActual que no existe
    const componentesHuerfanos = await componentes.find({
      aeronaveActual: { $ne: null },
      $expr: { $ne: [{ $type: '$aeronaveActual' }, 'missing'] }
    }).toArray();

    let huerfanosCount = 0;

    for (const componente of componentesHuerfanos) {
      if (componente.aeronaveActual && !idsValidosSet.has(componente.aeronaveActual.toString())) {
        huerfanosCount++;
        log.warning(`  Componente huérfano: ${componente.numeroSerie} -> aeronave inexistente ${componente.aeronaveActual}`);

        problemas.push({
          tipo: 'REFERENCIA_HUERFANA',
          componente: componente.numeroSerie,
          aeronaveInexistente: componente.aeronaveActual
        });

        soluciones.push(`ACCIÓN: Limpiar referencia del componente ${componente.numeroSerie}`);

        // Opcional: Limpiar la referencia automáticamente
        // await componentes.updateOne(
        //   { _id: componente._id },
        //   { $set: { aeronaveActual: null, estado: 'EN_ALMACEN' } }
        // );
      }
    }

    if (huerfanosCount === 0) {
      log.success('No se encontraron referencias huérfanas');
    } else {
      log.warning(`Se encontraron ${huerfanosCount} componentes con referencias huérfanas`);
    }

    return { problemas, soluciones };

  } catch (error) {
    log.error('Error verificando referencias: ' + error.message);
    return {
      problemas: [{ tipo: 'ERROR_REFERENCIAS', detalle: error.message }],
      soluciones: []
    };
  }
}

// 4. VERIFICAR INTEGRIDAD DE DATOS
async function verificarIntegridad(db) {
  log.title('4. VERIFICACIÓN DE INTEGRIDAD DE DATOS');

  const aeronaves = db.collection('aeronaves');
  const problemas = [];
  const soluciones = [];

  try {
    // Buscar aeronaves con datos inválidos
    const todasAeronaves = await aeronaves.find({}).toArray();

    log.info(`Verificando ${todasAeronaves.length} aeronaves...`);

    for (const aeronave of todasAeronaves) {
      const errores = [];

      // Verificar matrícula
      if (!aeronave.matricula || aeronave.matricula.trim() === '') {
        errores.push('Matrícula vacía');
      }

      // Verificar año de fabricación
      const anoActual = new Date().getFullYear();
      if (aeronave.anoFabricacion < 1900 || aeronave.anoFabricacion > anoActual + 1) {
        errores.push(`Año inválido: ${aeronave.anoFabricacion}`);
      }

      // Verificar horas de vuelo
      if (aeronave.horasVuelo < 0 || isNaN(aeronave.horasVuelo)) {
        errores.push(`Horas de vuelo inválidas: ${aeronave.horasVuelo}`);
      }

      // Verificar estado
      const estadosValidos = ['Operativo', 'En Mantenimiento', 'Fuera de Servicio', 'En Reparación'];
      if (!estadosValidos.includes(aeronave.estado)) {
        errores.push(`Estado inválido: ${aeronave.estado}`);
      }

      // Verificar tipo
      const tiposValidos = ['Helicóptero', 'Avión'];
      if (!tiposValidos.includes(aeronave.tipo)) {
        errores.push(`Tipo inválido: ${aeronave.tipo}`);
      }

      if (errores.length > 0) {
        log.error(`  Aeronave ${aeronave.matricula} (${aeronave._id}):`);
        errores.forEach(err => log.error(`    - ${err}`));

        problemas.push({
          tipo: 'DATOS_INVALIDOS',
          aeronave: aeronave.matricula,
          id: aeronave._id,
          errores
        });

        soluciones.push(`Corregir datos de aeronave ${aeronave.matricula}: ${errores.join(', ')}`);
      }
    }

    if (problemas.length === 0) {
      log.success('Todos los datos son válidos');
    } else {
      log.warning(`Se encontraron ${problemas.length} aeronaves con datos inválidos`);
    }

    return { problemas, soluciones };

  } catch (error) {
    log.error('Error verificando integridad: ' + error.message);
    return {
      problemas: [{ tipo: 'ERROR_INTEGRIDAD', detalle: error.message }],
      soluciones: []
    };
  }
}

// 5. REPARAR ÍNDICE DE MATRÍCULA ROTO
async function repararIndiceMatricula(db) {
  log.title('5. REPARACIÓN DE ÍNDICE DE MATRÍCULA');

  const aeronaves = db.collection('aeronaves');
  const soluciones = [];

  try {
    log.info('Eliminando índice de matrícula existente...');

    try {
      await aeronaves.dropIndex('matricula_1');
      log.success('Índice de matrícula eliminado');
    } catch (err) {
      if (err.code === 27) { // Index not found
        log.info('Índice de matrícula no existía');
      } else {
        throw err;
      }
    }

    log.info('Recreando índice de matrícula único...');
    await aeronaves.createIndex(
      { matricula: 1 },
      { unique: true, name: 'matricula_1' }
    );
    log.success('Índice de matrícula recreado exitosamente');

    soluciones.push('Índice de matrícula recreado con éxito');

    return { problemas: [], soluciones };

  } catch (error) {
    log.error('Error reparando índice: ' + error.message);

    if (error.code === 11000) {
      log.error('ERROR: Existen matrículas duplicadas. Ejecute primero la verificación de duplicados.');
      return {
        problemas: [{
          tipo: 'ERROR_INDICE_DUPLICADOS',
          detalle: 'No se puede crear índice único debido a matrículas duplicadas'
        }],
        soluciones: ['Eliminar matrículas duplicadas antes de recrear el índice']
      };
    }

    return {
      problemas: [{ tipo: 'ERROR_REPARACION', detalle: error.message }],
      soluciones: []
    };
  }
}

// 6. GENERAR REPORTE COMPLETO
async function generarReporte(resultados) {
  log.title('REPORTE DE DIAGNÓSTICO');

  let totalProblemas = 0;
  let totalSoluciones = 0;

  console.log('\n' + colors.cyan + 'RESUMEN DE PROBLEMAS:' + colors.reset);
  console.log('─'.repeat(60));

  for (const [seccion, resultado] of Object.entries(resultados)) {
    const problemas = resultado.problemas || [];
    const soluciones = resultado.soluciones || [];

    totalProblemas += problemas.length;
    totalSoluciones += soluciones.length;

    if (problemas.length > 0) {
      console.log(`\n${colors.yellow}${seccion}:${colors.reset}`);
      problemas.forEach((p, i) => {
        console.log(`  ${i + 1}. [${p.tipo}] ${JSON.stringify(p, null, 2)}`);
      });
    }
  }

  console.log('\n' + colors.green + 'SOLUCIONES APLICADAS/RECOMENDADAS:' + colors.reset);
  console.log('─'.repeat(60));

  for (const [seccion, resultado] of Object.entries(resultados)) {
    const soluciones = resultado.soluciones || [];

    if (soluciones.length > 0) {
      console.log(`\n${colors.green}${seccion}:${colors.reset}`);
      soluciones.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });
    }
  }

  console.log('\n' + colors.magenta + '─'.repeat(60) + colors.reset);
  console.log(`${colors.cyan}Total de problemas detectados: ${colors.yellow}${totalProblemas}${colors.reset}`);
  console.log(`${colors.cyan}Total de soluciones aplicadas: ${colors.green}${totalSoluciones}${colors.reset}`);
  console.log(colors.magenta + '─'.repeat(60) + colors.reset + '\n');

  if (totalProblemas === 0) {
    log.success('¡SISTEMA EN PERFECTO ESTADO! ✨');
  } else if (totalSoluciones >= totalProblemas) {
    log.success('Todos los problemas han sido corregidos o tienen soluciones recomendadas');
  } else {
    log.warning('Algunos problemas requieren atención manual');
  }
}

// FUNCIÓN PRINCIPAL
async function ejecutarDiagnostico() {
  console.log(colors.magenta + `
╔══════════════════════════════════════════════════════════╗
║         DIAGNÓSTICO COMPLETO - MÓDULO INVENTARIO         ║
║              Sistema de Mantenimiento Aeronaves          ║
╚══════════════════════════════════════════════════════════╝
  ` + colors.reset);

  const db = await conectarDB();

  const resultados = {
    'Índices': await verificarIndices(db),
    'Duplicados': await verificarDuplicados(db),
    'Referencias': await verificarReferencias(db),
    'Integridad': await verificarIntegridad(db)
  };

  // Si hay problemas de duplicados, ofrecer reparar el índice
  const hayDuplicados = resultados.Duplicados.problemas.length > 0;

  if (!hayDuplicados) {
    log.info('\nNo hay duplicados. Verificando estado del índice de matrícula...');
    resultados['Reparación Índice'] = await repararIndiceMatricula(db);
  } else {
    log.warning('\n⚠ Se detectaron duplicados. Resuelva los duplicados antes de reparar índices.');
  }

  await generarReporte(resultados);

  await mongoose.connection.close();
  log.success('\nConexión a MongoDB cerrada');

  process.exit(0);
}

// Ejecutar
ejecutarDiagnostico().catch(err => {
  log.error('Error fatal: ' + err.message);
  console.error(err);
  process.exit(1);
});
