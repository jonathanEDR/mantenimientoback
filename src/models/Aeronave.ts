import { Schema, model } from 'mongoose';

export interface IAeronave {
  matricula: string;
  tipo: 'Helicóptero' | 'Avión';
  modelo: string;
  fabricante: string;
  anoFabricacion: number;
  estado: 'Operativo' | 'En Mantenimiento' | 'Fuera de Servicio' | 'En Reparación' | 'Inoperativo por Reportaje';
  ubicacionActual: string;
  horasVuelo: number;
  observaciones?: string; // Campo legacy
  historialObservaciones?: Array<{
    fecha: Date;
    texto: string;
    usuario: string;
    tipo: 'observacion' | 'cambio_estado' | 'horas_actualizadas' | 'mantenimiento';
  }>;
  historialHorasVuelo?: Array<{
    fecha: Date;
    horasAnteriores: number;
    horasNuevas: number;
    incremento: number;
    usuario: string;
    observacion?: string;
    motivo: 'vuelo_operacional' | 'correcion_manual' | 'mantenimiento' | 'transferencia' | 'otro';
  }>;
}

const aeronaveSchema = new Schema<IAeronave>({
  matricula: { type: String, required: true, unique: true, uppercase: true },
  tipo: { 
    type: String, 
    required: true, 
    enum: ['Helicóptero', 'Avión'] 
  },
  modelo: { type: String, required: true },
  fabricante: { type: String, required: true },
  anoFabricacion: { 
    type: Number, 
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  estado: { 
    type: String, 
    required: true, 
    enum: ['Operativo', 'En Mantenimiento', 'Fuera de Servicio', 'En Reparación', 'Inoperativo por Reportaje'],
    default: 'Operativo'
  },
  ubicacionActual: { type: String, required: true },
  horasVuelo: { 
    type: Number, 
    required: true, 
    min: 0,
    default: 0
  },
  observaciones: { type: String },
  historialObservaciones: [{
    fecha: {
      type: Date,
      default: Date.now
    },
    texto: {
      type: String,
      required: true,
      trim: true
    },
    usuario: {
      type: String,
      required: true
    },
    tipo: {
      type: String,
      enum: ['observacion', 'cambio_estado', 'horas_actualizadas', 'mantenimiento'],
      default: 'observacion'
    }
  }],
  historialHorasVuelo: [{
    fecha: {
      type: Date,
      default: Date.now
    },
    horasAnteriores: {
      type: Number,
      required: true,
      min: 0
    },
    horasNuevas: {
      type: Number,
      required: true,
      min: 0
    },
    incremento: {
      type: Number,
      required: true
    },
    usuario: {
      type: String,
      required: true
    },
    observacion: {
      type: String,
      trim: true
    },
    motivo: {
      type: String,
      enum: ['vuelo_operacional', 'correcion_manual', 'mantenimiento', 'transferencia', 'otro'],
      default: 'vuelo_operacional'
    }
  }]
}, { timestamps: true });

export default model<IAeronave>('Aeronave', aeronaveSchema);