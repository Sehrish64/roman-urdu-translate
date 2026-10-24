#!/bin/bash
# Roman Urdu proxy ko VPS par start karta hai: Python server + Cloudflare quick tunnel.
# Tunnel ka URL tunnel-url.txt mein save hota hai (har restart par naya URL banta hai).
# NOTE: pkill patterns jaan boojh kar specific hain taake insta-auto-reply app
# (port 8000, apna alag tunnel) band na ho.
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
pkill -f "roman-urdu-proxy/server.py" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:8100" 2>/dev/null || true
sleep 1
nohup python3 "$DIR/server.py" > server.log 2>&1 &
CF="$(command -v cloudflared || echo "$HOME/cloudflared")"
nohup "$CF" tunnel --url http://127.0.0.1:8100 > tunnel.log 2>&1 &
URL=""
for i in $(seq 1 30); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log | head -1)
  [ -n "$URL" ] && break
  sleep 2
done
echo "$URL" > tunnel-url.txt
echo "Tunnel: $URL"
curl -s http://127.0.0.1:8100/health && echo " <- server health"
