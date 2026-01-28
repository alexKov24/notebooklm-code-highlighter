# NotebookLM Code Highlighter - Implementation Plan

## Overview
A WXT browser extension that adds syntax highlighting to code blocks in NotebookLM chat responses.

## Requirements Summary

### Core Functionality
- **Target site**: notebooklm.google.com only
- **Selector**: `pre > code` elements
- **Highlighting engine**: highlight.js with auto-detection
- **Timing**: Real-time via MutationObserver

### UI Features
- **Language picker**: Top-right overlay, searchable dropdown with recent languages
- **Copy button**: Icon swap (clipboard → checkmark) feedback
- **Line numbers**: Non-selectable via CSS `user-select: none`
- **Long code blocks**: Fixed max-height (400px) with internal scroll

### Theming
- Auto light/dark based on `prefers-color-scheme`
- 2-3 curated theme pairs (GitHub Light/Dark, VS Code Light/Dark)
- Inherit site's monospace font

### Storage
- `chrome.storage.local` for:
  - Settings (theme, enabled state, max-height)
  - Language cache: `hash(code) → language` mapping

### Popup Settings Panel
- Enable/disable toggle
- Theme selector dropdown
- Max-height configuration

### Technical Stack
- WXT + React + Strict TypeScript
- pnpm package manager
- Chrome (MV3) + Firefox support
- Shadow DOM for CSS isolation

---

## Implementation Steps

### Step 1: Initialize Project
```bash
pnpm create wxt@latest notebooklm-code-highlighter --template react
cd notebooklm-code-highlighter
```

**Files created:**
- `package.json` - dependencies and scripts
- `wxt.config.ts` - WXT configuration
- `tsconfig.json` - TypeScript strict config

### Step 2: Install Dependencies
```bash
pnpm add highlight.js
pnpm add -D @types/node
```

### Step 3: Configure WXT
**File: `wxt.config.ts`**
- Set manifest name: "NotebookLM Code Highlighter"
- Configure content script for `notebooklm.google.com`
- Set up Chrome MV3 + Firefox targets

### Step 4: Create Type Definitions
**File: `src/types/index.ts`**
- `Settings` interface (theme, enabled, maxHeight)
- `LanguageCache` type
- `CodeBlockState` interface

### Step 5: Create Storage Utilities
**File: `src/utils/storage.ts`**
- `getSettings()` / `saveSettings()`
- `getLanguageForHash()` / `saveLanguageForHash()`
- Hash function for code content

### Step 6: Create Highlight.js Wrapper
**File: `src/utils/highlighter.ts`**
- Initialize highlight.js with common languages
- `highlightCode(code: string, language?: string)`
- `detectLanguage(code: string)` with confidence check

### Step 7: Build Shadow DOM Component
**File: `src/components/CodeBlock.tsx`**
- Create Shadow DOM container
- Inject highlight.js theme CSS
- Render highlighted code with line numbers

### Step 8: Create Language Picker Component
**File: `src/components/LanguagePicker.tsx`**
- Searchable input
- Recent languages section (stored in local state)
- Full alphabetical language list
- Click handler to re-highlight with selected language

### Step 9: Create Copy Button Component
**File: `src/components/CopyButton.tsx`**
- Clipboard icon (default state)
- Checkmark icon (copied state, 2s timeout)
- `navigator.clipboard.writeText()` implementation

### Step 10: Implement Content Script
**File: `src/entrypoints/content.ts`**
- MutationObserver watching for `pre > code` elements
- WeakMap to track processed elements
- Hash comparison for content changes
- Mount React component into Shadow DOM for each code block

### Step 11: Build Popup Settings Panel
**File: `src/entrypoints/popup/App.tsx`**
- Enable/disable toggle switch
- Theme dropdown (GitHub, VS Code pairs)
- Max-height input/slider
- Save to `chrome.storage.local`

### Step 12: Add Theme CSS
**File: `src/styles/themes.ts`**
- Import GitHub Light/Dark CSS
- Import VS Code Light/Dark CSS
- Export theme CSS strings for Shadow DOM injection

### Step 13: System Theme Detection
**File: `src/utils/theme.ts`**
- `matchMedia('(prefers-color-scheme: dark)')`
- Listen for changes and update highlighting

---

## File Structure
```
notebooklm-code-highlighter/
├── src/
│   ├── entrypoints/
│   │   ├── content.ts          # Main content script
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── App.tsx         # Settings panel
│   │   └── background.ts       # Service worker (minimal)
│   ├── components/
│   │   ├── CodeBlock.tsx       # Shadow DOM wrapper
│   │   ├── LanguagePicker.tsx  # Searchable dropdown
│   │   └── CopyButton.tsx      # Copy with feedback
│   ├── utils/
│   │   ├── storage.ts          # Chrome storage helpers
│   │   ├── highlighter.ts      # highlight.js wrapper
│   │   └── theme.ts            # System theme detection
│   ├── styles/
│   │   └── themes.ts           # Theme CSS strings
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── public/
│   └── icon/                   # Extension icons
├── wxt.config.ts
├── tsconfig.json
└── package.json
```

---

## Verification

### Manual Testing
1. Load unpacked extension in Chrome (`pnpm dev`)
2. Open NotebookLM and start a chat
3. Ask a question that generates code (e.g., "Write a Python function to sort a list")
4. Verify:
   - Code block has syntax highlighting
   - Line numbers appear on left
   - Copy button works with icon feedback
   - Language picker opens and is searchable
   - Selecting new language re-highlights
   - Theme switches with system preference
   - Long code blocks have scroll

### Settings Testing
1. Click extension icon
2. Toggle enable/disable - verify code blocks update
3. Change theme - verify immediate update
4. Adjust max-height - verify code blocks resize

### Persistence Testing
1. Manually select a language for a code block
2. Refresh page
3. Same code block should remember the language selection

### Cross-Browser
1. `pnpm build` for production
2. Test in Firefox via `about:debugging`
