import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const servers: ReturnType<typeof createServer>[] = [];
function serve(port: number) {
  return new Promise<void>(resolve => {
    const server = createServer(async (request, response) => {
      try {
        const path = normalize(decodeURIComponent(request.url?.split('?')[0] || '/')).replace(/^[/\\]+/, '');
        const file = join(process.cwd(), path);
        const body = await readFile(file);
        response.writeHead(200, { 'content-type': extname(file) === '.html' ? 'text/html' : extname(file) === '.js' ? 'text/javascript' : 'text/css' });
        response.end(body);
      } catch { response.writeHead(404).end(); }
    });
    server.listen(port, '127.0.0.1', () => { servers.push(server); resolve(); });
  });
}
test.beforeAll(async () => { await serve(4173); await serve(4174); });
test.afterAll(() => servers.forEach(server => server.close()));
test('game-owned start, viewport, pause, restart and multiple attempts', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/tests/browser/host.html');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'READY' }).click();
  await expect(page.locator('#state')).toHaveText('initialized');
  await expect(frame.locator('#received')).toContainText('viewport');
  // No host start action: the game's own STARTED button alone starts play.
  await frame.getByRole('button', { name: 'STARTED' }).click();
  await expect(page.locator('#state')).toHaveText('started');
  await frame.getByRole('button', { name: 'CHECKPOINT' }).click();
  await expect(page.locator('#checkpoint-count')).toHaveText('1');
  await page.evaluate(() => window.host.pause());
  await expect(page.locator('#state')).toHaveText('paused');
  await page.evaluate(() => window.host.resume());
  await expect(page.locator('#state')).toHaveText('started');
  await frame.getByRole('button', { name: 'FAIL' }).click();
  await expect(page.locator('#state')).toHaveText('failed');
  await page.evaluate(() => window.host.restart());
  await expect(page.locator('#state')).toHaveText('initialized');
  await frame.getByRole('button', { name: 'STARTED' }).click();
  await frame.getByRole('button', { name: 'COMPLETE' }).click();
  await expect(page.locator('#state')).toHaveText('completed');
  await page.evaluate(() => window.host.restart());
  await frame.getByRole('button', { name: 'STARTED' }).click();
  await frame.getByRole('button', { name: 'COMPLETE' }).click();
  await expect(page.locator('#state')).toHaveText('completed');
});
test('rejects invalid origins and sessions', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/tests/browser/host.html');
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
    origin: 'http://evil.test', source: document.querySelector('iframe').contentWindow,
    data: { protocol: 'whs', version: 2, type: 'whs.game.ready', payload: { gameId: 'mock-game', capabilities: [] } },
  })));
  await expect(page.locator('#state')).toHaveText('waiting');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'READY' }).click();
  await frame.getByRole('button', { name: 'STARTED' }).click();
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
    origin: 'http://127.0.0.1:4174', source: document.querySelector('iframe').contentWindow,
    data: { protocol: 'whs', version: 2, type: 'whs.game.completed', sessionId: 'stale', payload: { score: 999 } },
  })));
  await expect(page.locator('#state')).toHaveText('started');
});
