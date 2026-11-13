import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const errors=[]; const logs=[];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
page.on('requestfailed', request => logs.push(`${request.url()} — ${request.failure()?.errorText ?? 'request failed'}`));
const url = pathToFileURL(path.resolve('dist/index.html')).href;
try { await page.goto(url, { waitUntil:'networkidle', timeout:15000 }); } catch (e) { errors.push('goto: '+e.message); }
await page.waitForTimeout(2500);
const ready = await page.evaluate(()=>window.biomech?.state?.ready ?? false);
if (!ready || errors.length || logs.length) throw new Error(JSON.stringify({url, ready, errors, logs}));
await page.locator('[data-model="bee"]').click();
await page.waitForFunction(()=>window.biomech?.state.ready && window.biomech.state.model==='bee');
if (errors.length || logs.length) throw new Error(JSON.stringify({errors, logs}));
console.log(JSON.stringify({url, title:await page.title(), ready, specimens:['scorpion','bee'], errors, logs}));
await browser.close();
