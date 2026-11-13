import { expect } from '@playwright/test';
export class LabPage {
  constructor(page) { this.page=page; }
  async open() {
    await this.page.goto('/');
    await expect.poll(()=>this.page.evaluate(()=>window.biomech?.state.ready)).toBe(true);
  }
  async specimen(name) {
    await this.page.getByRole('button',{name:name==='bee'?/MELLIS/:/TELSON/}).click();
    await expect.poll(()=>this.page.evaluate(()=>[window.biomech.state.model,window.biomech.state.ready])).toEqual([name,true]);
  }
  async snapshot() { return this.page.evaluate(()=>({state:window.biomech.state,pose:window.biomech.pose,stats:window.biomech.stats})); }
  async seek(time) {
    await this.page.getByRole('slider',{name:'演示时间轴'}).fill(String(time));
    await expect.poll(()=>this.page.evaluate(()=>window.biomech.state.time)).toBe(time);
  }
}
