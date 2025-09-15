import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { format, startOfDay, endOfDay } from 'date-fns';

export const LIMA_TIMEZONE = 'America/Lima';

/**
 * Configuración de formatos de fecha comunes
 */
export const DATE_FORMATS = {
  // Formatos de fecha
  DATE_SHORT: 'dd/MM/yyyy',           // 25/12/2023
  DATE_MEDIUM: 'dd MMM yyyy',         // 25 dic 2023
  DATE_LONG: 'dd \'de\' MMMM \'de\' yyyy', // 25 de diciembre de 2023
  
  // Formatos de hora
  TIME_12H: 'hh:mm a',               // 02:30 PM
  TIME_24H: 'HH:mm',                 // 14:30
  TIME_WITH_SECONDS: 'HH:mm:ss',     // 14:30:45
  
  // Formatos combinados
  DATETIME_SHORT: 'dd/MM/yyyy HH:mm', // 25/12/2023 14:30
  DATETIME_MEDIUM: 'dd MMM yyyy, HH:mm', // 25 dic 2023, 14:30
  DATETIME_LONG: 'dd \'de\' MMMM \'de\' yyyy \'a las\' HH:mm', // 25 de diciembre de 2023 a las 14:30
  
  // Formatos para APIs
  ISO_DATE: 'yyyy-MM-dd',            // 2023-12-25
  ISO_DATETIME: 'yyyy-MM-dd\'T\'HH:mm:ss', // 2023-12-25T14:30:00
  
  // Formatos especiales
  DAY_MONTH: 'dd MMM',               // 25 dic
  MONTH_YEAR: 'MMM yyyy',            // dic 2023
  YEAR: 'yyyy'                       // 2023
} as const;

/**
 * Obtiene la fecha y hora actual en la zona horaria de Lima
 */
export function getNowInLima(): Date {
  const now = new Date();
  return toZonedTime(now, LIMA_TIMEZONE);
}

/**
 * Convierte una fecha de Lima a UTC
 */
export function limaToUtc(date: Date): Date {
  return fromZonedTime(date, LIMA_TIMEZONE);
}

/**
 * Convierte una fecha UTC a Lima
 */
export function utcToLima(date: Date): Date {
  return toZonedTime(date, LIMA_TIMEZONE);
}

/**
 * Formatea una fecha en la zona horaria de Lima
 */
export function formatInLima(date: Date, formatStr: string = 'dd/MM/yyyy HH:mm:ss'): string {
  const limaDate = toZonedTime(date, LIMA_TIMEZONE);
  return formatTz(limaDate, formatStr, { timeZone: LIMA_TIMEZONE });
}

/**
 * Obtiene la fecha actual en Lima como string
 */
export function getCurrentDateStringInLima(): string {
  const now = getNowInLima();
  return format(now, 'yyyy-MM-dd');
}

/**
 * Obtiene la fecha y hora actual en Lima como string
 */
export function getCurrentDateTimeStringInLima(): string {
  const now = getNowInLima();
  return format(now, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Obtiene el inicio del día en Lima
 */
export function getStartOfDayInLima(date?: Date): Date {
  const targetDate = date || getNowInLima();
  const dateInLima = toZonedTime(targetDate, LIMA_TIMEZONE);
  const startOfDayInLima = startOfDay(dateInLima);
  return startOfDayInLima;
}

/**
 * Obtiene el final del día en Lima
 */
export function getEndOfDayInLima(date?: Date): Date {
  const targetDate = date || getNowInLima();
  const dateInLima = toZonedTime(targetDate, LIMA_TIMEZONE);
  const endOfDayInLima = endOfDay(dateInLima);
  return endOfDayInLima;
}

/**
 * Obtiene el rango del día actual en Lima
 */
export function getTodayRangeInLima(): { start: Date; end: Date } {
  const today = getNowInLima();
  return {
    start: getStartOfDayInLima(today),
    end: getEndOfDayInLima(today)
  };
}

/**
 * Formateadores de fecha
 */
export const formatters = {
  dateShort: (date: Date) => formatInLima(date, DATE_FORMATS.DATE_SHORT),
  dateMedium: (date: Date) => formatInLima(date, DATE_FORMATS.DATE_MEDIUM),
  dateLong: (date: Date) => formatInLima(date, DATE_FORMATS.DATE_LONG),
  time12h: (date: Date) => formatInLima(date, DATE_FORMATS.TIME_12H),
  time24h: (date: Date) => formatInLima(date, DATE_FORMATS.TIME_24H),
  timeWithSeconds: (date: Date) => formatInLima(date, DATE_FORMATS.TIME_WITH_SECONDS),
  datetimeShort: (date: Date) => formatInLima(date, DATE_FORMATS.DATETIME_SHORT),
  datetimeMedium: (date: Date) => formatInLima(date, DATE_FORMATS.DATETIME_MEDIUM),
  datetimeLong: (date: Date) => formatInLima(date, DATE_FORMATS.DATETIME_LONG),
  isoDate: (date: Date) => formatInLima(date, DATE_FORMATS.ISO_DATE),
  isoDatetime: (date: Date) => formatInLima(date, DATE_FORMATS.ISO_DATETIME)
};

/**
 * Rangos de fecha
 */
export const dateRanges = {
  today: getTodayRangeInLima,
  thisWeek: () => {
    const today = getNowInLima();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return {
      start: getStartOfDayInLima(startOfWeek),
      end: getEndOfDayInLima(endOfWeek)
    };
  },
  thisMonth: () => {
    const today = getNowInLima();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    return {
      start: getStartOfDayInLima(startOfMonth),
      end: getEndOfDayInLima(endOfMonth)
    };
  }
};