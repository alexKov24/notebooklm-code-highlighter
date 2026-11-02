import { useState, useEffect, useCallback, useMemo } from 'react';
import { highlightCode } from '../utils/highlighter';
import { getLanguageForCode, saveLanguageForCode } from '../utils/storage';
import { isDarkMode, watchDarkMode } from '../utils/theme';
import { getThemeCSS } from '../styles/themes';
import { CopyButton } from './CopyButton';
import { LanguagePicker } from './LanguagePicker';
import type { Settings } from '../types';

interface CodeBlockProps {
  code: string;
  settings: Settings;
}

const baseStyles = `
  * {
    box-sizing: border-box;
  }

  /* No overflow: hidden here: it would clip the language dropdown on short
     blocks. Corners are rounded on the header and content instead. */
  .code-block-container {
    position: relative;
    border-radius: 6px;
    font-family: inherit;
  }

  .code-block-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(128, 128, 128, 0.1);
    border-radius: 6px 6px 0 0;
  }

  .code-block-content {
    overflow: auto;
    border-radius: 0 0 6px 6px;
  }

  .code-block-content pre {
    margin: 0;
    padding: 12px;
    overflow: visible;
  }

  .code-block-content code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .line-numbers {
    display: flex;
  }

  .line-numbers-gutter {
    user-select: none;
    text-align: right;
    padding-right: 12px;
    margin-right: 12px;
    border-right: 1px solid rgba(128, 128, 128, 0.2);
    color: rgba(128, 128, 128, 0.6);
    min-width: 2em;
  }

  .line-numbers-content {
    flex: 1;
    overflow-x: auto;
  }
`;

const lightModeVars = `
  :host {
    --nlm-hl-dropdown-bg: #fff;
    --nlm-hl-dropdown-border: #e1e4e8;
    --nlm-hl-input-bg: #f6f8fa;
    --nlm-hl-hover-bg: #f6f8fa;
    --nlm-hl-selected-bg: #e1e4e8;
    --nlm-hl-text-muted: #6a737d;
  }
`;

const darkModeVars = `
  :host {
    --nlm-hl-dropdown-bg: #21262d;
    --nlm-hl-dropdown-border: #30363d;
    --nlm-hl-input-bg: #0d1117;
    --nlm-hl-hover-bg: #30363d;
    --nlm-hl-selected-bg: #388bfd33;
    --nlm-hl-text-muted: #8b949e;
  }
`;

export function CodeBlock({ code, settings }: CodeBlockProps) {
  const [language, setLanguage] = useState<string | null>(null);
  const [isAutoDetected, setIsAutoDetected] = useState(true);
  const [dark, setDark] = useState(() => isDarkMode());
  const [recentLanguages, setRecentLanguages] = useState<string[]>([]);

  // Load saved language preference
  useEffect(() => {
    getLanguageForCode(code).then((savedLang) => {
      if (savedLang) {
        setLanguage(savedLang);
        setIsAutoDetected(false);
      }
    });
  }, [code]);

  // Watch for dark mode changes
  useEffect(() => {
    return watchDarkMode(setDark);
  }, []);

  // Highlight the code
  const highlighted = useMemo(() => {
    return highlightCode(code, language ?? undefined);
  }, [code, language]);

  // Set auto-detected language when no language is set
  useEffect(() => {
    if (language === null && highlighted.language) {
      setLanguage(highlighted.language);
      setIsAutoDetected(highlighted.isAutoDetected);
    }
  }, [code, highlighted, language]);

  // Handle language change from picker
  const handleLanguageChange = useCallback(
    async (newLanguage: string) => {
      setLanguage(newLanguage);
      setIsAutoDetected(false);
      await saveLanguageForCode(code, newLanguage);

      // Update recent languages
      setRecentLanguages((prev) => {
        const filtered = prev.filter((l) => l !== newLanguage);
        return [newLanguage, ...filtered].slice(0, 5);
      });
    },
    [code]
  );

  // Generate line numbers
  const lines = code.split('\n');
  const lineNumbersHtml = lines.map((_, i) => i + 1).join('\n');

  // Build complete CSS
  const themeCSS = getThemeCSS(settings.theme, dark);
  const modeVars = dark ? darkModeVars : lightModeVars;
  const fullCSS = `${modeVars}\n${baseStyles}\n${themeCSS}`;

  return (
    <>
      <style>{fullCSS}</style>
      <div className="code-block-container">
        <div className="code-block-header">
          <LanguagePicker
            currentLanguage={highlighted.language}
            isAutoDetected={isAutoDetected}
            onLanguageChange={handleLanguageChange}
            recentLanguages={recentLanguages}
          />
          <CopyButton code={code} />
        </div>
        <div
          className="code-block-content"
          style={{ maxHeight: `${settings.maxHeight}px` }}
        >
          <pre className="hljs">
            <code className="line-numbers">
              <span
                className="line-numbers-gutter"
                dangerouslySetInnerHTML={{ __html: lineNumbersHtml }}
              />
              <span
                className="line-numbers-content"
                dangerouslySetInnerHTML={{ __html: highlighted.html }}
              />
            </code>
          </pre>
        </div>
      </div>
    </>
  );
}
