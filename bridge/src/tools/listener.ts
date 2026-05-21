import { Client, Message, Attachment } from 'discord.js';
import { ToolHandler, ToolResponse } from './types.js';
import { GetPendingEventsSchema, AckEventSchema } from '../schemas.js';
import { handleDiscordError } from '../errorHandler.js';

export interface DiscordMessageEvent {
  id: string;
  guildId: string;
  channelId: string;
  parentId?: string;
  channelName: string | null;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
  mentionsBot: boolean;
  hasMentions: boolean;
  attachments: Array<{ url: string; filename: string; contentType?: string }>;
  replyTo?: { messageId: string; authorId: string; content: string };
}

interface ListenerConfig {
  channelAllowlist?: string[];
  ignoreBots?: boolean;
  ignoreSelf?: boolean;
  maxQueueSize?: number;
  eventTTLMs?: number;
}

const DEFAULT_MAX_QUEUE_SIZE = 500;
const DEFAULT_EVENT_TTL_MS = 30 * 60 * 1000;
const BOT_COOLDOWN_MS = 30_000;
const botLastSeen = new Map<string, number>();

class DiscordListenerManager {
  private queue: Map<string, DiscordMessageEvent> = new Map();
  private config: Required<ListenerConfig>;
  private client: Client;

  constructor(client: Client, config: ListenerConfig = {}) {
    this.client = client;
    this.config = {
      channelAllowlist: config.channelAllowlist ?? [],
      ignoreBots: config.ignoreBots ?? true,
      ignoreSelf: config.ignoreSelf ?? true,
      maxQueueSize: config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
      eventTTLMs: config.eventTTLMs ?? DEFAULT_EVENT_TTL_MS,
    };
  }

  onMessageCreate(msg: Message): void {
    if (this.config.ignoreSelf && msg.author.id === this.client.user?.id) return;

    if (msg.author.bot) {
      if (this.config.ignoreBots) return;
      const now = Date.now();
      const lastSeen = botLastSeen.get(msg.author.id) ?? 0;
      if (now - lastSeen < BOT_COOLDOWN_MS) return;
      botLastSeen.set(msg.author.id, now);
    }

    if (this.config.channelAllowlist.length > 0 && !this.config.channelAllowlist.includes(msg.channelId)) return;
    if (this.queue.has(msg.id)) return;

    this.evictExpired();

    if (this.queue.size >= this.config.maxQueueSize) {
      const oldest = this.queue.keys().next().value;
      if (oldest) this.queue.delete(oldest);
    }

    const attachments = msg.attachments.map((a: Attachment) => ({
      url: a.url,
      filename: a.name ?? 'file',
      contentType: a.contentType ?? undefined,
    }));

    const parentId = (msg.channel as any).parentId || undefined;

    let replyTo: DiscordMessageEvent['replyTo'];
    if (msg.reference?.messageId) {
      const cachedMsg = (msg.channel as any).messages?.cache?.get(msg.reference.messageId);
      replyTo = {
        messageId: msg.reference.messageId,
        authorId: cachedMsg?.author?.id || '',
        content: cachedMsg?.content || '',
      };
    }

    const event: DiscordMessageEvent = {
      id: msg.id,
      guildId: msg.guildId ?? '',
      channelId: msg.channelId,
      parentId,
      channelName: msg.channel && 'name' in msg.channel ? msg.channel.name : null,
      authorId: msg.author.id,
      authorName: msg.author.displayName || msg.author.username,
      content: msg.content,
      timestamp: msg.createdTimestamp,
      mentionsBot: msg.mentions.has(this.client.user!.id),
      hasMentions: msg.mentions.users.size > 0,
      attachments,
      replyTo,
    };

    this.queue.set(msg.id, event);

    // If reply metadata wasn't in cache, fetch async (fire-and-forget)
    if (msg.reference?.messageId && replyTo && !replyTo.authorId) {
      this.resolveReplyMetadata(msg.id, msg.channel as any, msg.reference.messageId);
    }
  }

  private async resolveReplyMetadata(msgId: string, channel: any, replyMessageId: string): Promise<void> {
    try {
      if (typeof channel.messages?.fetch !== 'function') return;
      const refMsg = await channel.messages.fetch(replyMessageId);
      const event = this.queue.get(msgId);
      if (event?.replyTo) {
        event.replyTo.authorId = refMsg.author.id;
        event.replyTo.content = refMsg.content;
      }
    } catch {
      // reply metadata unavailable — keep authorId/content as empty strings
    }
  }

  getPendingEvents(filters: {
    guildId?: string;
    channelId?: string;
    limit?: number;
  }): DiscordMessageEvent[] {
    this.evictExpired();

    let events = Array.from(this.queue.values());

    if (filters.guildId) {
      events = events.filter(e => e.guildId === filters.guildId);
    }
    if (filters.channelId) {
      events = events.filter(e => e.channelId === filters.channelId);
    }

    events.sort((a, b) => a.timestamp - b.timestamp);

    const limit = filters.limit ?? 25;
    return events.slice(0, Math.min(limit, 50));
  }

  ackEvent(eventId: string): boolean {
    return this.queue.delete(eventId);
  }

  private evictExpired(): void {
    const cutoff = Date.now() - this.config.eventTTLMs;
    for (const [id, event] of this.queue) {
      if (event.timestamp < cutoff) {
        this.queue.delete(id);
      }
    }
  }

  queueSize(): number {
    return this.queue.size;
  }
}

let manager: DiscordListenerManager | null = null;

export function createListenerManager(client: Client, config?: ListenerConfig): DiscordListenerManager {
  manager = new DiscordListenerManager(client, config);
  return manager;
}

export function getListenerManager(): DiscordListenerManager {
  if (!manager) throw new Error('Listener manager not initialized. Call createListenerManager first.');
  return manager;
}

export const getPendingEventsHandler: ToolHandler = async (args) => {
  try {
    const filters = GetPendingEventsSchema.parse(args);
    const events = getListenerManager().getPendingEvents(filters);
    return {
      content: [{ type: 'text', text: JSON.stringify({ events, count: events.length }) }],
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};

export const ackEventHandler: ToolHandler = async (args) => {
  try {
    const { eventId } = AckEventSchema.parse(args);
    const removed = getListenerManager().ackEvent(eventId);
    return {
      content: [{ type: 'text', text: JSON.stringify({ acked: removed, eventId }) }],
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};
