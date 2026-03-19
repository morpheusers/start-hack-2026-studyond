import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  try {
    await mongoose.connect(uri);
    console.log('[DB] Connected to MongoDB Atlas');
  } catch (error) {
    console.error('[DB] Connection error:', error);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] Disconnected from MongoDB');
});
