import { expect } from '@playwright/test';
export class LabPage {
  constructor(page) { this.page=page; }
  async open() {
    await this.page.goto('/');
    await expect.poll(()=>this.page.evaluate(()=>window.biomech?.state.ready)).toBe(true);
  }
  async specimen(name) {
    await this.page.locator(`[data-model="${name}"]`).click();
    await expect.poll(()=>this.page.evaluate(()=>[window.biomech.state.model,window.biomech.state.ready])).toEqual([name,true]);
  }
  async snapshot() { return this.page.evaluate(()=>({state:window.biomech.state,pose:window.biomech.pose,stats:window.biomech.stats})); }
  async pickCenter() {
    const canvas=this.page.getByRole('img',{name:'可拖动旋转、滚轮缩放的三维机械模型'});
    const bounds=await canvas.boundingBox();
    await canvas.click({position:{x:bounds.width*.5,y:bounds.height*.52}});
  }
  async seek(time) {
    await this.page.getByRole('slider',{name:'演示时间轴'}).fill(String(time));
    await expect.poll(()=>this.page.evaluate(()=>window.biomech.state.time)).toBe(time);
  }
}
