import { createRoot, type Root } from 'react-dom/client';
import { CodeBlock } from '../components/CodeBlock';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getSettings, watchSettings, hashCode } from '../utils/storage';
import { highlightCode } from '../utils/highlighter';
import { getInlineThemeCSS } from '../styles/themes';
import { isDarkMode, watchDarkMode } from '../utils/theme';
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

      // Update inline code theme and toggle
      updateInlineThemeCSS();
      document.querySelectorAll('code:not(pre > code)').forEach((codeElement) => {
        const data = processedInline.get(codeElement);
        if (data) {
          if (settings.enabled) {
            // Re-highlight with new theme
            const code = codeElement.textContent ?? '';
            const result = highlightCode(code);
            codeElement.innerHTML = result.html;
            codeElement.classList.add('nlm-inline-hljs');
          } else {
            // Restore original HTML
            codeElement.innerHTML = data.originalHTML;
            codeElement.classList.remove('nlm-inline-hljs');
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

    // --- Inline code highlighting ---
    // Track processed inline code elements and their original content
    const processedInline = new WeakMap<Element, { hash: string; originalHTML: string }>();

    // Inject a shared <style> for inline code theme CSS
    let inlineStyleEl: HTMLStyleElement | null = null;
    let currentDark = isDarkMode();

    function updateInlineThemeCSS() {
      const css = getInlineThemeCSS(settings.theme, currentDark);
      if (!inlineStyleEl) {
        inlineStyleEl = document.createElement('style');
        inlineStyleEl.id = 'nlm-inline-hljs-theme';
        document.head.appendChild(inlineStyleEl);
      }
      inlineStyleEl.textContent = css;
    }

    // Watch dark mode changes for inline theme
    watchDarkMode((dark) => {
      currentDark = dark;
      updateInlineThemeCSS();
    });

    async function processInlineCode(codeElement: Element) {
      if (codeElement.closest('pre')) return; // Skip block code
      if (!settings.enabled) return;

      const code = codeElement.textContent ?? '';
      if (!code.trim()) return;

      const currentHash = await hashCode(code);
      const existing = processedInline.get(codeElement);

      // Already processed with same content
      if (existing && existing.hash === currentHash) return;

      // Save original HTML on first processing
      if (!existing) {
        processedInline.set(codeElement, {
          hash: currentHash,
          originalHTML: codeElement.innerHTML,
        });
      } else {
        existing.hash = currentHash;
      }

      // Apply syntax highlighting directly to the element
      const result = highlightCode(code);
      codeElement.innerHTML = result.html;
      codeElement.classList.add('nlm-inline-hljs');
    }

    function processAllInlineCode() {
      document.querySelectorAll('code:not(pre > code)').forEach(processInlineCode);
    }

    // Inject theme CSS and process initial inline code
    updateInlineThemeCSS();

    // Initial processing
    processAllCodeBlocks();
    processAllInlineCode();

    // Watch for new code blocks and inline code via MutationObserver
    const observer = new MutationObserver((mutations) => {
      let shouldProcessBlocks = false;
      let shouldProcessInline = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (node.matches('pre > code') || node.querySelector('pre > code')) {
                shouldProcessBlocks = true;
              }
              if (node.matches('code:not(pre > code)') || node.querySelector('code:not(pre > code)')) {
                shouldProcessInline = true;
              }
            }
          }
        } else if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent?.matches('code')) {
            if (parent.parentElement?.matches('pre')) {
              shouldProcessBlocks = true;
            } else {
              shouldProcessInline = true;
            }
          }
        }

        if (shouldProcessBlocks && shouldProcessInline) break;
      }

      if (shouldProcessBlocks) processAllCodeBlocks();
      if (shouldProcessInline) processAllInlineCode();
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
