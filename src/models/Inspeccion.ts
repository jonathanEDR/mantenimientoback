import { Schema, model } from 'mongoose';

// Enums para inspecciones
export enum TipoInspeccion {
  PREFLIGHT = 'PREFLIGHT',
  POSTFLIGHT = 'POSTFLIGHT',
  INSPECCION_100H = '100H',
  INSPECCION_500H = '500H',
  INSPECCION_1000H = '1000H',
  INSPECCION_ANUAL = 'ANUAL',
  INSPECCION_ESPECIAL = 'ESPECIAL',
  INSPECCION_CONFORMIDAD = 'CONFORMIDAD',
  INSPECCION_OVERHAUL = 'OVERHAUL'
}

export enum EstadoInspeccion {
  PROGRAMADA = 'PROGRAMADA',
  EN_PROCESO = 'EN_PROCESO',
  COMPLETADA = 'COMPLETADA',
  COMPLETADA_CON_DEFECTOS = 'COMPLETADA_CON_DEFECTOS',
  SUSPENDIDA = 'SUSPENDIDA',
  CANCELADA = 'CANCELADA'
}

export enum SeveridadDefecto {
  CRITICO = 'CRITICO',
  MAYOR = 'MAYOR',
  MENOR = 'MENOR',
  OBSERVACION = 'OBSERVACION'
}

// Sub-esquemas
const itemInspeccionSchema = new Schema({
  numeroItem: { type: String, required: true },
  descripcion: { type: String, required: true },
  referenciaManual: { type: String },
  estado: { type: String, enum: ['CONFORME', 'NO_CONFORME', 'NO_APLICA'], required: true },
  observaciones: { type: String },
  fechaInspeccion: { type: Date, default: Date.now },
  inspector: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fotosAdjuntas: [{
    nombre: String,
    url: String,
    fechaSubida: { type: Date, default: Date.now }
  }]
}, { _id: false });

