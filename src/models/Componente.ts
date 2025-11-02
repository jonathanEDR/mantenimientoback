import { Schema, model, Types } from 'mongoose';

// Enums para los diferentes tipos y estados
export enum ComponenteCategoria {
  FUSELAJE = 'FUSELAJE',
  MOTOR_PRINCIPAL = 'MOTOR_PRINCIPAL',
  TRANSMISION_PRINCIPAL = 'TRANSMISION_PRINCIPAL',
  CUBO_ROTOR_PRINCIPAL = 'CUBO_ROTOR_PRINCIPAL',
  PALAS_ROTOR_PRINCIPAL = 'PALAS_ROTOR_PRINCIPAL',
  PLATO_CICLICO = 'PLATO_CICLICO',
  CAJA_30_GRADOS = 'CAJA_30_GRADOS',
  CUBO_ROTOR_COLA = 'CUBO_ROTOR_COLA',
  PALAS_ROTOR_COLA = 'PALAS_ROTOR_COLA',
  STARTER_GENERADOR = 'STARTER_GENERADOR',
  BATERIAS = 'BATERIAS',
  SISTEMA_HIDRAULICO = 'SISTEMA_HIDRAULICO',
  TREN_ATERRIZAJE = 'TREN_ATERRIZAJE',
  SISTEMA_ELECTRICO = 'SISTEMA_ELECTRICO',
  INSTRUMENTACION = 'INSTRUMENTACION',
  CONTROLES_VUELO = 'CONTROLES_VUELO',
  OTROS = 'OTROS'
}

export enum EstadoComponente {
  INSTALADO = 'INSTALADO',
  EN_ALMACEN = 'EN_ALMACEN',
  EN_MANTENIMIENTO = 'EN_MANTENIMIENTO',
  EN_REPARACION = 'EN_REPARACION',
  TRAMITE_POR_BAJA = 'TRAMITE_POR_BAJA',
  EN_OVERHAUL = 'EN_OVERHAUL',
  PENDIENTE_INSPECCION = 'PENDIENTE_INSPECCION'
}

export enum UnidadVidaUtil {
  HORAS = 'HORAS',
  CICLOS = 'CICLOS',
  CALENDARIO_MESES = 'CALENDARIO_MESES',
  CALENDARIO_ANOS = 'CALENDARIO_ANOS'
}

// Sub-esquemas
const vidaUtilSchema = new Schema({
  limite: { type: Number, required: true },
  unidad: { type: String, enum: Object.values(UnidadVidaUtil), required: true },
  acumulado: { type: Number, default: 0 },
  restante: { type: Number }
}, { _id: false });

const historialUsoSchema = new Schema({
  fechaInstalacion: { type: Date },
  fechaRemocion: { type: Date },
  aeronaveId: { type: Schema.Types.ObjectId, ref: 'Aeronave' },
  horasIniciales: { type: Number, default: 0 },
  horasFinales: { type: Number },
  motivoRemocion: { type: String },
  observaciones: { type: String }
}, { timestamps: true });

const mantenimientoProgramadoSchema = new Schema({
  tipo: { type: String, required: true }, // '100H', '500H', 'OVERHAUL', etc.
  proximoVencimiento: { type: Date },
  horasProximoVencimiento: { type: Number },
  alertaAnticipada: { type: Number, default: 50 }, // Horas antes de alertar
  estado: { type: String, enum: ['VIGENTE', 'VENCIDO', 'PROXIMO'], default: 'VIGENTE' }
}, { _id: false });

