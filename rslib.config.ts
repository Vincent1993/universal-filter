import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [{
    format: 'esm',
    source: {
      tsconfigPath: './tsconfig.build.json',
      entry: {
        index: './src/index.ts',
      },
    },
   dts: true,
   output: {
    minify: true,
    distPath: {
      root: './dist',
    },
    filename: {
      js: '[name].mjs',
    },
   }
  }]
});
