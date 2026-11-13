import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/orbitron/latin-500.css';
import '@fontsource/orbitron/latin-600.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import './style.css';
import { specimens, DURATION, solve, tourAt, clamp } from './kinematics.js';
import { SpecimenStage } from './stage.js';

const icon = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><ellipse cx="24" cy="24" rx="6" ry="11"/><path d="m18 19-8-7m8 12-10 1m10 4-8 8m20-18 8-7m-8 12 10 1m-10 4 8 8M21 13l-4-6m10 6 4-6M24 35v7"/><circle cx="24" cy="22" r="2"/></svg>`;
const waveSVG = '<svg class="wave-chart" viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0 23H200 M50 0V46 M100 0V46 M150 0V46" class="chart-grid"/><path id="wave" d="M0 23H200"/></svg>';
document.querySelector('#app').innerHTML = `
<header class="masthead">
  <a class="brand" href="./" aria-label="仿生机械实验室首页"><span class="brand-mark">${icon}</span><span><b>BIOMECH<span class="brand-slash"> / </span></b><small>FIELD RESEARCH LABORATORY</small></span></a>
  <nav class="specimen-switch" aria-label="选择机械模型">
    <button data-model="scorpion" aria-pressed="true"><span class="specimen-number">01</span><strong>TELSON</strong><span>SC-8</span></button>
    <button data-model="bee" aria-pressed="false"><span class="specimen-number">02</span><strong>MELLIS</strong><span>HB-7</span></button>
  </nav>
  <div class="lab-status"><span class="status-dot"></span><span>系统在线<small>SIMULATION ACTIVE</small></span><span class="lab-bay">LAB / 02</span></div>
