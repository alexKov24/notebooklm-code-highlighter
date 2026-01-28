# Fix Jittering During Streaming Content

## Problem

When NotebookLM streams code (character by character), the MutationObserver fires on **every character change**, triggering a full reprocessing chain:

```
Char added → characterData mutation → processAllCodeBlocks()
  → SHA-256 hash (always differs) → renderCodeBlock()
  → highlight.js re-runs → DOM update → visual flicker
  × REPEATED FOR EVERY CHARACTER
```

NotebookLM is a Google product likely using Angular or Lit (Web Components). When it generates responses, it progressively renders text into existing DOM nodes, causing rapid `characterData` mutations.

## Root Causes

1. **No debouncing** — every `characterData` mutation immediately calls `processAllCodeBlocks()`
2. **Hash always changes during streaming** — growing text = new SHA-256 hash every time
3. **Full page scan on every mutation** — `processAllCodeBlocks()` queries ALL `pre > code` elements, not just the changed one
4. **Expensive re-render per character** — highlight.js + React render + storage lookup all fire per character

## Fix Plan

Two-part fix: debounce (already implemented) + height-matching to eliminate layout shift.

### 1. Debounce + targeted processing (DONE)
Already implemented in content.tsx — 300ms debounce, processes only affected elements.

### 2. Height-matching to prevent layout shift
**File:** [content.tsx](notebooklm-code-highlighter/src/entrypoints/content.tsx)

The core jittering issue is that our highlighted container has a different height than the original `<pre>` element. When Angular re-renders and our extension reprocesses, the height difference causes visible layout shift.

**Fix:** Before hiding the original `<pre>`, read its `offsetHeight` and set `min-height` on our Shadow DOM container to match. Update this on each reprocess.

In `processCodeBlock()`, when creating a new container:
```typescript
// Read original height before hiding
const originalHeight = preElement.offsetHeight;
container.style.minHeight = `${originalHeight}px`;
```

When updating an existing block (content changed):
```typescript
// Update min-height to match current original pre height
const preElement = codeElement.parentElement;
if (preElement) {
  // Temporarily show pre to measure, then re-hide
  preElement.style.display = '';
  existing.container.style.minHeight = `${preElement.offsetHeight}px`;
  preElement.style.display = settings.enabled ? 'none' : '';
}
```

## Files to Modify

| File | Changes |
|------|---------|
| [content.tsx](notebooklm-code-highlighter/src/entrypoints/content.tsx) | Add height-matching when creating/updating containers |

## Verification

1. `pnpm build` — ensure builds succeed
2. `pnpm typecheck` — no type errors
3. Manual test on NotebookLM: trigger code generation and confirm no jittering
4. Verify code blocks still highlight correctly after content finishes streaming

---

# Previous: Mozilla Review Fixes + Icon Configuration (COMPLETED)

## Mozilla Review Issues

### 1. Missing Firefox-specific manifest properties (REQUIRED)

**Issue:** Firefox requires `browser_specific_settings.gecko.id` and `browser_specific_settings.gecko.data_collection_permissions`

**Fix:** Update [wxt.config.ts](notebooklm-code-highlighter/wxt.config.ts) to add Firefox-specific settings:

```typescript
manifest: {
  // ... existing config
  browser_specific_settings: {
    gecko: {
      id: 'notebooklm-highlighter@koval.xyz',
      data_collection_permissions: {
        ads: false,
        analytics: false,
        personalization: false,
        technical: false
      }
    }
  }
}
```

### 2. Hidden __MACOSX files in zip (WARNING)

**Issue:** macOS creates `._*` metadata files that get included in the zip

**Fix:** Modify the zip command in [package.json](notebooklm-code-highlighter/package.json) to exclude these files, or create a `.wxtrc` exclude pattern. WXT uses `zip` under the hood - we can configure it to exclude `__MACOSX` and `._*` files.

### 3. Unsafe innerHTML assignments (WARNING)

**Issue:** Mozilla flagged `dangerouslySetInnerHTML` usage in:
- `chunks/popup-B8IkyA1w.js` (lines with column 1790, 4657)
- `content-scripts/content.js` (lines with column 1791, 4660, 2364)

**Analysis:** The innerHTML usage in [CodeBlock.tsx:172-179](notebooklm-code-highlighter/src/components/CodeBlock.tsx#L172-L179) is:
1. **Line numbers** (line 174): Safe - generated from `lines.map((_, i) => i + 1).join('\n')` - just numbers
2. **Highlighted code** (line 178): The HTML comes from `highlight.js` library which escapes user input before adding syntax highlighting markup

**Fix Options:**
- **Option A (Recommended):** Add code comments explaining the safety. The `highlight.js` library internally uses `escapeHTML()` on the code before adding span tags. This is a known safe pattern.
- **Option B:** Use DOMPurify to sanitize (adds dependency, may break highlighting spans)
- **Option C:** Build DOM elements manually instead of innerHTML (significant refactor)

The warnings are false positives because highlight.js escapes input. We can document this for reviewers.

---

## Icon Configuration

### 4. Add extension icons to manifest

**Fix:** Update [wxt.config.ts](notebooklm-code-highlighter/wxt.config.ts) to include icon sizes:

```typescript
manifest: {
  icons: {
    16: 'icon/icon.png',
    32: 'icon/icon.png',
    48: 'icon/icon.png',
    96: 'icon/icon.png',
    128: 'icon/icon.png'
  }
}
```

The existing 2048x2048 PNG will be scaled down by the browser. Alternatively, generate multiple sizes for better quality.

### 5. Add favicon to popup

**Fix:** Update [popup/index.html](notebooklm-code-highlighter/src/entrypoints/popup/index.html):

```html
<link rel="icon" type="image/png" href="/icon/icon.png" />
```

### 6. Replace gradient icon with actual logo in popup

**Fix:** Update [popup/App.tsx](notebooklm-code-highlighter/src/entrypoints/popup/App.tsx):
- Replace the gradient `<div className="header-icon">{'</>'}</div>` with an `<img>` tag
- Update `.header-icon` CSS to properly size the image

---

## Files to Modify

| File | Changes |
|------|---------|
| [wxt.config.ts](notebooklm-code-highlighter/wxt.config.ts) | Add `browser_specific_settings.gecko`, add `icons` |
| [src/entrypoints/popup/index.html](notebooklm-code-highlighter/src/entrypoints/popup/index.html) | Add favicon link |
| [src/entrypoints/popup/App.tsx](notebooklm-code-highlighter/src/entrypoints/popup/App.tsx) | Replace gradient icon with `<img>` |

---

## Verification

1. Run `pnpm build:firefox` and check `.output/firefox-mv2/manifest.json` contains:
   - `browser_specific_settings.gecko.id`
   - `browser_specific_settings.gecko.data_collection_permissions`
   - `icons` object
2. Run `pnpm zip:firefox` and verify no `__MACOSX` or `._*` files in the zip
3. Load the extension in Firefox and verify:
   - Extension icon appears in toolbar
   - Popup shows the logo image in header
   - Favicon appears in popup tab (if visible)
4. Test on NotebookLM to ensure highlighting still works
