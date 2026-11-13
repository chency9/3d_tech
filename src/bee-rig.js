import { Vector3 } from 'three';

const Z=new Vector3(0,0,1), X=new Vector3(1,0,0);

/** Rigid output pivots share their angles with the wing and leg instruments. */
export class BeeRig {
  constructor(nodes) { this.nodes=nodes; }
  pose(pose) {
    const body=this.nodes.get('HB_chassis');
    body.rotation.x=pose.bodyPitch;body.rotation.z=pose.bodyRoll;
    for(const [side,sign] of [['L',-1],['R',1]]) {
      this.nodes.get(`HB_drive_${side}`).rotateOnAxis(X,pose.driveAngle*sign);
      for(let i=0;i<2;i++) {
        const angle=pose.wingAngles[i]*sign;
        this.nodes.get(`HB_wing_${side}${i}`).rotateOnAxis(Z,angle);
        this.nodes.get(`HB_wing_crank_${side}${i}`).rotateOnAxis(Z,angle);
      }
      for(let i=0;i<3;i++) {
        const leg=pose.legs[i+(side==='R'?3:0)];
        this.nodes.get(`HB_leg_${side}${i}`).rotateOnAxis(Z,leg.angle*sign);
        this.nodes.get(`HB_tibia_${side}${i}`).rotateOnAxis(Z,leg.knee*sign);
        this.nodes.get(`HB_tarsus_${side}${i}`).rotateOnAxis(Z,leg.ankle*sign);
      }
      this.nodes.get(`HB_antenna_${sign}`).rotateOnAxis(Z,sign*pose.antennaAngle);
    }
    for(let i=0;i<7;i++)this.nodes.get(`HB_abdomen_ring_${i}`).position.z-=pose.abdomenOpen*i*.20;
    this.nodes.get('HB_abdomen_spring').scale.z=1+pose.abdomenOpen*1.15;
  }
}
