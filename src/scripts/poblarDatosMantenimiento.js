const mongoose = require('mongoose');
const Aeronave = require('../models/Aeronave');
const Componente = require('../models/Componente');
const OrdenTrabajo = require('../models/OrdenTrabajo');
const Inspeccion = require('../models/Inspeccion');

// Datos de ejemplo para componentes
const componentesEjemplo = [
  {
    numeroSerie: 'MOT-001-2023',
    numeroParte: 'PT6A-114A',
    nombre: 'Motor Principal Derecho',
    categoria: 'MOTOR_PRINCIPAL',
    fabricante: 'Pratt & Whitney',
    fechaFabricacion: new Date('2023-01-15'),
    fechaInstalacion: new Date('2023-03-01'),
    estado: 'INSTALADO',
    vidaUtil: [
      {
        limite: 5000,
        unidad: 'HORAS',
        acumulado: 1250
      }
    ],
    mantenimientosProgramados: [
      {
        tipo: 'Inspección 100H',
        proximoVencimiento: new Date('2025-10-15'),
        horasProximoVencimiento: 1300,
        alertaAnticipada: 25,
        estado: 'VIGENTE'
      }
    ]
  },
  {
    numeroSerie: 'FUS-002-2022',
    numeroParte: 'AS350-FUS-001',
    nombre: 'Fuselaje Principal',
    categoria: 'FUSELAJE',
    fabricante: 'Airbus Helicopters',
    fechaFabricacion: new Date('2022-06-10'),
    fechaInstalacion: new Date('2022-08-15'),
    estado: 'INSTALADO',
    vidaUtil: [
      {
        limite: 20000,
        unidad: 'HORAS',
        acumulado: 2100
      }
    ],
    mantenimientosProgramados: [
      {
        tipo: 'Inspección Estructural',
        proximoVencimiento: new Date('2025-11-01'),
        horasProximoVencimiento: 2500,
        alertaAnticipada: 50,
        estado: 'VIGENTE'
      }
    ]
  },
  {
    numeroSerie: 'TRP-003-2023',
    numeroParte: 'AS350-TRP-MAIN',
    nombre: 'Transmisión Principal',
    categoria: 'TRANSMISION_PRINCIPAL',
    fabricante: 'Airbus Helicopters',
    fechaFabricacion: new Date('2023-02-20'),
    fechaInstalacion: new Date('2023-04-10'),
    estado: 'INSTALADO',
    vidaUtil: [
      {
        limite: 4000,
        unidad: 'HORAS',
        acumulado: 980
      }
    ],
    mantenimientosProgramados: [
      {
        tipo: 'Overhaul Transmisión',
        proximoVencimiento: new Date('2025-12-15'),
        horasProximoVencimiento: 1200,
        alertaAnticipada: 100,
        estado: 'VIGENTE'
      }
    ]
  },
  {
    numeroSerie: 'AVN-004-2023',
    numeroParte: 'GARMIN-G500H',
    nombre: 'Sistema Aviónica GARMIN',
    categoria: 'INSTRUMENTACION',
    fabricante: 'Garmin',
    fechaFabricacion: new Date('2023-03-05'),
    fechaInstalacion: new Date('2023-05-20'),
    estado: 'INSTALADO',
    vidaUtil: [
      {
        limite: 10000,
        unidad: 'HORAS',
        acumulado: 750
      }
    ],
    mantenimientosProgramados: [
      {
        tipo: 'Actualización Software',
        proximoVencimiento: new Date('2025-09-30'),
        alertaAnticipada: 30,
        estado: 'PROXIMO'
      }
    ]
  },
  {
    numeroSerie: 'HID-005-2022',
    numeroParte: 'AS350-HYD-SYS',
    nombre: 'Sistema Hidráulico',
    categoria: 'SISTEMA_HIDRAULICO',
    fabricante: 'Airbus Helicopters',
    fechaFabricacion: new Date('2022-11-12'),
    fechaInstalacion: new Date('2023-01-08'),
    estado: 'EN_REPARACION',
    vidaUtil: [
      {
        limite: 6000,
        unidad: 'HORAS',
        acumulado: 1800
      }
    ],
    mantenimientosProgramados: [
      {
        tipo: 'Reemplazo Filtros',
        proximoVencimiento: new Date('2025-10-01'),
        horasProximoVencimiento: 2000,
        alertaAnticipada: 25,
        estado: 'VENCIDO'
      }
    ]
  }
];

