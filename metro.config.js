// https://docs.expo.dev/versions/v57.0.0/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend (wa-sqlite) ships a .wasm file it imports
// directly. Metro doesn't treat `.wasm` as a static asset by default, so
// that import fails to resolve on `--platform web` — needed the moment
// anything imports `expo-sqlite/kv-store` (see src/game/state/meta-store.ts).
config.resolver.assetExts.push('wasm');

module.exports = config;
