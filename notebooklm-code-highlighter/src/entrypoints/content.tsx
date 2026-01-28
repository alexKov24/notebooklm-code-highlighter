import { createRoot, type Root } from 'react-dom/client';
import { CodeBlock } from '../components/CodeBlock';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getSettings, watchSettings, hashCode } from '../utils/storage';
import type { Settings } from '../types';

const isDev = import.meta.env.DEV;

export default defineContentScript({
  matches: [
    'https://notebooklm.google.com/*',
    // Only include localhost in development builds
    ...(isDev ? ['*://localhost/*'] : []),
  ],
  runAt: 'document_idle',

  async main() {
    // Track processed elements and their content hashes
    const processedElements = new WeakMap<Element, { hash: string; root: Root; container: HTMLDivElement }>();
    // Track elements currently being processed to prevent race conditions
    const processingElements = new Set<Element>();

    // Current settings
    let settings = await getSettings();

    // Watch for settings changes
    const unsubscribeSettings = watchSettings((newSettings) => {
      settings = newSettings;
      // Re-render all existing code blocks with new settings
      document.querySelectorAll('pre > code').forEach((codeElement) => {
        const data = processedElements.get(codeElement);
        if (data) {
          const preElement = codeElement.parentElement;
          if (preElement) {
            // Toggle visibility based on enabled state
            preElement.style.display = settings.enabled ? 'none' : '';
            data.container.style.display = settings.enabled ? '' : 'none';
          }
          if (settings.enabled) {
            const code = codeElement.textContent ?? '';
            renderCodeBlock(data.root, code, settings);
          }
        }
      });
    });

    function renderCodeBlock(root: Root, code: string, currentSettings: Settings) {
      root.render(
        <ErrorBoundary>
          <CodeBlock code={code} settings={currentSettings} />
        </ErrorBoundary>
      );
    }

    async function processCodeBlock(codeElement: Element) {
      // Skip if already being processed (prevents race condition)
      if (processingElements.has(codeElement)) {
        return;
      }

      const preElement = codeElement.parentElement;
      if (!preElement || preElement.tagName !== 'PRE') {
        return;
      }

      const code = codeElement.textContent ?? '';
      if (!code.trim()) {
        return;
      }

      processingElements.add(codeElement);
      try {
        const currentHash = await hashCode(code);
        const existing = processedElements.get(codeElement);

        // Already processed with same content
        if (existing && existing.hash === currentHash) {
          return;
        }

        // Content changed, update existing
        if (existing) {
          existing.hash = currentHash;
          if (settings.enabled) {
            renderCodeBlock(existing.root, code, settings);
          }
          return;
        }

        // New code block - create Shadow DOM container
        const container = document.createElement('div');
        container.className = 'nlm-code-highlighter-container';

        const shadowRoot = container.attachShadow({ mode: 'open' });
        const root = createRoot(shadowRoot);

        // Hide original pre element and insert our container based on enabled state
        preElement.style.display = settings.enabled ? 'none' : '';
        container.style.display = settings.enabled ? '' : 'none';
        preElement.parentElement?.insertBefore(container, preElement);

        // Store reference
        processedElements.set(codeElement, { hash: currentHash, root, container });

        // Always render (container visibility handles enabled state)
        renderCodeBlock(root, code, settings);
      } finally {
        processingElements.delete(codeElement);
      }
    }

    function processAllCodeBlocks() {
      document.querySelectorAll('pre > code').forEach(processCodeBlock);
    }

    // Initial processing
    processAllCodeBlocks();

    // Watch for new code blocks via MutationObserver
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (node.matches('pre > code') || node.querySelector('pre > code')) {
                shouldProcess = true;
                break;
              }
            }
          }
        } else if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent?.matches('code') && parent.parentElement?.matches('pre')) {
            shouldProcess = true;
          }
        }

        if (shouldProcess) break;
      }

      if (shouldProcess) {
        processAllCodeBlocks();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Cleanup on unload
    window.addEventListener('unload', () => {
      observer.disconnect();
      unsubscribeSettings();
    });
  },
});
