import mongoose from "mongoose";
import { mongoUri } from "../secret";

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDatabase = async (): Promise<void> => {
  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (connectionPromise) {
    await connectionPromise;
    return;
  }
  try {
    const maskedUri = mongoUri.replace(/\/\/(.*):(.*)@/, "//***:***@");
    console.log(`🔌 Connecting to MongoDB: ${maskedUri}...`);
    
    mongoose.connection.on('connected', () => console.log('📡 Mongoose connected to DB'));
    mongoose.connection.on('error', (err) => console.error('📡 Mongoose connection error:', err));
    mongoose.connection.on('disconnected', () => console.log('📡 Mongoose disconnected'));

    const options: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      family: 4,
    };
    connectionPromise = mongoose.connect(mongoUri, options);
    await connectionPromise;
    console.log(`✅ MongoDB Connected`);
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    // Do not exit in serverless environment; rethrow to let caller decide
    throw error;
  } finally {
    connectionPromise = null;
  }
};
