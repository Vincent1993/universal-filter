import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.{ts,tsx}']
  },
  resolve: {
    alias: {
      'react-dom/test-utils': resolve(
        __dirname,
        'node_modules/react-dom/test-utils.js'
      ),
      'react-dom/client': resolve(
        __dirname,
        'node_modules/react-dom/client.js'
      ),
      '@testing-library/react': resolve(
        __dirname,
        'test-utils/testing-library-react.ts'
      )
    }
  }
});
