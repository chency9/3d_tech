import test from 'node:test';
import assert from 'node:assert/strict';
import { scorpionPose, footCycle, bodyToWorld, length, sub, SCORPION_CONFIG as cfg } from '../src/scorpion-motion.js';

test('eight IK chains preserve all three link lengths throughout the gait',()=>{
  for(let t=0;t<8;t+=.025){
    const p=scorpionPose(t,'walk');
    for(const leg of p.legs){
      assert.ok(Math.abs(length(sub(leg.coxa,leg.hip))-cfg.coxaLength)<1e-8);
      assert.ok(Math.abs(length(sub(leg.knee,leg.coxa))-cfg.femurLength)<1e-8);
      assert.ok(Math.abs(length(sub(leg.foot,leg.knee))-cfg.tibiaLength)<1e-8,`tibia stretched at ${t}`);
    }
  }
});

test('support feet stay at ground height despite body sway, with at least four contacts',()=>{
  for(let t=0;t<8;t+=.02){
    const p=scorpionPose(t,'walk');
    assert.ok(p.supportCount>=4,`insufficient support at ${t}`);
    for(const leg of p.legs){
      const foot=bodyToWorld(leg.foot,p.body);
      assert.ok(length(sub(foot,leg.worldFoot))<1e-9);
      assert.ok(foot[1]>=.105-1e-9,'foot penetrated ground');
      if(leg.contact)assert.ok(Math.abs(foot[1]-.105)<1e-9);
    }
  }
});

test('liftoff and touchdown have continuous position and velocity',()=>{
  const h=1e-6;
  for(const boundary of [cfg.dutyFactor,1]){
    const left=footCycle(boundary-h),center=footCycle(boundary),right=footCycle(boundary+h);
    assert.ok(Math.abs(left.travel-right.travel)<h*3);
    assert.ok(Math.abs((center.travel-left.travel)/h-(right.travel-center.travel)/h)<.001);
    assert.ok(Math.abs((center.height-left.height)/h-(right.height-center.height)/h)<.001);
  }
});

test('tail links move with distinct phase and the two claws are offset',()=>{
  const tail=scorpionPose(1.1,'tail');
  assert.ok(new Set(tail.tailAngles.map(a=>a.toFixed(5))).size>4);
  const claws=scorpionPose(1.1,'claw');
  assert.ok(Math.abs(claws.jaws[0]-claws.jaws[1])>.04);
});
