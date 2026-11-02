# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WXT browser extension that adds syntax highlighting to code blocks in NotebookLM (notebooklm.google.com). It uses React, TypeScript, and highlight.js.

## Commands

All commands run from `notebooklm-code-highlighter/`:

```bash
# Development - starts dev server with hot reload
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox

# Build production
pnpm build            # Chrome
pnpm build:firefox    # Firefox

# Package for distribution
pnpm zip              # Chrome
pnpm zip:firefox      # Firefox

# Type checking
pnpm typecheck

# Visual/e2e tests (Chromium via Playwright, Firefox via Selenium; builds first)
pnpm test:e2e
pnpm test:e2e:update  # re-record screenshot baselines after an intended visual change
```

## Architecture

### Content Script (`src/entrypoints/content.tsx`)
- Runs on `notebooklm.google.com` and `localhost`
- Uses MutationObserver to detect `pre > code` elements in real-time
- Creates Shadow DOM containers for CSS isolation
- Tracks processed elements with WeakMap + content hash to handle updates
- Watches settings changes and re-renders code blocks accordingly

### Code Block Rendering (`src/components/CodeBlock.tsx`)
- Renders inside Shadow DOM with isolated styles
- Features: syntax highlighting, line numbers (non-selectable), copy button, language picker
- Auto-detects language via highlight.js, remembers manual overrides in storage
- Respects system dark/light mode preference

### Storage (`src/utils/storage.ts`)
- Uses `chrome.storage.local` via WXT's browser API
- Stores settings (theme, enabled state, max-height) and language cache (code hash → language)
- SHA-256 hash of code content identifies blocks for language preference persistence

### Theme System (`src/styles/themes.ts`)
- Three theme pairs: GitHub, VS Code, Atom One (each with light/dark variant)
- Auto-switches based on `prefers-color-scheme` media query

### Popup Settings (`src/entrypoints/popup/App.tsx`)
- Enable/disable toggle, theme selector, max-height configuration
- Changes propagate immediately to all rendered code blocks

## Key Patterns

- WXT's `defineContentScript` for content script definition with match patterns
- React rendering into Shadow DOM root for style isolation
- Async hash comparison for detecting content changes without re-processing identical code
- Settings watcher pattern: `watchSettings()` returns unsubscribe function

## Supported Languages

Highlight.js configured with: JavaScript, TypeScript, Python, Java, C++, C, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, SQL, Bash, Shell, JSON, XML, HTML, CSS, SCSS, Markdown, YAML, Dockerfile, GraphQL, Plain Text