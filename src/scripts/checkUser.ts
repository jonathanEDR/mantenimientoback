import mongoose from 'mongoose';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MantenimientosDB');
    console.log('✅ Conectado a MongoDB');

    const clerkId = 'user_32mztGbKipp1tCC9u5lMIxNNFeU';

    const user = await User.findOne({ clerkId });

    if (!user) {
      console.log('❌ Usuario NO encontrado con clerkId:', clerkId);
    } else {
      console.log('✅ Usuario encontrado:');
      console.log('  - Name:', user.name);
      console.log('  - Email:', user.email);
      console.log('  - Role:', user.role);
      console.log('  - isActive:', user.isActive);
      console.log('  - clerkId:', user.clerkId);
      console.log('  - _id:', user._id);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