</header>
<main class="workspace">
  <div id="stage" class="stage"><div class="loading" role="status" data-phase="download"><span class="loading-spinner"></span><span class="loading-kicker">BIOMECH / SPECIMEN LOADER</span><b id="loading-title">正在下载机械标本</b><div class="loading-metrics"><span id="loading-detail">准备下载</span><strong id="loading-percent">0%</strong></div><progress id="loading-progress" max="100" value="0" aria-label="模型下载进度"></progress><ol class="loading-steps" aria-label="模型加载阶段"><li>01 下载模型</li><li>02 解析结构</li><li>03 准备渲染</li></ol><button id="retry" hidden>重新加载</button></div></div>
  <section class="specimen-heading" aria-label="模型信息">
    <div class="eyebrow"><span class="orange-tick"></span> BIOMIMETIC ROBOTICS <span class="heading-index">SPECIMEN / <span id="specimen-index">001</span></span></div>
    <h1><span id="model-name">Telson</span> <span id="model-code">SC-8</span><span class="title-period">.</span></h1>
    <p><span id="model-title">八足仿生步行器</span><span class="heading-divider">/</span><span id="model-subtitle">OCTOPOD WALKER</span></p>
  </section>
  <div class="specimen-meta"><span>SPECIMEN ID<b id="serial">SC8–0730</b></span><span>OPERATOR<b>RESEARCH / YOU</b></span><button id="help" aria-label="操作说明">?</button></div>
  <aside class="panel-column left-panels" aria-label="实时仿真仪表">
    <section class="instrument frequency-panel"><div class="panel-heading"><h2 id="frequency-heading">步态频率 <span>/ GAIT</span></h2><span>01</span></div><div class="reading"><strong id="frequency">0.0</strong><span>Hz</span><em id="frequency-mode">STANDBY</em></div><div class="micro-label" id="frequency-label">STRIDE FREQUENCY</div>${waveSVG}<div class="chart-caption"><span>相位同步</span><span id="phase">φ 000°</span></div></section>
    <section class="instrument"><div class="panel-heading"><h2 id="secondary-heading">尾部角度 <span>/ TAIL</span></h2><span>02</span></div><div class="gauge-layout"><div><div class="reading"><strong id="secondary">140</strong><span id="secondary-unit">°</span></div><div class="micro-label" id="secondary-label">STRIKE ANGLE</div></div><svg viewBox="0 0 90 65" class="dial" aria-hidden="true"><path d="M12 56A33 33 0 1 1 78 56" class="dial-track"/><path d="M12 56A33 33 0 1 1 78 56" class="dial-accent"/><g id="needle"><path d="M45 43L67 22"/><circle cx="45" cy="43" r="3"/></g><text x="8" y="64">0</text><text x="66" y="64">180</text></svg></div><div class="mini-data"><span id="secondary-info-label">姿态状态</span><b id="secondary-info">LOCKED</b></div></section>
    <section class="instrument servo-panel"><div class="panel-heading"><h2>关节伺服 <span>/ SERVOS</span></h2><span>03</span></div><div class="servo-caption"><span>ACTUATOR</span><span>LOAD / %</span></div><div id="servo-bars"></div><div class="panel-foot"><span class="status-dot"></span><span id="servo-status">8 个执行器就绪</span></div></section>
    <div class="simulation-note"><span>◇</span> 概念机械 · 演示仿真<small>POSE-DRIVEN TELEMETRY</small></div>
  </aside>
  <aside class="panel-column right-panels" aria-label="模型控制">
    <section class="instrument power-panel"><div class="panel-heading"><h2 id="output-heading">钳爪握力 <span>/ GRIP</span></h2><span>04</span></div><div class="reading"><strong id="output">61</strong><span id="output-unit">N</span><span class="tiny-wave">⌁⌁⌁</span></div><div class="meter-track"><i id="output-bar"></i></div><div class="mini-data"><span id="output-caption">CHELA / OPENING</span><b id="opening">20%</b></div></section>
    <section class="instrument"><div class="panel-heading"><h2>部件选择 <span>/ ASSEMBLIES</span></h2><span>05</span></div><div id="parts" class="button-grid parts-grid"></div><p class="control-hint">选择部件，查看内部结构</p></section>
    <section class="instrument"><div class="panel-heading"><h2>显示模式 <span>/ DISPLAY</span></h2><span>06</span></div><div class="button-grid display-grid"><button id="labels" aria-pressed="true">标注 <small>LABELS</small></button><button id="explode" aria-pressed="false">拆解 <small>EXPLODE</small></button><button id="wireframe" aria-pressed="false">线框 <small>WIRE</small></button><button id="turntable" aria-pressed="false">旋转 <small>ROTATE</small></button></div><div class="explode-control"><label for="explode-range">拆解程度</label><output id="explode-value">0%</output></div><input id="explode-range" type="range" min="0" max="100" step="1" value="0" aria-label="拆解程度"/></section>
    <section class="instrument motion-panel"><div class="panel-heading"><h2>动作控制 <span>/ MOTION</span></h2><span>07</span></div><div id="modes" class="button-grid motion-grid"></div><div class="mini-data speed-control"><label for="speed">播放速度</label><select id="speed" aria-label="播放速度"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1.0×</option><option value="1.5">1.5×</option></select></div></section>
  </aside>
  <div class="model-state"><div class="micro-label">OPERATING MODE <span id="mode-index">/ 01</span></div><strong id="operating-mode">STANDING</strong><span id="operating-description">待机姿态 · 全部机构就绪</span></div>
  <div class="viewport-tools"><div class="view-buttons" role="group" aria-label="相机视角"><button data-view="iso" aria-pressed="true">透视</button><button data-view="front" aria-pressed="false">正视</button><button data-view="side" aria-pressed="false">侧视</button><button data-view="top" aria-pressed="false">俯视</button><button data-view="detail" aria-pressed="false">特写</button></div><span class="orbit-hint">拖动旋转 <i>·</i> 滚轮缩放</span><button id="reset" title="重置模型和相机" aria-label="重置模型和相机">↺ <span>重置</span></button></div>
  <section class="transport" aria-label="演示播放控制"><div class="transport-title"><span class="orange-tick"></span><b>演示记录</b><small>OPERATION LOG</small><span id="chapter">整体观察</span></div><div class="transport-main"><button id="play" class="play-button" aria-label="暂停演示">Ⅱ</button><span id="current-time">00:00</span><div class="timeline-wrap"><input id="timeline" type="range" min="0" max="28" step="0.05" value="0" aria-label="演示时间轴"/><div class="timeline-chapters"><span>整体观察</span><span>功能机构</span><span>运动细节</span><span>结构拆解</span><span>重组</span></div></div><span class="end-time">00:28</span><button id="tour" aria-pressed="true"><span class="tour-light"></span>自动演示</button></div></section>
