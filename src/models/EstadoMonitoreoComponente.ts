import mongoose, { Document, Schema, Types } from 'mongoose';
import logger from '../utils/logger';

export interface IEstadoMonitoreoComponente extends Document {
  componenteId: Types.ObjectId;
  catalogoControlId: Types.ObjectId;
  valorActual: number;
  valorLimite: number;
  unidad: string;
  estado: 'OK' | 'PROXIMO' | 'VENCIDO' | 'OVERHAUL_REQUERIDO';
  fechaProximaRevision: Date;
  fechaUltimaActualizacion: Date;
  alertaActiva: boolean;
  observaciones?: string;
  // Campos para unificación de sistemas
  basadoEnAeronave: boolean; // Si usa horas de aeronave o del componente individual
  offsetInicial: number; // Horas de aeronave cuando se creó/instaló el estado
  // Configuración de Overhauls
  configuracionOverhaul?: {
    habilitarOverhaul: boolean;
    intervaloOverhaul: number; // Horas entre overhauls
    ciclosOverhaul: number; // Número máximo de overhauls permitidos
    cicloActual: number; // Ciclo actual (0 = primer uso, 1 = primer overhaul, etc.)
    horasUltimoOverhaul: number; // Horas cuando se hizo el último overhaul
    proximoOverhaulEn: number; // Horas cuando debe hacerse el próximo overhaul
    requiereOverhaul: boolean; // Si actualmente requiere overhaul
    fechaUltimoOverhaul?: Date; // Cuando se completó el último overhaul
    observacionesOverhaul?: string;
  };
  configuracionPersonalizada?: {
    alertaAnticipada: number; // Horas antes del vencimiento para alertar
    criticidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
    requiereParoAeronave: boolean;
  };
}

