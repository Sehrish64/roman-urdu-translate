#!/bin/bash
# Roman Urdu proxy — meri VM se Oracle VPS par deploy.
# SSH band ho to exit 3 (khamosh). Kaamyab ho to extension pack bhi wire karke zip bana deta hai.
set -u
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
VPS="opc@129.225.86.61"
SSH="ssh -i /home/hatch/.ssh/id_ed25519 -o IdentitiesOnly=yes -o ConnectTimeout=20 -o BatchMode=yes"
SCP="scp -i /home/hatch/.ssh/id_ed25519 -o IdentitiesOnly=yes -o ConnectTimeout=20 -o BatchMode=yes"
APP_TOKEN="$(tr -d '[:space:]' < "$LOCAL_DIR/app-token.local.txt")"

if ! $SSH "$VPS" 'echo ok' >/dev/null 2>&1; then
  echo "SSH_DOWN"
  exit 3
fi
echo "SSH_OK"

$SSH "$VPS" 'mkdir -p ~/roman-urdu-proxy' || exit 4
$SCP "$LOCAL_DIR/server.py" "$LOCAL_DIR/start.sh" "$LOCAL_DIR/set-key.sh" "$VPS:~/roman-urdu-proxy/" || exit 4

# .env banao: maujooda GEMINI_API_KEY mehfooz rakho, baqi values set karo.
# APP_TOKEN ssh ke stdin se jata hai (process list mein nazar nahi ata).
printf 'PROVIDER=gemini\nPORT=8100\nAPP_TOKEN=%s\n' "$APP_TOKEN" | $SSH "$VPS" 'cat > ~/roman-urdu-proxy/.env.base &&
  touch ~/roman-urdu-proxy/.env &&
  grep "^GEMINI_API_KEY=" ~/roman-urdu-proxy/.env >> ~/roman-urdu-proxy/.env.base 2>/dev/null || true;
  mv ~/roman-urdu-proxy/.env.base ~/roman-urdu-proxy/.env &&
  chmod 600 ~/roman-urdu-proxy/.env' || exit 4
echo "FILES_OK"

# @reboot par auto-start (pehle se ho to dobara nahi)
$SSH "$VPS" '(crontab -l 2>/dev/null | grep -v "roman-urdu-proxy/start.sh"; echo "@reboot sleep 25 && bash ~/roman-urdu-proxy/start.sh >> ~/roman-urdu-proxy/boot.log 2>&1") | crontab -' || exit 4

$SSH "$VPS" 'bash ~/roman-urdu-proxy/start.sh' || exit 4
URL="$($SSH "$VPS" 'cat ~/roman-urdu-proxy/tunnel-url.txt' | tr -d '[:space:]')"
echo "TUNNEL_URL=$URL"
[ -n "$URL" ] || exit 5

# Bahir se verification: health + token guard + asal request
echo "HEALTH: $(curl -s --max-time 20 "$URL/health")"
echo "NO_TOKEN: $(curl -s --max-time 20 -X POST "$URL/" -H 'Content-Type: application/json' -d '{"text":"hello"}')"
echo "WITH_TOKEN: $(curl -s --max-time 60 -X POST "$URL/" -H 'Content-Type: application/json' -H "X-App-Token: $APP_TOKEN" -d '{"text":"The meeting is tomorrow."}')"

# Extension pack wire karo: naya folder + zip (purani extension-proxy ko haath nahi lagaya)
PACK="$LOCAL_DIR/../pack-vps"
rm -rf "$PACK"
cp -r "$LOCAL_DIR/../extension-proxy" "$PACK"
sed -i "s|https://roman-urdu-proxy.YOUR-SUBDOMAIN.workers.dev|$URL|" "$PACK/background.js"
sed -i "s|CHANGE-ME-lambi-random-string|$APP_TOKEN|" "$PACK/background.js"
grep -q "trycloudflare.com" "$PACK/background.js" || exit 6
cd "$LOCAL_DIR/.." && rm -f roman-urdu-vps-pack.zip && zip -qr roman-urdu-vps-pack.zip pack-vps
echo "PACK_OK: $LOCAL_DIR/../roman-urdu-vps-pack.zip"
echo "DEPLOY_DONE"
