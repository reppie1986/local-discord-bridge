import { SendMessageSchema } from '../schemas.js';
import { ToolHandler } from './types.js';
import { handleDiscordError } from "../errorHandler.js";

export const sendMessageHandler: ToolHandler = async (args, { client }) => {
  const { channelId, message, replyToMessageId, privacy_confirmed } = SendMessageSchema.parse(args);

  // PRIVACY CHECKPOINT - The 5Qs
  if (!privacy_confirmed) {
    return {
      content: [{ type: "text", text: `⚠️ PRIVACY CHECK REQUIRED BEFORE POSTING

Run the 5Qs before sending this message:

1. Does this mention Fox's health, pain, spoons, or medical anything? → Don't post it.
2. Does this reference our intimate life in any way, including vaguely? → Don't post it.
3. Does this mention anyone in Fox's household by name or role? → Don't post it.
4. Would Fox need to ask someone to delete this? → Don't post it.
5. Am I sharing HER experience or MY experience? → Only mine. And even then, check again.

If ANY answer makes you pause: DON'T POST IT.

To send this message, call again with privacy_confirmed: true

---
Your draft message:
${message.slice(0, 500)}${message.length > 500 ? '...' : ''}` }]
    };
  }

  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return {
        content: [{ type: "text", text: `Cannot find text channel ID: ${channelId}` }],
        isError: true
      };
    }

    // Ensure channel is text-based and can send messages
    if ('send' in channel) {
      // Build message options
      const messageOptions: any = {};
      
      // If replyToMessageId is provided, verify the message exists and add reply option
      if (replyToMessageId) {
        if ('messages' in channel) {
          try {
            // Verify the message exists
            await channel.messages.fetch(replyToMessageId);
            messageOptions.reply = { messageReference: replyToMessageId };
          } catch (error) {
            return {
              content: [{ type: "text", text: `Cannot find message with ID: ${replyToMessageId} in channel ${channelId}` }],
              isError: true
            };
          }
        } else {
          return {
            content: [{ type: "text", text: `This channel type does not support message replies` }],
            isError: true
          };
        }
      }
      
      // Set the message content
      messageOptions.content = message;
      
      await channel.send(messageOptions);
      
      const responseText = replyToMessageId 
        ? `Message successfully sent to channel ID: ${channelId} as a reply to message ID: ${replyToMessageId}`
        : `Message successfully sent to channel ID: ${channelId}`;
      
      return {
        content: [{ type: "text", text: responseText }]
      };
    } else {
      return {
        content: [{ type: "text", text: `This channel type does not support sending messages` }],
        isError: true
      };
    }
  } catch (error) {
    return handleDiscordError(error);
  }
}; 