import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const servers: ReturnType<typeof createServer>[] = [];

function serve(port: number) {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(request.url?.split("?")[0] || "/");
      const relativePath = normalize(requestPath).replace(/^[/\\]+/, "");
      const file = join(root, relativePath);
      const body = await readFile(file);
      const extension = extname(file);
      const contentType = extension === ".html"
        ? "text/html"
        : extension === ".js"
          ? "text/javascript"
          : "text/css";
      response.writeHead(200, { "content-type": contentType });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      servers.push(server);
      resolve();
    });
  });
}

test.beforeAll(async () => {
  await serve(4173);
  await serve(4174);
});
test.afterAll(() => servers.forEach((server) => server.close()));

test("embedded mock game completes the full lifecycle", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/tests/browser/host.html");
  const frame = page.frameLocator("iframe");

  await frame.getByRole("button", { name: "READY" }).click();
  await expect(page.locator("#state")).toHaveText("initialized");
  await expect(frame.locator("#session")).not.toHaveText("—");

  await page.evaluate(() => window.host.start());
  await expect(page.locator("#state")).toHaveText("starting");
  await frame.getByRole("button", { name: "STARTED" }).click();
  await expect(page.locator("#state")).toHaveText("started");

  await frame.getByRole("button", { name: "CHECKPOINT" }).click();
  await expect(page.locator("#checkpoint-count")).toHaveText("1");
  await expect(page.locator("#last-message")).toHaveText("whs.game.checkpoint");

  await page.evaluate(() => window.host.pause());
  await expect(page.locator("#state")).toHaveText("paused");
  await expect(frame.locator("#reaction")).toContainText("PAUSE");
  await page.evaluate(() => window.host.resume());
  await expect(page.locator("#state")).toHaveText("started");
  await expect(frame.locator("#reaction")).toContainText("RESUME");
  await page.evaluate(() => window.host.setVolume(0.25));
  await expect(frame.locator("#reaction")).toContainText("Volume 0.25");

  await page.evaluate(() => window.host.restart());
  await expect(page.locator("#state")).toHaveText("initialized");
  await expect(frame.locator("#reaction")).toContainText("RESTART");
  await page.evaluate(() => window.host.start());
  await frame.getByRole("button", { name: "STARTED" }).click();
  await expect(page.locator("#state")).toHaveText("started");

  await frame.getByRole("button", { name: "COMPLETE" }).click();
  await expect(page.locator("#state")).toHaveText("completed");
});

test("host rejects invalid origins and stale state-changing sessions", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/tests/browser/host.html");
  await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", {
    origin: "http://evil.test",
    source: document.querySelector("iframe").contentWindow,
    data: {
      protocol: "whs",
      version: 1,
      type: "whs.game.ready",
      payload: { gameId: "mock-game", capabilities: [] },
    },
  })));
  await expect(page.locator("#state")).toHaveText("waiting");

  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "READY" }).click();
  await expect(page.locator("#state")).toHaveText("initialized");
  await page.evaluate(() => window.host.start());
  await frame.getByRole("button", { name: "STARTED" }).click();
  await expect(page.locator("#state")).toHaveText("started");

  await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", {
    origin: "http://127.0.0.1:4174",
    source: document.querySelector("iframe").contentWindow,
    data: {
      protocol: "whs",
      version: 1,
      type: "whs.game.completed",
      sessionId: "stale-session",
      payload: { score: 9999 },
    },
  })));
  await expect(page.locator("#state")).toHaveText("started");
});

test("embedded game reports failure", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/tests/browser/host.html");
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "READY" }).click();
  await expect(page.locator("#state")).toHaveText("initialized");
  await page.evaluate(() => window.host.start());
  await frame.getByRole("button", { name: "STARTED" }).click();
  await expect(page.locator("#state")).toHaveText("started");
  await frame.getByRole("button", { name: "FAIL" }).click();
  await expect(page.locator("#state")).toHaveText("failed");
});
