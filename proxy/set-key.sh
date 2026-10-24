#!/bin/bash
# Gemini API key ko VPS ki .env file mein mehfooz tareeqe se lagata hai.
# Istemal: bash ~/roman-urdu-proxy/set-key.sh   (key screen par nazar nahi ayegi)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$DIR/.env"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
read -r -s -p "Gemini API key paste karo (nazar nahi ayegi), phir Enter: " KEY
echo
if [ -z "$KEY" ]; then
  echo "Key khaali hai — kuch nahi badla."
  exit 1
fi
grep -v '^GEMINI_API_KEY=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
echo "GEMINI_API_KEY=$KEY" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "Key lag gayi. Ab server restart ho raha hai..."
pkill -f "roman-urdu-proxy/server.py" 2>/dev/null || true
sleep 1
cd "$DIR"
nohup python3 "$DIR/server.py" > server.log 2>&1 &
sleep 1
curl -s http://127.0.0.1:8100/health && echo " <- server zinda hai"
echo "Ho gaya!"
