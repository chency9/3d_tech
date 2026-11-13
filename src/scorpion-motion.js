import config from './scorpion-config.json' with { type: 'json' };

export const SCORPION_CONFIG = config;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a,b,t) => a+(b-a)*t;
const ease = x => { const t=clamp(x);return t*t*t*(t*(t*6-15)+10); };
export const add = (a,b) => a.map((v,i)=>v+b[i]);
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const mul = (a,s) => a.map(v=>v*s);
export const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export const length = a => Math.hypot(...a);
export const norm = a => mul(a,1/Math.max(length(a),1e-9));
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const lerp = (a,b,t) => a.map((v,i)=>mix(v,b[i],t));

export function solveTwoBone(start,end,l1,l2,pole=[0,1,0]) {
  const d=sub(end,start), distance=clamp(length(d),Math.abs(l1-l2)+1e-6,l1+l2-1e-6), direction=norm(d);
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const perpendicular=norm(sub(pole,mul(direction,dot(pole,direction))));
  return add(start,add(mul(direction,along),mul(perpendicular,height)));
}

export function legIK(hip,foot) {
  const horizontal=norm([foot[0]-hip[0],0,foot[2]-hip[2]]);
  const coxa=add(hip,mul(horizontal,config.coxaLength));
  const knee=solveTwoBone(coxa,foot,config.femurLength,config.tibiaLength);
  return {hip,coxa,knee,foot,hinge:norm(cross([0,1,0],sub(foot,hip)))};
}
export const restLegs=config.legs.map(leg=>({...leg,...legIK(leg.hip,leg.foot)}));

// Rz(roll) * Rx(pitch), identical to the scene's chassis quaternion.
export function bodyToWorld(point,body) {
  const [x,y,z]=point,cp=Math.cos(body.pitch),sp=Math.sin(body.pitch),cr=Math.cos(body.roll),sr=Math.sin(body.roll);
  const yy=cp*y-sp*z;
  return add([cr*x-sr*yy,sr*x+cr*yy,sp*y+cp*z],body.position);
}
function worldToBody(point,body) {
  const [x,y,z]=sub(point,body.position),cp=Math.cos(body.pitch),sp=Math.sin(body.pitch),cr=Math.cos(body.roll),sr=Math.sin(body.roll);
  const xx=cr*x+sr*y,yy=-sr*x+cr*y;
  return [xx,cp*yy+sp*z,-sp*yy+cp*z];
}

// Stance has constant ground velocity. The fifth-order swing polynomial matches
// stance velocity and zero acceleration at both ends. Foot height and its first
// derivative are zero at touchdown/liftoff, avoiding the old pendulum movement.
export function footCycle(phase) {
  const p=((phase%1)+1)%1,duty=config.dutyFactor;
  if(p<duty)return {travel:config.stride*(.5-p/duty),height:0,contact:true,phase:p};
  const u=(p-duty)/(1-duty),velocity=config.stride/duty;
  const tangent=velocity*(1-duty);
  return {
    travel:-config.stride/2-tangent*u+(config.stride+tangent)*ease(u),
    height:config.stepHeight*16*u*u*(1-u)*(1-u),
    contact:false,phase:p,
  };
}

function jawCycle(time,offset) {
  const p=((time/5.2+offset)%1+1)%1;
  if(p<.34)return mix(.16,.93,ease(p/.34));
  if(p<.47)return .93;
  if(p<.78)return mix(.93,.07,ease((p-.47)/.31));
  return mix(.07,.16,ease((p-.78)/.22));
}

function gaitState(t,mode,explode,weights) {
  const activity=1-ease(explode/.32);
  const walk=(weights?.walk??(mode==='walk'?1:0))*activity;
  const phase=t*TAU*config.frequency;
  const body={
    position:[.028*Math.sin(phase)*walk,.010*Math.sin(t*1.35)*activity+.028*Math.cos(phase*2)*walk,0],
    pitch:.012*Math.sin(phase*2+.5)*walk,
    roll:.018*Math.sin(phase)*walk,
  };
  return {activity,walk,body};
}

