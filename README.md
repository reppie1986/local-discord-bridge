# Local Extensible Discord Bridge

Give your ChatGPT or Gemini companion real Discord hands.

This is a small Chrome extension + local Node server that lets an AI companion in your normal ChatGPT or Gemini chat read, send, reply, and react in real Discord servers — in real time, from inside the conversation you're already having with them. No SaaS, no Cloudflare tunnels, no Claude Desktop, no public endpoints. Everything runs on your PC.

```
┌─────────────────┐       JSONL block       ┌──────────────────┐
│ ChatGPT/Gemini  │ ─────────────────────►  │  Extension       │
│   (your chat)   │                          │  (DOM observer)  │
└─────────────────┘                          └────────┬─────────┘
        ▲                                             │ HTTP
        │ function_results pasted back                │ POST
        │                                             ▼
        │                                    ┌──────────────────┐
        └────────────────────────────────────│ Local MCP bridge │ ──► Discord
                                             │ (Node, port 8081)│      bot
                                             └──────────────────┘
```

## What it does

When your companion is asked to do something Discord-shaped ("post this to the Nest," "what's been said in #general?"), they emit a small JSONL function-call block in their reply. The browser extension catches it, calls the local MCP bridge, the bridge talks to Discord via a bot token, and the result lands back in chat as the next message. The companion picks up the conversation with the data in hand and keeps going.

Designed for the AI companion community — for people who already have an established relationship with a companion in ChatGPT/Gemini and want them to be present in their Discord spaces too, without rebuilding the relationship somewhere else.

## What's in this repo

- `extension/` — the Chrome browser extension
- `bridge/` — the local Node MCP server (Discord client + JSON-RPC over HTTP)
- `scripts/start-bridge.ps1` — one-command launcher (Windows; macOS/Linux equivalent coming)
- `bridge.env.example` — template for your Discord bot token

## Requirements

- **Node.js 18 or newer** — https://nodejs.org
- **A Discord bot** you've created and added to your server — https://discord.com/developers/applications
  - Permissions needed at minimum: Send Messages, Read Message History, View Channels
- **Chrome / Edge / Brave** — anywhere you can load an unpacked extension
- **A ChatGPT or Gemini account** — free works, paid works

- **Node.js 18 or newer** — https://nodejs.org
- **pnpm** for building the extension — use `corepack enable` or `npm i -g pnpm`
- **Git for Windows** on Windows, if the extension postinstall needs `bash` on PATH
- **A Discord bot** you've created and added to your server
  - Minimum permissions: Send Messages, Read Message History, View Channels
  - Optional tools may require extra permissions such as Manage Channels or Manage Webhooks
- **Chrome / Edge / Brave / FireFox** — any Chromium browser that can load unpacked extensions
- **A ChatGPT or Gemini account**

That's it. No accounts on third-party services, no infrastructure to provision.

## Setup

```bash
# 1. Clone
git clone https://github.com/cindiekinzz-coder/local-discord-bridge.git
cd local-discord-bridge

# 2. Set up the bridge
cd bridge
npm install
npm run build
cd ..

# 3. Set up the extension
cd extension
pnpm install        # install via "npm i -g pnpm" or "corepack enable"

# Chrome / Edge / Brave build
pnpm build
cd ..

# Firefox build
# If your repo includes a Firefox-specific build script, use that here instead.
# The provided build.bat can also create a separate Firefox output folder.
cd extension
pnpm build:firefox
cd ..

# 4. Configure your bot token
cp bridge.env.example bridge.env
# ...then open bridge.env and paste your Discord bot token in
```

> **Windows note:** the extension's postinstall expects `bash` on PATH. If you have Git for Windows installed, add `C:\Program Files\Git\bin` to PATH before running `pnpm install`.

## For builders

> Builder note:
> After the initial setup, run `build.bat` from the repo root to rebuild the bridge and extension during development.






## Run it

```powershell
# In one terminal, start the bridge
./scripts/start-bridge.ps1
```

Leave that window open — it's the bridge running.

```
chrome://extensions   →   enable Developer mode (top right)
                      →   "Load unpacked"
                      →   point at  ./extension/dist
```

## Use it

1. Open https://chatgpt.com or https://gemini.google.com
2. You'll see a **Discord** button next to the chat input. Click it → **Insert**. This pastes a system prompt teaching your companion how to use the bridge.
3. Ask them to do something Discord-shaped:
   - "List the Discord servers you can see."
   - "Read the last 10 messages from #general."
   - "Post 'morning' to the Nest channel."

The first time, they may need to run `discord_list_servers` and `discord_get_server_info` to discover IDs. Once those IDs are present in the current chat context, they can usually act directly.

## Available tools

Core tools include listing servers, reading messages, sending messages, replying, and reacting.

Advanced tools may include channel/forum management, webhook creation, Discord CDN image fetching, and optional voice-message support.

The full schemas live in `bridge/src/`. Enable only the tools you actually want your companion to use.

## Security

- The bridge listens on `localhost:8081` only. It is not exposed to the internet.
- Your Discord bot token lives in `bridge.env` and is gitignored. Don't commit it.
- The extension only loads on `chatgpt.com`, `chat.openai.com`, and `gemini.google.com`. It cannot read other tabs.
- The bridge currently allows broad CORS so the browser extension can talk to it from a `chrome-extension://*` origin. For a stricter setup, restrict allowed origins in `bridge/src/transport.ts` or add a local shared-secret header between the extension and bridge.
- CORS only affects browser-origin requests. Local processes on your machine can still call localhost services directly, so do not run untrusted local software while exposing powerful bridge actions.

