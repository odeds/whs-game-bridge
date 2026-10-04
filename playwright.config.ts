import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/browser", timeout: 15000, use: { headless: true } });
