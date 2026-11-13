import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const htmlPath = path.join(dist, 'index.html');
const html = await readFile(htmlPath, 'utf8');

const cssMatch = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/i);
const jsMatch = html.match(/<script\b[^>]*src="([^"]+\.js)"[^>]*><\/script>/i);
if (!cssMatch || !jsMatch) throw new Error('Unable to find Vite CSS or JavaScript assets in dist/index.html');

const assetPath = asset => path.join(dist, asset.replace(/^\.\//, '').replaceAll('/', path.sep));
const [css, js, manifest] = await Promise.all([
  readFile(assetPath(cssMatch[1]), 'utf8'),
  readFile(assetPath(jsMatch[1]), 'utf8'),
  readFile(path.join(root, 'public/models/manifest.json'), 'utf8').then(JSON.parse),
]);

const modelBytes = {};
for (const entry of manifest) {
  const bytes = await readFile(path.join(dist, 'models', entry.file));
  modelBytes[entry.file] = bytes.length;
  // Classic scripts work under file:// without changing browser settings.
  // Each specimen has its own companion script, read only on local opening.
  const data = `globalThis.__BIOMECH_MODELS__ ??= {};globalThis.__BIOMECH_MODELS__[${JSON.stringify(entry.file)}]=${JSON.stringify(bytes.toString('base64'))};`;
  await writeFile(path.join(dist, 'models', `${entry.file}.js`), data, 'utf8');
}

const modelScript = `<script>globalThis.__BIOMECH_MODEL_BYTES__=${JSON.stringify(modelBytes)};</script>`;
// The generated stylesheet lives in dist/assets, while an inline style is
// resolved from dist/index.html. Move font URLs one directory deeper.
const standaloneCss = css.replaceAll('url(./', 'url(./assets/');
const inlineStyle = `<style data-standalone-style>\n${standaloneCss}\n</style>`;
// Three.js contains a few literal closing-script strings in shader and error
// text. Escape them before placing the bundle inside HTML so the parser cannot
// terminate the inline module early.
const safeJs = js.replaceAll('</script', '<\\/script');
const inlineModule = `<script type="module" data-standalone-bundle>\n${safeJs}\n</script>`;
// Use replacement callbacks: minified vendor code contains `$&` sequences,
// which String#replace would otherwise expand into the matched tag.
// Keep the startup screen before the bundle. Model bytes live in separate
// files so HTTP pages can report actual GLB download progress immediately.
const standalone = html
  .replace(cssMatch[0], () => inlineStyle)
  .replace(jsMatch[0], '')
  .replace('</body>', () => `${modelScript}${inlineModule}\n</body>`);
await writeFile(htmlPath, standalone, 'utf8');

const megabytes = (Buffer.byteLength(standalone) / 1024 / 1024).toFixed(1);
console.log(`dist/index.html written (${megabytes} MiB); ${manifest.length} models support HTTP progress and file:// companion scripts`);
