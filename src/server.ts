import { createServer } from 'http';
import App from './app';
import { connectDatabase } from '@/config/database';
import { startExpiredPostsScheduler } from './utils/expired-posts-scheduler';
import { SocketService } from './utils/socket.util';

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Initialize Express app
    const app = new App();
    const expressApp = app.getApp();

    // Create HTTP server
    const httpServer = createServer(expressApp);

    // Initialize WebSocket server
    const socketService = new SocketService(httpServer);
    // Store socket service globally for access from controllers
    (global as any).socketService = socketService;
    console.log('✅ WebSocket server initialized');

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`💬 WebSocket server is ready`);
      console.log('');
      console.log('💡 To start ngrok tunnel, run: npm run ngrok');
      console.log('');
      
      // Start scheduled job to update expired posts
      // ⬇️ CHỈNH SỐ Ở ĐÂY ĐỂ THAY ĐỔI THỜI GIAN CHẠY ĐỊNH KỲ ⬇️
      // Công thức: số giờ = số phút / 60
      // Ví dụ:
      // - 0.01667 = 1 phút (để test)
      // - 0.5 = 30 phút
      // - 1 = 1 giờ (production - khuyến nghị)
      // - 2 = 2 giờ
      // - 6 = 6 giờ
      // - 12 = 12 giờ
      // - 24 = 24 giờ (1 ngày)
      const intervalHours = 1; // ⬅️ SỬA SỐ NÀY (đơn vị: giờ)
      startExpiredPostsScheduler(intervalHours);
      console.log(`⏰ Expired posts scheduler started (runs every ${intervalHours} hour(s))`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();