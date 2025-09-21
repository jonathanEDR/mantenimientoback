import { Schema, model, Document } from 'mongoose';

export enum EstadoCatalogo {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  OBSOLETO = 'OBSOLETO'
}

export interface ICatalogoComponente extends Document {
  codigo: string;
  descripcion: string;
  estado: EstadoCatalogo;
  createdAt: Date;
  updatedAt: Date;
}

// Schema de Mongoose
const catalogoComponenteSchema = new Schema<ICatalogoComponente>({
  codigo: {
    type: String,
    required: [true, 'El código es requerido'],
    unique: true,
    trim: true,
    minlength: [3, 'El código debe tener al menos 3 caracteres'],
    maxlength: [20, 'El código no puede exceder 20 caracteres'],
    uppercase: true
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    minlength: [5, 'La descripción debe tener al menos 5 caracteres'],
    maxlength: [200, 'La descripción no puede exceder 200 caracteres']
  },
  estado: {
    type: String,
    enum: Object.values(EstadoCatalogo),
    default: EstadoCatalogo.ACTIVO,
    required: [true, 'El estado es requerido']
  }
}, {
  timestamps: true,
  collection: 'catalogoComponentes'
});

// Índices básicos
catalogoComponenteSchema.index({ codigo: 1 });
catalogoComponenteSchema.index({ estado: 1 });

const CatalogoComponente = model<ICatalogoComponente>('CatalogoComponente', catalogoComponenteSchema);

export default CatalogoComponente;

