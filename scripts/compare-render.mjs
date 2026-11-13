import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const beforeDir=process.argv[2]||'review/performance/reference-78f4f61';
const afterDir=process.argv[3]||'review/performance/optimized';
const before=JSON.parse(await readFile(path.join(beforeDir,'metrics.json'),'utf8'));
const after=JSON.parse(await readFile(path.join(afterDir,'metrics.json'),'utf8'));
assert.equal(after.length,before.length);
const browser=await chromium.launch({channel:'chrome',headless:true});
const comparison=[];
try {
  const page=await browser.newPage();
  for(let i=0;i<before.length;i++) {
    const a=before[i],b=after[i];
    assert.equal(a.name,b.name);
    for(const key of ['meshes','modelVertices','triangles']) assert.equal(b[key],a[key],`${a.name}: ${key} changed`);
    assert.deepEqual(b.settings,a.settings,`${a.name}: render quality changed`);
    const images=await Promise.all([beforeDir,afterDir].map(async dir=>'data:image/png;base64,'+(await readFile(path.join(dir,`${a.name}.png`))).toString('base64')));
    const difference=await page.evaluate(async images=>{
      const bitmaps=await Promise.all(images.map(async url=>{
        const image=new Image();image.src=url;await image.decode();return image;
      }));
      const [a,b]=bitmaps;
      if(a.width!==b.width||a.height!==b.height)throw new Error('Screenshot dimensions changed');
      const canvas=document.createElement('canvas');canvas.width=a.width;canvas.height=a.height;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      const data=bitmaps.map(image=>{context.drawImage(image,0,0);return context.getImageData(0,0,a.width,a.height).data;});
      let sum=0,changed=0;
      for(let i=0;i<data[0].length;i+=4) {
        const d=[0,1,2].map(c=>Math.abs(data[0][i+c]-data[1][i+c]));
        sum+=d[0]+d[1]+d[2];if(Math.max(...d)>8)changed++;
      }
      return {meanChannelError:sum/(a.width*a.height*3),changedPixelFraction:changed/(a.width*a.height)};
    },images);
    // A small tolerance covers floating-point matrix evaluation and edge
    // rasterization. Missing parts or changed materials exceed these bounds.
    assert.ok(difference.meanChannelError<.05,`${a.name}: image mean error ${difference.meanChannelError}`);
    assert.ok(difference.changedPixelFraction<.001,`${a.name}: visible pixels changed ${difference.changedPixelFraction}`);
    if(i<4||i===6)assert.ok(b.calls<=a.calls*.25,`${a.name}: draw submissions were not reduced`);
    comparison.push({name:a.name,calls:[a.calls,b.calls],cpuMedianMs:[a.cpuMedianMs,b.cpuMedianMs],gpuMeanMs:[a.gpuMeanMs,b.gpuMeanMs],hudMedianMs:[a.hudMedianMs,b.hudMedianMs],...difference});
  }
  await writeFile(path.join(afterDir,'comparison.json'),JSON.stringify(comparison,null,2));
  console.log(JSON.stringify(comparison,null,2));
  console.log('PASS: source vertex counts, rendered triangle counts, quality settings and all eight image comparisons; full-model draw calls reduced by at least 75%.');
} finally {await browser.close();}
