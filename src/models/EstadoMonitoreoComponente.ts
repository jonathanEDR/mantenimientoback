import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEstadoMonitoreoComponente extends Document {
  componenteId: Types.ObjectId;
  catalogoControlId: Types.ObjectId;
  valorActual: number;
  valorLimite: number;
  unidad: string;
  estado: 'OK' | 'PROXIMO' | 'VENCIDO';
  fechaProximaRevision: Date;
  fechaUltimaActualizacion: Date;
  alertaActiva: boolean;
  observaciones?: string;
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
    enum: ['OK', 'PROXIMO', 'VENCIDO'],
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
estadoMonitoreoComponenteSchema.pre('save', function(next) {
  const horasRestantes = this.valorLimite - this.valorActual;
  const alertaAnticipada = this.configuracionPersonalizada?.alertaAnticipada || 50;

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

  this.fechaUltimaActualizacion = new Date();
  next();
});

export const EstadoMonitoreoComponente = mongoose.model<IEstadoMonitoreoComponente>(
  'EstadoMonitoreoComponente', 
  estadoMonitoreoComponenteSchema
);