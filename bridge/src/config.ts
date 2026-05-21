import { readFileSync, existsSync } from 'fs';
import { info, error } from './logger.js';

export interface ScopeConfig {
  guildIds: string[];
  channelIds: string[];
  defaultChannelId: string;
  attentionMode?: 'all' | 'mentions_only' | 'name_match' | 'keywords';
  /** @deprecated Use attentionMode instead */
  routingMode?: 'all' | 'mentions_only' | 'name_match' | 'keywords';
  names?: string[];
  keywords?: string[];
  includeRepliesToSelf?: boolean;
}

export function resolveAttentionMode(scope: ScopeConfig): 'all' | 'mentions_only' | 'name_match' | 'keywords' {
  return scope.attentionMode || scope.routingMode || 'all';
}

export interface AppConfig {
  scopes: Record<string, ScopeConfig>;
  discord?: {
    token?: string;
  };
}

function tryParseInlineJson(raw: string): AppConfig | null {
  try {
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
}

function tryLoadFile(path: string): AppConfig | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as AppConfig;
  } catch (err) {
    error(`Failed to load config file: ${String(err)}`);
    return null;
  }
}

export function loadConfig(): AppConfig {
  const configIndex = process.argv.indexOf('--config');
  if (configIndex !== -1 && configIndex + 1 < process.argv.length) {
    const configArg = process.argv[configIndex + 1];

    // Try as file path first
    if (existsSync(configArg)) {
      info(`Loading config from file: ${configArg}`);
      const config = tryLoadFile(configArg);
      if (config) return config;
      error(`Config file '${configArg}' exists but is invalid, falling back to defaults`);
    } else {
      // Try as inline JSON
      const config = tryParseInlineJson(configArg);
      if (config) {
        info('Loaded config from inline JSON');
        return config;
      }
    }
  }

  return { scopes: {} };
}
