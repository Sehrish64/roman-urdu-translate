# Roman Urdu Translate (Chrome Extension)

Koi bhi text select karo -> "Roman Urdu" button -> Roman Urdu mein tarjuma (Urdu script nahi).
Right-click menu se bhi chalta hai: "Roman Urdu mein tarjuma".

## Install (developer mode)
1. Zip extract karo.
2. Chrome mein `chrome://extensions` kholo, "Developer mode" on karo.
3. "Load unpacked" dabao aur `roman-urdu-translate` folder chuno.
4. Settings page khulega: free Gemini ya Groq API key lagao, Save karo.
5. Kisi bhi page par text select karke try karo.

## Files
- manifest.json: MV3 config
- background.js: API calls (Gemini / Groq), context menu
- content.js: selection button + result card (Shadow DOM)
- options.html / options.js: settings

## Notes
- Key `chrome.storage.sync` mein save hoti hai (sirf aapke browser/account mein).
- Model ka naam purana ho jaye to settings mein badal do.
