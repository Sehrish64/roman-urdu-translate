// Roman Urdu Translate - background service worker (MV3)

// ===== PROXY SETTINGS (Sehrish: Worker deploy ke baad yahan apna URL daalo) =====
// Cloudflare Worker ka URL, masalan: "https://roman-urdu-proxy.sehrish.workers.dev"
// APP_TOKEN wohi rakho jo Worker ke secret APP_TOKEN mein hai.
const PROXY_URL = "https://controlling-casey-nato-ownership.trycloudflare.com";
const APP_TOKEN = 'YOUR_APP_TOKEN_HERE';

const DEFAULTS = {
  provider: "proxy",
  geminiKey: "",
  geminiModel: "gemini-2.5-flash",
  groqKey: "",
  groqModel: "llama-3.3-70b-versatile",
  style: "casual"
};

const STYLE_HINTS = {
  casual:
    "Style: casual, jaisa Pakistani log WhatsApp par dost ko likhte hain. Chhote, rozmarra ke alfaaz.",
  simple:
    "Style: bohot aasan, jaisa kisi student ko samjhate hain. Mushkil alfaaz ki jagah aam alfaaz, zaroorat ho to chhoti wazahat.",
  formal:
    "Style: tameez wala, thoda formal (aap, janab), lekin phir bhi Roman Urdu mein."
};

function buildSystemPrompt(style) {
  return `You convert any input text into natural Roman Urdu: Urdu written in Latin letters, exactly the way Pakistanis type on WhatsApp.

Rules:
- Output ONLY the Roman Urdu text. No Urdu/Arabic script, no explanations, no quotes, no labels.
- Translate the meaning naturally. Do NOT do word-by-word transliteration.
- Use common everyday spellings: hai, hain, nahi, kya, aap, mein, ka/ki/ke, ko, se, tha/thi, raha/rahi, karna, hoga.
- No diacritics or special characters.
- Keep everyday English loanwords as they are (computer, bill, meeting, phone, exam, internet, app).
- Keep names, numbers, URLs, emails, code and emojis unchanged.
- Keep the original line breaks and paragraph structure.
- If the input is already Roman Urdu, just clean it up and return it.
${STYLE_HINTS[style] || STYLE_HINTS.casual}

Examples:
Input: How are you doing today?
Output: Aaj aap kaise hain?
Input: The meeting has been postponed to Friday.
Output: Meeting Friday tak aage barha di gayi hai.
Input: Your electricity bill is higher than last month.
Output: Aapka bijli ka bill pichhle mahine se zyada aaya hai.`;
}

async function getSettings() {
  return chrome.storage.sync.get(DEFAULTS).then((s) => ({ ...DEFAULTS, ...s }));
}

async function callGemini(text, s) {
  if (!s.geminiKey) throw new Error("NO_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    s.geminiModel
  )}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": s.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(s.style) }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.3 }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini error ${res.status}`);
  const out = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!out) throw new Error("Khaali jawab aaya, dobara try karo.");
  return out;
}

async function callGroq(text, s) {
  if (!s.groqKey) throw new Error("NO_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.groqKey}` },
    body: JSON.stringify({
      model: s.groqModel,
      temperature: 0.3,
      messages: [
        { role: "system", content: buildSystemPrompt(s.style) },
        { role: "user", content: text }
      ]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Groq error ${res.status}`);
  const out = (data?.choices?.[0]?.message?.content || "").trim();
  if (!out) throw new Error("Khaali jawab aaya, dobara try karo.");
  return out;
}

async function callProxy(text, s) {
  let res;
  try {
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-App-Token": APP_TOKEN },
      body: JSON.stringify({ text, style: s.style })
    });
  } catch {
    throw new Error("Proxy se rabta nahi hua. Internet ya Worker URL check karo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Proxy error ${res.status}`);
  const out = (data?.result || "").trim();
  if (!out) throw new Error("Khaali jawab aaya, dobara try karo.");
  return out;
}

async function translate(text) {
  const s = await getSettings();
  const clean = text.trim().slice(0, 4000);
  if (s.provider === "groq") return callGroq(clean, s);
  if (s.provider === "gemini") return callGemini(clean, s);
  return callProxy(clean, s);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "translate") {
    translate(msg.text)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
    return true; // keep channel open for async response
  }
  if (msg?.type === "open-options") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: "roman-urdu",
    title: "Roman Urdu mein tarjuma",
    contexts: ["selection"]
  });
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "roman-urdu" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "translate-selection", text: info.selectionText || "" });
  }
});