// Datos de ejemplo para órdenes de trabajo
const ordenesTrabajoEjemplo = [
  {
    numeroOrden: 'OT-2025-001',
    titulo: 'Inspección 100H Motor Principal',
    descripcion: 'Realizar inspección programada de 100 horas al motor principal derecho según manual de mantenimiento',
    tipo: 'PREVENTIVO',
    prioridad: 'MEDIA',
    estado: 'PENDIENTE',
    fechaCreacion: new Date('2025-09-01'),
    fechaVencimiento: new Date('2025-10-15'),
    horasEstimadas: 8,
    materialesRequeridos: [
      {
        nombre: 'Filtro de aceite',
        numeroReferencia: 'PT6A-OIL-FILTER',
        cantidad: 1,
        disponible: true
      },
      {
        nombre: 'Aceite motor',
        numeroReferencia: 'MOBIL-JET-II',
        cantidad: 12,
        disponible: true
      }
    ],
    referenciaManual: 'MM-PT6A-114A Cap. 72',
    observaciones: 'Revisar especialmente el estado de las bujías y sistema de ignición'
  },
  {
    numeroOrden: 'OT-2025-002',
    titulo: 'Reparación Sistema Hidráulico',
    descripcion: 'Reparar fuga en sistema hidráulico detectada durante inspección diaria',
    tipo: 'CORRECTIVO',
    prioridad: 'ALTA',
    estado: 'EN_PROCESO',
    fechaCreacion: new Date('2025-09-10'),
    fechaInicio: new Date('2025-09-12'),
    fechaVencimiento: new Date('2025-09-20'),
    horasEstimadas: 12,
    horasReales: 8,
    tecnicoAsignado: 'Juan Pérez - Licencia A&P 12345',
    materialesRequeridos: [
      {
        nombre: 'Sello O-ring',
        numeroReferencia: 'AS350-HYD-SEAL-001',
        cantidad: 2,
        disponible: false
      },
      {
        nombre: 'Fluido hidráulico',
        numeroReferencia: 'SKYDROL-LD4',
        cantidad: 4,
        disponible: true
      }
    ],
    registrosTrabajo: [
      {
        fecha: new Date('2025-09-12'),
        tecnico: 'Juan Pérez',
        descripcion: 'Desmontaje panel acceso sistema hidráulico',
        tiempoTrabajo: 2
      },
      {
        fecha: new Date('2025-09-13'),
        tecnico: 'Juan Pérez',
        descripcion: 'Identificación fuga en conexión principal',
        tiempoTrabajo: 3
      },
      {
        fecha: new Date('2025-09-14'),
        tecnico: 'Juan Pérez',
        descripcion: 'Esperando repuestos - O-rings',
        tiempoTrabajo: 0
      }
    ],
    observaciones: 'Esperando llegada de sellos O-ring. ETA: 18/09/2025'
  },
  {
    numeroOrden: 'OT-2025-003',
    titulo: 'Actualización Software Aviónica',
    descripción: 'Actualizar software del sistema GARMIN G500H a versión más reciente',
    tipo: 'MODIFICACION',
    prioridad: 'BAJA',
    estado: 'COMPLETADA',
    fechaCreacion: new Date('2025-08-15'),
    fechaInicio: new Date('2025-08-20'),
    fechaFinalizacion: new Date('2025-08-22'),
    fechaVencimiento: new Date('2025-09-30'),
    horasEstimadas: 4,
    horasReales: 3.5,
    tecnicoAsignado: 'Maria González - Licencia Aviónica 67890',
    materialesRequeridos: [],
    registrosTrabajo: [
      {
        fecha: new Date('2025-08-20'),
        tecnico: 'Maria González',
        descripcion: 'Descarga e instalación software v15.2',
        tiempoTrabajo: 2
      },
      {
        fecha: new Date('2025-08-22'),
        tecnico: 'Maria González',
        descripcion: 'Pruebas funcionales y calibración',
        tiempoTrabajo: 1.5
      }
    ],
    certificacion: {
      certificadoPor: 'Maria González',
      numeroLicencia: '67890',
      fechaCertificacion: new Date('2025-08-22'),
      observacionesCertificacion: 'Actualización completada satisfactoriamente. Sistema operativo según especificaciones.'
    },
    observaciones: 'Actualización exitosa. Mejoras en rendimiento y nuevas funcionalidades disponibles.'
  },
  {
    numeroOrden: 'OT-2025-004',
    titulo: 'Inspección Estructural Fuselaje',
    descripcion: 'Inspección estructural programada del fuselaje según directiva AD',
    tipo: 'INSPECCION',
    prioridad: 'CRITICA',
    estado: 'PENDIENTE',
    fechaCreacion: new Date('2025-09-05'),
    fechaVencimiento: new Date('2025-11-01'),
    horasEstimadas: 16,
    directivaAD: 'AD-2024-AS350-001',
    materialesRequeridos: [
      {
        nombre: 'Líquido penetrante',
        numeroReferencia: 'NDT-DYE-PEN-001',
        cantidad: 2,
        disponible: true
      },
      {
        nombre: 'Revelador',
        numeroReferencia: 'NDT-DEVELOPER-001',
        cantidad: 2,
        disponible: true
      }
    ],
    referenciaManual: 'SRM-AS350 Cap. 53',
    observaciones: 'Cumplimiento obligatorio directiva AD. Requiere técnico certificado Nivel II NDT.'
  }
];

