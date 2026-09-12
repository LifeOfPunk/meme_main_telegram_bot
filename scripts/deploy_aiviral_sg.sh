#!/usr/bin/env bash
set -e

SERVER_IP="34.87.166.31"
SERVER_USER="aiviral_agency_gmail_com"
REMOTE_DIR="/opt/aiviral/viralapp-bot"
SSH_KEY="${HOME}/.ssh/id_ed25519_viral_farm_vm_ci"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying ViralApp Bot to GCP Singapore ($SERVER_IP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP"

echo "📡 Checking SSH connection..."
$SSH_CMD "echo '✅ SSH connection established to' \$(hostname)"

echo "📁 Ensuring remote directory $REMOTE_DIR..."
$SSH_CMD "sudo mkdir -p $REMOTE_DIR && sudo chown -R $SERVER_USER:$SERVER_USER $REMOTE_DIR"

echo "📤 Syncing project files..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'logs' \
    --exclude 'tmp' \
    --exclude 'temp' \
    --exclude '*.bak*' \
    --exclude '*.save' \
    --exclude '.env.save' \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    ./ "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

if [ -f ".env" ]; then
    echo "🔐 Syncing .env..."
    rsync -avz -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" .env "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/.env"
fi

echo "🐳 Building and starting Docker containers..."
$SSH_CMD << 'EOF'
set -e
cd /opt/aiviral/viralapp-bot

echo "🔄 Rebuilding Docker containers..."
sudo docker compose up -d --build

echo "⏳ Waiting 5s for services to initialize..."
sleep 5

echo "📊 Container status:"
sudo docker compose ps

echo "📋 Bot logs:"
sudo docker compose logs --tail 25 bot
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ViralApp Bot deployment complete on $SERVER_IP!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
