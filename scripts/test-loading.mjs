import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const dist = path.resolve('dist');
const html = await readFile(path.join(dist, 'index.html'));
let releaseDownload;
const downloadGate = new Promise(resolve => { releaseDownload = resolve; });
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/mechanical3d/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.write(html.subarray(0, 64 * 1024));
      // Hold the remaining model bytes until the browser proves that the
      // startup screen is visible during the actual HTML download.
      await downloadGate;
      response.end(html.subarray(64 * 1024));
      return;
    }
    const asset = path.resolve(dist, '.' + pathname.replace('/mechanical3d', ''));
    if (!asset.startsWith(dist + path.sep)) throw new Error('Invalid asset path');
    response.end(await readFile(asset));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/mechanical3d/`, { waitUntil: 'commit' });
  await expect(page.locator('.boot-loader')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('.boot-loader')).toContainText('正在启动机械实验室');
  await mkdir('review/loading', { recursive: true });
  // Capture the painted viewport directly: Playwright's screenshot helper
  // waits for document.fonts.ready, which needs the paused HTML to finish.
  const cdp = await page.context().newCDPSession(page);
  const screenshot = await cdp.send('Page.captureScreenshot');
  await writeFile('review/loading/slow-download.png', Buffer.from(screenshot.data, 'base64'));
  releaseDownload();
  await page.waitForFunction(() => window.biomech?.state.ready, null, { timeout: 20000 });
  await expect(page.locator('.boot-loader')).toHaveCount(0);
  await page.locator('[data-model="bee"]').click();
  await page.waitForFunction(() => window.biomech?.state.ready && window.biomech.state.model === 'bee', null, { timeout: 20000 });
  assert.deepEqual(errors, []);
  console.log('PASS: loading is visible before the HTML download completes; both specimens load under /mechanical3d/.');
} finally {
  releaseDownload();
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
