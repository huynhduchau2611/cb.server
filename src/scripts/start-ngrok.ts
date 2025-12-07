import { forward } from '@ngrok/ngrok';
import dotenv from 'dotenv';

// Load environment variables from .env file (from project root)
dotenv.config();

const PORT = process.env.PORT || 4000;

async function startNgrokTunnel() {
  try {
    // Check if NGROK_AUTHTOKEN is set
    const authtoken = process.env.NGROK_AUTHTOKEN;
    
    if (!authtoken) {
      console.error('❌ NGROK_AUTHTOKEN is not set!');
      process.exit(1);
    }

    // Use @ngrok/ngrok API
    const listener = await forward({
      addr: Number(PORT),
      authtoken: authtoken,
    });

    const url = listener.url();
    console.log('📡 Webhook URL:', `${url}/api/payments/webhook`);

    // Handle graceful shutdown
    let isShuttingDown = false;
    
    const shutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      try {
        await listener.close();
      } catch (err) {
        // Ignore errors on shutdown
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep the process running
    setInterval(() => {
      // Keep process alive
    }, 1000);
    
    // Keep process alive by preventing it from exiting
    // This ensures the process stays running until Ctrl+C
    setInterval(() => {
      // Just keep the process alive
    }, 1000);

  } catch (error: any) {
    console.error('❌ Failed to start ngrok:', error.message);
    process.exit(1);
  }
}

// Start the tunnel
startNgrokTunnel();

