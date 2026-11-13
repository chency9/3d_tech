import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
await fs.mkdir('review/revision02',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce',deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/');
await page.waitForFunction(()=>window.biomech?.state.ready);
const timeline=page.getByRole('slider',{name:'演示时间轴'});
for(let i=0;i<8;i++) {
  const t=24.05+i*.15;
  await timeline.evaluate((el,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},t.toFixed(2));
  await timeline.blur();
  await expect.poll(()=>page.evaluate(()=>window.biomech.pose.frequency)).toBeGreaterThan(.8);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:`review/revision02/gait-${i}.png`});
}
await page.getByRole('button',{name:'待机',exact:true}).click();
await page.getByRole('button',{name:'暂停演示',exact:true}).click();
await page.getByRole('button',{name:'特写',exact:true}).click();
const metrics=await page.evaluate(()=>new Promise(resolve=>{
  const start=performance.now();let frames=0;
  function frame(){frames++;if(frames===100)resolve({fps:100000/(performance.now()-start),stats:window.biomech.stats});else requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}));
await page.screenshot({path:'review/revision02/detail.png'});
await page.getByRole('button',{name:'透视',exact:true}).click();
await page.getByRole('button',{name:'拆解 EXPLODE',exact:true}).click();
await page.waitForFunction(()=>window.biomech.state.explode>.995);
await page.screenshot({path:'review/revision02/exploded.png'});
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'重置模型和相机'}).click();
await page.getByRole('button',{name:'暂停演示',exact:true}).click();
await page.evaluate(()=>new Promise(resolve=>{let i=0;function f(){if(++i===60)resolve();else requestAnimationFrame(f);}requestAnimationFrame(f);}));
await page.screenshot({path:'review/revision02/mobile.png',fullPage:true});
await fs.writeFile('review/revision02/report.json',JSON.stringify({errors,metrics},null,2));
console.log(JSON.stringify({errors,fps:metrics.fps,triangles:metrics.stats.triangles,calls:metrics.stats.calls}));
await browser.close();
