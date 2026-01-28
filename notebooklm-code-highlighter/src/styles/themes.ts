import type { ThemePair } from '../types';

// GitHub Light theme
const githubLight = `
.hljs {
  color: #24292e;
  background: #f6f8fa;
}
.hljs-comment, .hljs-quote { color: #6a737d; }
.hljs-keyword, .hljs-selector-tag { color: #d73a49; }
.hljs-string, .hljs-attr { color: #032f62; }
.hljs-number, .hljs-literal { color: #005cc5; }
.hljs-variable, .hljs-template-variable { color: #e36209; }
.hljs-type, .hljs-built_in { color: #6f42c1; }
.hljs-title, .hljs-section, .hljs-name { color: #6f42c1; }
.hljs-selector-id, .hljs-selector-class { color: #6f42c1; }
.hljs-meta { color: #005cc5; }
.hljs-addition { color: #22863a; background: #f0fff4; }
.hljs-deletion { color: #b31d28; background: #ffeef0; }
`;

// GitHub Dark theme
const githubDark = `
.hljs {
  color: #c9d1d9;
  background: #0d1117;
}
.hljs-comment, .hljs-quote { color: #8b949e; }
.hljs-keyword, .hljs-selector-tag { color: #ff7b72; }
.hljs-string, .hljs-attr { color: #a5d6ff; }
.hljs-number, .hljs-literal { color: #79c0ff; }
.hljs-variable, .hljs-template-variable { color: #ffa657; }
.hljs-type, .hljs-built_in { color: #d2a8ff; }
.hljs-title, .hljs-section, .hljs-name { color: #d2a8ff; }
.hljs-selector-id, .hljs-selector-class { color: #d2a8ff; }
.hljs-meta { color: #79c0ff; }
.hljs-addition { color: #aff5b4; background: #033a16; }
.hljs-deletion { color: #ffdcd7; background: #67060c; }
`;

// VS Code Light theme
const vscodeLight = `
.hljs {
  color: #000000;
  background: #ffffff;
}
.hljs-comment, .hljs-quote { color: #008000; }
.hljs-keyword, .hljs-selector-tag { color: #0000ff; }
.hljs-string, .hljs-attr { color: #a31515; }
.hljs-number, .hljs-literal { color: #098658; }
.hljs-variable, .hljs-template-variable { color: #001080; }
.hljs-type, .hljs-built_in { color: #267f99; }
.hljs-title, .hljs-section, .hljs-name { color: #795e26; }
.hljs-selector-id, .hljs-selector-class { color: #800000; }
.hljs-meta { color: #000080; }
`;

// VS Code Dark theme
const vscodeDark = `
.hljs {
  color: #d4d4d4;
  background: #1e1e1e;
}
.hljs-comment, .hljs-quote { color: #6a9955; }
.hljs-keyword, .hljs-selector-tag { color: #569cd6; }
.hljs-string, .hljs-attr { color: #ce9178; }
.hljs-number, .hljs-literal { color: #b5cea8; }
.hljs-variable, .hljs-template-variable { color: #9cdcfe; }
.hljs-type, .hljs-built_in { color: #4ec9b0; }
.hljs-title, .hljs-section, .hljs-name { color: #dcdcaa; }
.hljs-selector-id, .hljs-selector-class { color: #d7ba7d; }
.hljs-meta { color: #c586c0; }
`;

// Atom One Light theme
const atomLight = `
.hljs {
  color: #383a42;
  background: #fafafa;
}
.hljs-comment, .hljs-quote { color: #a0a1a7; font-style: italic; }
.hljs-keyword, .hljs-selector-tag { color: #a626a4; }
.hljs-string, .hljs-attr { color: #50a14f; }
.hljs-number, .hljs-literal { color: #986801; }
.hljs-variable, .hljs-template-variable { color: #e45649; }
.hljs-type, .hljs-built_in { color: #c18401; }
.hljs-title, .hljs-section, .hljs-name { color: #4078f2; }
.hljs-selector-id, .hljs-selector-class { color: #4078f2; }
.hljs-meta { color: #4078f2; }
`;

// Atom One Dark theme
const atomDark = `
.hljs {
  color: #abb2bf;
  background: #282c34;
}
.hljs-comment, .hljs-quote { color: #5c6370; font-style: italic; }
.hljs-keyword, .hljs-selector-tag { color: #c678dd; }
.hljs-string, .hljs-attr { color: #98c379; }
.hljs-number, .hljs-literal { color: #d19a66; }
.hljs-variable, .hljs-template-variable { color: #e06c75; }
.hljs-type, .hljs-built_in { color: #e5c07b; }
.hljs-title, .hljs-section, .hljs-name { color: #61afef; }
.hljs-selector-id, .hljs-selector-class { color: #61afef; }
.hljs-meta { color: #61afef; }
`;

export const themes: Record<ThemePair, { light: string; dark: string; name: string }> = {
  github: { light: githubLight, dark: githubDark, name: 'GitHub' },
  vscode: { light: vscodeLight, dark: vscodeDark, name: 'VS Code' },
  atom: { light: atomLight, dark: atomDark, name: 'Atom One' },
};

export function getThemeCSS(theme: ThemePair, isDark: boolean): string {
  return isDark ? themes[theme].dark : themes[theme].light;
}

/**
 * Returns theme CSS scoped for inline code elements.
 * Replaces `.hljs` with `.nlm-inline-hljs` and strips background properties
 * so only syntax token colors are applied.
 */
export function getInlineThemeCSS(theme: ThemePair, isDark: boolean): string {
  const css = getThemeCSS(theme, isDark);
  return css
    .replace(/\.hljs/g, '.nlm-inline-hljs')
    .replace(/background:\s*[^;]+;/g, '');
}
