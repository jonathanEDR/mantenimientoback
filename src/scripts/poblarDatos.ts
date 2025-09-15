import mongoose from 'mongoose';
import Aeronave from '../models/Aeronave';
import Componente from '../models/Componente';
import OrdenTrabajo from '../models/OrdenTrabajo';
import Inspeccion from '../models/Inspeccion';

// Conectar a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB';
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

async function crearDatosEjemplo() {
  await conectarDB();

  try {
    console.log('🚀 Iniciando creación de datos de ejemplo...');

    // Verificar aeronaves existentes
    let aeronaves = await Aeronave.find({});
    
    if (aeronaves.length === 0) {
      console.log('📋 No se encontraron aeronaves. Creando aeronaves de ejemplo...');
      
      // Crear aeronaves de ejemplo
      const aeronavesData = [
        {
          matricula: 'HK-4123X',
          tipo: 'Helicóptero' as const,
          modelo: 'AS350 B3e',
          fabricante: 'Airbus Helicopters',
          anoFabricacion: 2023,
          estado: 'Operativo' as const,
          ubicacionActual: 'Hangar Principal',
          horasVuelo: 1250,
          observaciones: 'Helicóptero en excelente estado, mantenimiento al día'
        },
        {
          matricula: 'HK-5678Y',
          tipo: 'Helicóptero' as const,
          modelo: 'Bell 407',
          fabricante: 'Bell Helicopter',
          anoFabricacion: 2022,
          estado: 'Operativo' as const,
          ubicacionActual: 'Base Operacional Sur',
          horasVuelo: 2100,
          observaciones: 'Helicóptero para operaciones comerciales'
        },
        {
          matricula: 'HK-9012Z',
          tipo: 'Helicóptero' as const,
          modelo: 'AS355 N',
          fabricante: 'Airbus Helicopters',
          anoFabricacion: 2021,
          estado: 'En Mantenimiento' as const,
          ubicacionActual: 'Taller de Mantenimiento',
          horasVuelo: 3200,
          observaciones: 'En mantenimiento preventivo programado'
        }
      ];

      aeronaves = await Aeronave.insertMany(aeronavesData);
      console.log(`✈️ ${aeronaves.length} aeronaves creadas exitosamente`);
    }

    const aeronave = aeronaves[0]; // Usar la primera aeronave
    console.log(`📊 Usando aeronave: ${aeronave.matricula} - ${aeronave.modelo}`);

    // Limpiar datos existentes de mantenimiento
    await Componente.deleteMany({});
    await OrdenTrabajo.deleteMany({});
    await Inspeccion.deleteMany({});
    console.log('🧹 Datos de mantenimiento anteriores limpiados');

    // Crear componentes
    const componentesData = [
      {
        numeroSerie: 'MOT-001-2023',
        numeroParte: 'PT6A-114A',
        nombre: 'Motor Principal',
        categoria: 'MOTOR_PRINCIPAL',
        fabricante: 'Pratt & Whitney',
        fechaFabricacion: new Date('2023-01-15'),
        fechaInstalacion: new Date('2023-03-01'),
        aeronaveActual: aeronave.matricula,
        posicionInstalacion: 'Compartimento Motor #1',
        estado: 'INSTALADO',
        ubicacionFisica: 'Instalado en aeronave',
        vidaUtil: [{
          limite: 5000,
          unidad: 'HORAS',
          acumulado: 1250,
          restante: 3750
        }],
        historialUso: [],
        mantenimientoProgramado: [],
        certificaciones: {
          numeroFormulario8130: '8130-MOT-001',
          fechaEmision8130: new Date('2023-01-20'),
          autoridad: 'FAA'
        },
        alertasActivas: false
      },
      {
        numeroSerie: 'TRP-002-2023',
        numeroParte: 'AS350-TRP-MAIN',
        nombre: 'Transmisión Principal',
        categoria: 'TRANSMISION_PRINCIPAL',
        fabricante: 'Airbus Helicopters',
        fechaFabricacion: new Date('2023-02-20'),
        fechaInstalacion: new Date('2023-04-10'),
        aeronaveActual: aeronave.matricula,
        posicionInstalacion: 'Compartimento Transmisión',
        estado: 'INSTALADO',
        ubicacionFisica: 'Instalado en aeronave',
        vidaUtil: [{
          limite: 4000,
          unidad: 'HORAS',
          acumulado: 980,
          restante: 3020
        }],
        historialUso: [],
        mantenimientoProgramado: [],
        certificaciones: {
          numeroFormulario8130: '8130-TRP-002',
          fechaEmision8130: new Date('2023-02-25'),
          autoridad: 'EASA'
        },
        alertasActivas: false
      },
      {
        numeroSerie: 'HID-003-2022',
        numeroParte: 'AS350-HYD-SYS',
        nombre: 'Sistema Hidráulico',
        categoria: 'SISTEMA_HIDRAULICO',
        fabricante: 'Airbus Helicopters',
        fechaFabricacion: new Date('2022-11-10'),
        fechaInstalacion: new Date('2023-05-15'),
        aeronaveActual: aeronave.matricula,
        posicionInstalacion: 'Compartimento Central',
        estado: 'INSTALADO',
        ubicacionFisica: 'Instalado en aeronave',
        vidaUtil: [{
          limite: 3000,
          unidad: 'HORAS',
          acumulado: 750,
          restante: 2250
        }],
        historialUso: [],
        mantenimientoProgramado: [],
        certificaciones: {
          numeroFormulario8130: '8130-HID-003',
          fechaEmision8130: new Date('2022-11-15'),
          autoridad: 'EASA'
        },
        alertasActivas: false
      }
    ];

    const componentes = await Componente.insertMany(componentesData);
    console.log(`🔧 ${componentes.length} componentes creados`);

    // Crear órdenes de trabajo
    const ordenesData = [
      {
        numeroOrden: 'OT-2025-001',
        aeronave: aeronave._id,
        componente: componentes[0]._id,
        tipo: 'PREVENTIVO',
        titulo: 'Inspección 100H Motor Principal',
        descripcion: 'Realizar inspección programada de 100 horas al motor principal',
        prioridad: 'MEDIA',
        estado: 'PENDIENTE',
        fechaCreacion: new Date('2025-09-01'),
        fechaVencimiento: new Date('2025-10-15'),
        horasEstimadas: 8,
        materialesRequeridos: [{
          numeroParte: 'PT6A-OIL-FILTER',
          descripcion: 'Filtro de aceite para motor PT6A',
          cantidad: 1,
          unidad: 'PCS',
          disponible: true
        }],
        observaciones: 'Revisar especialmente el estado de las bujías'
      },
      {
        numeroOrden: 'OT-2025-002',
        aeronave: aeronave._id,
        componente: componentes[2]._id,
        tipo: 'CORRECTIVO',
        titulo: 'Reparación Sistema Hidráulico',
        descripcion: 'Reparar fuga en sistema hidráulico detectada durante inspección',
        prioridad: 'ALTA',
        estado: 'EN_PROCESO',
        fechaCreacion: new Date('2025-09-10'),
        fechaInicio: new Date('2025-09-12'),
        fechaVencimiento: new Date('2025-09-20'),
        horasEstimadas: 12,
        horasReales: 8,
        tecnicoAsignado: 'Juan Pérez - Licencia A&P 12345',
        materialesRequeridos: [{
          numeroParte: 'AS350-HYD-SEAL-001',
          descripcion: 'Sello O-ring para sistema hidráulico',
          cantidad: 2,
          unidad: 'PCS',
          disponible: false
        }],
        registrosTrabajo: [],
        observaciones: 'Esperando llegada de sellos O-ring'
      },
      {
        numeroOrden: 'OT-2025-003',
        aeronave: aeronave._id,
        tipo: 'MODIFICACION',
        titulo: 'Actualización Software Aviónica',
        descripcion: 'Actualizar software del sistema GARMIN G500H',
        prioridad: 'BAJA',
        estado: 'COMPLETADA',
        fechaCreacion: new Date('2025-08-15'),
        fechaInicio: new Date('2025-08-20'),
        fechaFinalizacion: new Date('2025-08-22'),
        horasEstimadas: 4,
        horasReales: 3.5,
        tecnicoAsignado: 'Maria González - Licencia Aviónica 67890',
        materialesRequeridos: [],
        observaciones: 'Actualización exitosa. Sistema operativo según especificaciones.'
      }
    ];

    const ordenes = await OrdenTrabajo.insertMany(ordenesData);
    console.log(`📋 ${ordenes.length} órdenes de trabajo creadas`);

    // Crear inspecciones - comentado temporalmente para simplificar
    /*
    const inspeccionesData = [
      {
        numeroInspeccion: 'INSP-2025-001',
        aeronave: aeronave._id,
        tipoInspeccion: 'DIARIA',
        fechaInspeccion: new Date('2025-09-15'),
        inspector: 'Carlos Rodriguez - Licencia A&P 11223',
        estado: 'COMPLETADA',
        itemsInspeccion: [{
          categoria: 'MOTOR_PRINCIPAL',
          descripcion: 'Verificar nivel aceite motor',
          estado: 'CONFORME',
          observaciones: 'Nivel aceite normal, sin fugas visibles'
        }],
        defectosEncontrados: [{
          descripcion: 'Fuga sistema hidráulico',
          severidad: 'CRITICA',
          ubicacion: 'Conexión principal bomba hidráulica'
        }],
        observacionesGenerales: 'Aeronave en condiciones generales buenas.',
        proximaInspeccion: new Date('2025-09-16')
      },
      {
        numeroInspeccion: 'INSP-2025-002',
        aeronave: aeronave._id,
        tipoInspeccion: '100H',
        fechaInspeccion: new Date('2025-08-30'),
        inspector: 'Ana Martinez - Licencia A&P 33445',
        estado: 'COMPLETADA',
        itemsInspeccion: [{
          categoria: 'TRANSMISION_PRINCIPAL',
          descripcion: 'Análisis vibraciones transmisión',
          estado: 'CONFORME',
          observaciones: 'Vibraciones dentro de límites permitidos'
        }],
        defectosEncontrados: [],
        observacionesGenerales: 'Inspección 100H completada satisfactoriamente.',
        proximaInspeccion: new Date('2025-11-30')
      }
    ];

    const inspecciones = await Inspeccion.insertMany(inspeccionesData);
    console.log(`🔍 ${inspecciones.length} inspecciones creadas`);
    */
    
    console.log('🔍 Inspecciones omitidas temporalmente para simplificar');

    console.log('\n🎉 ¡Datos de ejemplo creados exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   • ${componentes.length} componentes`);
    console.log(`   • ${ordenes.length} órdenes de trabajo`);
    console.log(`   • Inspecciones: omitidas temporalmente`);
    
  } catch (error) {
    console.error('❌ Error creando datos:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Desconectado de MongoDB');
  }
}

crearDatosEjemplo();