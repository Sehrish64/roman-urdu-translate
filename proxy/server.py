#!/usr/bin/env python3
# roman-urdu-proxy — VPS version (worker.js ka Python roop, sirf stdlib)
# Kaam: extension se text lo, API key SERVER par chhupa kar Gemini/Groq se
# Roman Urdu tarjuma karwao, jawab wapas bhejo.
#
# Config: isi folder ki .env file (ya environment variables):
#   PROVIDER=gemini        (ya "groq")
#   GEMINI_API_KEY=AIza...
#   GROQ_API_KEY=gsk_...   (sirf jab PROVIDER=groq)
#   APP_TOKEN=lambi random string (extension ke background.js jaisi)
#   PORT=8100              (optional, default 8100)
import json
import os
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))


def load_env():
    env = dict(os.environ)
    path = os.path.join(BASE, ".env")
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env


ENV = load_env()
MAX_CHARS = 4000

STYLE_HINTS = {
    "casual": "Style: casual, jaisa Pakistani log WhatsApp par dost ko likhte hain. Chhote, rozmarra ke alfaaz.",
    "simple": "Style: bohot aasan, jaisa kisi student ko samjhate hain. Mushkil alfaaz ki jagah aam alfaaz, zaroorat ho to chhoti wazahat.",
    "formal": "Style: tameez wala, thoda formal (aap, janab), lekin phir bhi Roman Urdu mein.",
}


def build_system_prompt(style):
    return """You convert any input text into natural Roman Urdu: Urdu written in Latin letters, exactly the way Pakistanis type on WhatsApp.

Rules:
- Output ONLY the Roman Urdu text. No Urdu/Arabic script, no explanations, no quotes, no labels.
- Translate the meaning naturally. Do NOT do word-by-word transliteration.
- Use common everyday spellings: hai, hain, nahi, kya, aap, mein, ka/ki/ke, ko, se, tha/thi, raha/rahi, karna, hoga.
- No diacritics or special characters.
- Keep everyday English loanwords as they are (computer, bill, meeting, phone, exam, internet, app).
- Keep names, numbers, URLs, emails, code and emojis unchanged.
- Keep the original line breaks and paragraph structure.
- If the input is already Roman Urdu, just clean it up and return it.
%s

Examples:
Input: How are you doing today?
Output: Aaj aap kaise hain?
Input: The meeting has been postponed to Friday.
Output: Meeting Friday tak aage barha di gayi hai.
Input: Your electricity bill is higher than last month.
Output: Aapka bijli ka bill pichhle mahine se zyada aaya hai.""" % STYLE_HINTS.get(style, STYLE_HINTS["casual"])


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
}

# Halki si IP rate limit (soft guard): 60 tarjume / 10 minute / IP
_hits = {}


def rate_limited(ip):
    now = time.time()
    win = _hits.get(ip)
    if not win or now - win[0] > 600:
        _hits[ip] = [now, 1]
        return False
    win[1] += 1
    return win[1] > 60


def http_json(url, headers, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def call_gemini(text, style):
    model = ENV.get("GEMINI_MODEL") or "gemini-3.8-flash"
    status, data = http_json(
        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model,
        {"x-goog-api-key": ENV.get("GEMINI_API_KEY", "")},
        {
            "systemInstruction": {"parts": [{"text": build_system_prompt(style)}]},
            "contents": [{"role": "user", "parts": [{"text": text}]}],
            "generationConfig": {"temperature": 0.3},
        },
    )
    if status != 200:
        raise RuntimeError((data.get("error") or {}).get("message") or "Gemini error %s" % status)
    parts = ((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts).strip()


def call_groq(text, style):
    status, data = http_json(
        "https://api.groq.com/openai/v1/chat/completions",
        {"Authorization": "Bearer %s" % ENV.get("GROQ_API_KEY", "")},
        {
            "model": ENV.get("GROQ_MODEL") or "llama-3.3-70b-versatile",
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": build_system_prompt(style)},
                {"role": "user", "content": text},
            ],
        },
    )
    if status != 200:
        raise RuntimeError((data.get("error") or {}).get("message") or "Groq error %s" % status)
    return ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _send(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS.items():
            self.send_header(k, v)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/health"):
            self._send({"ok": True, "provider": ENV.get("PROVIDER", "gemini")})
        else:
            self._send({"error": "Sirf POST chalega."}, 405)

    def do_POST(self):
        token = ENV.get("APP_TOKEN", "")
        if token and self.headers.get("X-App-Token") != token:
            return self._send({"error": "Token theek nahi."}, 401)
        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
        if rate_limited(ip):
            return self._send({"error": "Bohat zyada requests — thodi dair baad try karo."}, 429)
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length).decode() or "{}")
        except Exception:
            return self._send({"error": "JSON body theek nahi."}, 400)
        text = str(body.get("text") or "").strip()[:MAX_CHARS]
        if not text:
            return self._send({"error": "Text khaali hai."}, 400)
        style = str(body.get("style") or "casual").lower()
        try:
            out = call_gemini(text, style) if (ENV.get("PROVIDER") or "gemini") == "gemini" else call_groq(text, style)
            if not out:
                return self._send({"error": "Khaali jawab aaya, dobara try karo."}, 502)
            self._send({"result": out})
        except Exception as e:
            self._send({"error": str(e) or "Upstream error"}, 502)


if __name__ == "__main__":
    port = int(ENV.get("PORT") or 8100)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
