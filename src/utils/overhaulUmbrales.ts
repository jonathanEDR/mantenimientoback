import { ISemaforoPersonalizado } from '../types/semaforoPersonalizado';
import logger from '../utils/logger';

/**
 * Calcula umbrales del semáforo automáticamente basados en el intervalo de overhaul
 * 
 * Cuando un componente tiene overhaul programado, los umbrales deben basarse en el
 * intervalo de overhaul (ej: 50h), NO en el límite total del componente (ej: 105h)
 * 
 * @param intervaloOverhaul - Horas entre cada overhaul (ej: 50h)
 * @param perfil - Perfil de alertas: 'ESTANDAR', 'CONSERVADOR', 'AGRESIVO'
 * @returns Configuración de semáforo con umbrales calculados
 */
export function calcularUmbralesParaOverhaul(
  intervaloOverhaul: number,
  perfil: 'ESTANDAR' | 'CONSERVADOR' | 'AGRESIVO' = 'ESTANDAR'
): ISemaforoPersonalizado {
  
  // Validar intervalo
  if (!intervaloOverhaul || intervaloOverhaul <= 0) {
    logger.warn(`[UMBRALES OVERHAUL] Intervalo inválido: ${intervaloOverhaul}. Usando valores por defecto.`);
    intervaloOverhaul = 50; // Valor por defecto seguro
  }

  let umbrales: ISemaforoPersonalizado['umbrales'];
  let descripciones: ISemaforoPersonalizado['descripciones'];

  switch (perfil) {
    case 'CONSERVADOR':
      // Más conservador: alerta con más anticipación
      // Ideal para componentes críticos
      umbrales = {
        morado: Math.round(intervaloOverhaul * 0.30),  // 30% del intervalo (vencido)
        rojo: Math.round(intervaloOverhaul * 0.60),    // 60% del intervalo
        naranja: Math.round(intervaloOverhaul * 0.50), // 50% del intervalo
        amarillo: Math.round(intervaloOverhaul * 0.30),// 30% del intervalo
        verde: 0
      };
      descripciones = {
        morado: 'SOBRE-CRÍTICO - Componente vencido en uso',
        rojo: 'Crítico - Programar overhaul inmediatamente',
        naranja: 'Alto - Preparar overhaul próximo',
        amarillo: 'Medio - Monitorear progreso',
        verde: 'OK - Funcionando normal'
      };
      break;

    case 'AGRESIVO':
      // Menos anticipación: alerta más tarde
      // Ideal para componentes no críticos o con buena disponibilidad
      umbrales = {
        morado: Math.round(intervaloOverhaul * 0.10),  // 10% del intervalo (vencido)
        rojo: Math.round(intervaloOverhaul * 0.30),    // 30% del intervalo
        naranja: Math.round(intervaloOverhaul * 0.20), // 20% del intervalo
        amarillo: Math.round(intervaloOverhaul * 0.10),// 10% del intervalo
        verde: 0
      };
      descripciones = {
        morado: 'SOBRE-CRÍTICO - Componente vencido en uso',
        rojo: 'Crítico - Programar overhaul inmediatamente',
        naranja: 'Alto - Preparar overhaul próximo',
        amarillo: 'Medio - Monitorear progreso',
        verde: 'OK - Funcionando normal'
      };
      break;

    case 'ESTANDAR':
    default:
      // Balanceado: equilibrio entre anticipación y operatividad
      // Recomendado para la mayoría de componentes
      umbrales = {
        morado: Math.round(intervaloOverhaul * 0.20),  // 20% del intervalo (vencido)
        rojo: Math.round(intervaloOverhaul * 0.40),    // 40% del intervalo
        naranja: Math.round(intervaloOverhaul * 0.30), // 30% del intervalo
        amarillo: Math.round(intervaloOverhaul * 0.20),// 20% del intervalo
        verde: 0
      };
      descripciones = {
        morado: 'SOBRE-CRÍTICO - Componente vencido en uso',
        rojo: 'Crítico - Programar overhaul inmediatamente',
        naranja: 'Alto - Preparar overhaul próximo',
        amarillo: 'Medio - Monitorear progreso',
        verde: 'OK - Funcionando normal'
      };
      break;
  }

  // Asegurar que los umbrales sean al menos 1 (no 0)
  umbrales = {
    morado: Math.max(1, umbrales.morado),
    rojo: Math.max(1, umbrales.rojo),
    naranja: Math.max(1, umbrales.naranja),
    amarillo: Math.max(1, umbrales.amarillo),
    verde: 0
  };

  logger.info(`[UMBRALES OVERHAUL] Calculados automáticamente para intervalo ${intervaloOverhaul}h (perfil: ${perfil}):`, {
    intervaloOverhaul,
    perfil,
    umbrales,
    rangos: {
      verde: `> ${umbrales.rojo}h`,
      amarillo: `${umbrales.naranja + 1}-${umbrales.rojo}h`,
      naranja: `${umbrales.amarillo + 1}-${umbrales.naranja}h`,
      rojo: `≤ ${umbrales.amarillo}h`,
      morado: `< -${umbrales.morado}h (vencido)`
    }
  });

  return {
    habilitado: true,
    unidad: 'HORAS',
    umbrales,
    descripciones
  };
}

/**
 * Valida y corrige una configuración de semáforo para overhaul
 * Si los umbrales están configurados incorrectamente (basados en límite total),
 * los recalcula basándose en el intervalo de overhaul
 */
export function validarYCorregirUmbralesOverhaul(
  configuracionActual: ISemaforoPersonalizado | undefined,
  intervaloOverhaul: number,
  valorLimite: number
): ISemaforoPersonalizado {
  
  // Si no hay configuración, crear una nueva
  if (!configuracionActual) {
    return calcularUmbralesParaOverhaul(intervaloOverhaul, 'ESTANDAR');
  }

  // Detectar si los umbrales están basados en el límite total (incorrecto)
  // Los umbrales no deberían exceder el intervalo de overhaul
  const umbralRojo = configuracionActual.umbrales.rojo;
  
  if (umbralRojo > intervaloOverhaul) {
    logger.warn(`[UMBRALES OVERHAUL] ⚠️ Configuración incorrecta detectada:`, {
      umbralRojo,
      intervaloOverhaul,
      valorLimite,
      problema: `Umbral rojo (${umbralRojo}h) excede intervalo de overhaul (${intervaloOverhaul}h)`
    });
    
    // Recalcular umbrales correctos
    return calcularUmbralesParaOverhaul(intervaloOverhaul, 'ESTANDAR');
  }

  // Configuración válida
  return configuracionActual;
}