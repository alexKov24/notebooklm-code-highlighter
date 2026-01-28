# Content Script Internals

## Overview

The content script uses two key techniques to efficiently track and update code blocks:
1. **WeakMap** for element tracking
2. **Content hashing** for change detection

---

## WeakMap for Element Tracking

```ts
const processedElements = new WeakMap<Element, { hash: string; root: Root; container: HTMLDivElement }>();
```

### What it stores
For each `<code>` element, we store:
- `hash` - SHA-256 hash of the code content
- `root` - React root for rendering
- `container` - Shadow DOM container we injected

### Why WeakMap?

| Regular Map | WeakMap |
|-------------|---------|
| Holds strong references | Holds weak references |
| Elements stay in memory forever | Elements can be garbage collected |
| Must manually clean up | Automatic cleanup |

When NotebookLM removes a code block from the DOM, the WeakMap automatically releases our stored data. No memory leaks, no cleanup code needed.

---

## Content Hashing

```ts
const currentHash = await hashCode(code);
```

### Purpose
Detect if code content has actually changed, not just if the DOM was touched.

### Flow
```
Code block mutation detected
        ↓
    Hash content
        ↓
Compare with stored hash
        ↓
    Same? → Skip (no work needed)
    Different? → Re-highlight
```

### Why not compare strings directly?

1. **Memory** - Storing full code strings for every block wastes memory
2. **Speed** - Hash comparison is O(1), string comparison is O(n)
3. **Persistence** - We use the same hash for language preference storage

### Hash implementation
```ts
// 16-char truncated SHA-256
async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
```

16 characters = 64 bits of entropy. Collision probability is negligible for our use case.

---

## Combined Flow

```
MutationObserver detects change
            ↓
Find all pre > code elements
            ↓
For each element:
            ↓
┌─ In WeakMap? ─────────────────────┐
│                                   │
No                                 Yes
│                                   │
Create container                Hash matches?
Attach Shadow DOM                   │
Store in WeakMap              Yes ──┴── No
Render                         │        │
                            Skip    Re-render
```

---

## Key Benefits

1. **No double-processing** - Hash check prevents redundant work
2. **No memory leaks** - WeakMap auto-cleans removed elements
3. **Streaming support** - Works correctly as NotebookLM streams responses
4. **Efficient updates** - Only re-render when content actually changes
