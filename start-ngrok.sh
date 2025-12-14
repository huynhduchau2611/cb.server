#!/bin/bash

# Script to start ngrok tunnel for PayOS webhook
# Usage: ./start-ngrok.sh

echo "🚀 Starting Ngrok tunnel for PayOS webhook..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok is not installed!"
    echo "   Install with: brew install ngrok/ngrok/ngrok"
    echo "   Or download from: https://ngrok.com/download"
    exit 1
fi

# Check if authtoken is configured
if ! ngrok config check &> /dev/null; then
    echo "⚠️  Ngrok authtoken not configured!"
    echo "   Run: ngrok config add-authtoken YOUR_AUTHTOKEN"
    echo "   Get authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
    exit 1
fi

# Start ngrok tunnel on port 4000
echo "📡 Starting tunnel: http://localhost:4000 -> https://*.ngrok-free.app"
echo ""
echo "💡 After ngrok starts, copy the HTTPS URL and:"
echo "   1. Update PAYOS_WEBHOOK_URL in .env file"
echo "   2. Or update webhook URL in PayOS dashboard"
echo "   3. Webhook endpoint: /api/payments/webhook"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

ngrok http 4000

