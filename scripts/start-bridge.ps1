# Local Discord Bridge - bridge launcher (Windows / PowerShell)
#
# Loads DISCORD_TOKEN from ..\bridge.env, then starts the local MCP server
# (bridge\build\index.js) in HTTP mode on the configured port.

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Split-Path -Parent $scriptDir

$envFile = Join-Path $repoRoot 'bridge.env'
if (-not (Test-Path $envFile)) {
    Write-Host "No bridge.env found at $envFile" -ForegroundColor Red
    Write-Host "Copy bridge.env.example to bridge.env and fill in DISCORD_TOKEN first." -ForegroundColor Red
    exit 1
}

# Parse bridge.env (simple KEY=VALUE lines, ignore # comments and blank lines).
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=][^=]*)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "env:$key" -Value $value
    }
}

if (-not $env:DISCORD_TOKEN) {
    Write-Host "DISCORD_TOKEN is empty in bridge.env. Paste your bot token there first." -ForegroundColor Red
    exit 1
}

$port = if ($env:MCP_DISCORD_PORT) { $env:MCP_DISCORD_PORT } else { '8081' }
$entry = Join-Path $repoRoot 'bridge\build\index.js'

if (-not (Test-Path $entry)) {
    Write-Host "Cannot find $entry" -ForegroundColor Red
    Write-Host "Build the bridge first: cd bridge; npm install; npm run build" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Local Discord Bridge on http://localhost:$port/mcp" -ForegroundColor Cyan
Write-Host "Leave this window open. Ctrl+C to stop." -ForegroundColor DarkGray
node $entry --transport http --port $port
