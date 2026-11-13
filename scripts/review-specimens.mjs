import { chromium, expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const selected=process.argv[2];
const models=selected?[selected]:['octopus','bee','scorpion'];
await mkdir('review/specimens',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report=[];
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.biomech?.state.ready);
  for(const model of models) {
    await page.locator(`[data-model="${model}"]`).click();
    await page.waitForFunction(model=>window.biomech.state.ready&&window.biomech.state.model===model,model,{timeout:60000});
    async function capture(name) {
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`review/specimens/${model}-${name}.png`,fullPage:true});
      report.push({model,view:name,stats:await page.evaluate(()=>window.biomech.stats)});
    }
    await capture('overview');
    const mode=model==='octopus'?'开壳':model==='bee'?'腹部展开':'钳爪开合';
    await page.getByRole('button',{name:mode,exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.biomech.state.simulationTime)).toBeGreaterThan(1.5);
    await page.getByRole('button',{name:'暂停演示',exact:true}).click();
    await capture('mechanism');
    await page.getByRole('button',{name:'拆解 EXPLODE',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.biomech.state.explode)).toBeGreaterThan(.995);
    await capture('exploded');
    await page.getByRole('button',{name:'重置模型和相机',exact:true}).click();
    await page.getByRole('button',{name:'特写',exact:true}).click();
    await page.evaluate(()=>new Promise(resolve=>{let n=0;const step=()=>++n<50?requestAnimationFrame(step):resolve();requestAnimationFrame(step);}));
    await capture('detail');
    await page.getByRole('button',{name:'重置模型和相机',exact:true}).click();
    const motion=model==='octopus'?'卷腕':model==='bee'?'悬停':'步行';
    await page.getByRole('button',{name:motion,exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.biomech.state.simulationTime)).toBeGreaterThan(2);
    await page.getByRole('button',{name:'暂停演示',exact:true}).click();
    await capture('motion');
    if(model==='bee') {
      await page.getByRole('button',{name:'腹部展开',exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>window.biomech.pose.abdomenOpen)).toBeGreaterThan(.5);
      await page.getByRole('button',{name:'暂停演示',exact:true}).click();
      await page.getByRole('button',{name:'侧视',exact:true}).click();
      await page.evaluate(()=>new Promise(resolve=>{let n=0;const step=()=>++n<60?requestAnimationFrame(step):resolve();requestAnimationFrame(step);}));
      await capture('abdomen-side');
    }
    if(model==='octopus') {
      await page.getByRole('button',{name:'重置模型和相机',exact:true}).click();
      await page.setViewportSize({width:390,height:844});
      await capture('mobile');
      await page.setViewportSize({width:1600,height:1100});
    }
  }
  await writeFile('review/specimens/report.json',JSON.stringify({errors,report},null,2));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify(report.map(({model,view,stats})=>({model,view,meshes:stats.meshes,triangles:stats.triangles,calls:stats.calls}))));
} finally {await browser.close();}
