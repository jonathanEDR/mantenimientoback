import mongoose from 'mongoose';
import Componente from '../models/Componente';
import Aeronave from '../models/Aeronave';
import logger from '../utils/logger';

async function crearComponentesConAlertas() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB');
    logger.info('✅ Conectado a MongoDB para crear componentes con alertas');

    // Obtener una aeronave existente
    const aeronave = await Aeronave.findOne();
    if (!aeronave) {
      throw new Error('No se encontró ninguna aeronave');
    }

    // Crear componente con vida útil próxima a vencer (90% progreso)
    const componenteProximo = new Componente({
      numeroSerie: 'ALERT-001-TEST',
      numeroParte: 'P001-ALERT',
      nombre: 'Motor Principal (ALERTA)',
      categoria: 'MOTOR_PRINCIPAL',
      fabricante: 'Test Aerospace',
      fechaFabricacion: new Date('2020-01-01'),
      fechaInstalacion: new Date('2023-01-01'),
      aeronaveActual: aeronave._id,
      posicionInstalacion: 'Engine Bay 1',
      estado: 'INSTALADO',
      vidaUtil: [
        {
          limite: 1000,      // Límite de 1000 horas
          acumulado: 950,    // Ya tiene 950 horas (95% - PRÓXIMO)
          unidad: 'HORAS',
          restante: 50
        }
      ],
      mantenimientoProgramado: [
        {
          tipo: '500H',
          proximoVencimiento: new Date('2025-12-01'),
          horasProximoVencimiento: 500,
          alertaAnticipada: 50,
          estado: 'PROXIMO'
        }
      ],
      ubicacionFisica: 'Hangar A',
      alertasActivas: true
    });

    // Crear componente con vida útil vencida (100% progreso)
    const componenteVencido = new Componente({
      numeroSerie: 'CRIT-002-TEST',
      numeroParte: 'P002-CRIT',
      nombre: 'Transmisión Principal (CRÍTICA)',
      categoria: 'TRANSMISION_PRINCIPAL',
      fabricante: 'Test Aerospace',
      fechaFabricacion: new Date('2018-01-01'),
      fechaInstalacion: new Date('2020-01-01'),
      aeronaveActual: aeronave._id,
      posicionInstalacion: 'Transmission Bay',
      estado: 'INSTALADO',
      vidaUtil: [
        {
          limite: 2000,      // Límite de 2000 horas
          acumulado: 2100,   // Ya tiene 2100 horas (105% - VENCIDO)
          unidad: 'HORAS',
          restante: -100
        }
      ],
      mantenimientoProgramado: [
        {
          tipo: 'OVERHAUL',
          proximoVencimiento: new Date('2025-01-01'), // Ya vencido
          horasProximoVencimiento: 2000,
          alertaAnticipada: 100,
          estado: 'VENCIDO'
        }
      ],
      ubicacionFisica: 'Hangar A',
      alertasActivas: true
    });

    await componenteProximo.save();
    await componenteVencido.save();

    console.log('✅ Componentes con alertas creados:');
    console.log(`- ${componenteProximo.nombre}: ${componenteProximo.numeroSerie} (PRÓXIMO)`);
    console.log(`- ${componenteVencido.nombre}: ${componenteVencido.numeroSerie} (VENCIDO)`);
    console.log(`- Instalados en aeronave: ${aeronave.matricula}`);

  } catch (error) {
    console.error('❌ Error creando componentes con alertas:', error);
  } finally {
    await mongoose.disconnect();
  }
}

crearComponentesConAlertas();