<div align="center">

# Discord AI Bot (Node.js + discord.js v14)

Lightweight Discord bot with slash commands, a message context menu image explainer powered by Google Gemini, polls, reminders, math utilities, and more.

</div>

## ✨ Features
* Slash commands (guild‑scoped for fast iteration)
* Message context menu: **Explain Image** (AI description of an image you right‑click)
* AI text Q&A via Gemini (`/ask`)
* Image explanation via `/explain_image` with direct attachment upload (and fallback to replying)
* Poll creation with live button vote counts
* Reminders via DM (fallback to channel if DM blocked)
* Basic user + math utilities
* Long AI responses are auto‑chunked to respect the 2000 char Discord limit
* Help delivered as a single ephemeral embed (`/help`)

## 📦 Tech Stack
* Node.js >= 16.9 (discord.js v14 requirement)
* discord.js
* Google GenAI SDK (`@google/genai`) for Gemini models
* Axios (download & re-upload images for embeds)
* dotenv for configuration

## 🧩 Commands Overview
Basic:
* `/ping` – Pong!
* `/whoami` – Your tag + ID
* `/uptime` – Bot uptime
* `/echo text:<text>` – Echo back text
* `/help` – Ephemeral embed with categorized feature list

Utilities:
* `/user info [target]` – Info about you or another user
* `/math add|sub|mul|div a b` – Basic arithmetic

Polls:
* `/poll create question:<q> options:<comma,separated,choices>` (2–5 options). Example:
	```
	/poll create question:Which color? options:red, green, blue
	```
	Users press buttons; counts update live.

Reminders:
* `/remind minutes:<n> text:<message>` – Sends a DM after the delay (fallback to channel if DM blocked).

AI:
* `/ask prompt:<your question>` – Send prompt to Gemini model.
* `/explain_image image:<attachment> [prompt]` – Upload an image directly (best)
	* Fallback: reply to a message with an image then run without attachment (may be less reliable)

## 🖼️ Image Explanation (Context Menu)
Best method. Right‑click (mobile: long press) an image message → Apps → **Explain Image**. The bot fetches the attachment, sends it to Gemini, and posts a description.

Why context menu? It guarantees access to the exact target message & attachment; slash replies don’t always pass the original message object.

### Slash Command Variant (`/explain_image`)
1. Type `/explain_image`
2. Add your image via the attachment field (paperclip) and optional prompt
3. Bot responds with an embed: first part of explanation + re-uploaded image (if < ~7.5MB)
4. Overflow explanation chunks send as follow-up messages

## 🤖 AI (Gemini) Notes
* Uses `@google/genai` (model: `gemini-2.0-flash` for text & images)
* Errors are truncated; raw stack traces not exposed
* Long outputs chunked (slash + context menu)
* Image > ~7.5MB: falls back to original URL embed (no re-upload)

## ♻️ Limitations / Next Ideas
* Poll & reminder data in-memory (lost on restart)
* No rate limiting or quotas yet
* No database / persistence layer
* Multi-image explain not implemented
* Add logging/metrics & moderation guards

## 🔒 Safety / Abuse Considerations
* Consider per-user cooldown (e.g. 15s) for `/ask` & image explanations
* Add content filtering if deploying broadly
* Log AI failures separately (rotate logs, redact keys)

## 📝 License
MIT

---
Feel free to extend: add persistence, global commands, or moderation tools.
