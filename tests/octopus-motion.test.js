import test from 'node:test';
import assert from 'node:assert/strict';
import { solve,waveSignal,tourAt,DURATION } from '../src/kinematics.js';
import { OCTOPUS_CONFIG as config } from '../src/octopus-motion.js';

test('all 96 arm hinges stay finite and the wave travels down independent arms',()=>{
  for(const mode of ['stand','swim','coil','mantle','jet'])for(let t=0;t<30;t+=.17) {
    const pose=solve('octopus',mode,t);
    assert.equal(pose.arms.length,8);
    for(const arm of pose.arms) {
      assert.equal(arm.angles.length,12);
      assert.ok(arm.angles.every(a=>Number.isFinite(a)&&Math.abs(a)<1.1));
      assert.ok(arm.load>=0&&arm.load<=100);
    }
    assert.equal(waveSignal('octopus',mode,t),(pose.pressure-17)/20);
    assert.ok(pose.thrust>0&&pose.depth>0);
  }
  const swim=solve('octopus','swim',1);
  assert.notDeepEqual(swim.arms[0].angles,swim.arms[1].angles);
  assert.ok(solve('octopus','coil',1).arms[1].curl>swim.arms[1].curl);
  assert.equal(config.segmentLengths.length,12);
});

test('octopus teardown disables pumping motion amplitudes and all tour stages reassemble',()=>{
  for(const mode of ['stand','swim','coil','mantle','jet']) {
    const pose=solve('octopus',mode,2,1,1);
    assert.equal(pose.mantleOpen,0);
    assert.equal(pose.frequency,0);
    assert.equal(pose.pressure,17);
  }
  assert.equal(tourAt(18,'octopus').explode,1);
  assert.equal(tourAt(24,'octopus').explode,0);
  assert.deepEqual(tourAt(0,'octopus'),tourAt(DURATION,'octopus'));
});
