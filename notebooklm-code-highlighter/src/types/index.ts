export type ThemePair = 'github' | 'vscode' | 'atom';

export const MIN_MAX_HEIGHT = 100;
export const MAX_MAX_HEIGHT = 1000;

export interface Settings {
  enabled: boolean;
  theme: ThemePair;
  maxHeight: number;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  theme: 'github',
  maxHeight: 400,
};

export function clampMaxHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.maxHeight;
  return Math.max(MIN_MAX_HEIGHT, Math.min(MAX_MAX_HEIGHT, Math.round(value)));
}

export interface LanguageCache {
  [hash: string]: string;
}

export interface CodeBlockState {
  code: string;
  language: string;
  isAutoDetected: boolean;
}
