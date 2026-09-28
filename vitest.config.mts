import { defineConfig, type Plugin } from 'vitest/config';

// migrate.ts now imports `Platform` from 'react-native' (Task 8, Part 2A), so
// its test reaches the real package. Vitest's Rolldown-based transform can't
// parse react-native's Flow-typed source at all, in or out of node_modules,
// so the only thing tests need from it — `Platform.OS` not equalling 'web' —
// is served from this tiny virtual module instead.
function stubReactNative(): Plugin {
  const id = 'react-native';
  const resolved = '\0virtual:react-native-stub';
  return {
    name: 'stub-react-native-platform',
    enforce: 'pre',
    resolveId: {
      order: 'pre',
      handler(source) {
        if (source === id) return resolved;
        return null;
      },
    },
    load(loadedId) {
      if (loadedId === resolved) return "export const Platform = { OS: 'ios' };";
      return null;
    },
  };
}

export default defineConfig({
  plugins: [stubReactNative()],
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
    // The app is used in India. A UTC laptop must see the same clock bugs.
    env: { TZ: 'Asia/Kolkata' },
  },
});