// Datos de ejemplo para inspecciones
const inspeccionesEjemplo = [
  {
    numeroInspeccion: 'INSP-2025-001',
    tipoInspeccion: 'DIARIA',
    fechaInspeccion: new Date('2025-09-15'),
    inspector: 'Carlos Rodriguez - Licencia A&P 11223',
    estado: 'COMPLETADA',
    itemsInspeccion: [
      {
        categoria: 'MOTOR_PRINCIPAL',
        descripcion: 'Verificar nivel aceite motor',
        estado: 'CONFORME',
        observaciones: 'Nivel aceite normal, sin fugas visibles'
      },
      {
        categoria: 'SISTEMA_HIDRAULICO',
        descripcion: 'Verificar nivel fluido hidráulico',
        estado: 'NO_CONFORME',
        observaciones: 'Nivel bajo, fuga detectada en conexión principal',
        accionRequerida: 'Generar OT para reparación fuga'
      },
      {
        categoria: 'TREN_ATERRIZAJE',
        descripcion: 'Inspección visual tren aterrizaje',
        estado: 'CONFORME',
        observaciones: 'Sin novedad, neumáticos en buen estado'
      }
    ],
    defectosEncontrados: [
      {
        descripcion: 'Fuga sistema hidráulico',
        severidad: 'CRITICA',
        ubicacion: 'Conexión principal bomba hidráulica',
        accionTomada: 'OT-2025-002 generada para reparación'
      }
    ],
    observacionesGenerales: 'Aeronave en condiciones generales buenas. Atender urgente fuga hidráulica.',
    proximaInspeccion: new Date('2025-09-16')
  },
  {
    numeroInspeccion: 'INSP-2025-002',
    tipoInspeccion: '100H',
    fechaInspeccion: new Date('2025-08-30'),
    inspector: 'Ana Martinez - Licencia A&P 33445',
    estado: 'COMPLETADA',
    itemsInspeccion: [
      {
        categoria: 'MOTOR_PRINCIPAL',
        descripcion: 'Inspección compresores',
        estado: 'CONFORME',
        observaciones: 'Compresores dentro de parámetros normales'
      },
      {
        categoria: 'TRANSMISION_PRINCIPAL',
        descripcion: 'Análisis vibraciones transmisión',
        estado: 'CONFORME',
        observaciones: 'Vibraciones dentro de límites permitidos'
      },
      {
        categoria: 'CUBO_ROTOR_PRINCIPAL',
        descripcion: 'Inspección visual cubo rotor',
        estado: 'CONFORME',
        observaciones: 'Sin grietas o deformaciones visibles'
      },
      {
        categoria: 'PALAS_ROTOR_PRINCIPAL',
        descripcion: 'Inspección palas rotor principal',
        estado: 'CONFORME',
        observaciones: 'Palas en buen estado, balanceadas correctamente'
      }
    ],
    defectosEncontrados: [],
    observacionesGenerales: 'Inspección 100H completada satisfactoriamente. Aeronave apta para servicio.',
    proximaInspeccion: new Date('2025-11-30')
  }
];

