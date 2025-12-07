import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    // Disconnect first to clear any cached connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27020/careerbridge?authSource=admin';

    await mongoose.connect(mongoUri, {
      // Ensure proper connection options
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Force new connection
      bufferCommands: false,
    });

    console.log('📦 MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('📦 MongoDB disconnected successfully');
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error);
    throw error;
  }
  //cmt
};
