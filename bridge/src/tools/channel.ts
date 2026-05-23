import { z } from "zod";
import { ChannelType } from "discord.js";
import { ToolContext, ToolResponse } from "./types.js";
import { 
  CreateTextChannelSchema, 
  DeleteChannelSchema, 
  ReadMessagesSchema,
  GetMessageSchema,
  CreateCategorySchema,
  EditCategorySchema,
  DeleteCategorySchema
} from "../schemas.js";
import { handleDiscordError } from "../errorHandler.js";

  // Category creation handler
export async function createCategoryHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  const { guildId, name, position, reason } = CreateCategorySchema.parse(args);
  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }
    const guild = await context.client.guilds.fetch(guildId);
    if (!guild) {
      return {
        content: [{ type: "text", text: `Cannot find guild with ID: ${guildId}` }],
        isError: true
      };
    }
    const options: any = { name, type: ChannelType.GuildCategory };
    if (typeof position === "number") options.position = position;
    if (reason) options.reason = reason;
    const category = await guild.channels.create(options);
    return {
      content: [{ type: "text", text: `Successfully created category "${name}" with ID: ${category.id}` }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}

// Category edit handler
export async function editCategoryHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  const { categoryId, name, position, reason } = EditCategorySchema.parse(args);
  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }
    const category = await context.client.channels.fetch(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return {
        content: [{ type: "text", text: `Cannot find category with ID: ${categoryId}` }],
        isError: true
      };
    }
    const update: any = {};
    if (name) update.name = name;
    if (typeof position === "number") update.position = position;
    if (reason) update.reason = reason;
    await category.edit(update);
    return {
      content: [{ type: "text", text: `Successfully edited category with ID: ${categoryId}` }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}

// Category deletion handler
export async function deleteCategoryHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  const { categoryId, reason } = DeleteCategorySchema.parse(args);
  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }
    const category = await context.client.channels.fetch(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return {
        content: [{ type: "text", text: `Cannot find category with ID: ${categoryId}` }],
        isError: true
      };
    }
    await category.delete(reason || "Category deleted via API");
    return {
      content: [{ type: "text", text: `Successfully deleted category with ID: ${categoryId}` }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}

  // Text channel creation handler
export async function createTextChannelHandler(
  args: unknown, 
  context: ToolContext
): Promise<ToolResponse> {
  const { guildId, channelName, topic, reason } = CreateTextChannelSchema.parse(args);
  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const guild = await context.client.guilds.fetch(guildId);
    if (!guild) {
      return {
        content: [{ type: "text", text: `Cannot find guild with ID: ${guildId}` }],
        isError: true
      };
    }

    // Create the text channel
    const channelOptions: any = {
      name: channelName,
      type: ChannelType.GuildText
    };
    if (topic) channelOptions.topic = topic;
    if (reason) channelOptions.reason = reason;
    const channel = await guild.channels.create(channelOptions);

    return {
      content: [{ 
        type: "text", 
        text: `Successfully created text channel "${channelName}" with ID: ${channel.id}` 
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}

// Channel deletion handler
export async function deleteChannelHandler(
  args: unknown, 
  context: ToolContext
): Promise<ToolResponse> {
  const { channelId, reason } = DeleteChannelSchema.parse(args);
  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const channel = await context.client.channels.fetch(channelId);
    if (!channel) {
      return {
        content: [{ type: "text", text: `Cannot find channel with ID: ${channelId}` }],
        isError: true
      };
    }

    // Check if channel can be deleted (has delete method)
    if (!('delete' in channel)) {
      return {
        content: [{ type: "text", text: `This channel type does not support deletion or the bot lacks permissions` }],
        isError: true
      };
    }

    // Delete the channel
    await channel.delete(reason || "Channel deleted via API");

    return {
      content: [{ 
        type: "text", 
        text: `Successfully deleted channel with ID: ${channelId}` 
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}

// Message reading handler
export async function readMessagesHandler(
  args: unknown, 
  context: ToolContext
): Promise<ToolResponse> {
  const { channelId, limit } = ReadMessagesSchema.parse(args);
  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const channel = await context.client.channels.fetch(channelId);
    if (!channel) {
      return {
        content: [{ type: "text", text: `Cannot find channel with ID: ${channelId}` }],
        isError: true
      };
    }

    // Check if channel has messages (text channel, thread, etc.)
    if (!channel.isTextBased() || !('messages' in channel)) {
      return {
        content: [{ type: "text", text: `Channel type does not support reading messages` }],
        isError: true
      };
    }

    // Fetch messages
    const messages = await channel.messages.fetch({ limit });
    
    if (messages.size === 0) {
      return {
        content: [{ type: "text", text: `No messages found in channel` }]
      };
    }

    // Format messages
    const formattedMessages = messages.map(msg => {
      const attachments = msg.attachments.map(a => ({
        id: a.id,
        filename: a.name,
        url: a.url,
        proxy_url: a.proxyURL,
        content_type: a.contentType,
        size: a.size,
        width: a.width,
        height: a.height
      }));

      // Surface embed bodies, not just a count — Tenor GIFs and link-preview
      // images live here. Without this the companion can't see any image that
      // wasn't uploaded as a direct attachment.
      const embeds = msg.embeds.map(e => {
        const out: any = {
          type: (e as any).data?.type ?? null, // 'image' | 'gifv' | 'video' | 'link' | 'rich' | ...
          url: e.url ?? null,
          title: e.title ?? null,
          description: e.description ?? null,
          provider: e.provider ? { name: e.provider.name, url: e.provider.url } : null
        };
        if (e.image) {
          out.image = { url: e.image.url, proxy_url: e.image.proxyURL, width: e.image.width, height: e.image.height };
        }
        if (e.thumbnail) {
          out.thumbnail = { url: e.thumbnail.url, proxy_url: e.thumbnail.proxyURL, width: e.thumbnail.width, height: e.thumbnail.height };
        }
        if (e.video) {
          out.video = { url: e.video.url, proxy_url: e.video.proxyURL, width: e.video.width, height: e.video.height };
        }
        return out;
      });

      return {
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          bot: msg.author.bot
        },
        timestamp: msg.createdAt,
        attachments,
        embeds,
        sticker_items: Array.from(msg.stickers.values()).map(s => ({
          id: s.id,
          name: s.name,
          format: s.format,
          url: s.url
        })),
        replyTo: msg.reference ? msg.reference.messageId : null
      };
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Convenience: flat list of every viewable image/GIF URL in this batch.
    // Companions call discord_fetch_image on entries they actually want to see.
    const image_refs: Array<{
      message_id: string;
      source: 'attachment' | 'embed-image' | 'embed-thumbnail' | 'embed-video' | 'sticker';
      url: string;
      width?: number | null;
      height?: number | null;
      content_type?: string | null;
      filename?: string | null;
    }> = [];
    for (const m of formattedMessages) {
      for (const a of m.attachments) {
        if (a.content_type && a.content_type.startsWith('image/')) {
          image_refs.push({
            message_id: m.id,
            source: 'attachment',
            url: a.url,
            width: a.width,
            height: a.height,
            content_type: a.content_type,
            filename: a.filename ?? null
          });
        }
      }
      for (const e of m.embeds) {
        if (e.image?.url) {
          image_refs.push({ message_id: m.id, source: 'embed-image', url: e.image.url, width: e.image.width, height: e.image.height });
        }
        if (e.thumbnail?.url) {
          image_refs.push({ message_id: m.id, source: 'embed-thumbnail', url: e.thumbnail.url, width: e.thumbnail.width, height: e.thumbnail.height });
        }
        // Tenor/Giphy 'gifv' embeds: video.url is the playable mp4; thumbnail
        // is the still frame. We surface both so the companion can decide.
        if (e.video?.url && (e.type === 'gifv' || e.type === 'image')) {
          image_refs.push({ message_id: m.id, source: 'embed-video', url: e.video.url, width: e.video.width, height: e.video.height });
        }
      }
      for (const s of m.sticker_items) {
        if (s.url) {
          image_refs.push({ message_id: m.id, source: 'sticker', url: s.url, filename: s.name });
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          channelId,
          messageCount: formattedMessages.length,
          messages: formattedMessages,
          image_refs
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}

// Single-message fetch handler
export async function getMessageHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  const { channelId, messageId } = GetMessageSchema.parse(args);
  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const channel = await context.client.channels.fetch(channelId);
    if (!channel) {
      return {
        content: [{ type: "text", text: `Cannot find channel with ID: ${channelId}` }],
        isError: true
      };
    }

    if (!channel.isTextBased() || !('messages' in channel)) {
      return {
        content: [{ type: "text", text: `Channel type does not support reading messages` }],
        isError: true
      };
    }

    const msg = await channel.messages.fetch(messageId);

    const attachments = msg.attachments.map(a => ({
      id: a.id,
      filename: a.name,
      url: a.url,
      proxy_url: a.proxyURL,
      content_type: a.contentType,
      size: a.size,
      width: a.width,
      height: a.height
    }));

    const embeds = msg.embeds.map(e => {
      const out: any = {
        type: (e as any).data?.type ?? null,
        url: e.url ?? null,
        title: e.title ?? null,
        description: e.description ?? null,
        provider: e.provider ? { name: e.provider.name, url: e.provider.url } : null
      };
      if (e.image) {
        out.image = { url: e.image.url, proxy_url: e.image.proxyURL, width: e.image.width, height: e.image.height };
      }
      if (e.thumbnail) {
        out.thumbnail = { url: e.thumbnail.url, proxy_url: e.thumbnail.proxyURL, width: e.thumbnail.width, height: e.thumbnail.height };
      }
      if (e.video) {
        out.video = { url: e.video.url, proxy_url: e.video.proxyURL, width: e.video.width, height: e.video.height };
      }
      return out;
    });

    const formattedMessage = {
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        bot: msg.author.bot
      },
      timestamp: msg.createdAt,
      attachments,
      embeds,
      sticker_items: Array.from(msg.stickers.values()).map(s => ({
        id: s.id,
        name: s.name,
        format: s.format,
        url: s.url
      })),
      replyTo: msg.reference ? msg.reference.messageId : null
    };

    const image_refs: Array<{
      message_id: string;
      source: 'attachment' | 'embed-image' | 'embed-thumbnail' | 'embed-video' | 'sticker';
      url: string;
      width?: number | null;
      height?: number | null;
      content_type?: string | null;
      filename?: string | null;
    }> = [];

    for (const a of attachments) {
      if (a.content_type && a.content_type.startsWith('image/')) {
        image_refs.push({
          message_id: formattedMessage.id,
          source: 'attachment',
          url: a.url,
          width: a.width,
          height: a.height,
          content_type: a.content_type,
          filename: a.filename ?? null
        });
      }
    }
    for (const e of embeds) {
      if (e.image?.url) {
        image_refs.push({ message_id: formattedMessage.id, source: 'embed-image', url: e.image.url, width: e.image.width, height: e.image.height });
      }
      if (e.thumbnail?.url) {
        image_refs.push({ message_id: formattedMessage.id, source: 'embed-thumbnail', url: e.thumbnail.url, width: e.thumbnail.width, height: e.thumbnail.height });
      }
      if (e.video?.url && (e.type === 'gifv' || e.type === 'image')) {
        image_refs.push({ message_id: formattedMessage.id, source: 'embed-video', url: e.video.url, width: e.video.width, height: e.video.height });
      }
    }
    for (const s of formattedMessage.sticker_items) {
      if (s.url) {
        image_refs.push({ message_id: formattedMessage.id, source: 'sticker', url: s.url, filename: s.name });
      }
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          channelId,
          message: formattedMessage,
          image_refs
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}
