import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

// Local Discord Bridge — a Chrome extension that lets your ChatGPT or Gemini
// companion read, send, react in real Discord servers via a local Node
// MCP server (the `bridge/` package in this repo) on localhost:8080/mcp.

const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: 'Local Discord Bridge',
  browser_specific_settings: {
    gecko: {
      id: 'local-discord-bridge@cindiekinzz.dev',
    },
  },
  version: packageJson.version,
  description: 'Give your ChatGPT or Gemini companion real Discord hands. Runs locally — no proxy, no tunnel, no third party.',
  host_permissions: [
    '*://*.chatgpt.com/*',
    '*://*.chat.openai.com/*',
    '*://*.gemini.google.com/*',
    'http://localhost/*',
    'http://localhost:*/*',
    'http://127.0.0.1/*',
    'http://127.0.0.1:*/*',
  ],
  permissions: ['storage', 'clipboardWrite'],
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  icons: {
    128: 'icon-128.png',
    34: 'icon-34.png',
  },
  content_scripts: [
    {
      matches: ['*://*.chatgpt.com/*', '*://*.chat.openai.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
    {
      matches: ['*://*.gemini.google.com/*'],
      js: ['content/index.iife.js'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', 'content/*.css', '*.svg', 'icon-128.png', 'icon-34.png'],
      matches: ['*://*/*'],
    },
  ],
} satisfies chrome.runtime.ManifestV3;

export default manifest;
