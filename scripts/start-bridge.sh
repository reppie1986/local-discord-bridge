#!/usr/bin/env bash
# Local Discord Bridge — bridge launcher (macOS / Linux)
#
# Loads DISCORD_TOKEN from ../bridge.env, then starts the local MCP server
# (bridge/build/index.js) in HTTP mode on the configured port.

set -e

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

env_file="$repo_root/bridge.env"
if [[ ! -f "$env_file" ]]; then
    echo "No bridge.env found at $env_file"
    echo "Copy bridge.env.example to bridge.env and fill in DISCORD_TOKEN first."
    exit 1
fi

# Export anything in bridge.env that looks like KEY=VALUE.
set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

if [[ -z "${DISCORD_TOKEN:-}" ]]; then
    echo "DISCORD_TOKEN is empty in bridge.env. Paste your bot token there first."
    exit 1
fi

port="${MCP_DISCORD_PORT:-8080}"
entry="$repo_root/bridge/build/index.js"

if [[ ! -f "$entry" ]]; then
    echo "Cannot find $entry"
    echo "Build the bridge first: cd bridge && npm install && npm run build"
    exit 1
fi

echo "Starting Local Discord Bridge on http://localhost:$port/mcp"
echo "Leave this window open. Ctrl+C to stop."
node "$entry" --transport http --port "$port"
