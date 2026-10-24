# Roman Urdu Translate — Proxy Setup (Sehrish ke liye)

## Hisse
1. `proxy/worker.js` — Cloudflare Worker ka code (sudhra hua)
2. `extension-proxy/` — extension ka naya version (1.1.0), default provider = Free Proxy

## Step 1 — Cloudflare Worker deploy karo
1. cloudflare.com par free account banao → Workers & Pages → Create → Worker → naam: `roman-urdu-proxy`
2. Worker ke code ki jagah `proxy/worker.js` ka pura code paste karo → Deploy
3. Worker → Settings → Variables and Secrets mein ye lagao (Secret type):
   - `PROVIDER` = `groq`
   - `GROQ_API_KEY` = tumhari Groq key (console.groq.com/keys se, free)
   - `APP_TOKEN` = koi lambi random string (khud bana lo, masalan 30 characters) — **yaad rakhna, Step 2 mein yehi chahiye**
   - (Agar Gemini use karna ho: `PROVIDER` = `gemini` aur `GEMINI_API_KEY` bhi lagao)
4. Worker ka URL note karo, masalan: `https://roman-urdu-proxy.<tumhara-naam>.workers.dev`

## Step 2 — Extension mein URL jorro
`extension-proxy/background.js` ke sab se upar do lines hain:
- `PROXY_URL` = apna Worker URL (Step 1 wala)
- `APP_TOKEN` = wohi string jo Worker secret mein lagayi thi

## Step 3 — Extension load karo
1. Chrome → `chrome://extensions` → Developer mode ON
2. Load unpacked → `extension-proxy` folder chuno
3. Kisi page par English text select karo → 🇵🇰 Roman Urdu button → tarjuma card mein!

## Test report (22 Oct 2026, Mulaa Habibi)
- Worker logic: 7/7 checks PASS (token check, sahi tarjuma flow, khaali text, ghalat method, CORS, upstream error par saaf jawab)
- Asal Chrome test: extension load hui, select karne par button aya, card khula — Worker deploy se pehle wahan saaf error aata hai ("Proxy se rabta nahi hua"), jo deploy ke baad asal tarjume se badal jayega.
