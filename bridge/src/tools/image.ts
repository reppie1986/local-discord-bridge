import { ToolContext, ToolResponse } from "./types.js";

interface FetchImageArgs {
  url: string;
  proxyUrl?: string;
  maxSizeKB?: number;
}

type FetchScaledImageResult =
  | {
      success: true;
      dataUri: string;
      base64: string;
      width: number;
      mimeType: string;
      sizeKB: number;
      attemptedWidths: number[];
      sourceUrl: string;
    }
  | {
      success: false;
      reason: string;
      mimeType?: string;
      finalWidth?: number;
      finalSizeKB?: number;
      attemptedWidths: number[];
      sourceUrl: string;
    };

const DEBUG_IMAGE_FETCH = process.env.DEBUG_IMAGE_FETCH === "1";

function isDiscordImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    return (
      urlObj.hostname === "cdn.discordapp.com" ||
      urlObj.hostname === "media.discordapp.net"
    );
  } catch {
    return false;
  }
}

function toDiscordMediaUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname === "cdn.discordapp.com") {
      urlObj.hostname = "media.discordapp.net";
      return urlObj.toString();
    }

    return url;
  } catch {
    return url;
  }
}

function buildFetchUrl(baseUrl: string, width: number, isDiscordCDN: boolean): string {
  if (!isDiscordCDN) {
    return baseUrl;
  }

  const urlObj = new URL(baseUrl);

  urlObj.searchParams.set("width", String(width));
  urlObj.searchParams.set("height", String(width));
  urlObj.searchParams.set("format", "webp");

  return urlObj.toString();
}

async function fetchScaledImage(
  url: string,
  proxyUrl?: string,
  maxSizeKB: number = 200
): Promise<FetchScaledImageResult> {
  const maxSizeBytes = maxSizeKB * 1024;

  // Base64 adds about 33% overhead, and JSON/data-uri wrapper adds more.
  // So do NOT allow the raw image to reach the full requested limit.
  const maxRawBytes = Math.floor(maxSizeBytes * 0.70);

  const preferredUrl = proxyUrl || url;
  const isDiscordCDN = isDiscordImageUrl(preferredUrl);

  const baseUrl = isDiscordCDN
    ? toDiscordMediaUrl(preferredUrl)
    : preferredUrl;

  const widths = [1024, 768, 576, 432, 324, 243, 200, 150, 100];
  const attemptedWidths: number[] = [];

  let lastMimeType: string | undefined;
  let lastWidth: number | undefined;
  let lastSizeKB: number | undefined;

  for (const width of widths) {
    attemptedWidths.push(width);

    let fetchUrl: string;

    try {
      fetchUrl = buildFetchUrl(baseUrl, width, isDiscordCDN);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown URL build error";

      return {
        success: false,
        reason: `Could not build image fetch URL: ${errorMessage}`,
        attemptedWidths,
        sourceUrl: baseUrl,
      };
    }

    let response: Response;

    try {
      response = await fetch(fetchUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown fetch error";

      return {
        success: false,
        reason: `Failed to fetch image: ${errorMessage}`,
        finalWidth: width,
        attemptedWidths,
        sourceUrl: fetchUrl,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        reason: `Failed to fetch image: HTTP ${response.status}`,
        finalWidth: width,
        attemptedWidths,
        sourceUrl: fetchUrl,
      };
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();

    lastMimeType = contentType;
    lastWidth = width;
    lastSizeKB = Math.round(arrayBuffer.byteLength / 1024);

    if (DEBUG_IMAGE_FETCH) {
      console.log("[discord_fetch_image]", {
        requestedWidth: width,
        fetchUrl,
        responseUrl: response.url,
        contentType,
        contentLength: response.headers.get("content-length"),
        actualSizeKB: lastSizeKB,
        maxRawKB: Math.round(maxRawBytes / 1024),
      });
    }

    if (arrayBuffer.byteLength <= maxRawBytes) {
      const base64 = Buffer.from(new Uint8Array(arrayBuffer)).toString("base64");

      return {
        success: true,
        dataUri: `data:${contentType};base64,${base64}`,
        base64,
        width,
        mimeType: contentType,
        sizeKB: lastSizeKB,
        attemptedWidths,
        sourceUrl: fetchUrl,
      };
    }

    if (!isDiscordCDN) {
      return {
        success: false,
        reason: `Image too large (${lastSizeKB}KB) and URL does not support Discord CDN resizing`,
        mimeType: contentType,
        finalWidth: width,
        finalSizeKB: lastSizeKB,
        attemptedWidths,
        sourceUrl: fetchUrl,
      };
    }
  }

  return {
    success: false,
    reason: `Could not scale image under ${maxSizeKB}KB limit`,
    mimeType: lastMimeType,
    finalWidth: lastWidth,
    finalSizeKB: lastSizeKB,
    attemptedWidths,
    sourceUrl: baseUrl,
  };
}

export async function fetchImageHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  void context;

  const { url, proxyUrl, maxSizeKB = 200 } = args as FetchImageArgs;

  if (!url) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            imageAvailable: false,
            reason: "url is required",
          }),
        },
      ],
    };
  }

  try {
    const result = await fetchScaledImage(url, proxyUrl, maxSizeKB);

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              imageAvailable: false,
              reason: result.reason,
              mimeType: result.mimeType,
              finalWidth: result.finalWidth,
              finalSizeKB: result.finalSizeKB,
              attemptedWidths: result.attemptedWidths,
              sourceUrl: result.sourceUrl,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "image",
          data: result.base64,
          mimeType: result.mimeType,
        },
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            imageAvailable: true,
            mimeType: result.mimeType,
            width: result.width,
            height: result.width,
            sizeKB: result.sizeKB,
            sourceUrl: result.sourceUrl,
            dataUri: result.dataUri,
          }),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            imageAvailable: false,
            reason: `Unexpected image fetch error: ${errorMessage}`,
          }),
        },
      ],
    };
  }
}