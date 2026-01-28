import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type Settings, type LanguageCache } from '../types';

const SETTINGS_KEY = 'nlm-hl-settings';
const LANGUAGE_CACHE_KEY = 'nlm-hl-language-cache';
const MAX_CACHE_ENTRIES = 100;
const HASH_LENGTH = 16;

export async function getSettings(): Promise<Settings> {
  try {
    const result = await browser.storage.local.get(SETTINGS_KEY);
    if (!result) {
      return DEFAULT_SETTINGS;
    }
    return (result[SETTINGS_KEY] as Settings | undefined) ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  try {
    const current = await getSettings();
    await browser.storage.local.set({ [SETTINGS_KEY]: { ...current, ...settings } });
  } catch {
    // Storage not available
  }
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
    if (changes[SETTINGS_KEY]) {
      callback((changes[SETTINGS_KEY].newValue as Settings | undefined) ?? DEFAULT_SETTINGS);
    }
  };

  browser.storage.local.onChanged.addListener(listener);

  return () => {
    browser.storage.local.onChanged.removeListener(listener);
  };
}

export async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, HASH_LENGTH);
}

async function getLanguageCache(): Promise<LanguageCache> {
  try {
    const result = await browser.storage.local.get(LANGUAGE_CACHE_KEY);
    if (!result) {
      return {};
    }
    return (result[LANGUAGE_CACHE_KEY] as LanguageCache | undefined) ?? {};
  } catch {
    return {};
  }
}

export async function getLanguageForCode(code: string): Promise<string | null> {
  const hash = await hashCode(code);
  const cache = await getLanguageCache();
  return cache[hash] ?? null;
}

export async function saveLanguageForCode(code: string, language: string): Promise<void> {
  try {
    const hash = await hashCode(code);
    const cache = await getLanguageCache();

    // Add new entry
    const newCache = { ...cache, [hash]: language };

    // Evict oldest entries if over limit
    const entries = Object.entries(newCache);
    if (entries.length > MAX_CACHE_ENTRIES) {
      const trimmedCache = Object.fromEntries(entries.slice(-MAX_CACHE_ENTRIES));
      await browser.storage.local.set({ [LANGUAGE_CACHE_KEY]: trimmedCache });
    } else {
      await browser.storage.local.set({ [LANGUAGE_CACHE_KEY]: newCache });
    }
  } catch {
    // Storage not available
  }
}
