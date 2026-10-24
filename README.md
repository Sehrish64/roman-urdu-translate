# Roman Urdu Translate — Chrome Extension

Select any text on a web page and get an instant AI translation into **Roman Urdu** — in 3 styles. Built for readers who are fluent in spoken Urdu but more comfortable reading the Latin script.

## How it works

- **extension/** — a Manifest V3 Chrome extension. Select text on any page and translate it via a small proxy you host yourself.
- **proxy/** — a tiny Python server (no frameworks) that holds your Gemini API key server-side, adds an app-token check and IP rate limiting, and calls Google's Gemini API. Deploy it on any small VPS with `deploy.sh`, then set your key with `set-key.sh`.

The extension never sees your API key — it only talks to your proxy.

## Setup

See [SETUP.md](SETUP.md) for step-by-step instructions.

## Notes

- Keys and tokens are never stored in this repo. The proxy reads its app token from a local file (`app-token.local.txt`, not included) that you create on your own server.
- Free to use and modify.

MIT License.
