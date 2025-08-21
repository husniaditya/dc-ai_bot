<div align="center">

# Discord AI Bot (Node.js + discord.js v14)

Lightweight Discord bot with modular slash commands, multi‑image AI explanation, conversational follow‑ups, message context menu image explainer powered by Google Gemini, polls (with live updates + results), reminders, math & utility commands, summarization, translation, and more.

</div>

## 🚀 Invite the Bot

Use this OAuth2 URL to add the bot to a server (requires "Manage Server" permission):

https://discord.com/oauth2/authorize?client_id=951335667756072981&scope=bot%20applications.commands


## ✨ Features
* Modular slash commands (guild‑scoped for rapid iteration)
* Message context menu: **Explain Image** (right‑click → Apps → Explain Image)
* AI text Q&A via Gemini (`/ask`) with short‑term response caching (3 min)
* Conversation follow‑ups (`/askfollow`) – keeps last turns (in‑memory)
* Multi‑image explanation (1–3 images) via `/explain_image` + optional prompt
* Channel summarization (`/summarize [count]`)
* Translation (`/translate text target`)
* Poll creation + live vote buttons + `/poll results id` snapshot
* Reminders via DM with channel fallback
* Basic user + math utilities
* Long outputs auto‑chunked (2,000 char safe slicing)
* Select‑menu driven help (`/help`) with ephemeral category switching
* Exponential backoff + size checks for AI image fetches
* Optional auto‑responses to greetings / casual phrases (toggle via env)

## 📦 Tech Stack
* Node.js >= 16.9 (discord.js v14 requirement)
* discord.js
* Google GenAI SDK (`@google/genai`) for Gemini models
* Axios (download & re-upload images for embeds)

## 🧩 Commands Overview
Core:
* `/ping` – Pong!
* `/whoami` – Your tag + ID
* `/uptime` – Bot uptime
* `/echo text:<text>` – Echo back text
* `/help` – Ephemeral help + category select

User & Math:
* `/user info [target]` – Info about you or another user
* `/math add|sub|mul|div a b` – Arithmetic

Polls:
* `/poll create question:<q> options:<a,b,c>` – 2–5 options
* `/poll results id:<pollId>` – Snapshot text summary

Reminders:
* `/remind minutes:<n> text:<message>` – DM (channel fallback)

AI / Knowledge:
* `/ask prompt:<text>` – Ask Gemini
* `/askfollow prompt:<text>` – Follow‑up with recent context (last ~10 turns stored)
* `/summarize [count]` – Summarize last N (default 30, max 100) channel messages
* `/translate text:<t> target:<lang>` – Quick translation (outputs only translation)
* `/explain_image image(image1,image2,image3):<attachments> [prompt]` – 1–3 images
	* Fallback legacy: reply to image message (less reliable)

Context Menu:
* Message → Apps → **Explain Image** – Single image explanation
* Message → Apps → **Summarize** – Summarize chat context (captures up to ~15 messages before/after, filters noise)
* Message → Apps → **Translate** – Auto‑detect source and translate message content to ID (model driven)

Auto Replies (optional):
* Responds to greetings / common Indonesian & English phrases (e.g. "pagi", "hi", "makasih", gaming terms like "lag", "push rank") when enabled.
* Cooldown per channel & phrase group (default 30s) to reduce spam.

## 🖼️ Image Explanation
### Context Menu (recommended)
Right‑click (mobile: long press) image message → Apps → **Explain Image**. Guarantees the exact attachment.

### Slash Command (`/explain_image`)
1. Provide up to 3 attachments (image, image2, image3) + optional prompt
2. Bot re‑uploads first (<8MB) into embed; shows others via count footer
3. Explanation split across embed + follow‑ups
4. Oversized images (>8MB) skipped with notice

## 🤖 AI (Gemini) Notes
* SDK: `@google/genai` using `gemini-2.0-flash`
* Text & multimodal (image) handled
* Exponential backoff (3 attempts) on transient failures
* `/ask` responses cached (3 min) per identical prompt
* `/askfollow` keeps limited rolling history (in‑memory per user)
* Long outputs chunked safely
* Images >8MB: rejected (slash) or not re‑uploaded (context menu fallback to URL)

## ♻️ Limitations / Next Ideas
* All state (polls, reminders, conversations, cache) in-memory → lost on restart
* No rate limiting / abuse throttling yet
* No persistence (DB, KV, or file) or analytics
* No permission gating (e.g., restrict heavy AI commands to roles)
* Conversation context limited to small rolling window
* No structured logging / metrics exporter
* Add tests & CI, graceful shutdown persistence snapshot

## 🔒 Safety / Abuse Considerations
* Implement per-user cooldown (e.g. 10–15s) for `ask/askfollow/explain_image/summarize`
* Add content moderation / filtering before broad release
* Redact sensitive data in logs; rotate & centralize
* Consider token usage tracking & quotas

## 📝 License
MIT

---
## 🗣 Auto Responses (Optional)

Enable lightweight pattern‑based greeting / chatter replies.

Considerations:
* Avoid responding to sensitive phrases – review patterns before production.
* High traffic channels may need longer cooldowns.
* For advanced behavior (per‑guild config, persistence, commands to add/remove patterns) promote patterns to a data store and expose admin slash commands.

---

---
Feel free to extend: add persistence, global commands, moderation tools, rate limiting, and observability.
