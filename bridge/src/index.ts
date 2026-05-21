#!/usr/bin/env node
import { Client, GatewayIntentBits } from "discord.js";
import { config as dotenvConfig } from 'dotenv';
import { DiscordMCPServer } from './server.js';
import { StdioTransport, StreamableHttpTransport } from './transport.js';
import { info, error } from './logger.js';
import { createListenerManager } from './tools/listener.js';
import { loadConfig } from './config.js';

// Load environment variables from .env file if exists
dotenvConfig();

// Load app config (scopes, etc.)
const appConfig = loadConfig();
info(`Loaded config with ${Object.keys(appConfig.scopes).length} scope(s): ${Object.keys(appConfig.scopes).join(', ') || 'none'}`);

// Configuration with priority for command line arguments
const DISCORD_TOKEN = (() => {
    if (appConfig.discord?.token) return appConfig.discord.token;
    return process.env.DISCORD_TOKEN || null;
})();

const TRANSPORT = (() => {
    const transportIndex = process.argv.indexOf('--transport');
    if (transportIndex !== -1 && transportIndex + 1 < process.argv.length) {
        return process.argv[transportIndex + 1];
    }
    return 'stdio';
})();

const HTTP_PORT = (() => {
    const portIndex = process.argv.indexOf('--port');
    if (portIndex !== -1 && portIndex + 1 < process.argv.length) {
        return parseInt(process.argv[portIndex + 1]);
    }
    return 8081;
})();

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Save token to client for login handler
if (DISCORD_TOKEN) {
    client.token = DISCORD_TOKEN;
}

// Set up Discord event listener (messageCreate only for phase 1)
// Listener checks client.user?.id at event time, so it's safe to bind before login
const channelAllowlist = (process.env.DISCORD_CHANNEL_ALLOWLIST ?? "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);

const listenerManager = createListenerManager(client, {
    ignoreBots: false,
    ignoreSelf: true,
    channelAllowlist,
});
client.on('messageCreate', (msg) => listenerManager.onMessageCreate(msg));
info('Discord message listener registered (observe-only, no auto-reply)');

// Auto-login on startup if token is available
const autoLogin = async () => {
    const token = DISCORD_TOKEN;
    if (token) {
        try {
            await client.login(token);
            info('Successfully logged in to Discord');
        } catch (err: any) {
            if (typeof err.message === 'string' && err.message.includes('Privileged intent provided is not enabled or whitelisted')) {
                error('Login failed: One or more privileged intents are not enabled in the Discord Developer Portal. Please enable the required intents.');
            } else {
                error('Auto-login failed: ' + String(err));
            }
        }
    } else {
        info("No Discord token found in config, skipping auto-login");
    }
};

// Initialize transport based on configuration
const initializeTransport = () => {
    switch (TRANSPORT.toLowerCase()) {
        case 'http':
            info(`Initializing HTTP transport on 0.0.0.0:${HTTP_PORT}`);
            return new StreamableHttpTransport(HTTP_PORT, appConfig.scopes);
        case 'stdio':
            info('Initializing stdio transport');
            return new StdioTransport();
        default:
            error(`Unknown transport type: ${TRANSPORT}. Falling back to stdio.`);
            return new StdioTransport();
    }
};

// Start auto-login process
await autoLogin();

// Create and start MCP server with selected transport
const transport = initializeTransport();
const mcpServer = new DiscordMCPServer(client, transport, appConfig.scopes);

try {
    await mcpServer.start();
    info('MCP server started successfully');
    
    // Keep the Node.js process running
    if (TRANSPORT.toLowerCase() === 'http') {
        // Send a heartbeat every 30 seconds to keep the process alive
        setInterval(() => {
            info('MCP server is running');
        }, 30000);
        
        // Handle termination signals
        process.on('SIGINT', async () => {
            info('Received SIGINT. Shutting down server...');
            await mcpServer.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            info('Received SIGTERM. Shutting down server...');
            await mcpServer.stop();
            process.exit(0);
        });
        
        info('Server running in keep-alive mode. Press Ctrl+C to stop.');
    }
} catch (err) {
    error('Failed to start MCP server: ' + String(err));
    process.exit(1);
}