import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, waveSignal, tourAt, DURATION } from '../src/kinematics.js';

test('the lightweight waveform exactly matches the full mechanism through motion and teardown transitions',()=>{
  for(const model of ['scorpion','bee']) for(const mode of ['stand','walk','claw','tail','hover','flight','abdomen']) {
    for(const explode of [0,.12,.249,.25,.31,1]) for(const weights of [null,{walk:.37,claw:.61,tail:.24}]) {
      for(let t=-2;t<9;t+=.31) {
        const pose=solve(model,mode,t,1,explode,weights);
        const expected=model==='scorpion'?pose.legs[0].angle/.24:pose.wingAngle/.54;
        assert.equal(waveSignal(model,mode,t,explode,weights),expected);
      }
    }
  }
});

test('grip closes as jaw angle decreases; all sampled poses remain bounded',()=>{
  for(let t=0;t<30;t+=.05) {
    const s=solve('scorpion','claw',t);
    assert.ok(s.clawOpen>=0&&s.clawOpen<=1);
    assert.ok(Math.abs(s.grip/76+s.clawOpen-1)<1e-10);
    const bee=solve('bee','hover',t);
    assert.ok(Math.abs(bee.wingAngle)<=.54);
    assert.ok(Number.isFinite(bee.power)&&bee.power>=0);
  }
});
test('exploded mechanisms stop walking and flapping',()=>{
  assert.equal(solve('bee','flight',1,1,1).frequency,0);
  assert.equal(solve('scorpion','walk',1,1,1).frequency,0);
  assert.ok(solve('scorpion','walk',1).legs.every(l=>Number.isFinite(l.angle)));
});
test('the full tour dismantles and reassembles both specimens and loops cleanly',()=>{
  for(const model of ['bee','scorpion']) {
    assert.equal(tourAt(18,model).explode,1);
    assert.equal(tourAt(24,model).explode,0);
    assert.deepEqual(tourAt(0,model),tourAt(DURATION,model));
    for(let t=0;t<DURATION;t+=.1) assert.ok(tourAt(t,model).explode>=0&&tourAt(t,model).explode<=1);
  }
});
