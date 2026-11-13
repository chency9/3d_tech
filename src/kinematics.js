// The conceptual mechanism, its pose and its instruments share this state.
// Values describe this animation; they are not sensor measurements.
import { scorpionPose, scorpionGaitAngle } from './scorpion-motion.js';
import { octopusPose, octopusPressure } from './octopus-motion.js';
export const DURATION = 28;
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };

export const specimens = {
  octopus: {
    name:'Pelagos',code:'OC-8',title:'八腕仿生深潜器',subtitle:'SOFT-ARM MANIPULATOR / FIELD SIMULATOR',
    file:'pelagos-oc8.glb',legs:8,id:'OC8–0731',
    parts:[['all','整机','ALL'],['optics','光学眼','OPTICS'],['mantle','外套膜','MANTLE'],['arms','八腕','ARMS'],['arm2','腕足 R2','ARM R2'],['core','泵组','PUMP'],['siphon','喷口','SIPHON'],['beak','喙部','BEAK']],
    modes:[['stand','悬停'],['swim','游动'],['coil','卷腕'],['mantle','开壳'],['jet','喷射']],
  },
  scorpion: {
    name: 'Telson', code: 'SC-8', title: '八足仿生步行器', subtitle: 'OCTOPOD WALKER / FIELD SIMULATOR',
    file: 'telson-sc8.glb', legs: 8, id: 'SC8–0730',
    parts: [['all', '整机', 'ALL'], ['head', '传感头', 'HEAD'], ['claws', '双钳', 'CLAWS'], ['body', '机架', 'FRAME'], ['tail', '尾部', 'TAIL'], ['legs', '八足', 'LEGS'], ['armor', '装甲', 'ARMOR'], ['power', '动力舱', 'CORE']],
    modes: [['stand', '待机'], ['walk', '步行'], ['claw', '钳爪开合'], ['tail', '尾部运动']],
  },
  bee: {
    name: 'Mellis', code: 'HB-7', title: '扑翼仿生飞行器', subtitle: 'FLAPPING-WING DRONE / FIELD SIMULATOR',
    file: 'mellis-hb7.glb', legs: 6, id: 'HB7–0412',
    parts: [['all', '整机', 'ALL'], ['head', '光学头', 'OPTICS'], ['wings', '扑翼', 'WINGS'], ['body', '胸部', 'THORAX'], ['motor', '传动', 'DRIVE'], ['abdomen', '腹部', 'ABDOMEN'], ['legs', '六足', 'LEGS']],
    modes: [['stand', '待机'], ['hover', '悬停'], ['abdomen', '腹部展开'], ['flight', '振翅演示']],
  },
};

export function tourAt(time, model) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  if(model==='octopus') {
    if(t<5)return {mode:'swim',part:'all',explode:0,chapter:'八腕巡航',stage:0};
    if(t<10)return {mode:'mantle',part:'all',explode:0,chapter:'外套膜展开',stage:1};
    if(t<15)return {mode:'coil',part:'arm2',explode:0,chapter:'腕足卷曲',stage:2};
    if(t<21)return {mode:'stand',part:'all',explode:smooth((t-15)/2),chapter:'结构拆解',stage:3};
    if(t<24)return {mode:'stand',part:'all',explode:1-smooth((t-21)/2.5),chapter:'重新组装',stage:4};
    return {mode:'jet',part:'all',explode:0,chapter:'喷流推进',stage:5};
  }
  if (t < 5) return { mode: model === 'bee' ? 'hover' : 'walk', part: 'all', explode: 0, chapter: '整体观察', stage: 0 };
  if (t < 10) return { mode: model === 'bee' ? 'abdomen' : 'claw', part: model === 'bee' ? 'abdomen' : 'claws', explode: 0, chapter: '功能机构', stage: 1 };
  if (t < 15) return { mode: model === 'bee' ? 'flight' : 'tail', part: model === 'bee' ? 'wings' : 'tail', explode: 0, chapter: '运动细节', stage: 2 };
  if (t < 21) return { mode: 'stand', part: 'all', explode: smooth((t - 15) / 2), chapter: '结构拆解', stage: 3 };
  if (t < 24) return { mode: 'stand', part: 'all', explode: 1 - smooth((t - 21) / 2.5), chapter: '重新组装', stage: 4 };
  return { mode: model === 'bee' ? 'hover' : 'walk', part: 'all', explode: 0, chapter: '运行演示', stage: 5 };
}

const beeActivity = (mode,explode,weights) => clamp(weights?.hover ?? (mode==='hover'?1:0))*(1-smooth(explode/.25)) + clamp(weights?.flight ?? (mode==='flight'?1:0))*(1-smooth(explode/.25));
const beeWingAngle = (mode,t,explode,weights) => {
  const activity=clamp(beeActivity(mode,explode,weights));
  return Math.sin(t*Math.PI*2*7.5)*.54*activity+.055*(1-activity);
};

export function waveSignal(model,mode,t,explode=0,weights=null) {
  if(model==='octopus')return (octopusPressure(t,mode,explode,weights)-17)/20;
  return model==='scorpion' ? scorpionGaitAngle(t,mode,explode,weights)/.24 : beeWingAngle(mode,t,explode,weights)/.54;
}

export function solve(model, mode, t, speed = 1, explode = 0, weights = null) {
  if(model==='octopus')return octopusPose(t,mode,explode,weights);
  if(model==='scorpion') {
    const mechanism=scorpionPose(t,mode,explode,weights);
    return {...mechanism,time:t,mode,explode,displayFrequency:mechanism.frequency*speed,wingAngle:0,abdomenOpen:0,flying:false,lift:0,
      power:4.3+mechanism.frequency*10+mechanism.legs.reduce((n,l)=>n+Math.abs(l.angle),0)*3};
  }
  const phase = t * Math.PI * 2;
  const activity=clamp(beeActivity(mode,explode,weights));
  const frequency=7.5*activity;
  const wingAngle=beeWingAngle(mode,t,explode,weights);
  const abdomenWeight=weights?.abdomen ?? (mode==='abdomen'?1:0);
  const abdomenOpen=(.45+.25*Math.sin(phase*.23))*abdomenWeight;
  const legs=Array.from({length:6},(_,i)=>{
    const fold=activity*(.19+.025*Math.sin(phase*.45+i*.6));
    return {angle:fold,knee:-fold*1.7,ankle:fold*.6,load:Math.round(32+fold*120+(i%3)*4),contact:activity<.1};
  });
  return {
    time:t,mode,explode,frequency,displayFrequency:frequency*speed,wingAngle,
    wingAngles:[wingAngle,Math.sin(phase*7.5-.16)*.43*activity+.044*(1-activity)],
    driveAngle:wingAngle*1.6,bodyPitch:activity*.025*Math.sin(phase*.45),bodyRoll:activity*.02*Math.sin(phase*.32),
    antennaAngle:.035*Math.sin(phase*.4)*activity,
    clawOpen:.2,grip:60.8,tailFlex:0,tailAngle:140,abdomenOpen,legs,flying:activity>.01,walking:false,
    lift:activity*(.10*Math.sin(phase*.45)+.25),
    power:4.3+activity*(13.7+9*Math.abs(wingAngle)/.54),
  };
}
