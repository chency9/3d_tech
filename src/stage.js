import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { specimens } from './kinematics.js';
import { ScorpionRig } from './scorpion-rig.js';
import { RenderBatches } from './render-batches.js';

const TAU = Math.PI * 2;
const X = new THREE.Vector3(1,0,0), Y = new THREE.Vector3(0,1,0), Z = new THREE.Vector3(0,0,1);
const cameraViews = { iso: [7.8, 5.8, 10.3], side: [11.5, 3.1, .1], front: [0, 3.8, 13.5], top: [.01, 13.5, .01], detail: [4.5,4.4,6.0] };
const paintLoading = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function localModel(url, file) {
  if (!globalThis.__BIOMECH_MODELS__?.[file]) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${url}.js`;
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); reject(new Error('本地模型文件缺失，请保留完整 dist 文件夹')); };
      document.body.append(script);
    });
  }
  const encoded = globalThis.__BIOMECH_MODELS__?.[file];
  if (!encoded) throw new Error('本地模型数据不可用');
  return Uint8Array.from(atob(encoded), char => char.charCodeAt(0)).buffer;
}

export class SpecimenStage {
  constructor(container, onSelect, onInteract) {
    this.container = container;
    this.onSelect = onSelect;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f4f1eb');
    this.scene.fog = new THREE.Fog('#f4f1eb', 22, 40);
    this.camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
    this.camera.position.fromArray(cameraViews.iso);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .88;
    this.renderer.domElement.setAttribute('aria-label', '可拖动旋转、滚轮缩放的三维机械模型');
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(environment, .04);
    this.scene.environment = this.environmentTarget.texture;
    environment.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8579, 1.0));
    const key = new THREE.DirectionalLight(0xfff9ee, 2.7);
    key.position.set(3, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .1, far: 25 });
    key.shadow.bias = -.0006;
    key.shadow.normalBias = .018;
    key.shadow.radius = 3;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd5e3ec, .85);
    fill.position.set(-6, 4, -3);
    this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#f4f1eb', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.035;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.guides = new THREE.Group();
    this.scene.add(this.guides);
    const lineMat = new THREE.LineBasicMaterial({ color: '#c5beb1', transparent: true, opacity: .48 });
    for (const radius of [3.5, 4.6]) {
      const points = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos(i/128*TAU)*radius, .006, Math.sin(i/128*TAU)*radius));
      this.guides.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat));
    }
    const ticks=[];
    for (let i=0; i<72; i++) {
      const a=i/72*TAU, r1=4.6, r2=i%6===0?4.80:4.67;
      const points=[new THREE.Vector3(Math.cos(a)*r1,.008,Math.sin(a)*r1),new THREE.Vector3(Math.cos(a)*r2,.008,Math.sin(a)*r2)];
      ticks.push(...points);
    }
    this.guides.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks),lineMat));
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.65, .35);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 24;
    this.controls.maxPolarAngle = Math.PI * .49;
    this.controls.enablePan = false;
    this.controls.addEventListener('start', () => { this.cameraGoal = null; onInteract(); });
    this.controls.update();
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.labelPosition = new THREE.Vector3();
    this.labels = [];
    this.labelNodes = [];
    this.selected = 'all';
    this.labelVisible = true;
    this.turntable = false;
    this.wireframe = false;
    this.loadId = 0;
    const el = this.renderer.domElement;
    let down;
    el.addEventListener('pointerdown', e => { down=[e.clientX,e.clientY]; });
    el.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX-down[0],e.clientY-down[1])>5 || !this.current) return;
      const rect=el.getBoundingClientRect();
      this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const hit=this.raycaster.intersectObject(this.current.root,true).find(h=>h.object.isMesh);
      let object=hit?.object;
      while(object) { if(object.userData.assembly) { onSelect(object.userData.assembly); break; } object=object.parent; }
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  async load(model, progress = () => {}) {
    const id=++this.loadId;
    if (!this.cache.has(model)) {
      const file = specimens[model].file;
      const url = `${import.meta.env.BASE_URL}models/${file}`;
      const total = globalThis.__BIOMECH_MODEL_BYTES__?.[file] || 0;
      progress({ phase: 'download', loaded: 0, total, local: location.protocol === 'file:' });
      let binary;
      if (location.protocol === 'file:') {
        binary = await localModel(url, file);
      } else {
        const fileLoader = new THREE.FileLoader().setResponseType('arraybuffer');
        binary = await fileLoader.loadAsync(url, event => {
          progress({ phase: 'download', loaded: event.loaded, total: total || event.total });
        });
      }
      progress({ phase: 'parse', loaded: binary.byteLength, total: binary.byteLength });
      await paintLoading();
      const gltf = await this.loader.parseAsync(binary, url.slice(0, url.lastIndexOf('/') + 1));
      const root = gltf.scene;
      const nodes = new Map(), meshes = [], assemblies = [], details = [];
      root.traverse(o => {
        nodes.set(o.name,o);
        o.userData.basePosition=o.position.clone();
        o.userData.baseQuaternion=o.quaternion.clone();
        if(o.userData.explodeVector) {
          o.userData.explodeDirection=new THREE.Vector3(...o.userData.explodeVector);
          details.push(o);
        }
        if(o.userData.assembly) {
          o.updateWorldMatrix(true,true);
          const center=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
          const offset=center.clone().sub(new THREE.Vector3(0,1.4,0));
          if(offset.length()<.1) offset.set(0,1,0);
          offset.y=Math.max(.45,Math.abs(offset.y)*.45);
          o.userData.explodeOffset=offset.normalize().multiplyScalar(1.4);
          assemblies.push(o);
        }
        if(o.isMesh) {
          o.userData.renderMaterialId=o.material.uuid;
          o.castShadow=!o.material.transparent;
          o.receiveShadow=true;
          o.material=o.material.clone();
          o.material.side=THREE.FrontSide;
          o.material.forceSinglePass=true;
          o.material.envMapIntensity=.65;
          if(o.material.name.startsWith('03')) o.material.color.set('#e74720');
          if(o.material.name.startsWith('02')) o.material.color.set('#242e31');
          o.userData.originalOpacity=o.material.opacity;
          o.userData.originalTransparent=o.material.transparent;
          if(o.material.transparent) { o.material.side=THREE.DoubleSide; o.material.depthWrite=false; }
          meshes.push(o);
        }
      });
      const rig=nodes.has('SC_chassis')?new ScorpionRig(nodes):null;
      const movingNodes=[...nodes.values()].filter(node=>node!==root&&(!node.isMesh||node.userData.explodeVector||(!rig&&node.name.endsWith('__01'))));
      const movingSet=new Set(movingNodes);
      for(const mesh of meshes) {
        if(!movingSet.has(mesh)) { mesh.updateMatrix();mesh.matrixAutoUpdate=false; }
      }
      const batches=new RenderBatches(root,meshes,this.renderer.extensions.has('WEBGL_multi_draw'));
      this.cache.set(model,{root,nodes,meshes,assemblies,details,rig,batches,movingNodes});
      root.visible=true;
      this.scene.add(root);
      progress({ phase: 'render' });
      await paintLoading();
      await this.renderer.compileAsync(this.scene,this.camera);
      batches.setEnabled(true);
      batches.update();
      await this.renderer.compileAsync(this.scene,this.camera);
      batches.setEnabled(false);
      root.visible=false;
    }
    if(id!==this.loadId) return false;
    if(this.current) this.current.root.visible=false;
    this.model=model;
    this.current=this.cache.get(model);
    this.current.root.visible=true;
    this.current.root.rotation.y=0;
    this.current.root.position.y=0;
    this.setSelection('all');
    this.setWireframe(this.wireframe);
    this.makeLabels();
    this.view('iso',true);
    progress({ phase: 'ready' });
    return true;
  }

  makeLabels() {
    this.labels.forEach(l=>l.el.remove());
    const sc=this.model==='scorpion';
    const specs=sc ? [ ['SC_head','OPTIC ARRAY','复眼传感器',1,-55], ['SC_claw_L','CHELA ASSEMBLY','钳爪执行器',-1,24], ['SC_tail_joint_3','CAUDAL SERVO','尾部伺服关节',1,0] ] : [ ['HB_head','OPTIC MODULE','光学感知模块',-1,25], ['HB_wing_R0','WING TRANSMISSION','扑翼传动机构',1,-60], ['HB_abdomen','ABDOMEN CAPSULE','分段腹部舱体',1,25] ];
    this.labels=specs.map(([name,title,subtitle,side,offsetY])=>{
      const anchor=this.current.nodes.get(name);
      const el=document.createElement('div');
      el.className=`model-label ${side<0?'label-left':'label-right'}`;
      el.innerHTML=`<span class="label-dot"></span><span class="label-line"></span><span class="label-text"><b>${title}</b><small>${subtitle}</small></span>`;
      this.container.append(el);
      const line=el.querySelector('.label-line'),text=el.querySelector('.label-text');
      line.style.width=`${Math.hypot(62,offsetY)}px`;
      line.style.left='0';line.style.right='auto';line.style.transformOrigin='0 50%';
      line.style.transform=`rotate(${Math.atan2(offsetY,side*62)}rad)`;
      text.style.top=`${offsetY-12}px`;
      if(side<0)text.style.right='70px';else text.style.left='70px';
      return {el,anchor,side};
    });
  }

  setSelection(part) {
    this.selected=part;
    if(!this.current) return;
    this.current.meshes.forEach(mesh=>{
      const active=part==='all'||this.belongsTo(mesh,part);
      mesh.material.transparent=mesh.userData.originalTransparent||!active;
      mesh.material.opacity=active?mesh.userData.originalOpacity:.045;
      mesh.material.depthWrite=active&&!mesh.userData.originalTransparent;
      mesh.castShadow=active&&!mesh.userData.originalTransparent;
    });
    this.current.batches.setEnabled(part==='all'&&!this.wireframe);
  }

  setWireframe(value) {
    this.wireframe=value;
    this.current?.meshes.forEach(m=>m.material.wireframe=value);
    this.current?.batches.setEnabled(this.selected==='all'&&!value);
  }
  view(name, instant=false) {
    this.cameraGoal=new THREE.Vector3(...cameraViews[name]);
    this.controls.target.set(0,this.model==='bee'?1.4:1.7,.35);
    if(this.container.clientWidth<650) this.cameraGoal.multiplyScalar(1.45);
    if(instant) { this.camera.position.copy(this.cameraGoal); this.cameraGoal=null; this.controls.update(); }
  }
  resize() {
    const {width,height}=this.container.getBoundingClientRect();
    if(!width||!height) return;
    this.renderer.setSize(width,height);
    this.width=width;this.height=height;
    this.camera.aspect=width/height;
    this.camera.fov=width<650?42:36;
    this.camera.updateProjectionMatrix();
  }

  frame(pose, delta, time, tour, playing = true) {
    if(!this.current) { this.renderer.render(this.scene,this.camera); return; }
    const {root,nodes,assemblies,details,rig,movingNodes}=this.current;
    for(const node of movingNodes) {
      node.position.copy(node.userData.basePosition);
      node.quaternion.copy(node.userData.baseQuaternion);
    }
    const rotate=(name,axis,angle)=>{
      const node=nodes.get(name);
      if(node) node.rotateOnAxis(axis,angle);
    };
    if(rig) {
      rig.pose(pose);
    } else if(this.model==='scorpion') {
      for(let i=0;i<6;i++) rotate(`SC_tail_joint_${i}`,X,pose.tailFlex);
      for(const [s,sign] of [['L',-1],['R',1]]) {
        rotate(`SC_jaw_${s}_a`,Y,-pose.clawOpen*.38);
        rotate(`SC_jaw_${s}_b`,Y,pose.clawOpen*.38);
        for(let i=0;i<4;i++) rotate(`SC_leg_${s}${i}`,Y,pose.legs[i+(s==='R'?4:0)].angle*sign);
      }
    } else {
      for(const [s,sign] of [['L',-1],['R',1]]) {
        for(let i=0;i<2;i++) rotate(`HB_wing_${s}${i}`,Z,pose.wingAngle*sign*(i===0?1:-.8));
        for(let i=0;i<3;i++) rotate(`HB_leg_${s}${i}`,Z,pose.flying?sign*.18:0);
      }
      for(let i=0;i<7;i++) {
        const n=nodes.get(`HB_abdomen_ring_${i}`);
        if(n) n.position.z-=pose.abdomenOpen*i*.14;
      }
    }
    for(const node of assemblies) {
      if(!node.userData.explodeVector)node.position.addScaledVector(node.userData.explodeOffset,pose.explode);
    }
    for(const node of details)node.position.addScaledVector(node.userData.explodeDirection,pose.explode);
    // Lift ceramic shells away from each rigid assembly during teardown.
    for(const mesh of this.current.meshes) {
      if(!rig&&mesh.name.endsWith('__01')) mesh.position.y+=pose.explode*.65;
    }
    root.position.y=pose.lift;
    const zoom=1/(1+pose.explode*.44);
    if(Math.abs(this.camera.zoom-zoom)>.0001){this.camera.zoom=zoom;this.camera.updateProjectionMatrix();}
    if(playing&&(this.turntable||tour)) root.rotation.y+=delta*(this.turntable?.20:.055);
    if(this.cameraGoal) {
      this.camera.position.lerp(this.cameraGoal,1-Math.exp(-delta*5));
      if(this.camera.position.distanceTo(this.cameraGoal)<.01) this.cameraGoal=null;
    }
    this.controls.update();
    this.current.batches.update();
    this.renderer.render(this.scene,this.camera);
    const w=this.width,h=this.height;
    for(const label of this.labels) {
      const visible=this.labelVisible&&label.anchor&&(this.selected==='all'||this.belongsTo(label.anchor,this.selected));
      label.el.hidden=!visible;
      if(!visible) continue;
      const pos=label.anchor.getWorldPosition(this.labelPosition).project(this.camera);
      const x=(pos.x*.5+.5)*w,y=(-pos.y*.5+.5)*h;
      label.el.style.transform=`translate(${x}px,${y}px)`;
      label.el.style.opacity=pos.z>1||x<120||x>w-120||y<70||y>h-120?'0':'1';
    }
  }
  belongsTo(node,part) { while(node) { if(node.userData.assembly===part) return true; node=node.parent; } return false; }
  stats() {
    const articulated={};
    for(const name of ['SC_jaw_L_a','SC_tail_joint_2','SC_leg_L0_femur','SC_leg_L0_tibia','SC_leg_L0_rod','HB_wing_L0','HB_abdomen_ring_5']) {
      const node=this.current?.nodes.get(name);
      if(node) articulated[name]={position:node.position.toArray(),quaternion:node.quaternion.toArray()};
    }
    return {model:this.model,loaded:!!this.current,meshes:this.current?.meshes.length??0,triangles:this.renderer.info.render.triangles,calls:this.renderer.info.render.calls,selected:this.selected,articulated,feet:this.current?.rig?.diagnostics()};
  }
}
