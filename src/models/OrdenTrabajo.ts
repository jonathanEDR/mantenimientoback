import { Schema, model } from 'mongoose';

// Enums para órdenes de trabajo
export enum TipoMantenimiento {
  PREVENTIVO = 'PREVENTIVO',
  CORRECTIVO = 'CORRECTIVO',
  INSPECCION = 'INSPECCION',
  OVERHAUL = 'OVERHAUL',
  REPARACION = 'REPARACION',
  MODIFICACION = 'MODIFICACION',
  DIRECTIVA_AD = 'DIRECTIVA_AD',
  BOLETIN_SERVICIO = 'BOLETIN_SERVICIO'
}

export enum PrioridadOrden {
  CRITICA = 'CRITICA',
  ALTA = 'ALTA', 
  MEDIA = 'MEDIA',
  BAJA = 'BAJA'
}

export enum EstadoOrden {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  ESPERANDO_REPUESTOS = 'ESPERANDO_REPUESTOS',
  ESPERANDO_APROBACION = 'ESPERANDO_APROBACION',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
  SUSPENDIDA = 'SUSPENDIDA'
}

// Sub-esquemas
const materialRequeridoSchema = new Schema({
  numeroParte: { type: String, required: true },
  descripcion: { type: String, required: true },
  cantidad: { type: Number, required: true, min: 1 },
  unidad: { type: String, required: true },
  disponible: { type: Boolean, default: false },
  proveedor: { type: String },
  costo: { type: Number },
  fechaSolicitud: { type: Date, default: Date.now },
  fechaRecepcion: { type: Date }
}, { _id: false });

const registroTrabajoSchema = new Schema({
  fecha: { type: Date, required: true },
  tecnico: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  horasInvertidas: { type: Number, required: true, min: 0 },
  descripcionTrabajo: { type: String, required: true },
  observaciones: { type: String }
}, { timestamps: true });