</main>
<footer class="statusbar"><span>FIELD SIMULATOR <i>/</i> REV. 01</span><span id="anatomy">8 LEGS <i>·</i> 2 CLAWS <i>·</i> 6 TAIL LINKS</span><span class="footer-right"><span id="render-status">INITIALIZING</span><i>/</i> BIOMECH LAB <span class="orange-slashes">/////</span></span></footer>
<dialog id="help-dialog"><button id="close-help" aria-label="关闭说明">×</button><span class="eyebrow">FIELD GUIDE / 操作说明</span><h2>探索一台仿生机械。</h2><p>拖动模型旋转，滚轮缩放。点击模型或右侧部件按钮，聚焦对应机构；点击「拆解」展开结构。</p><dl><dt>空格</dt><dd>播放 / 暂停</dd><dt>E</dt><dd>拆解 / 组装</dd><dt>L</dt><dd>显示 / 隐藏标注</dd><dt>R</dt><dd>重置模型与视角</dd></dl><p class="dialog-note">机械结构参考演示动图重建。仪表数值来自当前动作模型，为概念仿真数据。</p></dialog>
`;

const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={model:'scorpion',mode:'stand',part:'all',time:0,simulationTime:0,playing:!reduced,tour:!reduced,speed:1,explode:0,targetExplode:0,ready:false,lastInput:performance.now(),labels:true,wireframe:false,turntable:false};
let stage, loadAttempt=0, last=performance.now(), lastHUD=0, frames=0, fps=0, fpsAt=last;
const motionWeights={walk:0,claw:0,tail:0};
const currentPose=()=>solve(state.model,state.mode,state.simulationTime,state.speed,state.explode,motionWeights);
const modeLabels={stand:['STANDING','待机姿态 · 全部机构就绪'],walk:['WALKING','交替步态 · 足端接地 / 关节联动'],claw:['CLAW OPEN','双钳开合 · 抓握机构演示'],tail:['TAIL ACTIVE','尾部运动 · 关节链协同'],hover:['HOVER','悬停姿态 · 扑翼机构运行'],flight:['WING BEAT','振翅演示 · 翼根关节驱动'],abdomen:['ABDOMEN OPEN','腹部展开 · 检查分段结构']};
const touch=()=>{state.lastInput=performance.now();};
function manual() { touch(); state.tour=false; $('tour').setAttribute('aria-pressed','false'); }
function press(id,on){$(id).setAttribute('aria-pressed',String(on));}

function setPart(part,fromTour=false) {
  if(!fromTour) manual();
  state.part=part;
  stage?.setSelection(part);
  document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===part)));
}
function setMode(mode,fromTour=false) {
  if(!fromTour) { manual(); state.targetExplode=0; state.playing=true; }
  state.mode=mode;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  updatePlay();
}
function updatePlay() { $('play').textContent=state.playing?'Ⅱ':'▶'; $('play').setAttribute('aria-label',state.playing?'暂停演示':'播放演示'); }
function setExplode(value) {
  manual(); state.targetExplode=clamp(value); if(value>0) setPart('all');
  press('explode',value>.01);
  $('explode-range').value=String(Math.round(value*100));
}

function renderControls() {
  const cfg=specimens[state.model], bee=state.model==='bee';
  $('parts').dataset.specimen=state.model;
  $('parts').innerHTML=cfg.parts.map(([key,label,en])=>`<button data-part="${key}" aria-pressed="${key==='all'}">${label}<small>${en}</small></button>`).join('');
  $('modes').innerHTML=cfg.modes.map(([key,label])=>`<button data-mode="${key}" aria-pressed="${key===state.mode}">${label}</button>`).join('');
  $('servo-bars').innerHTML=Array.from({length:cfg.legs},(_,i)=>`<div class="servo-row"><span>${i<cfg.legs/2?'L':'R'}${i%(cfg.legs/2)+1}</span><div class="servo-track"><i id="servo-${i}"></i></div><span id="load-${i}">32%</span></div>`).join('');
  $('servo-status').textContent=`${cfg.legs} 个执行器就绪`;
  $('model-name').textContent=cfg.name;
  $('model-code').textContent=cfg.code;
  $('model-title').textContent=cfg.title;
  $('model-subtitle').textContent=bee?'FLAPPING-WING DRONE':'OCTOPOD WALKER';
  $('specimen-index').textContent=bee?'002':'001';
  $('serial').textContent=cfg.id;
  $('frequency-heading').innerHTML=bee?'振翅频率 <span>/ WING BEAT</span>':'步态频率 <span>/ GAIT</span>';
  $('frequency-label').textContent=bee?'WING FREQUENCY':'STRIDE FREQUENCY';
  $('secondary-heading').innerHTML=bee?'扑翼幅度 <span>/ AMPLITUDE</span>':'尾部角度 <span>/ TAIL</span>';
  $('secondary-label').textContent=bee?'WING DEFLECTION':'STRIKE ANGLE';
  $('output-heading').innerHTML=bee?'运行功率 <span>/ POWER</span>':'钳爪握力 <span>/ GRIP</span>';
  $('output-unit').textContent=bee?'W':'N';
  $('output-caption').textContent=bee?'WING / DEFLECTION':'CHELA / OPENING';
  $('anatomy').innerHTML=bee?'6 LEGS <i>·</i> 4 WINGS <i>·</i> 2 OPTICS':'8 LEGS <i>·</i> 2 CLAWS <i>·</i> 6 TAIL LINKS';
  document.querySelectorAll('[data-model]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.model===state.model)));
  document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>setPart(b.dataset.part));
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
}

function showLoading({ phase, loaded = 0, total = 0, local = false }) {
  document.querySelector('.loading').dataset.phase = phase;
  const progress = $('loading-progress');
  if (phase === 'download') {
    $('loading-title').textContent = local ? '正在读取本地标本' : '正在下载机械标本';
    const mb = bytes => (bytes / 1024 / 1024).toFixed(1);
    $('loading-detail').textContent = local ? '读取本地模型文件' : total ? `${mb(loaded)} / ${mb(total)} MB` : `${mb(loaded)} MB 已下载`;
    if (total && !local) {
      const percent = Math.min(100, Math.floor(loaded / total * 100));
      progress.value = percent;
      $('loading-percent').textContent = `${percent}%`;
    } else {
      progress.removeAttribute('value');
      $('loading-percent').textContent = local ? '读取中' : '下载中';
    }
  } else {
    progress.removeAttribute('value');
    $('loading-percent').textContent = phase === 'ready' ? '就绪' : '处理中';
    $('loading-title').textContent = phase === 'render' ? '正在准备渲染' : '正在解析机械结构';
    $('loading-detail').textContent = phase === 'render' ? '准备材质、灯光与关节' : '下载完成，正在组装部件';
  }
}

async function selectModel(model) {
  const attempt=++loadAttempt;
  state.ready=false; state.model=model; state.time=0; state.simulationTime=0; state.mode='stand';state.part='all';state.explode=0;state.targetExplode=0;
  Object.keys(motionWeights).forEach(key=>motionWeights[key]=0);
  $('stage').classList.add('is-loading');
  document.querySelector('.loading').hidden=false;
  showLoading({ phase: 'download' }); $('retry').hidden=true;
  renderControls();
  try {
    const loaded=await stage.load(model,progress=>{if(attempt===loadAttempt)showLoading(progress);});
    if(!loaded||attempt!==loadAttempt)return;
    state.ready=true;
    document.querySelector('.loading').hidden=true;
    $('stage').classList.remove('is-loading');
    $('render-status').textContent='WEBGL / READY';
    updateHUD(currentPose());
    last=performance.now();
  } catch(error) {
    if(attempt!==loadAttempt)return;
    console.error(error);
    $('loading-title').textContent='模型加载失败';
    $('loading-detail').textContent='请检查网络连接或模型文件，然后重试';
    document.querySelector('.loading').dataset.phase='error';
    $('loading-progress').value=0;
    $('loading-percent').textContent='已中断';
    $('retry').hidden=false;
    $('render-status').textContent='MODEL / UNAVAILABLE';
  }
}

document.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>{touch();selectModel(b.dataset.model);});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
  manual();stage.view(b.dataset.view);document.querySelectorAll('[data-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));
});
$('labels').onclick=()=>{manual();state.labels=!state.labels;stage.labelVisible=state.labels;press('labels',state.labels);};
$('wireframe').onclick=()=>{manual();state.wireframe=!state.wireframe;stage.setWireframe(state.wireframe);press('wireframe',state.wireframe);};
$('turntable').onclick=()=>{manual();state.turntable=!state.turntable;stage.turntable=state.turntable;press('turntable',state.turntable);};
$('explode').onclick=()=>setExplode(state.targetExplode>.5?0:1);
$('explode-range').oninput=e=>setExplode(Number(e.target.value)/100);
$('speed').onchange=e=>{manual();state.speed=Number(e.target.value);};
$('play').onclick=()=>{touch();state.playing=!state.playing;updatePlay();};
$('tour').onclick=()=>{touch();state.tour=!state.tour;if(state.tour){state.playing=true;state.turntable=false;stage.turntable=false;press('turntable',false);}press('tour',state.tour);updatePlay();};
$('timeline').oninput=e=>{
  touch();state.time=Number(e.target.value);state.simulationTime=state.time;state.tour=true;state.playing=false;
  const cue=tourAt(state.time,state.model);
  setPart(cue.part,true);setMode(cue.mode,true);state.targetExplode=cue.explode;
  Object.keys(motionWeights).forEach(key=>motionWeights[key]=state.mode===key?1:0);
  press('tour',true);updatePlay();updateHUD(currentPose());
};
$('reset').onclick=()=>{
  manual();state.mode='stand';state.time=0;state.simulationTime=0;state.explode=0;state.targetExplode=0;state.turntable=false;state.wireframe=false;state.labels=true;state.speed=1;
  stage.turntable=false;stage.labelVisible=true;stage.setWireframe(false);stage.current.root.rotation.y=0;
  setPart('all');setMode('stand');stage.view('iso');
  ['explode','turntable','wireframe'].forEach(id=>press(id,false));press('labels',true);$('speed').value='1';
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view==='iso')));
};
$('retry').onclick=()=>selectModel(state.model);
$('help').onclick=()=>{manual();$('help-dialog').showModal();};
$('close-help').onclick=()=>$('help-dialog').close();
window.addEventListener('keydown',e=>{
  if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.altKey||e.ctrlKey||e.metaKey||$('help-dialog').open)return;
  if(e.code==='Space'){e.preventDefault();$('play').click();}
  if(e.key.toLowerCase()==='e')$('explode').click();
  if(e.key.toLowerCase()==='l')$('labels').click();
  if(e.key.toLowerCase()==='r')$('reset').click();
});
document.addEventListener('visibilitychange',()=>{last=performance.now();});

function updateHUD(pose) {
  const bee=state.model==='bee';
  $('frequency').textContent=pose.displayFrequency.toFixed(1);
  $('frequency-mode').textContent=pose.frequency>.01?'ACTIVE':'STANDBY';
  $('phase').textContent=`φ ${String(Math.floor(state.simulationTime*360%360)).padStart(3,'0')}°`;
  $('secondary').textContent=bee?`${Math.abs(pose.wingAngle*180/Math.PI).toFixed(0)}`:pose.tailAngle.toFixed(0);
  $('secondary-info').textContent=bee?(pose.flying?'FLAPPING':'FOLDED'):Math.abs(pose.tailFlex)>.001?'ACTIVE':'LOCKED';
  $('needle').style.transform=`rotate(${bee?Math.abs(pose.wingAngle)*90-60:pose.tailAngle-140}deg)`;
  $('output').textContent=bee?pose.power.toFixed(1):pose.grip.toFixed(0);
  $('opening').textContent=bee?`${(pose.wingAngle*180/Math.PI).toFixed(0)}°`:`${(pose.clawOpen*100).toFixed(0)}%`;
  $('output-bar').style.width=`${bee?pose.power/30*100:pose.grip/76*100}%`;
  pose.legs.forEach((leg,i)=>{$(`servo-${i}`).style.width=`${leg.load}%`;$(`servo-${i}`).classList.toggle('active',!leg.contact);$(`load-${i}`).textContent=`${leg.load}%`;});
  if(!bee)$('servo-status').textContent=`${pose.supportCount} 足支撑 · ${8-pose.supportCount} 足摆动`;
  const wave=Array.from({length:80},(_,i)=>{
    const t=state.simulationTime-(79-i)/35;
    const p=solve(state.model,state.mode,t,state.speed,state.explode,motionWeights);
    const value=bee?p.wingAngle/.54:p.legs[0].angle/.24;
    return `${i?'L':'M'}${(i/79*200).toFixed(1)} ${(23-value*16).toFixed(1)}`;
  }).join(' ');
  $('wave').setAttribute('d',wave);
  const [label,description]=state.explode>.1?['TEARDOWN','结构拆解 · 各机构沿装配方向分离']:modeLabels[state.mode];
  $('operating-mode').textContent=label;
  $('operating-description').textContent=description;
  $('current-time').textContent=`00:${Math.floor(state.time).toString().padStart(2,'0')}`;
  $('timeline').value=String(state.time);
  $('timeline').style.setProperty('--progress',`${state.time/DURATION*100}%`);
  $('explode-range').value=String(Math.round(state.targetExplode*100));
  $('explode-value').textContent=`${Math.round(state.explode*100)}%`;
  press('explode',state.targetExplode>.01);
  $('chapter').textContent=state.tour?tourAt(state.time,state.model).chapter:'手动探索';
  $('render-status').textContent=`WEBGL / ${fps} FPS`;
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.06);last=now;
  if(document.hidden||!stage)return;
  frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;}
  if(state.ready) {
    if(!reduced&&!state.tour&&state.playing&&now-state.lastInput>25000&&!$('help-dialog').open){state.tour=true;press('tour',true);}
    if(state.playing){state.simulationTime+=dt*state.speed;state.time=(state.time+dt*state.speed)%DURATION;}
    if(state.tour){const cue=tourAt(state.time,state.model);if(cue.part!==state.part)setPart(cue.part,true);if(cue.mode!==state.mode)setMode(cue.mode,true);state.targetExplode=cue.explode;}
    state.explode+=(state.targetExplode-state.explode)*(1-Math.exp(-dt*6));
    for(const key of Object.keys(motionWeights))motionWeights[key]+=((state.mode===key?1:0)-motionWeights[key])*(1-Math.exp(-dt*4.5));
    const pose=currentPose();
    stage.frame(pose,dt,state.simulationTime,state.tour&&state.playing,state.playing);
    if(now-lastHUD>90){updateHUD(pose);lastHUD=now;}
  } else if(!stage.current) stage.frame(null,0,0,false);
}

try {
  stage=new SpecimenStage($('stage'),part=>setPart(part),manual);
  selectModel('scorpion');
  requestAnimationFrame(animate);
} catch(error) {
  console.error(error);$('loading-title').textContent='无法启动三维显示';$('loading-detail').textContent='请启用浏览器硬件加速，或使用支持 WebGL 2 的浏览器';
}
updatePlay();

// A read-only diagnostic surface also makes deterministic visual QA possible.
window.biomech={get state(){return {...state};},get stats(){return stage?.stats();},get pose(){return currentPose();}};
