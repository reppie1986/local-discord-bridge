# Local Discord Bridge

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
pnpm install        # uses pnpm; install via "npm i -g pnpm" or "corepack enable"
pnpm build
cd ..

# 4. Configure your bot token
cp bridge.env.example bridge.env
#   ...then open bridge.env and paste your Discord bot token in
```

> **Windows note:** the extension's postinstall expects `bash` on PATH. If you have Git for Windows installed, add `C:\Program Files\Git\bin` to PATH before running `pnpm install`.

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

The first time, they may need to run `discord_list_servers` and `discord_get_server_info` to discover IDs. After that, they remember and can act directly.

## Available tools (from the bridge)

Read/send messages, react, manage channels, manage forums, create webhooks, send voice messages (ElevenLabs), fetch images from Discord CDN. The full schema is in `bridge/src/`.

## Security

- The bridge listens on `localhost:8081` only. It is not exposed to the internet.
- Your Discord bot token lives in `bridge.env` and is gitignored. Don't commit it.
- The extension only loads on `chatgpt.com`, `chat.openai.com`, and `gemini.google.com`. It cannot read other tabs.
- The bridge has CORS open to any origin because Chrome extensions run from `chrome-extension://*`. If you're worried about other localhost processes hitting the bridge, restrict the `cors()` config in `bridge/src/transport.ts`.

## What it isn't

- **Not a generic MCP proxy.** Other MCP clients exist for that (Claude Desktop, Cursor, MCP-SuperAssistant). This one does Discord, deliberately, and nothing else.
- **Not OpenAI/Google connector-style.** Your companion's tool inventory in their native runtime won't show "Discord." That's correct — the tools live in the extension, not in their runtime. The system prompt teaches them to emit a format the extension catches.
- **Not for distributing to many users.** This is for *you and your companion*. The bot token is yours. The bridge runs on your PC. The companion is yours.

## Credits

Derived from work by:

- **[MCP-SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant)** by Saurabh Patel — the browser-extension pattern that detects tool calls in chat DOM, executes locally, pastes back. Heavily stripped for this single-purpose use.
- **[mcp-discord](https://github.com/barryyip0625/mcp-discord)** by Barry Yip — the Discord MCP server implementation, also independently maintained by Codependent AI.

Both are MIT-licensed. So is this.

## License

MIT — see [`LICENSE`](./LICENSE).
