import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
await fs.mkdir('review',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/');
await page.waitForFunction(()=>window.biomech?.state.ready,{timeout:60000});
const captures=[];
for(const model of ['scorpion','bee']) {
  if(model==='bee'){
    await page.getByRole('button',{name:/MELLIS/}).click();
    await page.waitForFunction(()=>window.biomech?.state.ready&&window.biomech.state.model==='bee');
  }
  for(const [chapter,time] of [['overview',0],['mechanism',7],['motion',12],['exploded',18],['reassembled',24]]) {
    await page.getByRole('slider',{name:'演示时间轴'}).fill(String(time));
    await page.waitForFunction(({model,time})=>{
      const s=window.biomech.state;
      const expected=time===18?1:0;
      return s.model===model&&s.time===time&&Math.abs(s.explode-expected)<.015;
    },{model,time});
    await page.getByRole('slider',{name:'演示时间轴'}).blur();
    await page.waitForFunction(({time})=>document.querySelector('#current-time').textContent===`00:${String(time).padStart(2,'0')}`,{time});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:`review/${model}-${chapter}.png`});
    captures.push({model,chapter,stats:await page.evaluate(()=>window.biomech.stats)});
  }
}
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'重置模型和相机'}).click();
await page.getByRole('button',{name:'暂停演示',exact:true}).click();
await page.screenshot({path:'review/mobile-bee.png',fullPage:true});
console.log(JSON.stringify({errors,captures}));
await browser.close();
