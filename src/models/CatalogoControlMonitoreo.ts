import mongoose, { Document, Schema } from 'mongoose';

export interface ICatalogoControlMonitoreo extends Document {
  descripcionCodigo: string;
  horaInicial: number;
  horaFinal: number;
  estado: 'ACTIVO' | 'INACTIVO';
}

const catalogoControlMonitoreoSchema = new Schema<ICatalogoControlMonitoreo>({
  descripcionCodigo: {
    type: String,
    required: true,
    trim: true
  },
  horaInicial: {
    type: Number,
    required: true,
    min: 0
  },
  horaFinal: {
    type: Number,
    required: true,
    min: 0
  },
  estado: {
    type: String,
    enum: ['ACTIVO', 'INACTIVO'],
    default: 'ACTIVO',
    required: true
  }
}, {
  timestamps: true,
  collection: 'catalogoControlMonitoreo'
});

export const CatalogoControlMonitoreo = mongoose.model<ICatalogoControlMonitoreo>('CatalogoControlMonitoreo', catalogoControlMonitoreoSchema);