// Interface principal
export interface IComponente {
  numeroSerie: string;
  numeroParte: string;
  nombre: string;
  categoria: string; // Código del catálogo de componentes
  fabricante: string;
  fechaFabricacion: Date;
  fechaInstalacion?: Date;
  aeronaveActual?: Types.ObjectId; // Referencia a aeronave donde está instalado
  posicionInstalacion?: string; // Ej: "Main Rotor Hub", "Engine #1"
  estado: EstadoComponente;
  vidaUtil: typeof vidaUtilSchema.obj[];
  historialUso: typeof historialUsoSchema.obj[];
  mantenimientoProgramado: typeof mantenimientoProgramadoSchema.obj[];
  ultimaInspeccion?: Date;
  proximaInspeccion?: Date;
  certificaciones: {
    numeroFormulario8130?: string;
    fechaEmision8130?: Date;
    autoridad?: string;
  };
  ubicacionFisica: string; // Hangar, almacén, taller, etc.
  observaciones?: string;
  documentos?: {
    tipo: string;
    url: string;
    fechaSubida: Date;
  }[];
  alertasActivas: boolean;
}

const componenteSchema = new Schema<IComponente>({
  numeroSerie: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true,
    trim: true
  },
  numeroParte: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  nombre: { type: String, required: true, trim: true },
  categoria: { 
    type: String, 
    required: true,
    index: true,
    trim: true,
    uppercase: true
    // Ya no usa enum hardcodeado - usa códigos del catálogo dinámico
  },
  fabricante: { type: String, required: true, trim: true },
  fechaFabricacion: { type: Date, required: true },
  fechaInstalacion: { type: Date },
  aeronaveActual: { 
    type: Schema.Types.ObjectId, 
    ref: 'Aeronave',
    index: true
  },
  posicionInstalacion: { type: String, trim: true },
  estado: { 
    type: String, 
    enum: Object.values(EstadoComponente), 
    required: true,
    default: EstadoComponente.EN_ALMACEN,
    index: true
  },
  vidaUtil: [vidaUtilSchema],
  historialUso: [historialUsoSchema],
  mantenimientoProgramado: [mantenimientoProgramadoSchema],
  ultimaInspeccion: { type: Date },
  proximaInspeccion: { type: Date },
  certificaciones: {
    numeroFormulario8130: { type: String, trim: true },
    fechaEmision8130: { type: Date },
    autoridad: { type: String, trim: true }
  },
  ubicacionFisica: { type: String, required: true, trim: true },
  observaciones: { type: String, trim: true },
  documentos: [{
    tipo: { type: String, required: true },
    url: { type: String, required: true },
    fechaSubida: { type: Date, default: Date.now }
  }],
  alertasActivas: { type: Boolean, default: false, index: true }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos para mejorar consultas
componenteSchema.index({ categoria: 1, estado: 1 });
componenteSchema.index({ aeronaveActual: 1, estado: 1 });
componenteSchema.index({ alertasActivas: 1, proximaInspeccion: 1 });

// Virtual para calcular días hasta próxima inspección
componenteSchema.virtual('diasHastaProximaInspeccion').get(function(this: IComponente) {
  if (!this.proximaInspeccion) return null;
  
  const ahora = new Date();
  const diferencia = this.proximaInspeccion.getTime() - ahora.getTime();
  return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
});

// Middleware para actualizar alertas antes de guardar
componenteSchema.pre('save', function(next) {
  // Verificar si hay vencimientos próximos
  let tieneAlertas = false;
  
  // Verificar vida útil
  this.vidaUtil.forEach((vida: any) => {
    if (vida.restante !== undefined && typeof vida.restante === 'number' && vida.restante <= 50) {
      tieneAlertas = true;
    }
  });
  
  // Verificar próxima inspección
  if (this.proximaInspeccion) {
    const ahora = new Date();
    const diferencia = this.proximaInspeccion.getTime() - ahora.getTime();
    const diasRestantes = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    if (diasRestantes <= 30) {
      tieneAlertas = true;
    }
  }
  
  this.alertasActivas = tieneAlertas;
  next();
});

// Virtual para obtener estados de monitoreo asociados
componenteSchema.virtual('estadosMonitoreo', {
  ref: 'EstadoMonitoreoComponente',
  localField: '_id',
  foreignField: 'componenteId'
});

// Asegurar que los virtuals se incluyan en JSON
componenteSchema.set('toJSON', { virtuals: true });
componenteSchema.set('toObject', { virtuals: true });

export default model<IComponente>('Componente', componenteSchema);