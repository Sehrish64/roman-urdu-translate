// Roman Urdu Translate - content script
(() => {
  if (window.__ruTranslateLoaded) return;
  window.__ruTranslateLoaded = true;

  const MAX_CHARS = 4000;
  let host, root, btn, card, lastText = "", lastRect = null;

  function ensureUI() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:absolute;top:0;left:0;z-index:2147483647;";
    root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
        .btn {
          position: fixed; display: none; align-items: center; gap: 6px;
          background: #0f9d58; color: #fff; border: 0; border-radius: 999px;
          padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,.25);
        }
        .btn:hover { background: #0b8043; }
        .card {
          position: fixed; display: none; width: min(380px, calc(100vw - 24px));
          background: #fff; color: #1f2328; border-radius: 14px; padding: 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,.28); border: 1px solid #e5e7eb;
        }
        .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .title { font-size: 12px; font-weight: 700; color: #0f9d58; letter-spacing:.3px; }
        .x { background:none; border:0; font-size:18px; cursor:pointer; color:#6b7280; line-height:1; }
        .out { font-size: 15px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; max-height: 260px; overflow:auto; }
        .out.loading { color:#6b7280; font-style: italic; }
        .out.err { color:#b42318; font-size: 13px; }
        .row { display:flex; gap:8px; margin-top:10px; }
        .act { border:1px solid #d0d5dd; background:#f9fafb; color:#1f2328; border-radius:8px; padding:5px 10px; font-size:12px; cursor:pointer; }
        .act:hover { background:#eef2f6; }
        @media (prefers-color-scheme: dark) {
          .card { background:#1f2328; color:#e6edf3; border-color:#30363d; }
          .act { background:#2d333b; color:#e6edf3; border-color:#444c56; }
          .act:hover { background:#373e47; }
          .x { color:#9ca3af; }
          .out.loading { color:#9ca3af; }
        }
      </style>
      <button class="btn" id="btn">🇵🇰 Roman Urdu</button>
      <div class="card" id="card">
        <div class="head"><span class="title">ROMAN URDU</span><button class="x" id="x" title="Band karo">×</button></div>
        <div class="out" id="out"></div>
        <div class="row" id="row"></div>
      </div>`;
    document.documentElement.appendChild(host);
    btn = root.getElementById("btn");
    card = root.getElementById("card");
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep selection alive
    btn.addEventListener("click", () => runTranslate(lastText));
    root.getElementById("x").addEventListener("click", hideAll);
  }

  function hideAll() {
    if (btn) btn.style.display = "none";
    if (card) card.style.display = "none";
  }

  function place(el, rect, width, below = true) {
    const margin = 8;
    const w = width;
    let left = Math.min(Math.max(rect.left, margin), window.innerWidth - w - margin);
    let top = below ? rect.bottom + margin : rect.top - margin;
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  function showButton(rect) {
    ensureUI();
    card.style.display = "none";
    btn.style.display = "flex";
    place(btn, rect, 140);
    // keep button inside viewport vertically
    const top = parseFloat(btn.style.top);
    if (top > window.innerHeight - 40) btn.style.top = Math.max(rect.top - 40, 8) + "px";
  }

  function showCard(rect) {
    ensureUI();
    btn.style.display = "none";
    card.style.display = "block";
    place(card, rect, 380);
    const h = card.offsetHeight;
    let top = parseFloat(card.style.top);
    if (top + h > window.innerHeight - 8) card.style.top = Math.max(rect.top - h - 8, 8) + "px";
  }

  function setOut(text, cls = "") {
    const out = root.getElementById("out");
    out.className = "out " + cls;
    out.textContent = text;
  }

  function setActions(result, original) {
    const row = root.getElementById("row");
    row.innerHTML = "";
    const copy = document.createElement("button");
    copy.className = "act";
    copy.textContent = "Copy";
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(result); copy.textContent = "Copy ho gaya ✓"; }
      catch { copy.textContent = "Copy nahi hua"; }
      setTimeout(() => (copy.textContent = "Copy"), 1500);
    };
    const again = document.createElement("button");
    again.className = "act";
    again.textContent = "Dobara";
    again.onclick = () => runTranslate(original);
    row.append(copy, again);
  }

  function runTranslate(text) {
    text = (text || "").trim();
    if (!text) return;
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
    const rect = lastRect || { left: 20, top: 20, bottom: 20 };
    showCard(rect);
    setOut("Tarjuma ho raha hai…", "loading");
    root.getElementById("row").innerHTML = "";

    try {
      chrome.runtime.sendMessage({ type: "translate", text }, (resp) => {
        if (chrome.runtime.lastError) {
          setOut("Extension update hui hai. Page refresh karke dobara try karo.", "err");
          return;
        }
        if (!resp?.ok) {
          if (resp?.error === "NO_KEY") {
            setOut("Pehle API key lagani hai (free). Neeche button se settings kholo.", "err");
            const row = root.getElementById("row");
            row.innerHTML = "";
            const b = document.createElement("button");
            b.className = "act";
            b.textContent = "Settings kholo";
            b.onclick = () => chrome.runtime.sendMessage({ type: "open-options" });
            row.append(b);
          } else {
            setOut(resp?.error || "Kuch masla aa gaya.", "err");
          }
          return;
        }
        setOut(resp.result);
        setActions(resp.result, text);
        showCard(rect);
      });
    } catch {
      setOut("Extension update hui hai. Page refresh karke dobara try karo.", "err");
    }
  }

  function onSelectionChange(e) {
    // ignore clicks inside our own UI
    if (host && e && e.composedPath && e.composedPath().includes(host)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || text.length < 2) {
        if (btn && btn.style.display !== "none") btn.style.display = "none";
        return;
      }
      if (sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      lastText = text;
      lastRect = { left: rect.left, top: rect.top, bottom: rect.bottom };
      showButton(lastRect);
    }, 10);
  }

  document.addEventListener("mouseup", onSelectionChange);
  document.addEventListener("keyup", (e) => {
    if (e.shiftKey || e.key === "Shift" || e.key.startsWith("Arrow")) onSelectionChange(e);
  });
  document.addEventListener("mousedown", (e) => {
    if (host && e.composedPath().includes(host)) return;
    hideAll();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideAll(); });
  window.addEventListener("scroll", () => { if (btn) btn.style.display = "none"; }, { passive: true });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "translate-selection") {
      const sel = window.getSelection();
      const text = (msg.text || (sel ? sel.toString() : "")).trim();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        lastRect = { left: r.left, top: r.top, bottom: r.bottom };
      }
      runTranslate(text);
    }
  });
})();
