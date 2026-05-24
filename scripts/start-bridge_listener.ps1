# Local Discord Bridge - bridge launcher (Windows / PowerShell)
#
# Loads DISCORD_TOKEN from ..\bridge.env, then starts the local MCP server
# (bridge\build\index.js) in HTTP mode on the configured port.
#
# Optional environment variables:
#   MCP_DISCORD_PORT - HTTP port for the MCP server (default: 8081)
#   BRIDGE_CONFIG    - Path to config.json (default: <repo>\bridge\config.json)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Split-Path -Parent $scriptDir

$defaultConfigFile = Join-Path $repoRoot 'bridge\config.json'
$configFile = if ($env:BRIDGE_CONFIG) { $env:BRIDGE_CONFIG } else { $defaultConfigFile }

$envFile = Join-Path $repoRoot 'bridge.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Host "No bridge.env found at $envFile" -ForegroundColor Red
    Write-Host "Copy bridge.env.example to bridge.env and fill in DISCORD_TOKEN first." -ForegroundColor Red
    exit 1
}

# Parse bridge.env (simple KEY=VALUE lines, ignore # comments and blank lines).
# This mirrors the shell script's exported env behavior, but stays PowerShell-friendly.
Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith('#')) {
        return
    }

    if ($line -match '^\s*([^#=][^=]*)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()

        # Strip matching single/double quotes around simple values.
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        Set-Item -Path "env:$key" -Value $value
    }
}

if (-not $env:DISCORD_TOKEN) {
    Write-Host "DISCORD_TOKEN is empty in bridge.env. Paste your bot token there first." -ForegroundColor Red
    exit 1
}

$port = if ($env:MCP_DISCORD_PORT) { $env:MCP_DISCORD_PORT } else { '8081' }
$entry = Join-Path $repoRoot 'bridge\build\index.js'

if (-not (Test-Path -LiteralPath $entry)) {
    Write-Host "Cannot find $entry" -ForegroundColor Red
    Write-Host "Build the bridge first: cd bridge; npm install; npm run build" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath $configFile)) {
    Write-Host "Cannot find config file: $configFile" -ForegroundColor Red
    Write-Host "Create it first, for example: $defaultConfigFile" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Local Discord Bridge on http://localhost:$port/mcp" -ForegroundColor Cyan
Write-Host "Using config: $configFile" -ForegroundColor DarkGray
Write-Host "Leave this window open. Ctrl+C to stop." -ForegroundColor DarkGray

node "$entry" --transport http --port "$port" --config "$configFile"
