import { Schema, model } from 'mongoose';

// Enum para roles de usuario
export enum UserRole {
  ADMINISTRADOR = 'ADMINISTRADOR',
  MECANICO = 'MECANICO',
  COPILOTO = 'COPILOTO',
  ESPECIALISTA = 'ESPECIALISTA'
}

export interface IUser {
  clerkId: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string; // Optional since Clerk handles auth
}

const userSchema = new Schema<IUser>({
  clerkId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    required: true, 
    default: UserRole.ESPECIALISTA 
  },
  password: { type: String } // Optional
}, { timestamps: true });

export default model<IUser>('User', userSchema);
