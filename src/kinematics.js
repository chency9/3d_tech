// The conceptual mechanism, its pose and its instruments share this state.
// Values describe this animation; they are not sensor measurements.
import { scorpionPose } from './scorpion-motion.js';
export const DURATION = 28;
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };

export const specimens = {
  scorpion: {
    name: 'Telson', code: 'SC-8', title: '八足仿生步行器', subtitle: 'OCTOPOD WALKER / FIELD SIMULATOR',
    file: 'telson-sc8.glb', legs: 8, id: 'SC8–0730',
    parts: [['all', '整机', 'ALL'], ['head', '传感头', 'HEAD'], ['claws', '双钳', 'CLAWS'], ['body', '机架', 'FRAME'], ['tail', '尾部', 'TAIL'], ['legs', '八足', 'LEGS'], ['armor', '装甲', 'ARMOR'], ['power', '动力舱', 'CORE']],
    modes: [['stand', '待机'], ['walk', '步行'], ['claw', '钳爪开合'], ['tail', '尾部运动']],
  },
  bee: {
    name: 'Mellis', code: 'HB-7', title: '扑翼仿生飞行器', subtitle: 'FLAPPING-WING DRONE / FIELD SIMULATOR',
    file: 'mellis-hb7.glb', legs: 6, id: 'HB7–0412',
    parts: [['all', '整机', 'ALL'], ['head', '光学头', 'OPTICS'], ['wings', '扑翼', 'WINGS'], ['body', '胸部', 'THORAX'], ['abdomen', '腹部', 'ABDOMEN'], ['legs', '六足', 'LEGS']],
    modes: [['stand', '待机'], ['hover', '悬停'], ['abdomen', '腹部展开'], ['flight', '振翅演示']],
  },
};

export function tourAt(time, model) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  if (t < 5) return { mode: model === 'bee' ? 'hover' : 'walk', part: 'all', explode: 0, chapter: '整体观察', stage: 0 };
  if (t < 10) return { mode: model === 'bee' ? 'abdomen' : 'claw', part: model === 'bee' ? 'abdomen' : 'claws', explode: 0, chapter: '功能机构', stage: 1 };
  if (t < 15) return { mode: model === 'bee' ? 'flight' : 'tail', part: model === 'bee' ? 'wings' : 'tail', explode: 0, chapter: '运动细节', stage: 2 };
  if (t < 21) return { mode: 'stand', part: 'all', explode: smooth((t - 15) / 2), chapter: '结构拆解', stage: 3 };
  if (t < 24) return { mode: 'stand', part: 'all', explode: 1 - smooth((t - 21) / 2.5), chapter: '重新组装', stage: 4 };
  return { mode: model === 'bee' ? 'hover' : 'walk', part: 'all', explode: 0, chapter: '运行演示', stage: 5 };
}

export function solve(model, mode, t, speed = 1, explode = 0, weights = null) {
  if(model==='scorpion') {
    const mechanism=scorpionPose(t,mode,explode,weights);
    return {...mechanism,time:t,mode,explode,displayFrequency:mechanism.frequency*speed,wingAngle:0,abdomenOpen:0,flying:false,lift:0,
      power:4.3+mechanism.frequency*10+mechanism.legs.reduce((n,l)=>n+Math.abs(l.angle),0)*3};
  }
  const phase = t * Math.PI * 2;
  const walking = mode === 'walk' && explode < .25;
  const flying = (mode === 'hover' || mode === 'flight') && explode < .25;
  const frequency = model === 'bee' ? (flying ? 7.5 : 0) : (walking ? 1.2 : 0);
  const wingAngle = flying ? Math.sin(phase * frequency) * .54 : .055;
  const clawOpen = mode === 'claw' ? .5 + .5 * Math.sin(phase * .32) : .20;
  const tailFlex = mode === 'tail' ? Math.sin(phase * .18) * .13 : 0;
  const abdomenOpen = mode === 'abdomen' ? .45 + .25 * Math.sin(phase * .23) : 0;
  const legs = Array.from({ length: specimens[model].legs }, (_, i) => {
    const angle = walking ? Math.sin(phase * frequency + (i % 2) * Math.PI) * .24 : 0;
    return { angle, load: Math.round(32 + Math.abs(angle) * 120 + (i % 3) * 4), contact: angle <= .08 };
  });
  return {
    time: t, mode, explode, frequency, displayFrequency: frequency * speed, wingAngle,
    clawOpen, grip: 76 * (1 - clawOpen), tailFlex, tailAngle: 140 + tailFlex * 180 / Math.PI * 4,
    abdomenOpen, legs, flying, walking,
    lift: flying ? .10 * Math.sin(phase * .45) + .25 : 0,
    power: flying ? 18 + 9 * Math.abs(wingAngle) / .54 : walking ? 10 + legs.reduce((n,l) => n + Math.abs(l.angle), 0) * 3 : 4.3,
  };
}
