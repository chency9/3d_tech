import { test, expect } from '@playwright/test';
import { LabPage } from './lab.page.js';

test('both detailed models load without runtime errors; changing specimens preserves controls',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const lab=new LabPage(page);await lab.open();
  await expect(page.getByRole('heading',{level:1})).toContainText('Telson SC-8');
  expect((await lab.snapshot()).stats.meshes).toBeGreaterThan(80);
  await lab.specimen('bee');
  await expect(page.getByRole('heading',{level:1})).toContainText('Mellis HB-7');
  expect((await lab.snapshot()).stats.meshes).toBeGreaterThan(60);
  await lab.specimen('scorpion');
  await expect(page.getByRole('button',{name:'八足 LEGS'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('claws and tail move in 3D; readouts are driven by the same mechanism',async({page})=>{
  const lab=new LabPage(page);await lab.open();
  const initial=(await lab.snapshot()).stats.articulated.SC_jaw_L_a.quaternion;
  await page.getByRole('button',{name:'钳爪开合',exact:true}).click();
  await expect.poll(async()=>JSON.stringify((await lab.snapshot()).stats.articulated.SC_jaw_L_a.quaternion)).not.toBe(JSON.stringify(initial));
  await page.getByRole('button',{name:'暂停演示',exact:true}).click();
  await expect.poll(async()=>Math.abs(Number(await page.locator('#output').textContent())-Math.round((await lab.snapshot()).pose.grip))).toBeLessThanOrEqual(1);
  const snap=await lab.snapshot();
  expect(snap.pose.grip).toBeCloseTo(76*(1-snap.pose.clawOpen),5);
  await page.getByRole('button',{name:'尾部运动',exact:true}).click();
  await expect.poll(async()=>Math.abs((await lab.snapshot()).pose.tailFlex)).toBeGreaterThan(.01);
  const tail=(await lab.snapshot()).stats.articulated.SC_tail_joint_2.quaternion;
  expect(Math.abs(tail[0])).toBeGreaterThan(.001);
});

test('precision legs articulate independently and keep support feet grounded in the rendered rig',async({page})=>{
  const lab=new LabPage(page);await lab.open();
  await page.getByRole('button',{name:'步行',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).pose.frequency).toBeGreaterThan(.75);
  await page.getByRole('button',{name:'暂停演示',exact:true}).click();
  const snap=await lab.snapshot();
  const upper=snap.stats.articulated.SC_leg_L0_femur.quaternion;
  const lower=snap.stats.articulated.SC_leg_L0_tibia.quaternion;
  expect(upper).not.toEqual(lower);
  for(const leg of snap.pose.legs){
    const rendered=snap.stats.feet.find(f=>f.id===leg.id);
    expect(rendered.worldPosition[1]).toBeCloseTo(leg.worldFoot[1],3);
  }
  await page.getByRole('button',{name:'装甲 ARMOR',exact:true}).click();
  expect((await lab.snapshot()).stats.selected).toBe('armor');
  await page.getByRole('button',{name:'动力舱 CORE',exact:true}).click();
  expect((await lab.snapshot()).stats.selected).toBe('power');
});

test('explode, isolate, reassemble, and timeline scrubbing change the model state',async({page})=>{
  const lab=new LabPage(page);await lab.open();
  await page.getByRole('button',{name:'尾部 TAIL',exact:true}).click();
  expect((await lab.snapshot()).stats.selected).toBe('tail');
  await page.getByRole('button',{name:'拆解 EXPLODE',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).state.explode).toBeGreaterThan(.95);
  expect((await lab.snapshot()).stats.selected).toBe('all');
  await expect(page.locator('#operating-mode')).toHaveText('TEARDOWN');
  await page.getByRole('button',{name:'拆解 EXPLODE',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).state.explode).toBeLessThan(.05);
  await lab.seek(18);
  await expect.poll(async()=>(await lab.snapshot()).state.explode).toBeGreaterThan(.95);
  await lab.seek(24);
  await expect.poll(async()=>(await lab.snapshot()).state.explode).toBeLessThan(.05);
});

test('bee wing and abdomen pivots animate; play/pause and keyboard shortcuts work',async({page})=>{
  const lab=new LabPage(page);await lab.open();await lab.specimen('bee');
  const initial=(await lab.snapshot()).stats.articulated.HB_wing_L0.quaternion;
  await page.getByRole('button',{name:'悬停',exact:true}).click();
  await expect.poll(async()=>JSON.stringify((await lab.snapshot()).stats.articulated.HB_wing_L0.quaternion)).not.toBe(JSON.stringify(initial));
  await expect(page.locator('#frequency')).toHaveText('7.5');
  await page.getByRole('button',{name:'腹部展开',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).pose.abdomenOpen).toBeGreaterThan(.1);
  await page.getByRole('button',{name:'暂停演示',exact:true}).click();
  const t=(await lab.snapshot()).state.simulationTime;
  await page.keyboard.press('l');
  await expect(page.getByRole('button',{name:'标注 LABELS',exact:true})).toHaveAttribute('aria-pressed','false');
  expect((await lab.snapshot()).state.simulationTime).toBe(t);
  await page.keyboard.press('e');
  await expect.poll(async()=>(await lab.snapshot()).state.explode).toBeGreaterThan(.9);
});

test('mobile page has no horizontal overflow and the controls remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const lab=new LabPage(page);await lab.open();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'拆解 EXPLODE',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).state.explode).toBeGreaterThan(.9);
  await page.getByRole('button',{name:'操作说明',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'关闭说明',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('a missing model produces a recoverable error instead of an endless loader',async({page})=>{
  await page.route('**/models/telson-sc8.glb',route=>route.fulfill({status:404,body:'missing'}));
  await page.goto('/');
  await expect(page.getByText('模型加载失败',{exact:true})).toBeVisible();
  await page.unroute('**/models/telson-sc8.glb');
  await page.getByRole('button',{name:'重新加载',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.biomech?.state.ready)).toBe(true);
});

test('batched render copies preserve direct picking, isolation and returning to the complete model',async({page})=>{
  const lab=new LabPage(page);await lab.open();
  await page.getByRole('button',{name:'标注 LABELS',exact:true}).click();
  await lab.pickCenter();
  await expect.poll(async()=>(await lab.snapshot()).state.part).not.toBe('all');
  const part=(await lab.snapshot()).state.part;
  await expect(page.locator(`[data-part="${part}"]`)).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'整机 ALL',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).state.part).toBe('all');
  await page.getByRole('button',{name:'线框 WIRE',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).stats.triangles).toBe(2);
  await page.getByRole('button',{name:'线框 WIRE',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).stats.triangles).toBeGreaterThan(1000000);
});

test('a browser without WEBGL_multi_draw keeps every model and control available',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const getExtension=WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension=function(name) {
      return name==='WEBGL_multi_draw'?null:getExtension.call(this,name);
    };
  });
  const lab=new LabPage(page);await lab.open();
  await expect.poll(async()=>(await lab.snapshot()).stats.calls).toBeGreaterThan(800);
  await page.getByRole('button',{name:'拆解 EXPLODE',exact:true}).click();
  await expect.poll(async()=>(await lab.snapshot()).state.explode).toBeGreaterThan(.95);
  await lab.specimen('bee');await lab.specimen('scorpion');
  expect(errors).toEqual([]);
});