const defectoSchema = new Schema({
  numeroDefecto: { type: String, required: true },
  componente: { type: String }, // Número de serie del componente afectado
  descripcion: { type: String, required: true },
  severidad: { type: String, enum: Object.values(SeveridadDefecto), required: true },
  accionCorrectiva: { type: String },
  fechaDeteccion: { type: Date, default: Date.now },
  fechaCorreccion: { type: Date },
  detectadoPor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  corregidoPor: { type: Schema.Types.ObjectId, ref: 'User' },
  estado: { type: String, enum: ['ABIERTO', 'EN_PROCESO', 'CORREGIDO', 'VERIFICADO'], default: 'ABIERTO' },
  ordenTrabajoAsociada: { type: Schema.Types.ObjectId, ref: 'OrdenTrabajo' },
  observaciones: { type: String },
  fotosDefecto: [{
    nombre: String,
    url: String,
    fechaSubida: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Interface principal
export interface IInspeccion {
  numeroInspeccion: string;
  aeronave: string; // Matrícula de la aeronave
  tipo: TipoInspeccion;
  fechaProgramada: Date;
  fechaInicio?: Date;
  fechaFinalizacion?: Date;
  horasAeronave: number; // Horas totales de la aeronave al momento de la inspección
  ciclosAeronave?: number; // Ciclos totales si aplica
  estado: EstadoInspeccion;
  inspectorPrincipal: string; // ID del inspector principal
  inspectoresAdicionales?: string[]; // IDs de inspectores adicionales
  itemsInspeccionados: typeof itemInspeccionSchema.obj[];
  defectosEncontrados: typeof defectoSchema.obj[];
  observacionesGenerales?: string;
  limitacionesOperacionales?: string;
  recomendaciones?: string;
  documentosReferencia: {
    manual: string;
    revision: string;
    seccion?: string;
  }[];
  certificacion?: {
    certificadoPor: string; // ID del técnico certificador
    numeroLicencia: string;
    fechaCertificacion: Date;
    observacionesCertificacion: string;
    liberadoVuelo: boolean;
  };
  aprobacion?: {
    aprobadoPor: string; // ID del ingeniero/supervisor
    fechaAprobacion: Date;
    observacionesAprobacion: string;
  };
  proximaInspeccion?: {
    tipo: TipoInspeccion;
    fechaVencimiento: Date;
    horasVencimiento: number;
  };
  tiempoInspeccion?: number; // Tiempo total en horas
  condicionesAmbientales?: {
    temperatura: number;
    humedad: number;
    ubicacion: string;
  };
}

const inspeccionSchema = new Schema<IInspeccion>({
  numeroInspeccion: { 
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
  tipo: { 
    type: String, 
    enum: Object.values(TipoInspeccion), 
    required: true,
    index: true
  },
  fechaProgramada: { type: Date, required: true, index: true },
  fechaInicio: { type: Date },
  fechaFinalizacion: { type: Date },
  horasAeronave: { type: Number, required: true, min: 0 },
  ciclosAeronave: { type: Number, min: 0 },
  estado: { 
    type: String, 
    enum: Object.values(EstadoInspeccion), 
    required: true,
    default: EstadoInspeccion.PROGRAMADA,
    index: true
  },
  inspectorPrincipal: { 
    type: String,
    ref: 'User',
    required: true
  },
  inspectoresAdicionales: [{ 
    type: String,
    ref: 'User'
  }],
  itemsInspeccionados: [itemInspeccionSchema],
  defectosEncontrados: [defectoSchema],
  observacionesGenerales: { type: String },
  limitacionesOperacionales: { type: String },
  recomendaciones: { type: String },
  documentosReferencia: [{
    manual: { type: String, required: true },
    revision: { type: String, required: true },
    seccion: { type: String }
  }],
  certificacion: {
    certificadoPor: { type: String, ref: 'User' },
    numeroLicencia: { type: String },
    fechaCertificacion: { type: Date },
    observacionesCertificacion: { type: String },
    liberadoVuelo: { type: Boolean, default: false }
  },
  aprobacion: {
    aprobadoPor: { type: String, ref: 'User' },
    fechaAprobacion: { type: Date },
    observacionesAprobacion: { type: String }
  },
  proximaInspeccion: {
    tipo: { type: String, enum: Object.values(TipoInspeccion) },
    fechaVencimiento: { type: Date },
    horasVencimiento: { type: Number }
  },
  tiempoInspeccion: { type: Number, min: 0 },
  condicionesAmbientales: {
    temperatura: { type: Number },
    humedad: { type: Number },
    ubicacion: { type: String }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
inspeccionSchema.index({ aeronave: 1, tipo: 1 });
inspeccionSchema.index({ inspectorPrincipal: 1, fechaProgramada: 1 });
inspeccionSchema.index({ estado: 1, fechaProgramada: 1 });
inspeccionSchema.index({ 'defectosEncontrados.estado': 1 });

// Virtual para calcular duración de la inspección
inspeccionSchema.virtual('duracionInspeccion').get(function(this: IInspeccion) {
  if (!this.fechaInicio || !this.fechaFinalizacion) return null;
  
  const diferencia = this.fechaFinalizacion.getTime() - this.fechaInicio.getTime();
  return Math.round(diferencia / (1000 * 60 * 60 * 24 * 100)) / 100; // Días con 2 decimales
});

// Virtual para calcular el porcentaje de conformidad
inspeccionSchema.virtual('porcentajeConformidad').get(function(this: IInspeccion) {
  if (!this.itemsInspeccionados || this.itemsInspeccionados.length === 0) return 0;
  
  const itemsConformes = this.itemsInspeccionados.filter((item: any) => item.estado === 'CONFORME').length;
  return Math.round((itemsConformes / this.itemsInspeccionados.length) * 100);
});

// Virtual para verificar si tiene defectos críticos
inspeccionSchema.virtual('tieneDefectosCriticos').get(function(this: IInspeccion) {
  if (!this.defectosEncontrados || this.defectosEncontrados.length === 0) return false;
  
  return this.defectosEncontrados.some((defecto: any) => 
    defecto.severidad === SeveridadDefecto.CRITICO && defecto.estado !== 'VERIFICADO'
  );
});

// Middleware para generar número de inspección automáticamente
inspeccionSchema.pre('save', async function(next) {
  if (!this.numeroInspeccion) {
    const año = new Date().getFullYear();
    const tipoAbrev = this.tipo.substring(0, 3).toUpperCase();
    
    const ultimaInspeccion = await model('Inspeccion').findOne({
      numeroInspeccion: { $regex: `^INS-${año}-${tipoAbrev}-` }
    }).sort({ numeroInspeccion: -1 });
    
    let siguiente = 1;
    if (ultimaInspeccion) {
      const ultimoNumero = parseInt(ultimaInspeccion.numeroInspeccion.split('-')[3]);
      siguiente = ultimoNumero + 1;
    }
    
    this.numeroInspeccion = `INS-${año}-${tipoAbrev}-${siguiente.toString().padStart(4, '0')}`;
  }
  
  // Calcular tiempo total de inspección si hay fecha inicio y fin
  if (this.fechaInicio && this.fechaFinalizacion) {
    const diferencia = this.fechaFinalizacion.getTime() - this.fechaInicio.getTime();
    this.tiempoInspeccion = Math.round(diferencia / (1000 * 60 * 60) * 100) / 100; // Horas con 2 decimales
  }
  
  next();
});

export default model<IInspeccion>('Inspeccion', inspeccionSchema);