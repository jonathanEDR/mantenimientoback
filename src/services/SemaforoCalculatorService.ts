/**
 * SERVICIO DE CÁLCULO DE SEMÁFORO PERSONALIZABLE
 * 
 * Este servicio calcula el color y estado del semáforo basándose en:
 * - Horas restantes hasta el próximo overhaul
 * - Configuración personalizada de umbrales por color
 * - Unidad de medida (HORAS o PORCENTAJE)
 * 
 * FLUJO DE CÁLCULO:
 * 1. Determinar horas restantes hasta próximo overhaul
 * 2. Comparar con umbrales personalizados
 * 3. Asignar color apropiado según configuración
 * 4. Generar resultado con descripción y nivel de urgencia
 */

import { 
  ISemaforoPersonalizado, 
  IResultadoSemaforo, 
  ColorSemaforo,
  CONFIGURACIONES_SEMAFORO_PREDEFINIDAS,
  SemaforoUtils
} from '../types/semaforoPersonalizado';
import logger from '../utils/logger';

export class SemaforoCalculatorService {
  
  /**
   * Calcula el estado del semáforo basándose en horas restantes y configuración
   */
  static calcularSemaforo(
    horasRestantes: number,
    intervaloOverhaul: number,
    configuracion: ISemaforoPersonalizado
  ): IResultadoSemaforo {
    
    // Validar configuración
    const erroresValidacion = SemaforoUtils.validarConfiguracionSemaforo(configuracion);
    if (erroresValidacion.length > 0) {
      logger.warn('Configuración de semáforo inválida, usando configuración estándar:', erroresValidacion);
      configuracion = CONFIGURACIONES_SEMAFORO_PREDEFINIDAS.ESTANDAR;
    }

    const { umbrales, unidad, descripciones } = configuracion;
    
    // Convertir a valor comparable según unidad
    let valorComparacion: number;
    let porcentajeProgreso: number;
    
    if (unidad === 'PORCENTAJE') {
      // Calcular porcentaje del intervalo consumido
      const horasConsumidas = intervaloOverhaul - horasRestantes;
      porcentajeProgreso = Math.max(0, Math.min(100, (horasConsumidas / intervaloOverhaul) * 100));
      valorComparacion = porcentajeProgreso;
    } else {
      // Usar horas directamente
      valorComparacion = horasRestantes;
      const horasConsumidas = intervaloOverhaul - horasRestantes;
      porcentajeProgreso = Math.max(0, Math.min(100, (horasConsumidas / intervaloOverhaul) * 100));
    }

    // Determinar color según umbrales
    let color: ColorSemaforo;
    let umbralActual: number;
    let nivel: number;
    
    if (unidad === 'PORCENTAJE') {
      // Para porcentaje, mayor porcentaje = más crítico
      const porcentajeLimite = 100;
      
      if (valorComparacion >= (porcentajeLimite + umbrales.morado)) {
        // MORADO: Excedió el límite por el umbral configurado
        color = 'MORADO';
        umbralActual = porcentajeLimite + umbrales.morado;
        nivel = 0; // Máxima criticidad
      } else if (valorComparacion >= umbrales.rojo) {
        color = 'ROJO';
        umbralActual = umbrales.rojo;
        nivel = 1;
      } else if (valorComparacion >= umbrales.naranja) {
        color = 'NARANJA';
        umbralActual = umbrales.naranja;
        nivel = 2;
      } else if (valorComparacion >= umbrales.amarillo) {
        color = 'AMARILLO';
        umbralActual = umbrales.amarillo;
        nivel = 3;
      } else {
        color = 'VERDE';
        umbralActual = umbrales.verde;
        nivel = 4;
      }
    } else {
      // Para horas: La lógica es:
      // - horasRestantes NEGATIVAS = MORADO (pasó el límite)
      // - horasRestantes entre 0 y umbral rojo = ROJO
      // - horasRestantes entre umbral rojo y naranja = NARANJA
      // - etc.
      
      if (horasRestantes < -umbrales.morado) {
        // MORADO: Excedió el límite por más del umbral configurado
        color = 'MORADO';
        umbralActual = -umbrales.morado;
        nivel = 0; // Máxima criticidad
      } else if (horasRestantes <= 0) {
        // ROJO: Entre 0 y el límite (o justo en el límite)
        color = 'ROJO';
        umbralActual = 0;
        nivel = 1;
      } else if (horasRestantes <= umbrales.amarillo) {
        // ROJO: Menos horas que el umbral amarillo
        color = 'ROJO';
        umbralActual = umbrales.amarillo;
        nivel = 1;
      } else if (horasRestantes <= umbrales.naranja) {
        // NARANJA: Entre amarillo y naranja
        color = 'NARANJA';
        umbralActual = umbrales.naranja;
        nivel = 2;
      } else if (horasRestantes <= umbrales.rojo) {
        // AMARILLO: Entre naranja y rojo
        color = 'AMARILLO';
        umbralActual = umbrales.rojo;
        nivel = 3;
      } else {
        // VERDE: Más horas que el umbral rojo
        color = 'VERDE';
        umbralActual = umbrales.rojo;
        nivel = 4;
      }
    }

    // Obtener descripción
    const descripcion = descripciones?.[color.toLowerCase() as keyof typeof descripciones] || 
                      `Estado ${color}`;

    // Determinar si requiere atención (colores críticos)
    const requiereAtencion = color === 'MORADO' || color === 'ROJO' || color === 'NARANJA';

    return {
      color,
      descripcion,
      horasRestantes: Math.max(horasRestantes, horasRestantes), // Mantener valores negativos
      umbralActual,
      porcentajeProgreso,
      requiereAtencion,
      nivel
    };
  }

