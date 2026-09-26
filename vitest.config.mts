import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
    // The app is used in India. A UTC laptop must see the same clock bugs.
    env: { TZ: 'Asia/Kolkata' },
  },
});
