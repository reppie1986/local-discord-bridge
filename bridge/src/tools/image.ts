import { ToolContext, ToolResponse } from "./types.js";

interface FetchImageArgs {
  url: string;
  maxSizeKB?: number;
}

// Hard ceiling — ChatGPT and Gemini both reject vision attachments above
// ~20 MB. We stay well under so any single response fits comfortably in the
// JSON-RPC envelope returned over local HTTP.
const HARD_CEILING_KB = 18 * 1024; // 18 MB

// Fetch image with iterative scaling using Discord CDN's width parameter.
// `maxSizeKB` is the *target*; the function prefers the first variant under
// that size. If no variant fits (high-detail screenshots, big PNGs), it
// returns the smallest available variant rather than throwing — vision
// models accept much larger inputs than the target, and a too-large image
// the model can see is strictly better than an error.
async function fetchImageWithScaling(
  url: string,
  maxSizeKB: number = 800
): Promise<{ base64: string; width: number; mimeType: string; sizeBytes: number; targetMet: boolean }> {
  const maxSizeBytes = maxSizeKB * 1024;
  const hardCeilingBytes = HARD_CEILING_KB * 1024;
  const isDiscordCDN = url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net');
  const widths = [1536, 1280, 1024, 768, 576, 432, 324, 243, 200];

  // Track the smallest variant we've seen so far — fallback if nothing fits
  // the soft target.
  let smallest: { bytes: ArrayBuffer; width: number; mimeType: string } | null = null;

  for (const width of widths) {
    let fetchUrl = url;
    if (isDiscordCDN) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('width', String(width));
      fetchUrl = urlObj.toString();
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();

    // Track smallest as we go.
    if (!smallest || arrayBuffer.byteLength < smallest.bytes.byteLength) {
      smallest = { bytes: arrayBuffer, width, mimeType: contentType };
    }

    if (arrayBuffer.byteLength <= maxSizeBytes) {
      const base64 = Buffer.from(new Uint8Array(arrayBuffer)).toString('base64');
      return {
        base64,
        width,
        mimeType: contentType,
        sizeBytes: arrayBuffer.byteLength,
        targetMet: true,
      };
    }

    // Non-resizable URL: one round only. Fall through to the post-loop
    // smallest-variant fallback so we still return *something* the model
    // can see (as long as it's under the hard ceiling).
    if (!isDiscordCDN) {
      break;
    }
  }

  if (!smallest) {
    throw new Error('Could not fetch image at any width');
  }

  if (smallest.bytes.byteLength > hardCeilingBytes) {
    throw new Error(
      `Image still ${Math.round(smallest.bytes.byteLength / 1024)}KB at smallest scaled width — exceeds vision-attachment ceiling (${HARD_CEILING_KB}KB).`
    );
  }

  // Return the smallest variant we found. Caller can read `targetMet: false`
  // and either accept it or call again with a larger maxSizeKB.
  const base64 = Buffer.from(new Uint8Array(smallest.bytes)).toString('base64');
  return {
    base64,
    width: smallest.width,
    mimeType: smallest.mimeType,
    sizeBytes: smallest.bytes.byteLength,
    targetMet: false,
  };
}

export async function fetchImageHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  const { url, maxSizeKB = 800 } = args as FetchImageArgs;

  if (!url) {
    return {
      content: [{ type: "text", text: "Error: url is required" }],
      isError: true
    };
  }

  try {
    const result = await fetchImageWithScaling(url, maxSizeKB);
    const sizeKB = Math.round(result.sizeBytes / 1024);

    return {
      content: [
        {
          type: "image",
          data: result.base64,
          mimeType: result.mimeType
        },
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            finalWidth: result.width,
            mimeType: result.mimeType,
            sizeKB,
            targetMet: result.targetMet,
            note: result.targetMet
              ? undefined
              : `Image returned at smallest available width (${sizeKB}KB > ${maxSizeKB}KB target). Still well under the 20MB vision-attachment ceiling.`
          })
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error fetching image: ${errorMessage}` }],
      isError: true
    };
  }
}
