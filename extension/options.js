const DEFAULTS = {
  provider: "proxy",
  geminiKey: "",
  geminiModel: "gemini-2.5-flash",
  groqKey: "",
  groqModel: "llama-3.3-70b-versatile",
  style: "casual"
};
const $ = (id) => document.getElementById(id);
const fields = ["provider", "geminiKey", "geminiModel", "groqKey", "groqModel", "style"];

function toggle() {
  const p = $("provider").value;
  $("geminiBox").classList.toggle("hide", p !== "gemini");
  $("groqBox").classList.toggle("hide", p !== "groq");
}

chrome.storage.sync.get(DEFAULTS).then((s) => {
  fields.forEach((f) => ($(f).value = s[f] ?? DEFAULTS[f]));
  toggle();
});

$("provider").addEventListener("change", toggle);

$("save").addEventListener("click", async () => {
  const data = {};
  fields.forEach((f) => (data[f] = $(f).value.trim() || DEFAULTS[f]));
  await chrome.storage.sync.set(data);
  $("msg").textContent = "Save ho gaya ✓";
  setTimeout(() => ($("msg").textContent = ""), 2000);
});