const inspeccionItemSchema = new Schema({
  item: { type: String, required: true },
  descripcion: { type: String, required: true },
  estado: { type: String, enum: ['CONFORME', 'NO_CONFORME', 'NO_APLICA'], required: true },
  observaciones: { type: String },
  accionRequerida: { type: String },
  fechaInspeccion: { type: Date, default: Date.now },
  inspector: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

// Interface principal
export interface IOrdenTrabajo {
  numeroOrden: string;
  aeronave: string; // Matrícula de la aeronave
  componente?: string; // Número de serie del componente si aplica
  tipo: TipoMantenimiento;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadOrden;
  tecnicoAsignado?: string; // ID del técnico
  supervisorAsignado?: string; // ID del supervisor
  fechaCreacion: Date;
  fechaVencimiento?: Date;
  fechaInicio?: Date;
  fechaFinalizacion?: Date;
  estado: EstadoOrden;
  horasEstimadas: number;
  horasReales?: number;
  materialesRequeridos: typeof materialRequeridoSchema.obj[];
  registrosTrabajo: typeof registroTrabajoSchema.obj[];
  itemsInspeccion: typeof inspeccionItemSchema.obj[];
  referenciaManual?: string; // Referencia al manual de mantenimiento
  directivaAD?: string; // Número de directiva si aplica
  boletinServicio?: string; // Número de boletín de servicio
  observaciones?: string;
  documentosAdjuntos?: {
    nombre: string;
    tipo: string;
    url: string;
    fechaSubida: Date;
  }[];
  certificacion?: {
    certificadoPor: string; // ID del técnico certificador
    numeroLicencia: string;
    fechaCertificacion: Date;
    observacionesCertificacion: string;
  };
  aprobacion?: {
    aprobadoPor: string; // ID del supervisor/ingeniero
    fechaAprobacion: Date;
    observacionesAprobacion: string;
  };
  costoTotal?: number;
  tiempoTotal?: number; // En horas
}

const ordenTrabajoSchema = new Schema<IOrdenTrabajo>({
  numeroOrden: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true
  },
  aeronave: { 
    type: String, 
    required: true,
    ref: 'Aeronave',
    index: true
  },
  componente: { 
    type: String,
    ref: 'Componente'
  },
  tipo: { 
    type: String, 
    enum: Object.values(TipoMantenimiento), 
    required: true,
    index: true
  },
  titulo: { type: String, required: true, trim: true },
  descripcion: { type: String, required: true },
  prioridad: { 
    type: String, 
    enum: Object.values(PrioridadOrden), 
    required: true,
    default: PrioridadOrden.MEDIA,
    index: true
  },
  tecnicoAsignado: { 
    type: String,
    ref: 'User'
  },
  supervisorAsignado: { 
    type: String,
    ref: 'User'
  },
  fechaCreacion: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date, index: true },
  fechaInicio: { type: Date },
  fechaFinalizacion: { type: Date },
  estado: { 
    type: String, 
    enum: Object.values(EstadoOrden), 
    required: true,
    default: EstadoOrden.PENDIENTE,
    index: true
  },
  horasEstimadas: { type: Number, required: true, min: 0 },
  horasReales: { type: Number, min: 0 },
  materialesRequeridos: [materialRequeridoSchema],
  registrosTrabajo: [registroTrabajoSchema],
  itemsInspeccion: [inspeccionItemSchema],
  referenciaManual: { type: String, trim: true },
  directivaAD: { type: String, trim: true },
  boletinServicio: { type: String, trim: true },
  observaciones: { type: String },
  documentosAdjuntos: [{
    nombre: { type: String, required: true },
    tipo: { type: String, required: true },
    url: { type: String, required: true },
    fechaSubida: { type: Date, default: Date.now }
  }],
  certificacion: {
    certificadoPor: { type: String, ref: 'User' },
    numeroLicencia: { type: String },
    fechaCertificacion: { type: Date },
    observacionesCertificacion: { type: String }
  },
  aprobacion: {
    aprobadoPor: { type: String, ref: 'User' },
    fechaAprobacion: { type: Date },
    observacionesAprobacion: { type: String }
  },
  costoTotal: { type: Number, min: 0 },
  tiempoTotal: { type: Number, min: 0 }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
ordenTrabajoSchema.index({ aeronave: 1, estado: 1 });
ordenTrabajoSchema.index({ tecnicoAsignado: 1, estado: 1 });
ordenTrabajoSchema.index({ fechaVencimiento: 1, estado: 1 });
ordenTrabajoSchema.index({ tipo: 1, prioridad: 1 });

// Virtual para calcular días hasta vencimiento
ordenTrabajoSchema.virtual('diasHastaVencimiento').get(function(this: IOrdenTrabajo) {
  if (!this.fechaVencimiento) return null;
  
  const ahora = new Date();
  const diferencia = this.fechaVencimiento.getTime() - ahora.getTime();
  return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
});

// Virtual para calcular progreso de la orden
ordenTrabajoSchema.virtual('progreso').get(function(this: IOrdenTrabajo) {
  switch (this.estado) {
    case EstadoOrden.PENDIENTE:
      return 0;
    case EstadoOrden.EN_PROCESO:
    case EstadoOrden.ESPERANDO_REPUESTOS:
      return 50;
    case EstadoOrden.ESPERANDO_APROBACION:
      return 80;
    case EstadoOrden.COMPLETADA:
      return 100;
    case EstadoOrden.CANCELADA:
    case EstadoOrden.SUSPENDIDA:
      return 0;
    default:
      return 0;
  }
});

// Middleware para generar número de orden automáticamente
ordenTrabajoSchema.pre('save', async function(next) {
  if (!this.numeroOrden) {
    const año = new Date().getFullYear();
    const ultimaOrden = await model('OrdenTrabajo').findOne({
      numeroOrden: { $regex: `^OT-${año}-` }
    }).sort({ numeroOrden: -1 });
    
    let siguiente = 1;
    if (ultimaOrden) {
      const ultimoNumero = parseInt(ultimaOrden.numeroOrden.split('-')[2]);
      siguiente = ultimoNumero + 1;
    }
    
    this.numeroOrden = `OT-${año}-${siguiente.toString().padStart(4, '0')}`;
  }
  
  // Calcular tiempo total de los registros
  if (this.registrosTrabajo && this.registrosTrabajo.length > 0) {
    this.tiempoTotal = this.registrosTrabajo.reduce((total: number, registro: any) => {
      return total + (registro.horasInvertidas || 0);
    }, 0);
  }
  
  // Calcular costo total de materiales
  if (this.materialesRequeridos && this.materialesRequeridos.length > 0) {
    this.costoTotal = this.materialesRequeridos.reduce((total: number, material: any) => {
      return total + ((material.costo || 0) * material.cantidad);
    }, 0);
  }
  
  next();
});

export default model<IOrdenTrabajo>('OrdenTrabajo', ordenTrabajoSchema);