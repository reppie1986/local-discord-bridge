# Wishes

Future ideas, experiments, and possible expansion paths.

These are not promises or guaranteed features.
They are simply directions that may be explored later.

---

## Configurable MCP Tools

Add a configurable MCP tool registry.

Goals:
- enable/disable tools without code changes
- per-tool permissions
- scoped access rules
- configurable descriptions
- configurable routing behavior
- cleaner future integrations

- acting as hub for nonfile related mcp tools, like connectors to corvid / acrit

Possible config fields:
- tool name
- enabled state
- allowed scopes
- allowed users
- endpoint / command
- category
- execution policy

---

## Filesystem Tools

Optional local filesystem integration through scoped MCP tooling.

Goals:
- controlled project-folder access
- read/write operations
- safe directory boundaries
- companion-assisted project workflows

Possible operations:
- list files
- read files
- write/update files
- create folders
- search project files

---

## Polled Listener

Optional polling-based listener mode.

Useful when:
- push/event systems are unreliable
- Discord events are missed
- lightweight periodic checks are preferred

Potential uses:
- Discord polling
- owner command channels
- scoped monitoring
- fallback mode

---

## ChatGPT Injection Toggle

Add extension-level control for automatic chat injection.

Possible modes:
- disabled
- manual only
- owner-triggered
- scoped channels only
- fully automatic

Goals:
- reduce unwanted context spam
- improve control over event flow
- make companion behavior easier to tune

---

## Future Expansion

Potential future directions:
- broader MCP integrations
- modular capability loading
- scoped memory helpers
- richer event routing
- companion-specific behavior tuning
- multi-service integrations

The bridge started as a Discord tool.
Discord remains the primary focus.

But the architecture is intentionally extensible.