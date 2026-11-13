import { Vector3 } from 'three';
import { OCTOPUS_CONFIG as config } from './octopus-motion.js';

const Y=new Vector3(0,1,0);
export class OctopusRig {
  constructor(nodes) {
    this.nodes=nodes;
    this.axes=Array.from({length:8},(_,i)=>{
      const a=config.azimuthOffset+i*Math.PI/4;
      return new Vector3(-Math.sin(a),0,Math.cos(a));
    });
    this.mantleAxes=Array.from({length:8},(_,i)=>new Vector3(-Math.sin(i*Math.PI/4),0,Math.cos(i*Math.PI/4)));
    this.jetAxis=new Vector3(0,-.42,.91).normalize();
  }
  pose(pose) {
    const body=this.nodes.get('OC_body');
    body.rotation.x=pose.bodyPitch;body.rotation.z=pose.bodyRoll;
    for(const arm of pose.arms) {
      this.nodes.get(`OC_arm_${arm.id}`).rotateOnAxis(Y,arm.yaw);
      for(let j=0;j<arm.angles.length;j++)this.nodes.get(`OC_arm_${arm.id}_joint_${j}`).rotateOnAxis(this.axes[arm.id],arm.angles[j]);
    }
    for(let i=0;i<8;i++)this.nodes.get(`OC_mantle_petal_${i}`).rotateOnAxis(this.mantleAxes[i],-pose.mantleOpen*1.15-pose.explode*.9);
    this.nodes.get('OC_crown').position.y+=pose.mantleOpen*.75;
    this.nodes.get('OC_rotor').rotateOnAxis(Y,pose.pumpAngle);
    this.nodes.get('OC_jet_impeller').rotateOnAxis(this.jetAxis,pose.jetAngle);
    this.nodes.get('OC_beak_L').rotateOnAxis(Y,-pose.beakOpen);
    this.nodes.get('OC_beak_R').rotateOnAxis(Y,pose.beakOpen);
  }
  diagnostics() {
    const body=this.nodes.get('OC_body');body.updateWorldMatrix(true,true);
    return Array.from({length:8},(_,i)=>{
      const points=Array.from({length:12},(_,j)=>this.nodes.get(`OC_arm_${i}_joint_${j}`).getWorldPosition(new Vector3()));
      const tip=this.nodes.get(`OC_arm_${i}_tip`).getWorldPosition(new Vector3());points.push(tip);
      return {id:i,tip:tip.toArray(),lengths:points.slice(0,-1).map((point,j)=>point.distanceTo(points[j+1]))};
    });
  }
}
