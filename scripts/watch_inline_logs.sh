#!/bin/bash

echo "👀 Watching for inline query logs..."
echo "Press Ctrl+C to stop"
echo ""

pm2 logs meemee-bot --lines 0 | grep -i "inline"
