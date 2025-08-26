# Security Policy

## Supported Versions
Security updates will generally be applied to the latest `main` branch. Older tags may not receive fixes unless explicitly requested and feasible.

| Version | Supported |
|---------|-----------|
| main (unreleased) | ✅ |
| past tags (<1.0.0) | ⚠️ Best effort |

## Reporting a Vulnerability
If you discover a security vulnerability, please DO NOT open a public issue.

Instead:
1. Email: security@replace-with-your-domain.example (replace before publishing)
2. (Optional) Create a private GitHub Security Advisory (if repository settings allow)

Provide (as applicable):
- Affected component / file
- Vulnerability type (e.g., injection, auth bypass)
- Steps to reproduce / proof of concept
- Expected vs actual behavior
- Potential impact (data exposure, escalation, etc.)
- Mitigations attempted

We'll aim to acknowledge within 72 hours and provide an initial assessment within 7 days.

## Disclosure Process
1. Triage & reproduce
2. Assign CVSS-like severity (Low/Medium/High/Critical)
3. Develop & test fix
4. Coordinate release (may create a security patch branch)
5. Credit reporter (if desired) in release notes

## Security Best Practices (Project)
- Never commit secrets (.env stays local)
- Principle of least privilege for tokens / bot permissions
- Input validation for regex / dynamic evaluation
- Rate limiting & cooldowns for abuse control
- Sanitization of user content in embeds / UI
- Dependency updates (check `npm audit` periodically)
- Log redaction of sensitive identifiers

## Hardening Roadmap
- Add automated dependency scanning (GitHub Dependabot)
- Add secret scanning & commit hooks
- Implement structured logging with PII filters
- Add unit tests for permission checks & rate limiting
- Security headers for dashboard (CSP, etc.)

## Hall of Fame
(Security researchers may be listed here with consent after coordinated disclosure.)
