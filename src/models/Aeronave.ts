import { Schema, model } from 'mongoose';

export interface IAeronave {
  matricula: string;
  tipo: 'Helicóptero' | 'Avión';
  modelo: string;
  fabricante: string;
  anoFabricacion: number;
  estado: 'Operativo' | 'En Mantenimiento' | 'Fuera de Servicio' | 'En Reparación';
  ubicacionActual: string;
  horasVuelo: number;
  observaciones?: string;
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
    enum: ['Operativo', 'En Mantenimiento', 'Fuera de Servicio', 'En Reparación'],
    default: 'Operativo'
  },
  ubicacionActual: { type: String, required: true },
  horasVuelo: { 
    type: Number, 
    required: true, 
    min: 0,
    default: 0
  },
  observaciones: { type: String }
}, { timestamps: true });

export default model<IAeronave>('Aeronave', aeronaveSchema);