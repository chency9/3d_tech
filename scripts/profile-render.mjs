import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const output = process.argv[2] || 'review/performance/current';
await mkdir(output, { recursive: true });
const reference = process.argv.find(arg => arg.startsWith('--reference='))?.slice('--reference='.length);
let base = '';
if (reference) {
  base = '/review/performance/reference';
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', reference, '--', 'src'], { encoding: 'utf8' }).trim().split('\n');
  for (const file of files) {
    const target = path.join('review/performance/reference', file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, execFileSync('git', ['show', `${reference}:${file}`]));
  }
  const html = execFileSync('git', ['show', `${reference}:index.html`], { encoding: 'utf8' }).replace('src="/src/main.js"', 'src="./src/main.js"');
  await writeFile('review/performance/reference/index.html', html);
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace('window.biomech={', 'window.profileStage=stage;window.biomech={')
      .replace('function updateHUD(pose) {', 'function updateHUD(pose) { const start=performance.now();try { return profileUpdateHUD(pose); } finally { (window.profileHUDSamples??=[]).push(performance.now()-start); } }\nfunction profileUpdateHUD(pose) {');
    await route.fulfill({ response, body });
  });
  await page.goto(`http://127.0.0.1:5173${base}/`);
  await page.waitForFunction(() => window.biomech?.state.ready);
  await page.evaluate(async () => {
    const frame = window.profileStage.frame;
    window.profileStage.frame = function (...args) {
      const begin = performance.now();
      const config = window.profileConfig;
      const pose = window.profileAnimated
        ? window.profileSolve(config.model,config.mode,2.25+(window.profileStep++)/60,1,config.explode,config.weights)
        : window.profilePose;
      const result = pose
        ? frame.call(this, pose, 0, 2.25, false, false)
        : frame.apply(this, args);
      if (window.profileSamples) window.profileSamples.push(performance.now() - begin);
      if (window.captureFrame) {
        window.framePNG = this.renderer.domElement.toDataURL('image/png');
        window.captureFrame = false;
      }
      return result;
    };
  });
  await page.waitForFunction(() => !!window.profileStage);
  const gpuTiming = await page.evaluate(() => {
    const stage = window.profileStage, gl = stage.renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    window.profileQueries = [];
    const render = stage.renderer.render.bind(stage.renderer);
    if (ext) stage.renderer.render = function (...args) {
      if (!window.profileSamples) return render(...args);
      const query = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      const result = render(...args);
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      window.profileQueries.push(query);
      return result;
    };
    return { timer: !!ext, multiDraw: !!gl.getExtension('WEBGL_multi_draw'), renderer: gl.getParameter(gl.RENDERER) };
  });
  console.log(JSON.stringify(gpuTiming));
  const scenarios = [
    ['scorpion', 'stand', 0, 'all', false],
    ['scorpion', 'walk', 0, 'all', false],
    ['scorpion', 'tail', 0, 'all', false],
    ['scorpion', 'stand', 1, 'all', false],
    ['scorpion', 'claw', .35, 'tail', false],
    ['scorpion', 'walk', 0, 'all', true],
    ['bee', 'flight', 0, 'all', false],
    ['bee', 'abdomen', 1, 'wings', false],
  ];
  const report = [];
  for (let i = 0; i < scenarios.length; i++) {
    const [model, mode, explode, selection, wireframe] = scenarios[i];
    if (await page.evaluate(() => window.biomech.state.model) !== model) {
      await page.locator(`[data-model="${model}"]`).click();
      await page.waitForFunction(model => window.biomech.state.ready && window.biomech.state.model === model, model);
    }
    await page.evaluate(async ({ model, mode, explode, selection, wireframe, base }) => {
      const { solve } = await import(`${base}/src/kinematics.js`);
      const weights = { walk: mode === 'walk' ? 1 : 0, claw: mode === 'claw' ? 1 : 0, tail: mode === 'tail' ? 1 : 0 };
      window.profileSolve=solve;window.profileConfig={model,mode,explode,weights};window.profileStep=0;
      window.profilePose = solve(model, mode, 2.25, 1, explode, weights);
      window.profileAnimated=true;
      window.profileHUDSamples=[];
      window.profileStage.setSelection(selection);
      window.profileStage.setWireframe(wireframe);
      window.profileSamples = null;
    }, { model, mode, explode, selection, wireframe, base });
    await page.evaluate(() => new Promise(resolve => {
      let frames = 0;
      function warmup() { if (++frames < 12) requestAnimationFrame(warmup); else resolve(); }
      requestAnimationFrame(warmup);
    }));
    const metrics = await page.evaluate(() => new Promise(resolve => {
      window.profileSamples = [];
      const intervals = [];
      let previous = performance.now();
      function sample(now) {
        intervals.push(now - previous); previous = now;
        if (intervals.length < 60) { requestAnimationFrame(sample); return; }
        const stage = window.profileStage, meshes = stage.current.meshes;
        const sorted = window.profileSamples.slice().sort((a, b) => a - b);
        const hud=window.profileHUDSamples.sort((a,b)=>a-b);
        const geometries = new Map();
        for (const mesh of meshes) geometries.set(mesh.geometry.uuid, (geometries.get(mesh.geometry.uuid) || 0) + 1);
        const gl = stage.renderer.getContext(), timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
        const gpu = timer&&!gl.getParameter(timer.GPU_DISJOINT_EXT) ? window.profileQueries.filter(q => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)).map(q => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6) : [];
        window.profileQueries.forEach(q => gl.deleteQuery(q)); window.profileQueries = [];
        resolve({ calls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles,
          gpuMeanMs: gpu.length ? gpu.reduce((a,b) => a+b,0)/gpu.length : null,
          hudMedianMs: hud[Math.floor(hud.length/2)] ?? null,
          meshes: meshes.length, geometries: geometries.size, repeatedGeometryMeshes: [...geometries.values()].filter(n => n > 1).reduce((a, b) => a + b, 0),
          materials: new Set(meshes.map(m => m.material.uuid)).size,
          cpuMedianMs: sorted[Math.floor(sorted.length / 2)], cpuP95Ms: sorted[Math.floor(sorted.length * .95)],
          frameMeanMs: intervals.reduce((a, b) => a + b, 0) / intervals.length,
          modelVertices: meshes.reduce((n, mesh) => n + mesh.geometry.attributes.position.count, 0),
          settings: { pixelRatio: stage.renderer.getPixelRatio(), shadowSize: stage.scene.children.find(o => o.isDirectionalLight && o.castShadow).shadow.mapSize.toArray(), toneMapping: stage.renderer.toneMapping, exposure: stage.renderer.toneMappingExposure },
        });
        window.profileSamples = null;
      }
      requestAnimationFrame(sample);
    }));
    await page.evaluate(() => { window.profileAnimated=false;window.captureFrame = true; });
    await page.waitForFunction(() => !window.captureFrame);
    const png = await page.evaluate(() => window.framePNG.split(',')[1]);
    const name = `${i}-${model}-${mode}-${selection}${wireframe ? '-wire' : ''}`;
    await writeFile(path.join(output, `${name}.png`), Buffer.from(png, 'base64'));
    report.push({ name, ...metrics });
    console.log(JSON.stringify(report.at(-1)));
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(output, 'metrics.json'), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