async function poblarDatosEjemplo() {
  try {
    console.log('🚀 Iniciando población de datos de ejemplo...');

    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/invmant');
    console.log('✅ Conectado a MongoDB');

    // Obtener aeronaves existentes
    const aeronaves = await Aeronave.find({});
    if (aeronaves.length === 0) {
      console.log('❌ No se encontraron aeronaves. Primero crea aeronaves en el módulo de inventario.');
      return;
    }

    console.log(`📊 Encontradas ${aeronaves.length} aeronaves en el sistema`);

    // Asignar aeronaves a los componentes
    for (let i = 0; i < componentesEjemplo.length; i++) {
      const aeronave = aeronaves[i % aeronaves.length];
      componentesEjemplo[i].aeronaveActual = aeronave._id.toString();
      componentesEjemplo[i].historialUso = [{
        fechaInstalacion: componentesEjemplo[i].fechaInstalacion.toISOString(),
        aeronaveId: aeronave._id.toString(),
        horasIniciales: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
    }

    // Crear componentes
    console.log('🔧 Creando componentes de ejemplo...');
    const componentesCreados = [];
    for (const componenteData of componentesEjemplo) {
      const componente = new Componente(componenteData);
      const componenteGuardado = await componente.save();
      componentesCreados.push(componenteGuardado);
      console.log(`   ✓ Componente creado: ${componenteData.nombre}`);
    }

    // Asignar aeronaves y componentes a las órdenes de trabajo
    for (let i = 0; i < ordenesTrabajoEjemplo.length; i++) {
      const aeronave = aeronaves[i % aeronaves.length];
      const componente = componentesCreados[i % componentesCreados.length];
      
      ordenesTrabajoEjemplo[i].aeronave = aeronave._id.toString();
      ordenesTrabajoEjemplo[i].componente = componente._id.toString();
    }

    // Crear órdenes de trabajo
    console.log('📋 Creando órdenes de trabajo de ejemplo...');
    const ordenesCreadas = [];
    for (const ordenData of ordenesTrabajoEjemplo) {
      const orden = new OrdenTrabajo(ordenData);
      const ordenGuardada = await orden.save();
      ordenesCreadas.push(ordenGuardada);
      console.log(`   ✓ Orden de trabajo creada: ${ordenData.numeroOrden}`);
    }

    // Asignar aeronaves a las inspecciones
    for (let i = 0; i < inspeccionesEjemplo.length; i++) {
      const aeronave = aeronaves[i % aeronaves.length];
      inspeccionesEjemplo[i].aeronave = aeronave._id.toString();
    }

    // Crear inspecciones
    console.log('🔍 Creando inspecciones de ejemplo...');
    for (const inspeccionData of inspeccionesEjemplo) {
      const inspeccion = new Inspeccion(inspeccionData);
      const inspeccionGuardada = await inspeccion.save();
      console.log(`   ✓ Inspección creada: ${inspeccionData.numeroInspeccion}`);
    }

    console.log('\n🎉 ¡Datos de ejemplo creados exitosamente!');
    console.log('\n📊 Resumen de datos creados:');
    console.log(`   • ${componentesCreados.length} componentes`);
    console.log(`   • ${ordenesCreadas.length} órdenes de trabajo`);
    console.log(`   • ${inspeccionesEjemplo.length} inspecciones`);
    
    console.log('\n🚀 Puedes probar las siguientes funcionalidades:');
    console.log('   • Dashboard de mantenimiento: Ver estadísticas y alertas');
    console.log('   • Gestión de componentes: Crear, editar y gestionar componentes');
    console.log('   • Órdenes de trabajo: Ver detalles y gestionar órdenes');
    console.log('   • APIs: Todas las APIs tienen datos para probar');

  } catch (error) {
    console.error('❌ Error al poblar datos de ejemplo:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Desconectado de MongoDB');
  }
}

module.exports = { poblarDatosEjemplo };

// Si se ejecuta directamente
if (require.main === module) {
  poblarDatosEjemplo();
}