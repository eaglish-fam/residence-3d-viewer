import {getLanguage, t, viewText, onLanguageChange, setProgress} from './i18n.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const $=s=>document.querySelector(s), stage=$('#stage'), F=.3048;
const ft=(x,y,z)=>new THREE.Vector3(x*F,z*F,-y*F);
const scene=new THREE.Scene();scene.background=new THREE.Color('#eeede7');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.localClippingEnabled=true;stage.append(renderer.domElement);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.33;
const camera=new THREE.PerspectiveCamera(44,1,.035,350);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=8;controls.maxDistance=90;controls.maxPolarAngle=Math.PI/2-.025;controls.autoRotateSpeed=.65;
const hemi=new THREE.HemisphereLight(0xffffff,0xc0b5a3,2.0);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff6df,3.0);sun.position.set(-12,30,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-23,right:23,top:27,bottom:-27,near:.5,far:100});sun.shadow.bias=-.00008;sun.shadow.normalBias=.006;sun.target.position.copy(ft(26,30,4));scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xdce9f3,1);fill.position.set(30,18,-35);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0xdddcd3,roughness:.94}));ground.rotation.x=-Math.PI/2;ground.position.y=-.17;ground.receiveShadow=true;scene.add(ground);
const shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.ShadowMaterial({opacity:.13}));shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.y=-.159;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
const layers={roof:[],ceiling:[],wall:[],wall_cut:[],interior:[],detail:[],opening:[],door:[],trim:[],glass:[]};
let current='overview',inside=false,loaded=false,transition=null,house=null,lookYaw=0,lookPitch=0,lastTick=performance.now();
const presets={
 plan:{p:[26,29,120],t:[26,30,0]},
 overview:{p:[87,-66,82],t:[26,29,5]},
 front:{p:[26,-97,43],t:[26,24,6]},
 rear:{p:[27,158,64],t:[27,35,5]},
 left:{p:[-132,32,64],t:[26,32,5]},
 right:{p:[184,32,64],t:[26,32,5]},
 living:{p:[17.5,15.7,5.45],t:[26.9,26,4.6],inside:true},
 kitchen:{p:[14.1,32.1,5.65],t:[6.3,18.3,4.15],inside:true},
 bedroom:{p:[37.5,38.3,5.3],t:[45.7,47.2,3.7],inside:true},
 entry:{p:[25.65,-4.4,5.35],t:[25.9,21.5,5.1],inside:true}
};
function resize(){const {width,height}=stage.getBoundingClientRect();const previous=camera.aspect;renderer.setSize(width,height);camera.aspect=width/height;if(loaded&&!inside&&!transition){const factor=Math.max(1,1.1/camera.aspect)/Math.max(1,1.1/previous);camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);}camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);resize();
function procedural(material,type){
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 houseWorld;\nvarying vec3 houseNormal;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhouseWorld=(modelMatrix*vec4(position,1.0)).xyz;\nhouseNormal=normalize(mat3(modelMatrix)*normal);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 houseWorld;\nvarying vec3 houseNormal;\nfloat hashHouse(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}');
  const roof=`float u=abs(houseNormal.x)>.3?houseWorld.z:houseWorld.x;float row=floor(houseWorld.y/.115);vec2 tile=vec2(u/.31+mod(row,2.0)*.5,houseWorld.y/.115);vec2 f=fract(tile);float seam=step(.025,f.x)*step(.045,f.y);float r=hashHouse(floor(tile));diffuseColor.rgb*=mix(.48,.83+r*.35,seam);`;
  const wood=`float row=floor(houseWorld.z/.18);vec2 tile=vec2(houseWorld.x/1.55+mod(row,3.0)*.31,houseWorld.z/.18);vec2 f=fract(tile);float seam=step(.002,f.x)*step(.008,f.y);float r=hashHouse(floor(tile));float grain=sin(houseWorld.x*45.0+sin(houseWorld.z*170.0))*.025;diffuseColor.rgb*=mix(.68,.85+r*.35+grain,seam);`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+(type==='roof'?roof:wood));
 };material.customProgramCacheKey=()=>type;
}
function inheritedLayer(o){for(let p=o;p;p=p.parent){if(p.userData?.viewer_layer)return p.userData.viewer_layer;}return'detail';}
function optimize(root){
 root.updateMatrixWorld(true);const groups=new Map();const decorated=new Set();const layerMaterials=new Map();
 root.traverse(o=>{if(!o.isMesh)return;const layer=inheritedLayer(o);const mk=o.material.uuid+'|'+layer;let material=layerMaterials.get(mk);if(!material){material=o.material.clone();layerMaterials.set(mk,material);}
  if(!decorated.has(material.uuid)){
   decorated.add(material.uuid);material.side=['wall','wall_cut'].includes(layer)?THREE.FrontSide:THREE.DoubleSide;
   if(/Slate grey shingles/.test(material.name)){material.color.set('#68747a');procedural(material,'roof');}
   if(/Oak plank floor/.test(material.name)){material.color.set('#b8986b');procedural(material,'wood');}
   if(/Silver mirror/.test(material.name)){material.color.set('#c1cfd0');material.metalness=.65;material.roughness=.20;}
   if(/Smoky blue glazing/.test(material.name)){material.transmission=0;material.transparent=true;material.opacity=.30;material.depthWrite=false;material.roughness=.12;material.color.set('#a4c0c2');}
  }
  const key=material.uuid+'|'+layer;let g=groups.get(key);if(!g){g={material,layer,geometries:[]};groups.set(key,g);}
  let geo=o.geometry.clone();if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(o.matrixWorld);
  for(const key of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(key))geo.deleteAttribute(key);
  if(!geo.attributes.normal)geo.computeVertexNormals();if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  g.geometries.push(geo);
 });
 const result=new THREE.Group();
 for(const g of groups.values()){
  const merged=mergeGeometries(g.geometries,false);if(!merged)throw new Error(t('mergeError'));merged.computeBoundingSphere();
  const m=new THREE.Mesh(merged,g.material);m.name=g.material.name;m.userData.viewer_layer=g.layer;m.castShadow=!g.material.transparent;m.receiveShadow=true;result.add(m);(layers[g.layer]||layers.detail).push(m);
  g.geometries.forEach(x=>x.dispose());
 }
 return result;
}
function visibility(){
 const cut=!inside&&$('#cutaway').checked;
 const roof=inside||($('#roof').checked&&!cut);
 [...layers.roof,...layers.ceiling].forEach(o=>o.visible=roof);
 layers.wall.forEach(o=>o.visible=!cut);layers.wall_cut.forEach(o=>o.visible=cut);
 [...layers.opening,...layers.door,...layers.trim].forEach(o=>o.visible=!cut);
 controls.autoRotate=!inside&&$('#rotate').checked;
}
function setMode(interior){
 inside=interior;$('#exterior-controls').hidden=interior;$('#interior-controls').hidden=!interior;
 $('#tab-exterior').classList.toggle('active',!inside);$('#tab-interior').classList.toggle('active',inside);
 $('#tab-exterior').setAttribute('aria-selected',String(!inside));$('#tab-interior').setAttribute('aria-selected',String(inside));
 $('#hint').textContent=t(inside?'hintInterior':'hintExterior');
 scene.background.set(inside?'#e7e8df':'#eeede7');hemi.intensity=inside?2.35:2.0;scene.environmentIntensity=inside?.45:.33;
 visibility();
}
function go(name,instant=false){
 if(!loaded||!presets[name])return;const previous=current;current=name;const p=presets[name];if(name==='plan')$('#cutaway').checked=true;else if(previous==='plan')$('#cutaway').checked=false;setMode(!!p.inside);if(p.inside&&$('#room-select').querySelector(`option[value="${name}"]`))$('#room-select').value=name;
 updateViewCopy();
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
 controls.enabled=!inside;controls.autoRotate=false;
 const end=ft(...p.p),target=ft(...p.t);
 camera.fov=inside?72:44;
 if(!inside){const centre=ft(26,30,5);const direction=end.clone().sub(centre).normalize();const d=(name==='plan'?36:(name==='overview'?33:(['left','right'].includes(name)?32:28)))*Math.max(1,1.1/camera.aspect);end.copy(centre).addScaledVector(direction,d);}
 camera.updateProjectionMatrix();
 if(inside||instant||matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.copy(end);camera.lookAt(target);controls.target.copy(target);transition=null;setLook(target);visibility();}
 else transition={start:performance.now(),from:camera.position.clone(),to:end,tf:controls.target.clone(),tt:target};
}
function setLook(target){const d=target.clone().sub(camera.position).normalize();lookPitch=Math.asin(d.y);lookYaw=Math.atan2(-d.x,-d.z);}
function updateLook(){camera.rotation.order='YXZ';camera.rotation.set(lookPitch,lookYaw,0);}
const collision=new THREE.Raycaster();
function move(distance,strafe=0){
 if(!inside||!loaded)return;const d=new THREE.Vector3(-Math.sin(lookYaw),0,-Math.cos(lookYaw));d.multiplyScalar(distance);d.add(new THREE.Vector3(Math.cos(lookYaw),0,-Math.sin(lookYaw)).multiplyScalar(strafe));
 collision.set(camera.position,d.clone().normalize());collision.far=d.length()+.22;const hit=collision.intersectObjects([...layers.wall,...layers.door],false);if(hit.length)return;
 camera.position.add(d);updateLook();
}
$('#forward').onclick=()=>move(.35);$('#backward').onclick=()=>move(-.35);
let drag=null;const pointers=new Map();let pinch=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(!inside)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY};if(pointers.size===2){const[a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
renderer.domElement.addEventListener('pointermove',e=>{if(!inside||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1&&drag){lookYaw-=(e.clientX-drag.x)*.004;lookPitch=Math.max(-1.28,Math.min(1.28,lookPitch-(e.clientY-drag.y)*.004));updateLook();}else if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);move((d-pinch)*.012);pinch=d;}drag={x:e.clientX,y:e.clientY};});
for(const event of ['pointerup','pointercancel'])renderer.domElement.addEventListener(event,e=>{pointers.delete(e.pointerId);drag=null;});
renderer.domElement.addEventListener('wheel',e=>{if(!inside)return;e.preventDefault();move(-Math.sign(e.deltaY)*.25);},{passive:false});
window.addEventListener('keydown',e=>{if(!inside||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;const k=e.key.toLowerCase();if(['w','s','a','d','arrowup','arrowdown'].includes(k))e.preventDefault();if(k==='w'||k==='arrowup')move(.22);if(k==='s'||k==='arrowdown')move(-.22);if(k==='a')move(0,-.22);if(k==='d')move(0,.22);});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
$('#mode-tabs').addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();const button=inside?$('#tab-exterior'):$('#tab-interior');button.click();button.focus();});
$('#room-select').onchange=e=>go(e.target.value);
$('#tab-exterior').onclick=()=>go('overview');$('#tab-interior').onclick=()=>go('living');$('#reset').onclick=()=>go(current,true);
$('#roof').onchange=visibility;$('#rotate').onchange=visibility;$('#cutaway').onchange=()=>{if($('#cutaway').checked)go('plan');else go('overview');};
$('#reference').onclick=()=>$('#plan-dialog').showModal();$('#close-plan').onclick=()=>$('#plan-dialog').close();
$('#plan-dialog').addEventListener('click',e=>{if(e.target===$('#plan-dialog'))$('#plan-dialog').close();});
document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-plan]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});updatePlanCopy();});
function updatePlanCopy(){const traced=$('[data-plan="traced"]').classList.contains('active');$('#plan-image').src=traced?'./assets/plan-'+getLanguage()+'.svg':'./assets/floor-plan.jpg';$('#plan-image').alt=t(traced?'tracedAlt':'originalAlt');}
function updateViewCopy(){
 const copy=viewText(current);$('#view-title').textContent=copy.title;$('#view-desc').textContent=copy.desc;$('#view-type').textContent=t(inside?'typeInterior':'typeExterior');$('#hint').textContent=t(inside?'hintInterior':'hintExterior');
 $('#room-select').querySelectorAll('option').forEach(opt=>opt.textContent=viewText(opt.value).title);
 $('#interior-controls').querySelectorAll('[data-view]').forEach(button=>button.textContent=viewText(button.dataset.view).title);
 updatePlanCopy();
}
onLanguageChange(updateViewCopy);updateViewCopy();
let roomData;
try{const response=await fetch('./assets/rooms.json');if(!response.ok)throw new Error('Room metadata failed');roomData=await response.json();}
catch(error){error.userMessage='loadError';throw error;}
for(const room of roomData.rooms){presets[room.id]={p:room.camera,t:room.target,inside:true};const opt=document.createElement('option');opt.value=room.id;opt.textContent=viewText(room.id).title;$('#room-select').append(opt);}
const loader=new GLTFLoader();loader.load('./assets/house.glb',gltf=>{
 try{setProgress('preparing');house=optimize(gltf.scene);scene.add(house);loaded=true;go('overview',true);$('#loading').style.opacity='0';setTimeout(()=>$('#loading').remove(),350);window.__viewer={get state(){return{loaded,current,inside,meshes:house.children.length,roofsVisible:layers.roof.filter(x=>x.visible).length,roofMeshes:layers.roof.length,wallFullVisible:layers.wall.filter(x=>x.visible).length,wallCutVisible:layers.wall_cut.filter(x=>x.visible).length,revision:roomData.revision,language:getLanguage(),rooms:roomData.rooms.length,clipped:$('#cutaway').checked,position:camera.position.toArray()};},go};}
 catch(e){setProgress('renderError');console.error(e);}
},xhr=>{if(xhr.total)setProgress('progress',{percent:Math.min(100,Math.round(xhr.loaded/xhr.total*100))});},err=>{setProgress('loadError');console.error(err);});
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-lastTick)/1000,.05);lastTick=now;
 if(transition){const t=Math.min((now-transition.start)/700,1),s=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,s);controls.target.lerpVectors(transition.tf,transition.tt,s);camera.lookAt(controls.target);if(t===1){transition=null;visibility();}}
 else if(!inside)controls.update(dt);
 renderer.render(scene,camera);
}requestAnimationFrame(animate);