function gaitFoot(t,leg,walk,body) {
  const cycle=footCycle(t*config.frequency+leg.phase);
  const worldFoot=add(leg.foot,[.045*Math.sin(Math.PI*cycle.phase)*walk*(cycle.contact?0:leg.side),cycle.height*walk,cycle.travel*walk]);
  const foot=worldToBody(worldFoot,body);
  const angle=Math.atan2(foot[2]-leg.hip[2],Math.abs(foot[0]-leg.hip[0]))-Math.atan2(leg.foot[2]-leg.hip[2],Math.abs(leg.foot[0]-leg.hip[0]));
  return {cycle,worldFoot,foot,angle};
}

// The chart needs one angle, not eight IK chains, hydraulic links and claws.
// Use the same body/foot equations as the full pose to keep the signal exact.
export function scorpionGaitAngle(t,mode,explode=0,weights=null) {
  const {walk,body}=gaitState(t,mode,explode,weights);
  return gaitFoot(t,restLegs[0],walk,body).angle;
}

export function scorpionPose(t,mode,explode=0,weights=null) {
  const {activity,walk,body}=gaitState(t,mode,explode,weights);
  const claw=(weights?.claw??(mode==='claw'?1:0))*activity;
  const tail=(weights?.tail??(mode==='tail'?1:0))*activity;
  const legs=restLegs.map((leg,i)=>{
    const {cycle,worldFoot,foot,angle}=gaitFoot(t,leg,walk,body);
    const solved=legIK(leg.hip,foot);
    const contact=walk<.01||cycle.contact;
    return {...solved,id:leg.id,worldFoot,contact,phase:cycle.phase,
      angle,
      load:Math.round(contact?36+13*Math.sin(Math.PI*clamp(cycle.phase/config.dutyFactor))*walk+3*(i%3):12+cycle.height*22),
    };
  });
  const tailAngles=Array.from({length:6},(_,i)=>activity*(.007*Math.sin(t*.85-i*.35)+tail*(.105*Math.sin(t*1.03-i*.43)+.026*Math.sin(t*2.06-i*.28))));
  const tailYaw=Array.from({length:6},(_,i)=>activity*(.004*Math.sin(t*.68-i*.24)+tail*.024*Math.sin(t*.75-i*.38)));
  const jaws=[0,.15].map(offset=>mix(.19,jawCycle(t,offset),claw)+.008*Math.sin(t*.8+offset*8)*activity*(1-claw));
  const arms=[-1,1].map((s,i)=>{
    const shoulder=[s*.60,1.26,1.18],restElbow=[s*1.17,1.09,1.94],restWrist=[s*1.39,.97,2.62];
    const wrist=add(restWrist,[s*.055*Math.sin(t*.65+i*.6)*activity,.025*Math.sin(t*.9+i)*activity+claw*.055,claw*.055*Math.sin(t*.8+i*.9)]);
    const elbow=solveTwoBone(shoulder,wrist,length(sub(restElbow,shoulder)),length(sub(restWrist,restElbow)),sub(restElbow,shoulder));
    return {id:i===0?'L':'R',shoulder,elbow,wrist,restElbow,restWrist,yaw:activity*.022*Math.sin(t*.7+i)};
  });
  const grip=76*(1-(jaws[0]+jaws[1])/2);
  return {body,legs,tailAngles,tailYaw,jaws,arms,grip,clawOpen:(jaws[0]+jaws[1])/2,
    tailFlex:tailAngles[2],tailAngle:140+tailAngles.reduce((s,a)=>s+a,0)*180/Math.PI,
    frequency:config.frequency*walk,walking:walk>.01,supportCount:legs.filter(l=>l.contact).length,
  };
}
