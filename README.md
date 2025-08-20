# Simple Discord Bot (Node.js)

This is a minimal Discord AI bot scaffold using Node.js and discord.js.

Commands:
- `/ping` — bot replies `Pong!`
- `/whoami` — shows your username and ID
- `/uptime` — shows bot uptime
- `/echo <text>` — bot repeats the provided text
- `/help` — shows available commands (ephemeral)
Advanced commands
- `/user info [target]` — show info for yourself or another user
- `/math add|sub|mul|div a b` — perform basic arithmetic (use the subcommands)
- `/poll create <question> <options>` — create a poll. `options` is a comma-separated list (max 5).
	- Example: `/poll create question:Which color? options: red, green, blue`
- `/remind minutes:5 text:Take a break` — DM you after the set minutes
AI integration
- `/ask prompt:<your question>` — sends the prompt to the configured Gemini API and replies with the result.

Notes:
- Node.js 16.9+ is recommended for discord.js v14.
