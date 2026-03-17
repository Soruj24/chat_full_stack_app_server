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
    connectionPromise = mongoose.connect(mongoUri);
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
