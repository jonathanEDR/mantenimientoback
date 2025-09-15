import { Schema, model } from 'mongoose';

export interface IUser {
  clerkId: string;
  name: string;
  email: string;
  password?: string; // Optional since Clerk handles auth
}

const userSchema = new Schema<IUser>({
  clerkId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String } // Optional
}, { timestamps: true });

export default model<IUser>('User', userSchema);
