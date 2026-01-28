# Code Review: NotebookLM Code Highlighter Extension

## Summary
This is a well-structured browser extension with clean architecture. However, I found several bugs, security concerns, and code quality issues worth addressing.

---

## BUGS

### 1. ~~**State Update in useMemo (Critical)**~~ FIXED
**File:** [CodeBlock.tsx:116-123](notebooklm-code-highlighter/src/components/CodeBlock.tsx#L116-L123)

```tsx
const highlighted = useMemo(() => {
  const result = highlightCode(code, language ?? undefined);
  if (language === null) {
    setLanguage(result.language);      // Side effect in useMemo
    setIsAutoDetected(result.isAutoDetected);
  }
  return result;
}, [code, language]);
```

Calling `setState` inside `useMemo` is an anti-pattern. React may skip memoized computations in development (StrictMode) or in future concurrent features, causing inconsistent state. This should be refactored to use `useEffect` for state updates.

**Fix:** Moved state updates to a separate `useEffect` hook.

### 2. ~~**isDarkMode Called as Value, Not Function**~~ FIXED
**File:** [CodeBlock.tsx:97](notebooklm-code-highlighter/src/components/CodeBlock.tsx#L97)

```tsx
const [dark, setDark] = useState(isDarkMode);  // Passing function reference
```

Should be:
```tsx
const [dark, setDark] = useState(isDarkMode());  // Invoke the function
```

Currently, `dark` is initialized to the function itself (truthy), not its boolean result.

**Fix:** Changed to `useState(() => isDarkMode())`.

### 3. ~~**Memory Leak: Settings Watcher Never Unsubscribed**~~ FIXED
**File:** [content.tsx:22-40](notebooklm-code-highlighter/src/entrypoints/content.tsx#L22-L40)

```tsx
watchSettings((newSettings) => {
  settings = newSettings;
  // ...
});
```

`watchSettings()` returns an unsubscribe function that's never called. The `unload` listener only disconnects the MutationObserver. This creates a memory leak for the storage listener.

**Fix:** Stored the unsubscribe function and call it in the unload handler.

### 4. ~~**Click-Outside Detection Doesn't Work in Shadow DOM**~~ FIXED
**File:** [LanguagePicker.tsx:48-60](notebooklm-code-highlighter/src/components/LanguagePicker.tsx#L48-L60)

```tsx
document.addEventListener('mousedown', handleClickOutside);
```

This listener is attached to `document`, but the component renders inside a Shadow DOM. Events in Shadow DOM have retargeted `event.target`, so `containerRef.current.contains(e.target)` may not work as expected when clicking outside the shadow root.

**Fix:** Used `e.composedPath()` instead of `contains()` for proper Shadow DOM traversal.

### 5. ~~**Unbounded Language Cache Growth**~~ FIXED
**File:** [storage.ts:68-75](notebooklm-code-highlighter/src/utils/storage.ts#L68-L75)

```tsx
export async function saveLanguageForCode(code: string, language: string): Promise<void> {
  const cache = await getLanguageCache();
  await browser.storage.local.set({ [LANGUAGE_CACHE_KEY]: { ...cache, [hash]: language } });
}
```

The language cache grows indefinitely with no eviction policy. Over time, this could consume significant storage and slow down cache operations.

**Fix:** Added `MAX_CACHE_ENTRIES = 100` with eviction of oldest entries when limit exceeded.

### 6. ~~**Race Condition in processCodeBlock**~~ FIXED
**File:** [content.tsx:46-91](notebooklm-code-highlighter/src/entrypoints/content.tsx#L46-L91)

The async `processCodeBlock` function can be called multiple times for the same element before the first call completes (since `hashCode` is async). This could result in duplicate containers being created.

**Fix:** Added `processingElements` Set to track elements currently being processed.

---

## SECURITY

### 1. **XSS via dangerouslySetInnerHTML (Medium Risk)**
**File:** [CodeBlock.tsx:169-176](notebooklm-code-highlighter/src/components/CodeBlock.tsx#L169-L176)

```tsx
<span dangerouslySetInnerHTML={{ __html: lineNumbersHtml }} />
<span dangerouslySetInnerHTML={{ __html: highlighted.html }} />
```

While highlight.js escapes most HTML entities, the library doesn't guarantee XSS safety in all edge cases. NotebookLM controls the code content, so risk is low, but:
- Line numbers HTML (`lineNumbersHtml`) is safe since it's just numbers joined by newlines
- `highlighted.html` relies entirely on highlight.js's escaping

**Mitigation:** highlight.js does HTML-escape by default, but consider adding an explicit sanitization layer for defense-in-depth.

### 2. ~~**localhost Host Permission is Overly Broad**~~ FIXED
**File:** [wxt.config.ts:11-14](notebooklm-code-highlighter/wxt.config.ts#L11-L14)

```ts
host_permissions: [
  'https://notebooklm.google.com/*',
  '*://localhost/*',  // Allows http AND https on any localhost port
],
```

This grants the extension access to any localhost service. If a user runs sensitive local services (dev servers with credentials, local APIs), the extension has permission to inject content scripts. Consider removing this for production or restricting to specific ports.

**Fix:** Made localhost permission conditional on `NODE_ENV !== 'production'`. Production builds only include `notebooklm.google.com`.

### 3. ~~**No Input Validation on maxHeight**~~ FIXED
**File:** [App.tsx:263](notebooklm-code-highlighter/src/entrypoints/popup/App.tsx#L263)

```tsx
onChange={(e) => updateSetting('maxHeight', parseInt(e.target.value) || 400)}
```

While the `min` and `max` attributes exist on the input, they don't prevent programmatic manipulation. Invalid values (negative, extremely large) could cause layout issues or be exploited.

**Fix:** Added `clampMaxHeight()` validation function that enforces bounds (100-1000) and handles NaN/Infinity.

---

## CODE QUALITY

### 1. ~~**Duplicate Import Path**~~ FIXED
**File:** [content.tsx:3-4](notebooklm-code-highlighter/src/entrypoints/content.tsx#L3-L4)

```tsx
import { getSettings, watchSettings } from '../utils/storage';
import { hashCode } from '../utils/storage';  // Could be combined
```

Should be:
```tsx
import { getSettings, watchSettings, hashCode } from '../utils/storage';
```

**Fix:** Combined imports into single statement.

### 2. **Inline Styles Instead of CSS Classes**
**Files:** LanguagePicker.tsx, CopyButton.tsx

Heavy use of inline styles (60+ lines) makes the code harder to maintain and prevents style reuse. Consider moving to the CSS-in-shadow approach used in CodeBlock.tsx.

### 3. ~~**Magic Numbers**~~ FIXED
**File:** [storage.ts:47](notebooklm-code-highlighter/src/utils/storage.ts#L47)

```tsx
return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
```

The `16` is a magic number. Consider extracting to a named constant like `HASH_LENGTH`.

**Fix:** Extracted to `HASH_LENGTH = 16` constant.

### 4. ~~**No Error Boundary**~~ FIXED
The React components have no error boundary. If highlight.js throws (malformed input, unknown language), the entire code block UI will crash without recovery.

**Fix:** Added `ErrorBoundary` component that wraps `CodeBlock` and displays fallback UI on errors.

### 5. **recentLanguages State Resets on Re-render**
**File:** [CodeBlock.tsx:98](notebooklm-code-highlighter/src/components/CodeBlock.tsx#L98)

```tsx
const [recentLanguages, setRecentLanguages] = useState<string[]>([]);
```

`recentLanguages` is component-local state that resets whenever the component re-mounts (which happens on settings changes). Consider persisting this in storage.

### 6. **No TypeScript Strict Null Checks in Some Areas**
**File:** [content.tsx:84](notebooklm-code-highlighter/src/entrypoints/content.tsx#L84)

```tsx
preElement.parentElement?.insertBefore(container, preElement);
```

The `?.` operator silently fails if `parentElement` is null. Consider explicit handling or assertion.

### 7. **Inconsistent Error Handling**
```tsx
// storage.ts - silently swallows errors
catch {
  return DEFAULT_SETTINGS;
}

// CopyButton.tsx - logs errors
catch (err) {
  console.error('Failed to copy:', err);
}
```

Error handling is inconsistent across the codebase. Consider a unified approach.

---

## POSITIVE NOTES

- **Good Shadow DOM isolation** - Prevents style conflicts with host page
- **Proper cleanup pattern** - MutationObserver disconnects on unload
- **WeakMap for element tracking** - Automatic garbage collection when elements are removed
- **Minimal permissions** - Only requests `storage` permission
- **Good TypeScript usage** - Proper interfaces and type exports
- **Content hashing** - Efficient change detection via SHA-256 truncation

---

## Priority Fixes

| Priority | Issue | Status |
|----------|-------|--------|
| High | setState in useMemo | FIXED |
| High | isDarkMode not invoked | FIXED |
| Medium | Settings watcher memory leak | FIXED |
| Medium | Shadow DOM click detection | FIXED |
| Medium | localhost permissions | FIXED |
| Medium | No input validation | FIXED |
| Medium | No error boundary | FIXED |
| Low | Unbounded cache | FIXED |
| Low | Magic numbers | FIXED |
