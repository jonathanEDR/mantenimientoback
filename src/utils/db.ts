import mongoose from 'mongoose';
import logger from './logger';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in env');
  await mongoose.connect(uri, {
    // useNewUrlParser and useUnifiedTopology are default in mongoose v6+
  });
  logger.info('Connected to MongoDB');
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (err) {
    logger.warn('Error during MongoDB disconnect: %s', (err as Error).message);
  }
}