  /**
   * Obtiene configuración de semáforo predefinida por nombre
   */
  static obtenerConfiguracionPredefinida(nombre: keyof typeof CONFIGURACIONES_SEMAFORO_PREDEFINIDAS): ISemaforoPersonalizado {
    return CONFIGURACIONES_SEMAFORO_PREDEFINIDAS[nombre] || CONFIGURACIONES_SEMAFORO_PREDEFINIDAS.ESTANDAR;
  }

  /**
   * Crea configuración personalizada con validación
   */
  static crearConfiguracionPersonalizada(
    umbrales: { morado: number; rojo: number; naranja: number; amarillo: number; verde: number },
    unidad: 'HORAS' | 'PORCENTAJE' = 'HORAS',
    descripciones?: { morado: string; rojo: string; naranja: string; amarillo: string; verde: string }
  ): ISemaforoPersonalizado {
    
    const configuracion: ISemaforoPersonalizado = {
      habilitado: true,
      unidad,
      umbrales,
      descripciones: descripciones || {
        morado: 'SOBRE-CRÍTICO - Componente vencido en uso',
        rojo: 'Crítico - Acción inmediata requerida',
        naranja: 'Alto - Preparar overhaul próximo',
        amarillo: 'Medio - Monitorear progreso', 
        verde: 'OK - Funcionando normal'
      },
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };

    // Validar configuración
    const errores = SemaforoUtils.validarConfiguracionSemaforo(configuracion);
    if (errores.length > 0) {
      throw new Error(`Configuración de semáforo inválida: ${errores.join(', ')}`);
    }

    return configuracion;
  }

  /**
   * Convierte criticidad legacy a configuración de semáforo
   */
  static convertirCriticidadLegacy(
    criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA',
    alertaAnticipadaOverhaul: number
  ): ISemaforoPersonalizado {
    
    // Mapear criticidad legacy a configuración de semáforo (5 colores)
    const multiplicadores = {
      'BAJA': { morado: 6, rojo: 4, naranja: 3, amarillo: 2, verde: 1 },
      'MEDIA': { morado: 5, rojo: 3, naranja: 2.5, amarillo: 1.5, verde: 1 },
      'ALTA': { morado: 3, rojo: 2, naranja: 1.5, amarillo: 1.2, verde: 1 },
      'CRITICA': { morado: 2, rojo: 1.5, naranja: 1.2, amarillo: 1.1, verde: 1 }
    };

    const mult = multiplicadores[criticidad];
    const baseHoras = alertaAnticipadaOverhaul;

    return {
      habilitado: true,
      unidad: 'HORAS',
      umbrales: {
        morado: Math.round(baseHoras * mult.morado), // Horas DESPUÉS del límite
        rojo: Math.round(baseHoras * mult.rojo),
        naranja: Math.round(baseHoras * mult.naranja),
        amarillo: Math.round(baseHoras * mult.amarillo),
        verde: Math.round(baseHoras * mult.verde)
      },
      descripciones: {
        morado: `SOBRE-CRÍTICO (${criticidad}) - Componente vencido en uso`,
        rojo: `Crítico (${criticidad}) - Overhaul requerido`,
        naranja: `Alto (${criticidad}) - Preparar overhaul`,
        amarillo: `Medio (${criticidad}) - Monitorear`,
        verde: `OK (${criticidad}) - Normal`
      },
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };
  }

  /**
   * Calcula múltiples estados de semáforo para comparación
   */
  static calcularComparacionSemaforos(
    horasRestantes: number,
    intervaloOverhaul: number,
    configuraciones: Record<string, ISemaforoPersonalizado>
  ): Record<string, IResultadoSemaforo> {
    
    const resultados: Record<string, IResultadoSemaforo> = {};
    
    for (const [nombre, config] of Object.entries(configuraciones)) {
      try {
        resultados[nombre] = this.calcularSemaforo(horasRestantes, intervaloOverhaul, config);
      } catch (error) {
        logger.error(`Error calculando semáforo para configuración ${nombre}:`, error);
        // Usar configuración estándar como fallback
        resultados[nombre] = this.calcularSemaforo(
          horasRestantes, 
          intervaloOverhaul, 
          CONFIGURACIONES_SEMAFORO_PREDEFINIDAS.ESTANDAR
        );
      }
    }
    
    return resultados;
  }
}

export default SemaforoCalculatorService;