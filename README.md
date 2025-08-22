<div align="center">

# Choco Maid – Discord AI Bot & Modern Dashboard (discord.js v14)

Smart assistant bot with AI image explanation, Q&A, translation, summarization, polls, reminders, math & utility slash commands **plus a glass‑morphism React dashboard** featuring Discord OAuth login, per‑guild auto‑response management, regex tester, bulk actions, dark / light themes, and persistence via MariaDB.

</div>

## 🚀 Invite the Bot

Use this OAuth2 URL to add the bot to a server (requires "Manage Server" permission):

https://discord.com/oauth2/authorize?client_id=951335667756072981&scope=bot%20applications.commands


## ✨ Core Features
Bot:
* Modular slash commands (fast guild registration)
* Context menu actions: Explain Image, Summarize, Translate
* AI text Q&A (`/ask`) + follow‑ups (`/askfollow`) with rolling context
* Multi‑image explanation (1–3 images) via `/explain_image`
* Channel summarization, translation, polls with live update buttons
* Reminders, math & user utilities, safe chunking for long outputs
* Pattern‑based auto replies (per‑guild enabled + cooldown)

Dashboard:
* Discord OAuth2 login (identify + guilds) w/ anti‑CSRF state
* Guild selection grid (icon cards, search)
* Per‑guild settings + auto‑response CRUD (enabled flags)
* Regex tester panel (pattern + flags + multi‑line sample)
* Bulk enable / disable / delete actions
* Per‑user cooldown setting (ms) for auto replies
* Glass UI, dark/light theme toggle, animated toasts, modern full‑screen login

Persistence:
* Guild‑scoped tables for settings + auto responses
* OAuth user storage & last selected guild

## 📦 Tech Stack
Bot:
* Node.js 18+ (global fetch) + discord.js v14
* Google GenAI SDK (`@google/genai`) for Gemini 2.0 Flash
* Axios (image re‑upload / fetch)

Dashboard:
* React + Vite + Bootstrap + custom theme
* JWT auth + fetch API

## 🧩 Commands Overview (Selected)
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

Auto Replies:
* Responds to greetings / common Indonesian & English phrases
* Configurable per guild; enabled toggle + per‑user cooldown (ms)

## 🖼️ Image Explanation
### Context Menu (recommended)
Right‑click (mobile: long press) image message → Apps → **Explain Image**. Guarantees the exact attachment.

### Slash Command (`/explain_image`)
1. Provide up to 3 attachments (image, image2, image3) + optional prompt
2. Bot re‑uploads first (<8MB) into embed; shows others via count footer
3. Explanation split across embed + follow‑ups
4. Oversized images (>8MB) skipped with notice

## 🤖 AI (Gemini) Notes
* Model: `gemini-2.0-flash`
* Backoff (exponential) on transient failures (up to 3 attempts)
* In‑memory prompt cache for `/ask` (3 min)
* Rolling limited context for `/askfollow`
* Safe chunking for long outputs
* Skip re‑upload of large images (>8MB)

## ♻️ Limitations / Next Ideas
* In‑memory runtime caches (loss on restart for non‑DB state like conversations)
* Permission gating for dashboard mutations (currently minimal – server membership + optional manage flag indicator only)
* Export / import auto responses JSON
* Server‑side pagination for very large response sets
* Accessibility (focus rings, ARIA labels) audit
* Structured logging + metrics / tracing
* Tests + CI, graceful shutdown snapshots

## 🔒 Safety / Abuse Considerations
* Add command rate limiting (API already has rudimentary IP rate limit)
* Content moderation / filtering for AI responses
* Redact sensitive data in logs; rotate + centralize
* Track token usage & add quotas

## 🗣 Auto Responses Quick Guide
Dashboard → Auto Responses:
1. Add / Edit pattern (regex + flags)
2. Provide one reply per line (bot picks randomly)
3. Toggle Enabled inline or in modal
4. Use search + pagination + bulk actions for maintenance
5. Regex tester helps verify before saving

Cooldown is per user (configurable at Settings panel). Disabled entries remain stored but skipped.

## 📝 License
MIT

---
Feel free to extend with moderation, analytics, observability, and advanced permission controls.
