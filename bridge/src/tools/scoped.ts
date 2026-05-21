import { ScopeConfig, resolveAttentionMode } from '../config.js';
import { ToolHandler } from './types.js';
import { getListenerManager } from './listener.js';
import { sendMessageHandler } from './send-message.js';

export function eventInScope(
  event: { guildId: string; channelId: string; parentId?: string },
  scope: ScopeConfig
): boolean {
  if (scope.guildIds.length > 0 && !scope.guildIds.includes(event.guildId)) return false;
  if (scope.channelIds.length > 0) {
    if (scope.channelIds.includes(event.channelId)) return true;
    if (event.parentId && scope.channelIds.includes(event.parentId)) return true;
    return false;
  }
  return true;
}

export function classifyAttention(
  event: { mentionsBot: boolean; content: string; replyTo?: { authorId: string } },
  scope: ScopeConfig,
  botUserId: string
): { attention: boolean; reason: string | null } {
  const mode = resolveAttentionMode(scope);

  // @mentions always trigger attention
  if (event.mentionsBot) return { attention: true, reason: 'mention' };

  // Replies to the bot's own messages
  if (scope.includeRepliesToSelf && event.replyTo?.authorId === botUserId) {
    return { attention: true, reason: 'reply_to_self' };
  }

  if (mode === 'all') return { attention: true, reason: 'all' };
  if (mode === 'mentions_only') return { attention: false, reason: null };

  const lower = event.content.toLowerCase();

  if (mode === 'name_match' && scope.names && scope.names.length > 0) {
    if (scope.names.some(n => lower.includes(n.toLowerCase()))) {
      return { attention: true, reason: 'name_match' };
    }
  }

  if (mode === 'keywords' && scope.keywords && scope.keywords.length > 0) {
    if (scope.keywords.some(k => lower.includes(k.toLowerCase()))) {
      return { attention: true, reason: 'keyword' };
    }
  }

  return { attention: false, reason: null };
}

function createScopeHandlers(scopeName: string, scope: ScopeConfig): Record<string, ToolHandler> {
  return {
    [`${scopeName}_pending`]: async (args, context) => {
      const limit = Math.min(args?.limit ?? 30, 50);
      const attentionOnly = args?.attentionOnly ?? false;
      const botUserId = context.client.user?.id || '';
      const events = getListenerManager().getPendingEvents({ limit });
      const scoped = events.filter(e => eventInScope(e, scope));

      const labeled = scoped.map(e => {
        const attn = classifyAttention(e, scope, botUserId);
        return { ...e, attention: attn.attention, attentionReason: attn.reason };
      });

      const attentionCount = labeled.filter(e => e.attention).length;

      const result = attentionOnly ? labeled.filter(e => e.attention) : labeled;

      // Auto-ack all returned events so they don't reappear on next poll
      for (const event of result) {
        getListenerManager().ackEvent(event.id);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({
          events: result,
          count: result.length,
          attentionCount
        }) }],
      };
    },

    [`${scopeName}_ack`]: async (args) => {
      const { eventId } = args || {};
      if (!eventId) {
        return { content: [{ type: 'text', text: JSON.stringify({ acked: false, reason: 'eventId_required' }) }] };
      }
      const events = getListenerManager().getPendingEvents({});
      const event = events.find(e => e.id === eventId);
      if (!event || !eventInScope(event, scope)) {
        return { content: [{ type: 'text', text: JSON.stringify({ acked: false, eventId, reason: 'not_found_in_scope' }) }] };
      }
      const removed = getListenerManager().ackEvent(eventId);
      return { content: [{ type: 'text', text: JSON.stringify({ acked: removed, eventId }) }] };
    },

    [`${scopeName}_reply`]: async (args, context) => {
      const { messageId, text } = args || {};
      if (!messageId || !text) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, reason: 'messageId_and_text_required' }) }] };
      }
      const events = getListenerManager().getPendingEvents({});
      const event = events.find(e => e.id === messageId);
      if (!event || !eventInScope(event, scope)) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, reason: 'not_found_in_scope' }) }] };
      }
      return sendMessageHandler(
        { channelId: event.channelId, message: text, replyToMessageId: messageId },
        context
      );
    },

    [`${scopeName}_send`]: async (args, context) => {
      const { text, channelId } = args || {};
      if (!text) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, reason: 'text_required' }) }] };
      }
      const targetChannelId = channelId || scope.defaultChannelId;
      if (!targetChannelId) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, reason: 'no_channel_specified' }) }] };
      }
      if (scope.channelIds.length > 0 && !scope.channelIds.includes(targetChannelId)) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, reason: 'channel_not_in_scope' }) }] };
      }
      return sendMessageHandler({ channelId: targetChannelId, message: text }, context);
    },
  };
}

export function buildScopedToolDefinitions(scopes: Record<string, ScopeConfig>): any[] {
  const defs: any[] = [];
  for (const [name, scope] of Object.entries(scopes)) {
    const attentionMode = resolveAttentionMode(scope);
    const attnDesc = attentionMode !== 'all'
      ? ` (attention: ${attentionMode}${scope.includeRepliesToSelf ? ', includeRepliesToSelf' : ''})`
      : '';
    defs.push({
      name: `${name}_pending`,
      description: `Returns pending Discord events scoped to ${name} with attention labels. Events are auto-acked on return.${attnDesc} Each event includes attention: boolean and attentionReason field. Use attentionOnly=true to return only events needing attention.`,
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max events to return (1-50)", default: 30 },
          attentionOnly: { type: "boolean", description: "If true, only return events flagged for attention", default: false }
        }
      }
    });
    defs.push({
      name: `${name}_ack`,
      description: `Acknowledges a pending Discord event scoped to ${name}, removing it from the queue`,
      inputSchema: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "The Discord message ID to acknowledge" }
        },
        required: ["eventId"]
      }
    });
    defs.push({
      name: `${name}_reply`,
      description: `Replies to a pending Discord event scoped to ${name}`,
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The Discord message ID from a pending event to reply to" },
          text: { type: "string", description: "The text to send as a reply" }
        },
        required: ["messageId", "text"]
      }
    });
    defs.push({
      name: `${name}_send`,
      description: `Sends a message to a channel within the ${name} scope. Default channel: ${scope.defaultChannelId || 'none'}`,
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The text to send" },
          channelId: { type: "string", description: "Override channel ID (must be within scope)" }
        },
        required: ["text"]
      }
    });
  }
  return defs;
}

export function buildScopedHandlerMap(scopes: Record<string, ScopeConfig>): Map<string, ToolHandler> {
  const map = new Map<string, ToolHandler>();
  for (const [scopeName, scope] of Object.entries(scopes)) {
    const handlers = createScopeHandlers(scopeName, scope);
    for (const [name, handler] of Object.entries(handlers)) {
      map.set(name, handler);
    }
  }
  return map;
}
