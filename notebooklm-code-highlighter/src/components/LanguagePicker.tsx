import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { LANGUAGES, getLanguageName } from '../utils/highlighter';

const DROPDOWN_MAX_HEIGHT = 300;
const DROPDOWN_MIN_HEIGHT = 120;
const VIEWPORT_MARGIN = 8;

interface DropdownPlacement {
  openUp: boolean;
  maxHeight: number;
}

interface LanguagePickerProps {
  currentLanguage: string;
  isAutoDetected: boolean;
  onLanguageChange: (language: string) => void;
  recentLanguages: string[];
}

export function LanguagePicker({
  currentLanguage,
  isAutoDetected,
  onLanguageChange,
  recentLanguages,
}: LanguagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [placement, setPlacement] = useState<DropdownPlacement>({
    openUp: false,
    maxHeight: DROPDOWN_MAX_HEIGHT,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredLanguages = LANGUAGES.filter((lang) =>
    lang.name.toLowerCase().includes(search.toLowerCase()) ||
    lang.id.toLowerCase().includes(search.toLowerCase())
  );

  const recentFiltered = recentLanguages
    .filter((id) => id !== currentLanguage)
    .slice(0, 3)
    .map((id) => LANGUAGES.find((l) => l.id === id))
    .filter(Boolean) as { id: string; name: string }[];

  const handleSelect = useCallback(
    (languageId: string) => {
      onLanguageChange(languageId);
      setIsOpen(false);
      setSearch('');
    },
    [onLanguageChange]
  );

  // Open upward when there isn't room below (e.g. code block near the bottom
  // of the viewport) and shrink to fit whichever side is chosen
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePlacement = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - VIEWPORT_MARGIN;
      const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(DROPDOWN_MIN_HEIGHT, Math.min(DROPDOWN_MAX_HEIGHT, available));
      // Runs on every scroll event: skip the re-render when nothing changed
      setPlacement((prev) =>
        prev.openUp === openUp && prev.maxHeight === maxHeight ? prev : { openUp, maxHeight }
      );
    };

    updatePlacement();
    // Capture phase so scrolling of any page container (not just the window)
    // re-evaluates the placement while the menu is open
    window.addEventListener('resize', updatePlacement);
    document.addEventListener('scroll', updatePlacement, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', updatePlacement);
      document.removeEventListener('scroll', updatePlacement, { capture: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Use composedPath() to properly detect clicks across Shadow DOM boundaries
      const path = e.composedPath();
      if (containerRef.current && !path.includes(containerRef.current)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        className="language-picker-button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          border: 'none',
          borderRadius: '4px',
          background: 'transparent',
          cursor: 'pointer',
          color: 'inherit',
          fontSize: '11px',
          fontFamily: 'inherit',
          opacity: 0.7,
          transition: 'opacity 0.2s, background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'rgba(128, 128, 128, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <span>{getLanguageName(currentLanguage)}</span>
        {isAutoDetected && (
          <span style={{ opacity: 0.6, fontSize: '10px' }}>(auto)</span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="language-picker-menu"
          style={{
            position: 'absolute',
            ...(placement.openUp
              ? { bottom: '100%', marginBottom: '4px' }
              : { top: '100%', marginTop: '4px' }),
            right: 0,
            width: '200px',
            maxHeight: `${placement.maxHeight}px`,
            overflowY: 'auto',
            background: 'var(--nlm-hl-dropdown-bg, #fff)',
            border: '1px solid var(--nlm-hl-dropdown-border, #e1e4e8)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '8px', borderBottom: '1px solid var(--nlm-hl-dropdown-border, #e1e4e8)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search languages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--nlm-hl-dropdown-border, #e1e4e8)',
                borderRadius: '4px',
                fontSize: '12px',
                outline: 'none',
                background: 'var(--nlm-hl-input-bg, #f6f8fa)',
                color: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ padding: '4px 0' }}>
            {!search && recentFiltered.length > 0 && (
              <>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--nlm-hl-text-muted, #6a737d)',
                    textTransform: 'uppercase',
                  }}
                >
                  Recent
                </div>
                {recentFiltered.map((lang) => (
                  <button
                    key={`recent-${lang.id}`}
                    onClick={() => handleSelect(lang.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '6px 12px',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--nlm-hl-hover-bg, #f6f8fa)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {lang.name}
                  </button>
                ))}
                <div
                  style={{
                    margin: '4px 12px',
                    borderBottom: '1px solid var(--nlm-hl-dropdown-border, #e1e4e8)',
                  }}
                />
              </>
            )}

            {!search && (
              <div
                style={{
                  padding: '4px 12px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--nlm-hl-text-muted, #6a737d)',
                  textTransform: 'uppercase',
                }}
              >
                All Languages
              </div>
            )}

            {filteredLanguages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleSelect(lang.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 12px',
                  border: 'none',
                  background: lang.id === currentLanguage ? 'var(--nlm-hl-selected-bg, #e1e4e8)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'inherit',
                  fontWeight: lang.id === currentLanguage ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (lang.id !== currentLanguage) {
                    e.currentTarget.style.background = 'var(--nlm-hl-hover-bg, #f6f8fa)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    lang.id === currentLanguage ? 'var(--nlm-hl-selected-bg, #e1e4e8)' : 'transparent';
                }}
              >
                {lang.name}
              </button>
            ))}

            {filteredLanguages.length === 0 && (
              <div
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--nlm-hl-text-muted, #6a737d)',
                }}
              >
                No languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
