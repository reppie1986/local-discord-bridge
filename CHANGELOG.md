# Changelog

## Per-Tool Auto-Execute Toggles + Forced `*_ack`/`*_pending` Execution

**Files changed:**
- `extension/pages/content/src/types/stores.ts`
- `extension/pages/content/src/stores/ui.store.ts`
- `extension/pages/content/src/services/automation.service.ts`
- `extension/pages/content/src/render_prescript/src/renderer/functionBlock.ts`
- `extension/pages/content/src/components/sidebar/Settings/Settings.tsx`
- `extension/pages/content/src/components/sidebar/SidebarManager.tsx`

**What:**
Added per-tool auto-execute overrides to the extension settings. Tools ending in `_ack` or `_pending` always auto-execute regardless of global toggles. Other tools only auto-execute when global auto-execute is on AND their per-tool toggle is enabled.

**Why:**
`*_ack` and `*_pending` tools are lightweight status updates that must always flow through. Other side-effecting tools (`*_reply`, `*_send`, etc.) should be opt-in to prevent unintended Discord actions.

**Details:**
- New `autoExecuteTools: Record<string, boolean>` field on `UserPreferences` — persisted via Zustand middleware
- `automation.service.ts` now exposes `autoExecuteTools` on `window.__mcpAutomationState` and refreshes on preference changes
- `functionBlock.ts` gains `isForcedAutoExecuteTool()`, `shouldAutoExecuteTool()`, and a runtime dedupe guard (5s window)
- New "Per-Tool Auto-Execute" card in Settings panel with toggle switches; forced tools shown as "Always"

---

## Discord Image Fetch — Returns Actual Image Payload

**Files changed:**
- `bridge/src/tools/image.ts`

**What:**
`discord_fetch_image` now returns the image as proper MCP `ImageContent` in addition to JSON metadata with a `dataUri`.

**Why:**
The tool was returning only JSON text containing a `dataUri` string, which the model received as text it couldn't visually inspect.

**Details:**
- On success, the `content` array includes:
  1. `{ type: "image", data: "<base64>", mimeType: "image/webp" }` — native MCP image
  2. `{ type: "text", text: JSON.stringify({ success, imageAvailable, mimeType, width, height, sizeKB, sourceUrl, dataUri }) }` — metadata with full dataUri
- Failure responses remain `type: "text"` with error details
- All existing Discord CDN scaling logic preserved (cdn→media URL normalization, width iteration, maxSizeKB, webp conversion)

---

## Extension Renders Image Content from Tool Results

**Files changed:**
- `extension/pages/content/src/render_prescript/src/renderer/components.ts`
- `extension/pages/content/src/render_prescript/src/renderer/functionResult.ts`

**What:**
The extension now handles `type: "image"` content items in MCP tool results, converting them to markdown images in the text paste flow and rendering them in the result panel.

**Why:**
The extension's `displayResult()` only handled `type: "text"` items — image data was silently discarded. The `<function_result>` rendering path only handled images with external URLs, not base64 data URIs.

**Details:**
- `displayResult()`: image items are converted to `![image](data:mimeType;base64,...)` markdown and included when user clicks Insert
- `renderFunctionResultContent()`: now handles `item.data` + `item.mimeType` to construct `data:` URIs for `<img>` tags in the display panel
