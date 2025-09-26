// Tipos e interfaces para el sistema de monitoreo

export enum EstadoAlerta {
  OK = 'OK',
  PROXIMO = 'PROXIMO',
  VENCIDO = 'VENCIDO'
}

export enum TipoAlerta {
  PREVENTIVO = 'PREVENTIVO',
  CRITICO = 'CRITICO',
  INFORMATIVO = 'INFORMATIVO'
}

// Interface para una alerta individual
export interface IAlertaMonitoreo {
  descripcionCodigo: string;
  horaInicial: number;
  horaFinal: number;
  horasActuales: number;
  estado: EstadoAlerta;
  tipoAlerta: TipoAlerta;
  horasRestantes?: number;
  horasVencidas?: number;
  porcentajeCompletado: number;
  fechaProximoVencimiento?: Date;
  prioridad: number; // 1 = alta, 2 = media, 3 = baja
}

// Interface para el resumen de monitoreo de una aeronave
export interface IResumenMonitoreoAeronave {
  aeronaveId: string;
  matricula: string;
  horasVueloActuales: number;
  alertas: IAlertaMonitoreo[];
  totalAlertas: number;
  alertasCriticas: number;
  alertasProximas: number;
  alertasOk: number;
  ultimaActualizacion: Date;
}

// Interface para el resumen de toda la flota
export interface IResumenFlota {
  totalAeronaves: number;
  aeronavesConAlertas: number;
  totalAlertasCriticas: number;
  totalAlertasProximas: number;
  aeronaves: IResumenMonitoreoAeronave[];
  generadoEn: Date;
}

// Interface para la respuesta de la API
export interface IMonitoreoResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: Date;
}

// Interface para configuración de alertas
export interface IConfiguracionAlerta {
  porcentajeAlertaProxima: number; // Por defecto 10% (cuando está al 90% del intervalo)
  diasAnticipacion: number; // Días de anticipación para alertas
  horasMinimesTolerancia: number; // Horas mínimas de tolerancia antes de marcar como vencido
}

// Interface para filtros de monitoreo
export interface IFiltrosMonitoreo {
  estados?: EstadoAlerta[];
  tiposAlerta?: TipoAlerta[];
  aeronaveIds?: string[];
  soloAeronavesConAlertas?: boolean;
}

export default {
  EstadoAlerta,
  TipoAlerta
};