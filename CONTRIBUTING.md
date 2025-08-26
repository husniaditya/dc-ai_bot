# Contributing Guide

Thanks for your interest in contributing! This document explains how to set up your environment, propose changes, and follow project standards.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Branching Model](#branching-model)
- [Issues](#issues)
- [Pull Requests](#pull-requests)
- [Commit Messages](#commit-messages)
- [Coding Standards](#coding-standards)
- [Slash Commands & Features](#slash-commands--features)
- [Dashboard (React)](#dashboard-react)
- [Database / Persistence](#database--persistence)
- [Security](#security)
- [Releases](#releases)

## Code of Conduct
Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior.

## Development Setup
1. Clone the repo
2. Copy `.env.example` to `.env` (create one if missing) and fill values
3. Install dependencies:
   ```bash
   npm install
   cd dashboard && npm install && cd ..
   ```
4. Run the bot:
   ```bash
   npm start
   ```
5. Run the dashboard (in another terminal):
   ```bash
   cd dashboard
   npm run dev
   ```
6. (First time) register slash commands:
   ```bash
   npm run register-commands
   ```

## Branching Model
- `main` – stable (releases / production)
- `dashboard` or feature branches – active development
- Use `feat/short-description`, `fix/...`, `chore/...`, `docs/...`, `refactor/...`

## Issues
- Use templates (if added later) or clearly describe:
  - What happened vs expected
  - Reproduction steps
  - Environment (OS, Node version)
  - Logs / stack traces (redact secrets)
- Tag with labels: `bug`, `enhancement`, `security`, `question`, etc.

## Pull Requests
Checklist before opening:
- Rebase on latest target branch
- Add / update documentation & types where applicable
- Include tests if logic is complex (test infra TBD)
- Ensure no secrets in diff
- Reference related issue: `Closes #123`

PR template (put in description):
```
### Summary
Explain the change succinctly.

### Changes
- Bullet list of key changes

### Screenshots / Logs (if UI)

### Checklist
- [ ] Tests (where reasonable)
- [ ] Docs updated
- [ ] Lint / build passes
- [ ] No sensitive data
```

## Commit Messages
Format: `<type>(scope?): short imperative summary`

Common types: feat, fix, chore, docs, refactor, perf, test, build, ci

Examples:
- `feat(commands): add /poll results command`
- `fix(ai): retry transient 500 errors`
- `docs: add security policy`

## Coding Standards
- Node target: modern (ES2022 features ok given Node >=18 runtime if updated)
- Prefer small, focused modules
- Avoid large inline blocks; extract helpers to `util.js`
- Handle promise rejections; never leave unhandled
- Log with consistent prefix / level (future: structured)
- Avoid hard coding magic numbers; put constants at top or config

### Style
- Use `const` / `let` (no `var`)
- Async/await over raw promise chains
- Defensive checks for external data (API / DB)

## Slash Commands & Features
- Define command in `commands/<name>.js`
- Export `data` (SlashCommandBuilder) & `execute(interaction)`
- Register via `npm run register-commands`
- Keep responses ephemeral when user-specific or noisy

## Dashboard (React)
- Components under `dashboard/src/components`
- Sections under `dashboard/src/sections`
- Use functional components + hooks
- Handle errors with `ErrorBoundary.jsx`
- Keep API calls abstracted in `api.js`

## Database / Persistence
- MariaDB / MySQL (see `mysql2`) + Mongo (if applicable)
- Migrations TBD (document schema changes in PRs for now)

## Security
- Do not commit secrets (.env, tokens, keys)
- Validate & sanitize user-supplied input (regex patterns, etc.)
- Report vulnerabilities privately (see [SECURITY.md](SECURITY.md))

## Releases
1. Update CHANGELOG (if added later)
2. Bump version in `package.json`
3. Tag: `vX.Y.Z`
4. Draft GitHub release notes

Thanks for contributing! 💜
