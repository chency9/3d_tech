import * as THREE from 'three';
import { restLegs, sub, add, mul, lerp, norm } from './scorpion-motion.js';

const vec = a => new THREE.Vector3(...a);
const up = new THREE.Vector3(0,1,0);
const xAxis = new THREE.Vector3(1,0,0);
const yAxis = new THREE.Vector3(0,1,0);

export class ScorpionRig {
  constructor(nodes) { this.nodes=nodes; }
  orient(name,start,end,restStart,restEnd,origin) {
    const n=this.nodes.get(name);if(!n)return;
    n.position.fromArray(sub(start,origin));
    n.quaternion.setFromUnitVectors(vec(norm(sub(restEnd,restStart))),vec(norm(sub(end,start))));
    n.quaternion.multiply(n.userData.baseQuaternion);
  }
  pose(pose) {
    const chassis=this.nodes.get('SC_chassis');
    chassis.position.fromArray(pose.body.position);
    chassis.quaternion.setFromEuler(new THREE.Euler(pose.body.pitch,0,pose.body.roll,'ZXY'));
    for(let i=0;i<restLegs.length;i++) {
      const rest=restLegs[i],leg=pose.legs[i],id=`SC_leg_${leg.id}`;
      this.orient(`${id}_coxa`,leg.hip,leg.coxa,rest.hip,rest.coxa,rest.hip);
      this.orient(`${id}_femur`,leg.coxa,leg.knee,rest.coxa,rest.knee,rest.hip);
      this.orient(`${id}_tibia`,leg.knee,leg.foot,rest.knee,rest.foot,rest.hip);
      const foot=this.nodes.get(`${id}_foot`);
      foot.position.fromArray(sub(leg.foot,rest.hip));
      foot.quaternion.copy(chassis.quaternion).invert();
      if(!leg.contact)foot.rotateOnAxis(xAxis,-.13*Math.sin(Math.PI*(leg.phase-.68)/.32)**2);
      const anchor=(a,b,t,hinge)=>add(lerp(a,b,t),mul(hinge,.22));
      const restA=anchor(rest.coxa,rest.knee,.35,rest.hinge),restB=anchor(rest.knee,rest.foot,.29,rest.hinge);
      const a=anchor(leg.coxa,leg.knee,.35,leg.hinge),b=anchor(leg.knee,leg.foot,.29,leg.hinge);
      this.orient(`${id}_ram`,a,b,restA,restB,rest.hip);
      const rod=this.nodes.get(`${id}_rod`);
      const oldLength=vec(sub(restB,restA)).length(),newLength=vec(sub(b,a)).length();
      rod.position.fromArray(mul(norm(sub(restB,restA)),newLength-oldLength));
      for(const [tag,position] of [['A',a],['B',b]]) {
        const clevis=this.nodes.get(`${id}_clevis${tag}`);
        if(clevis){clevis.position.fromArray(sub(position,rest.hip));clevis.quaternion.setFromUnitVectors(vec(rest.hinge),vec(leg.hinge));}
      }
    }
    for(const arm of pose.arms) {
      this.orient(`SC_arm_${arm.id}_upper`,arm.shoulder,arm.elbow,arm.shoulder,arm.restElbow,arm.shoulder);
      this.orient(`SC_arm_${arm.id}_lower`,arm.elbow,arm.wrist,arm.restElbow,arm.restWrist,arm.shoulder);
      const hand=this.nodes.get(`SC_hand_${arm.id}`);
      hand.position.fromArray(sub(arm.wrist,arm.shoulder));
      hand.rotateOnAxis(yAxis,arm.yaw);
      const opening=pose.jaws[arm.id==='L'?0:1];
      this.nodes.get(`SC_jaw_${arm.id}_a`)?.rotateOnAxis(yAxis,-opening*.38);
      this.nodes.get(`SC_jaw_${arm.id}_b`)?.rotateOnAxis(yAxis,opening*.38);
    }
    for(let i=0;i<6;i++) {
      const tail=this.nodes.get(`SC_tail_joint_${i}`);
      tail.rotateOnAxis(xAxis,pose.tailAngles[i]);
      tail.rotateOnAxis(up,pose.tailYaw[i]);
    }
    this.nodes.get('SC_head')?.rotateOnAxis(up,.025*Math.sin(pose.time*.65)*(1-pose.explode));
  }
  diagnostics() {
    const chassis=this.nodes.get('SC_chassis');
    chassis.updateWorldMatrix(true,true);
    return restLegs.map(leg=>{
      const n=this.nodes.get(`SC_leg_${leg.id}_foot`);
      return {id:leg.id,worldPosition:n.getWorldPosition(new THREE.Vector3()).toArray()};
    });
  }
}
