import { Schema, model } from 'mongoose';

// Enum para roles de usuario (mantenemos los 4 roles existentes)
export enum UserRole {
  ADMINISTRADOR = 'ADMINISTRADOR',
  MECANICO = 'MECANICO',
  PILOTO = 'PILOTO',
  ESPECIALISTA = 'ESPECIALISTA'
}

// Estructura mejorada para auditoría de roles
export interface IRoleHistory {
  previousRole: UserRole;
  newRole: UserRole;
  changedBy: string; // ClerkId del usuario que hizo el cambio
  changedAt: Date;
  reason?: string;
}

// Interface mejorada para el usuario
export interface IUser {
  clerkId: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string; // Optional since Clerk handles auth
  
  // Campos de auditoría mejorados
  isActive: boolean;
  lastLoginAt?: Date;
  roleHistory: IRoleHistory[];
  
  // Metadatos adicionales
  createdBy?: string; // ClerkId del usuario que creó este usuario
  updatedBy?: string; // ClerkId del usuario que actualizó por última vez
}

// Schema mejorado para auditoría de roles
const roleHistorySchema = new Schema<IRoleHistory>({
  previousRole: { 
    type: String, 
    enum: Object.values(UserRole), 
    required: true 
  },
  newRole: { 
    type: String, 
    enum: Object.values(UserRole), 
    required: true 
  },
  changedBy: { type: String, required: true },
  changedAt: { type: Date, default: Date.now },
  reason: { type: String }
}, { _id: false });

// Schema principal del usuario mejorado
const userSchema = new Schema<IUser>({
  clerkId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true // Índice para búsquedas rápidas
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    index: true
  },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    required: true, 
    default: UserRole.ESPECIALISTA,
    index: true // Índice para filtros por rol
  },
  password: { type: String }, // Optional since Clerk handles auth
  
  // Campos de auditoría
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  lastLoginAt: { type: Date },
  roleHistory: [roleHistorySchema],
  
  // Metadatos de gestión
  createdBy: { type: String },
  updatedBy: { type: String }
}, { 
  timestamps: true,
  // Configuraciones adicionales para optimización
  collection: 'users'
});

// Índices compuestos para consultas eficientes
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// Middleware pre-save para auditoría automática
userSchema.pre('save', function(next) {
  if (this.isModified('role') && !this.isNew) {
    // Registrar cambio de rol en el historial
    const previousRole = this.getChanges().$set?.role || this.role;
    if (previousRole !== this.role) {
      this.roleHistory.push({
        previousRole: previousRole as UserRole,
        newRole: this.role,
        changedBy: this.updatedBy || 'system',
        changedAt: new Date(),
        reason: 'Role updated via API'
      });
    }
  }
  next();
});

// Método para obtener permisos efectivos del usuario
userSchema.methods.getEffectivePermissions = function() {
  // Este método será implementado por el PermissionService
  return [];
};

// Método para verificar si el usuario está activo
userSchema.methods.isUserActive = function(): boolean {
  return this.isActive === true;
};

// Método estático para buscar usuarios por rol
userSchema.statics.findByRole = function(role: UserRole, activeOnly: boolean = true) {
  const query: any = { role };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query);
};

export default model<IUser>('User', userSchema);