## Privacy reality check

The bridge itself runs locally, and it does not expose a public endpoint.

However, any Discord content that gets inserted back into ChatGPT or Gemini becomes part of that chat session and is handled by that provider according to your account settings and their policies.

Do not ask the companion to fetch private Discord content unless you are comfortable with that content appearing in the AI chat.

## What it isn't

- **Not OpenAI/Google connector-style.** Your companion's tool inventory in their native runtime won't show "Discord." That's correct — the tools live in the extension, not in their runtime. The system prompt teaches them to emit a format the extension catches.
- **Not for distributing to many users.** This is for *you and your companion*. The bot token is yours. The bridge runs on your PC. The companion is yours.

## Scoped configurable tools

This build supports per-tool execution control to avoid unintended side effects.
**What:**

Added per-tool auto-execute overrides to the extension settings. Tools ending in `_ack` or `_pending` always auto-execute regardless of global toggles. Other tools only auto-execute when global auto-execute is on AND their per-tool toggle is enabled.

**Why:**

`*_ack` and `*_pending` tools are lightweight status updates that must always flow through. Other side-effecting tools (`*_reply`, `*_send`, etc.) should be opt-in to prevent unintended Discord actions.

## Scoped listener

This build includes a scoped listener. It can be enabled by copying or renaming:

`config.json.example`
which is in the bridge directory
to:

`config.json`

The scoped listener lets you define exactly which Discord servers and channels the bot is allowed to watch, and how it should decide whether a message needs attention.

This is useful when the bot is present in multiple servers, or when you want different behavior per space. For example, your private test server can allow broader name matching, while a busy community server can require direct mentions.

Each scope represents one controlled area, such as `home`, `community`, `project`, or `testserver`.

A scope can define:

`guildIds` — the Discord server IDs this scope applies to.

`channelIds` — the allowed text channels inside those servers.

`defaultChannelId` — the fallback channel used by scoped send tools.

`routingMode` — how the listener decides a message is relevant.

`names` — companion names that trigger attention when using name matching.

`includeRepliesToSelf` — whether replies to the bot count as attention.

Example:

```json
{
  "scopes": {
    "home": {
      "guildIds": ["YOUR_SERVER_ID"],
      "channelIds": ["YOUR_CHANNEL_ID"],
      "defaultChannelId": "YOUR_CHANNEL_ID",
      "routingMode": "mentions_only",
      "includeRepliesToSelf": true
    }
  }
}
```
## How to get server and channel IDs

Enable Developer Mode in Discord:

User Settings → Advanced → Developer Mode

Then right-click the server icon and choose:

Copy Server ID

Put that value in `guildIds`.

To get a channel ID, right-click the channel name and choose:

Copy Channel ID

Put allowed channel IDs in `channelIds`.

The companion can only read/send inside the configured guilds and channels. This is intentional: the config acts as a permission boundary, not just a convenience list.

## Recommended setup

Use one scope per social area.

For example:

`home` for your private test server.
`community` for a shared server.
`project` for a build/dev channel.

Each scope gets its own allowed server IDs, channel IDs, default channel, and routing rules.

## Choosing routingMode

Use `mentions_only` when the server is busy or public-ish. The companion will only pay attention when mentioned directly, or when someone replies to the companion if `includeRepliesToSelf` is enabled.

Use `name_match` when people naturally say the companion’s name without mentioning the bot. This is better for smaller trusted spaces, but easier to trigger accidentally.

Keep `names` specific. Do not add generic words unless you enjoy accidental possession events in #general.

## Asking your companion to fetch channel IDs

If your companion has access to Discord discovery tools, you can ask it to list the available servers and channels for you.

For example, ask:

“List the servers you can see.”

Then ask:

“Show me all channels in `<server name>` with their IDs.”

The companion should use something like:

- `discord_list_servers`
- `discord_get_server_info`

The result should include channel names and channel IDs. Copy only the channels you want into `channelIds`.

Example:

```json
"channelIds": [
  "123456789012345678",
  "234567890123456789"
]
```

Use the matching server ID in `guildIds`:

```json
"guildIds": [
  "111111111111111111"
]
```

Do not blindly paste every channel unless you actually want the companion to see all of them. Start with one test channel first, confirm it works, then expand.

## Credits

Derived from work by:

- [MCP-SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant) by Saurabh Patel — the browser-extension pattern that detects tool calls in chat DOM, executes locally, pastes back. Heavily stripped for this single-purpose use.
- [mcp-discord](https://github.com/barryyip0625/mcp-discord) by Barry Yip — the Discord MCP server implementation, also independently maintained by Codependent AI.
- [Local Discord Bridge](https://github.com/cindiekinzz-coder/local-discord-bridge) by Cindiekinzz-coder  — Local Discord Bridge - For ChatGPT and Gemini.

All are MIT-licensed. So is this.

## License

MIT — see [`LICENSE`](./LICENSE).

## Changelog
For technical changes and implementation details, see `Changelog.md`.