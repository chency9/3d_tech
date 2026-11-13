import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const dist = path.resolve('dist');
const html = await readFile(path.join(dist, 'index.html'));
let releaseDownload;
const downloadGate = new Promise(resolve => { releaseDownload = resolve; });
let releaseMoreModel, releaseModel;
const moreModelGate = new Promise(resolve => { releaseMoreModel = resolve; });
const modelGate = new Promise(resolve => { releaseModel = resolve; });
const requestedModels = [];
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/mechanical3d/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.write(html.subarray(0, 64 * 1024));
      // Hold the remaining HTML until the browser proves that the
      // startup screen is visible during the actual HTML download.
      await downloadGate;
      response.end(html.subarray(64 * 1024));
      return;
    }
    const asset = path.resolve(dist, '.' + pathname.replace('/mechanical3d', ''));
    if (!asset.startsWith(dist + path.sep)) throw new Error('Invalid asset path');
    const bytes = await readFile(asset);
    if (pathname.endsWith('/telson-sc8.glb')) {
      requestedModels.push(path.basename(asset));
      // Omit Content-Length to exercise the manifest-size fallback used by
      // chunked or compressed production responses.
      response.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
      response.write(bytes.subarray(0, Math.ceil(bytes.length / 4)));
      await moreModelGate;
      response.write(bytes.subarray(Math.ceil(bytes.length / 4), Math.ceil(bytes.length * .75)));
      await modelGate;
      response.end(bytes.subarray(Math.ceil(bytes.length * .75)));
      return;
    }
    if (pathname.endsWith('/mellis-hb7.glb')) requestedModels.push(path.basename(asset));
    response.writeHead(200, { 'Content-Length': bytes.length });
    response.end(bytes);
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
  await expect(page.locator('#loading-percent')).toHaveText('25%');
  await expect(page.locator('#loading-progress')).toHaveAttribute('value', '25');
  await expect(page.locator('#loading-detail')).toHaveText('4.0 / 15.8 MB');
  await page.screenshot({ path: 'review/loading/model-progress.png' });
  releaseMoreModel();
  await expect(page.locator('#loading-percent')).toHaveText('75%');
  await expect(page.locator('#loading-progress')).toHaveAttribute('value', '75');
  releaseModel();
  await page.waitForFunction(() => window.biomech?.state.ready, null, { timeout: 20000 });
  await expect(page.locator('.boot-loader')).toHaveCount(0);
  await page.locator('[data-model="bee"]').click();
  await page.waitForFunction(() => window.biomech?.state.ready && window.biomech.state.model === 'bee', null, { timeout: 20000 });
  assert.deepEqual(errors, []);
  assert.deepEqual(requestedModels, ['telson-sc8.glb', 'mellis-hb7.glb']);
  console.log('PASS: early loading, real 25% → 75% model download progress without Content-Length, and both specimens under /mechanical3d/.');
} finally {
  releaseDownload();
  releaseMoreModel();
  releaseModel();
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
