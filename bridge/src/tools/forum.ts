import { ChannelType, ForumChannel } from 'discord.js';
import { GetForumChannelsSchema, CreateForumPostSchema, GetForumPostSchema, ReplyToForumSchema, DeleteForumPostSchema } from '../schemas.js';
import { ToolHandler } from './types.js';
import { handleDiscordError } from "../errorHandler.js";

export const getForumChannelsHandler: ToolHandler = async (args, { client }) => {
  const { guildId } = GetForumChannelsSchema.parse(args);
  
  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      return {
        content: [{ type: "text", text: `Cannot find guild with ID: ${guildId}` }],
        isError: true
      };
    }

    // Fetch all channels from the guild
    const channels = await guild.channels.fetch();
    
    // Filter to get only forum channels
    const forumChannels = channels.filter(channel => channel?.type === ChannelType.GuildForum);
    
    if (forumChannels.size === 0) {
      return {
        content: [{ type: "text", text: `No forum channels found in guild: ${guild.name}` }]
      };
    }

    // Format forum channels information
    const forumInfo = forumChannels.map(channel => ({
      id: channel.id,
      name: channel.name,
      topic: channel.topic || "No topic set"
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(forumInfo, null, 2) }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};

export const createForumPostHandler: ToolHandler = async (args, { client }) => {
  const { forumChannelId, title, content, tags } = CreateForumPostSchema.parse(args);
  
  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const channel = await client.channels.fetch(forumChannelId);
    if (!channel || channel.type !== ChannelType.GuildForum) {
      return {
        content: [{ type: "text", text: `Channel ID ${forumChannelId} is not a forum channel.` }],
        isError: true
      };
    }

    const forumChannel = channel as ForumChannel;
    
    // Get available tags in the forum
    const availableTags = forumChannel.availableTags;
    let selectedTagIds: string[] = [];
    
    // If tags are provided, find their IDs
    if (tags && tags.length > 0) {
      selectedTagIds = availableTags
        .filter(tag => tags.includes(tag.name))
        .map(tag => tag.id);
    }

    // Create the forum post
    const thread = await forumChannel.threads.create({
      name: title,
      message: {
        content: content
      },
      appliedTags: selectedTagIds.length > 0 ? selectedTagIds : undefined
    });

    return {
      content: [{ 
        type: "text", 
        text: `Successfully created forum post "${title}" with ID: ${thread.id}` 
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};

export const getForumPostHandler: ToolHandler = async (args, { client }) => {
  const { threadId } = GetForumPostSchema.parse(args);
  
  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const thread = await client.channels.fetch(threadId);
    if (!thread || !(thread.isThread())) {
      return {
        content: [{ type: "text", text: `Cannot find thread with ID: ${threadId}` }],
        isError: true
      };
    }

    // Get messages from the thread
    const messages = await thread.messages.fetch({ limit: 10 });

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
      const embeds = msg.embeds.map(e => {
        const out: any = {
          type: (e as any).data?.type ?? null,
          url: e.url ?? null,
          title: e.title ?? null,
          description: e.description ?? null,
          provider: e.provider ? { name: e.provider.name, url: e.provider.url } : null
        };
        if (e.image) out.image = { url: e.image.url, proxy_url: e.image.proxyURL, width: e.image.width, height: e.image.height };
        if (e.thumbnail) out.thumbnail = { url: e.thumbnail.url, proxy_url: e.thumbnail.proxyURL, width: e.thumbnail.width, height: e.thumbnail.height };
        if (e.video) out.video = { url: e.video.url, proxy_url: e.video.proxyURL, width: e.video.width, height: e.video.height };
        return out;
      });
      return {
        id: msg.id,
        content: msg.content,
        author: msg.author.tag,
        createdAt: msg.createdAt,
        attachments,
        embeds
      };
    });

    const image_refs: Array<{ message_id: string; source: string; url: string; width?: number | null; height?: number | null }> = [];
    for (const m of formattedMessages) {
      for (const a of m.attachments) {
        if (a.content_type && a.content_type.startsWith('image/')) {
          image_refs.push({ message_id: m.id, source: 'attachment', url: a.url, width: a.width, height: a.height });
        }
      }
      for (const e of m.embeds) {
        if (e.image?.url) image_refs.push({ message_id: m.id, source: 'embed-image', url: e.image.url, width: e.image.width, height: e.image.height });
        if (e.thumbnail?.url) image_refs.push({ message_id: m.id, source: 'embed-thumbnail', url: e.thumbnail.url, width: e.thumbnail.width, height: e.thumbnail.height });
        if (e.video?.url && (e.type === 'gifv' || e.type === 'image')) image_refs.push({ message_id: m.id, source: 'embed-video', url: e.video.url, width: e.video.width, height: e.video.height });
      }
    }

    const threadDetails = {
      id: thread.id,
      name: thread.name,
      parentId: thread.parentId,
      messageCount: messages.size,
      createdAt: thread.createdAt,
      messages: formattedMessages,
      image_refs
    };

    return {
      content: [{ type: "text", text: JSON.stringify(threadDetails, null, 2) }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};

export const replyToForumHandler: ToolHandler = async (args, { client }) => {
  const { threadId, message } = ReplyToForumSchema.parse(args);
  
  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const thread = await client.channels.fetch(threadId);
    if (!thread || !(thread.isThread())) {
      return {
        content: [{ type: "text", text: `Cannot find thread with ID: ${threadId}` }],
        isError: true
      };
    }

    if (!('send' in thread)) {
      return {
        content: [{ type: "text", text: `This thread does not support sending messages` }],
        isError: true
      };
    }

    // Send the reply
    const sentMessage = await thread.send(message);

    return {
      content: [{ 
        type: "text", 
        text: `Successfully replied to forum post. Message ID: ${sentMessage.id}` 
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};

export const deleteForumPostHandler: ToolHandler = async (args, { client }) => {
  const { threadId, reason } = DeleteForumPostSchema.parse(args);
  
  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const thread = await client.channels.fetch(threadId);
    if (!thread || !thread.isThread()) {
      return {
        content: [{ type: "text", text: `Cannot find forum post/thread with ID: ${threadId}` }],
        isError: true
      };
    }

    // Delete the forum post/thread
    await thread.delete(reason || "Forum post deleted via API");

    return {
      content: [{ 
        type: "text", 
        text: `Successfully deleted forum post/thread with ID: ${threadId}` 
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}; 