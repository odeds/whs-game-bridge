import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = process.cwd();
let servers: ReturnType<typeof createServer>[] = [];
function serve(port: number) { const server = createServer(async (req, res) => { try { const path = normalize(join(root, decodeURIComponent(req.url?.split("?")[0] || "/"))).replace(root, ""); const file = join(root, path); const body = await readFile(file); res.writeHead(200, { "content-type": extname(file) === ".html" ? "text/html" : extname(file) === ".js" ? "text/javascript" : "text/css" }); res.end(body); } catch { res.writeHead(404).end(); } }); return new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => { servers.push(server); resolve(); })); }
test.beforeAll(async () => { await serve(4173); await serve(4174); }); test.afterAll(() => servers.forEach((s) => s.close()));
test("embedded mock game completes lifecycle and responds to controls", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/tests/browser/host.html"); const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "READY" }).click(); await expect(page.locator("#state")).toHaveText("initialized");
  await page.evaluate(() => window.host.start()); await frame.getByRole("button", { name: "STARTED" }).click(); await expect(page.locator("#state")).toHaveText("started");
  await frame.getByRole("button", { name: "CHECKPOINT" }).click(); await page.evaluate(() => window.host.pause()); await expect(frame.locator("#reaction")).toContainText("PAUSE"); await page.evaluate(() => window.host.resume()); await expect(frame.locator("#reaction")).toContainText("RESUME"); await page.evaluate(() => window.host.restart()); await expect(frame.locator("#reaction")).toContainText("RESTART"); await page.evaluate(() => window.host.start()); await frame.getByRole("button", { name: "STARTED" }).click();
  await frame.getByRole("button", { name: "COMPLETE" }).click(); await expect(page.locator("#state")).toHaveText("completed");
});
test("host rejects invalid origin and stale session", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/tests/browser/host.html");
  await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", { origin: "http://evil.test", source: document.querySelector("iframe").contentWindow, data: { protocol: "whs", version: 1, type: "whs.game.ready", payload: { gameId: "mock-game", capabilities: [] } } })));
  await expect(page.locator("#state")).toHaveText("waiting"); const frame = page.frameLocator("iframe"); await frame.getByRole("button", { name: "READY" }).click(); await expect(page.locator("#state")).toHaveText("initialized");
  await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", { origin: "http://127.0.0.1:4174", source: document.querySelector("iframe").contentWindow, data: { protocol: "whs", version: 1, type: "whs.game.initialized", sessionId: "stale" } })));
  await expect(page.locator("#state")).toHaveText("initialized");
});
test("embedded game reports failure", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/tests/browser/host.html"); const frame = page.frameLocator("iframe"); await frame.getByRole("button", { name: "READY" }).click(); await expect(page.locator("#state")).toHaveText("initialized"); await page.evaluate(() => window.host.start()); await frame.getByRole("button", { name: "STARTED" }).click(); await expect(page.locator("#state")).toHaveText("started"); await frame.getByRole("button", { name: "FAIL" }).click(); await expect(page.locator("#state")).toHaveText("failed");
});
