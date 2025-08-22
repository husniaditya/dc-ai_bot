Dashboard Frontend (MERN - React)

This folder will contain the React dashboard for managing bot settings and auto responses.

Planned structure:
- src/
  - api.js (fetch helpers)
  - components/
  - pages/
  - App.jsx
  - main.jsx
- public/

To scaffold (manual steps):
1. npx create-react-app dashboard --template vite (or use Vite + React) - outside current single-folder if desired.
2. Configure VITE_API_BASE and token storage after /api/login.
3. Implement pages: Login, Settings, AutoResponses CRUD.

API Endpoints (JWT required except /api/login):
POST /api/login {username,password} -> {token}
GET /api/settings -> { autoReplyEnabled, autoReplyCooldownMs }
PUT /api/settings { autoReplyEnabled?, autoReplyCooldownMs? }
GET /api/auto-responses -> list
POST /api/auto-responses { key, pattern, flags, replies }
DELETE /api/auto-responses/:key
