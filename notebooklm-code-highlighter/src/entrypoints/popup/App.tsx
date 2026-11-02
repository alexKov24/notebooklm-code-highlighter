import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../../utils/storage';
import { themes } from '../../styles/themes';
import type { Settings, ThemePair } from '../../types';
import { DEFAULT_SETTINGS, MIN_MAX_HEIGHT, MAX_MAX_HEIGHT, clampMaxHeight } from '../../types';

const styles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    font-size: 14px;
    background: #fff;
    color: #24292e;
    width: 280px;
  }

  @media (prefers-color-scheme: dark) {
    body {
      background: #21262d;
      color: #c9d1d9;
    }
  }

  .container {
    padding: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e1e4e8;
  }

  @media (prefers-color-scheme: dark) {
    .header {
      border-bottom-color: #30363d;
    }
  }

  .header h1 {
    font-size: 14px;
    font-weight: 600;
  }

  .header-icon {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    object-fit: contain;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .setting-label {
    font-size: 13px;
    color: #57606a;
  }

  @media (prefers-color-scheme: dark) {
    .setting-label {
      color: #8b949e;
    }
  }

  .toggle {
    position: relative;
    width: 40px;
    height: 22px;
    background: #d0d7de;
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .toggle.active {
    background: #2da44e;
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }

  .toggle.active .toggle-knob {
    transform: translateX(18px);
  }

  select {
    padding: 6px 28px 6px 10px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: #f6f8fa url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2357606a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center;
    font-size: 13px;
    color: #24292e;
    cursor: pointer;
    appearance: none;
  }

  @media (prefers-color-scheme: dark) {
    select {
      background-color: #0d1117;
      border-color: #30363d;
      color: #c9d1d9;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    }
  }

  select:focus {
    outline: none;
    border-color: #0969da;
    box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
  }

  input[type="number"] {
    width: 70px;
    padding: 6px 10px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: #f6f8fa;
    font-size: 13px;
    color: #24292e;
  }

  @media (prefers-color-scheme: dark) {
    input[type="number"] {
      background: #0d1117;
      border-color: #30363d;
      color: #c9d1d9;
    }
  }

  input[type="number"]:focus {
    outline: none;
    border-color: #0969da;
    box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
  }

  .unit {
    font-size: 12px;
    color: #57606a;
    margin-left: 4px;
  }

  @media (prefers-color-scheme: dark) {
    .unit {
      color: #8b949e;
    }
  }

  .footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #e1e4e8;
    font-size: 11px;
    color: #8b949e;
    text-align: center;
  }

  @media (prefers-color-scheme: dark) {
    .footer {
      border-top-color: #30363d;
    }
  }
`;

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings({ [key]: value });
  };

  if (loading) {
    return null;
  }

  return (
    <>
      <style>{styles}</style>
      <div className="container">
        <div className="header">
          <img className="header-icon" src="/icon/icon.png" alt="" />
          <h1>Code Highlighter</h1>
        </div>

        <div className="setting-row">
          <span className="setting-label">Enable highlighting</span>
          <div
            className={`toggle ${settings.enabled ? 'active' : ''}`}
            onClick={() => updateSetting('enabled', !settings.enabled)}
            role="switch"
            aria-checked={settings.enabled}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                updateSetting('enabled', !settings.enabled);
              }
            }}
          >
            <div className="toggle-knob" />
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-label">Color theme</span>
          <select
            value={settings.theme}
            onChange={(e) => updateSetting('theme', e.target.value as ThemePair)}
            disabled={!settings.enabled}
          >
            {Object.entries(themes).map(([id, theme]) => (
              <option key={id} value={id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-row">
          <span className="setting-label">Max height</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="number"
              min={MIN_MAX_HEIGHT}
              max={MAX_MAX_HEIGHT}
              step="50"
              value={settings.maxHeight}
              onChange={(e) => updateSetting('maxHeight', clampMaxHeight(parseInt(e.target.value)))}
              disabled={!settings.enabled}
            />
            <span className="unit">px</span>
          </div>
        </div>

        <div className="footer">
          Works on notebook.google.com
        </div>
      </div>
    </>
  );
}
