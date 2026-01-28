import { defineConfig } from 'wxt';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  srcDir: 'src',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'NotebookLM Code Highlighter',
    description: 'Adds syntax highlighting to code blocks in NotebookLM',
    permissions: ['storage'],
    host_permissions: [
      'https://notebooklm.google.com/*',
      // Only include localhost in development builds
      ...(isDev ? ['*://localhost/*'] : []),
    ],
    icons: {
      16: 'icon/icon.png',
      32: 'icon/icon.png',
      48: 'icon/icon.png',
      96: 'icon/icon.png',
      128: 'icon/icon.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'notebooklm-highlighter@koval.xyz',
        // @ts-expect-error - data_collection_permissions is a new Firefox requirement not yet in WXT types
        data_collection_permissions: {
          required: ['none'],
          optional: [],
        },
      },
    },
  },
});
