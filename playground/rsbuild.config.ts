import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/rspack';
import path from 'node:path';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      'index': './src/main.tsx',
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  html: {
    title: 'Universal Filter Playground',
  },
  output: {
    assetPrefix: '/universal-filter/',
  },
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({
          target: 'react',
          autoCodeSplitting: true,
        }),
      ],
    },
  },
});
