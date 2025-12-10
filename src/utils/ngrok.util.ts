import ngrok from 'ngrok';

let ngrokUrl: string | null = null;

/**
 * Start ngrok tunnel
 * @param port - Port to tunnel (default: 4000)
 * @returns ngrok public URL
 */
export async function startNgrok(port: number = 4000): Promise<string> {
  try {
    // Check if ngrok is already running
    if (ngrokUrl) {
      console.log('📡 Ngrok is already running:', ngrokUrl);
      return ngrokUrl;
    }

    // Check if NGROK_AUTHTOKEN is set
    const authtoken = process.env.NGROK_AUTHTOKEN;
    if (authtoken) {
      await ngrok.authtoken(authtoken);
    }

    // Start ngrok tunnel
    const url = await ngrok.connect({
      addr: port,
      authtoken: authtoken,
    });

    ngrokUrl = url;
    console.log('✅ Ngrok tunnel started successfully!');
    console.log('📡 Public URL:', url);
    console.log('🔗 Webhook URL:', `${url}/api/payments/webhook`);
    console.log('');
    console.log('💡 Copy the webhook URL above and:');
    console.log('   1. Update PAYOS_WEBHOOK_URL in .env file');
    console.log('   2. Or update webhook URL in PayOS dashboard');
    console.log('');

    return url;
  } catch (error: any) {
    console.error('❌ Failed to start ngrok:', error.message);
    if (error.message.includes('authtoken')) {
      console.error('💡 Tip: Set NGROK_AUTHTOKEN in .env file');
      console.error('   Get authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken');
    }
    throw error;
  }
}

/**
 * Stop ngrok tunnel
 */
export async function stopNgrok(): Promise<void> {
  try {
    if (ngrokUrl) {
      await ngrok.disconnect();
      ngrokUrl = null;
      console.log('🛑 Ngrok tunnel stopped');
    }
  } catch (error: any) {
    console.error('❌ Failed to stop ngrok:', error.message);
  }
}

/**
 * Get current ngrok URL
 */
export function getNgrokUrl(): string | null {
  return ngrokUrl;
}