const estadoMonitoreoComponenteSchema = new Schema<IEstadoMonitoreoComponente>({
  componenteId: {
    type: Schema.Types.ObjectId,
    ref: 'Componente',
    required: true
  },
  catalogoControlId: {
    type: Schema.Types.ObjectId,
    ref: 'CatalogoControlMonitoreo',
    required: true
  },
  valorActual: {
    type: Number,
    required: true,
    min: 0
  },
  valorLimite: {
    type: Number,
    required: true,
    min: 0
  },
  unidad: {
    type: String,
    required: true,
    enum: ['HORAS', 'CICLOS', 'DIAS', 'MESES', 'ANOS'],
    default: 'HORAS'
  },
  estado: {
    type: String,
    enum: ['OK', 'PROXIMO', 'VENCIDO', 'OVERHAUL_REQUERIDO'],
    required: true,
    default: 'OK'
  },
  fechaProximaRevision: {
    type: Date,
    required: true
  },
  fechaUltimaActualizacion: {
    type: Date,
    default: Date.now
  },
  alertaActiva: {
    type: Boolean,
    default: false
  },
  observaciones: {
    type: String,
    trim: true
  },
  // Campos para unificación de sistemas
  basadoEnAeronave: {
    type: Boolean,
    default: true // Por defecto usar horas de aeronave
  },
  offsetInicial: {
    type: Number,
    default: 0,
    min: 0
  },
  // Configuración de Overhauls
  configuracionOverhaul: {
    habilitarOverhaul: {
      type: Boolean,
      default: false
    },
    intervaloOverhaul: {
      type: Number,
      default: 500, // 500 horas entre overhauls por defecto
      min: 1
    },
    ciclosOverhaul: {
      type: Number,
      default: 5, // Máximo 5 overhauls por defecto
      min: 1
    },
    cicloActual: {
      type: Number,
      default: 0, // Empezar en ciclo 0 (primer uso)
      min: 0
    },
    horasUltimoOverhaul: {
      type: Number,
      default: 0,
      min: 0
    },
    proximoOverhaulEn: {
      type: Number,
      default: 500 // Primera vez en 500 horas
    },
    requiereOverhaul: {
      type: Boolean,
      default: false
    },
    fechaUltimoOverhaul: {
      type: Date
    },
    observacionesOverhaul: {
      type: String,
      trim: true
    }
  },
  configuracionPersonalizada: {
    alertaAnticipada: {
      type: Number,
      default: 50, // 50 horas antes por defecto
      min: 0
    },
    criticidad: {
      type: String,
      enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'],
      default: 'MEDIA'
    },
    requiereParoAeronave: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  collection: 'estadosMonitoreoComponente'
});

// Índices para optimizar consultas
estadoMonitoreoComponenteSchema.index({ componenteId: 1 });
estadoMonitoreoComponenteSchema.index({ estado: 1 });
estadoMonitoreoComponenteSchema.index({ fechaProximaRevision: 1 });
estadoMonitoreoComponenteSchema.index({ alertaActiva: 1 });

// Índice compuesto para consultas complejas
estadoMonitoreoComponenteSchema.index({ 
  componenteId: 1, 
  catalogoControlId: 1 
}, { unique: true }); // Un componente no puede tener el mismo control duplicado

// Middleware para actualizar el estado automáticamente
estadoMonitoreoComponenteSchema.pre('save', async function(next) {
  try {
    let valorActualCalculado = this.valorActual;

    // Si está basado en aeronave, calcular valor actual desde horas acumuladas del componente
    if (this.basadoEnAeronave && this.isModified('valorActual')) {
      // Obtener las horas acumuladas del componente específico
      const Componente = this.model('Componente');
      const componente = await Componente.findById(this.componenteId)
        .select('vidaUtil')
        .lean() as any;

      if (componente?.vidaUtil) {
        // Buscar la vida útil en HORAS del componente
        const vidaUtilHoras = componente.vidaUtil.find((vida: any) => vida.unidad === 'HORAS');
        
        if (vidaUtilHoras) {
          // Usar las horas acumuladas del componente (desde su instalación)
          valorActualCalculado = Math.max(0, vidaUtilHoras.acumulado + this.offsetInicial);
          
          // Actualizar el valorActual para mantener consistencia
          this.valorActual = valorActualCalculado;
          
          logger.debug(`[ESTADO] Componente ${this.componenteId}: horas acumuladas=${vidaUtilHoras.acumulado}, offset=${this.offsetInicial}, valorFinal=${valorActualCalculado}`);
        }
      }
    }

    // Calcular estado basándose en el valor actual (calculado o manual)
    const horasRestantes = this.valorLimite - valorActualCalculado;
    const alertaAnticipada = this.configuracionPersonalizada?.alertaAnticipada || 50;

    // ============ LÓGICA DE OVERHAULS INTEGRADA CON MONITOREO ============
    if (this.configuracionOverhaul?.habilitarOverhaul) {
      const configOverhaul = this.configuracionOverhaul;

      // Log esencial para monitoreo de overhauls
      logger.debug(`[OVERHAUL] Estado calculado - Valor: ${valorActualCalculado}/${this.valorLimite}, Intervalo: ${configOverhaul.intervaloOverhaul}h, Ciclo: ${configOverhaul.cicloActual}/${configOverhaul.ciclosOverhaul}`);

      // IMPORTANTE: NO recalcular cicloActual - este se incrementa manualmente al completar overhaul
      // Solo calcular si está en el próximo intervalo basándose en el ciclo ACTUAL (no lo sobrescribimos)
      
      // Calcular el próximo punto de overhaul basándose en el ciclo actual + 1
      const proximoOverhaulEn = (configOverhaul.cicloActual + 1) * configOverhaul.intervaloOverhaul;
      
      // Verificar si necesita overhaul ahora (ha alcanzado el próximo intervalo)
      const horasSiguienteOverhaul = (configOverhaul.cicloActual + 1) * configOverhaul.intervaloOverhaul;
      const necesitaOverhaulAhora = valorActualCalculado >= horasSiguienteOverhaul;
      
      // Actualizar configuración solo si no fue modificada manualmente
      if (!this.isModified('configuracionOverhaul.proximoOverhaulEn')) {
        configOverhaul.proximoOverhaulEn = proximoOverhaulEn;
      }

      logger.debug(`[OVERHAUL] Ciclo actual: ${configOverhaul.cicloActual}, próximo overhaul en: ${proximoOverhaulEn}h, horas actuales: ${valorActualCalculado}h`);

      // VERIFICAR ESTADO BASÁNDOSE EN CICLO ACTUAL Y LÍMITE DEL COMPONENTE

      // 1. Si ya superó el límite del componente
      if (valorActualCalculado >= this.valorLimite) {
        // Si aún puede hacer overhauls y necesita uno
        if (configOverhaul.cicloActual < configOverhaul.ciclosOverhaul && necesitaOverhaulAhora) {
          configOverhaul.requiereOverhaul = true;
          this.estado = 'OVERHAUL_REQUERIDO';
          this.alertaActiva = true;
          logger.warn(`[OVERHAUL] ⚠️ Componente vencido requiere overhaul - ${valorActualCalculado}/${this.valorLimite}h`);
        } else if (configOverhaul.cicloActual >= configOverhaul.ciclosOverhaul) {
          // Ya no puede hacer más overhauls
          configOverhaul.requiereOverhaul = false;
          this.estado = 'VENCIDO';
          this.alertaActiva = true;
          logger.error(`[OVERHAUL] ❌ Componente definitivamente vencido - Máximo overhauls alcanzado (${configOverhaul.cicloActual}/${configOverhaul.ciclosOverhaul})`);
        } else {
          // Vencido pero sin overhaul requerido aún
          this.estado = 'VENCIDO';
          this.alertaActiva = true;
          logger.info(`[OVERHAUL] Componente vencido, próximo overhaul en: ${proximoOverhaulEn}h`);
        }
      }
      // 2. Si necesita overhaul ahora mismo (antes del límite)
      else if (necesitaOverhaulAhora && configOverhaul.cicloActual < configOverhaul.ciclosOverhaul) {
        configOverhaul.requiereOverhaul = true;
        this.estado = 'OVERHAUL_REQUERIDO';
        this.alertaActiva = true;
        logger.warn(`[OVERHAUL] 🚨 OVERHAUL REQUERIDO - ${valorActualCalculado}h (intervalo: ${configOverhaul.intervaloOverhaul}h, ciclo: ${configOverhaul.cicloActual}/${configOverhaul.ciclosOverhaul})`);
      }
      // 3. Si está próximo a un overhaul
      else if (valorActualCalculado >= (proximoOverhaulEn - alertaAnticipada)) {
        configOverhaul.requiereOverhaul = false;
        this.estado = 'PROXIMO';
        this.alertaActiva = true;
        logger.info(`[OVERHAUL] ⚠️ Próximo a overhaul - ${valorActualCalculado}h (faltan ${proximoOverhaulEn - valorActualCalculado}h para overhaul)`);
      }
      // 4. Estado normal
      else {
        configOverhaul.requiereOverhaul = false;
        this.estado = 'OK';
        this.alertaActiva = false;
        logger.debug(`[OVERHAUL] ✅ Estado OK - ${valorActualCalculado}h (próximo overhaul en ${proximoOverhaulEn}h)`);
      }
    }

    // ============ LÓGICA NORMAL DE VENCIMIENTO ============
    // Solo aplicar si no está en modo overhaul
    if (!this.configuracionOverhaul?.habilitarOverhaul) {
      if (horasRestantes <= 0) {
        this.estado = 'VENCIDO';
        this.alertaActiva = true;
      } else if (horasRestantes <= alertaAnticipada) {
        this.estado = 'PROXIMO';
        this.alertaActiva = true;
      } else {
        this.estado = 'OK';
        this.alertaActiva = false;
      }
    }

    this.fechaUltimaActualizacion = new Date();
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error('Error desconocido en middleware'));
  }
});

export const EstadoMonitoreoComponente = mongoose.model<IEstadoMonitoreoComponente>(
  'EstadoMonitoreoComponente', 
  estadoMonitoreoComponenteSchema,
  'estadosMonitoreoComponente'  // Especificar explícitamente el nombre de la colección
);