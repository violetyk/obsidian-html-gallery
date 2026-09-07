import { defineConfig } from "vitest/config";

export default defineConfig({
  // The plugin build marks "obsidian" external because Obsidian provides it at runtime.
  // Tests do the same, with a stub holding just the few helpers the pure modules import.
  resolve: {
    alias: { obsidian: new URL("./test/obsidian-stub.ts", import.meta.url).pathname },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
