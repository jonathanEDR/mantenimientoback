import mongoose from 'mongoose';
import logger from './logger';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in env');
  
  // Configuración optimizada para producción
  await mongoose.connect(uri, {
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '20'), // Máximo 20 conexiones
    serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000'), // 5 segundos
    socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000'), // 45 segundos
    maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '30000'), // 30 segundos
    bufferCommands: process.env.DB_BUFFER_COMMANDS !== 'false', // Deshabilitar en producción

  });
  
  logger.info('Connected to MongoDB with optimized settings', {
    maxPoolSize: process.env.MONGODB_MAX_POOL_SIZE || '20',
    bufferCommands: process.env.DB_BUFFER_COMMANDS !== 'false'
  });
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (err) {
    logger.warn('Error during MongoDB disconnect: %s', (err as Error).message);
  }
}
