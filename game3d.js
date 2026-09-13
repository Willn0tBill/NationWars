(() => {
'use strict';

const mount = document.getElementById('game');
const loading = document.getElementById('loading');
if (!mount || !window.THREE) { if (loading) loading.textContent = '3D engine failed to load. Refresh the page.'; return; }

const T = THREE;
let scene, camera, renderer, raycaster, mouse;
let terrain, gridGroup, unitsGroup, citiesGroup, selectedUnit = null;
let gold = 1000, food = 800, science = 0, territory = 0;
let armies = [], cities = [], selectedTile = null;
let dragging = false, lastX = 0, lastY = 0;
let cameraYaw = 0, cameraDistance = 34, cameraHeight = 30;
const MAP = 24, HALF = MAP / 2, TILE = 2.5;
const playerColor = 0x4da6ff, enemyColor = 0xef6262, neutralColor = 0x64748b;

function $(id){ return document.getElementById(id); }
function rand(min,max){ return min + Math.random()*(max-min); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function boot(){
  scene = new T.Scene();
  scene.background = new T.Color(0x07111d);
  scene.fog = new T.Fog(0x07111d, 42, 100);
  camera = new T.PerspectiveCamera(48, innerWidth/innerHeight, .1, 150);
  renderer = new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace = T.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
  raycaster = new T.Raycaster(); mouse = new T.Vector2();

  const hemi = new T.HemisphereLight(0xb8d7ff,0x182313,2.2); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff,2.4); sun.position.set(15,30,10); scene.add(sun);

  buildTerrain();
  buildGrid();
  unitsGroup = new T.Group(); citiesGroup = new T.Group(); scene.add(unitsGroup,citiesGroup);
  spawnWorld();
  updateCamera(); updateHUD();
  addEvents();
  loading.classList.add('hidden');
  animate();
}

function buildTerrain(){
  const geo = new T.PlaneGeometry(MAP*TILE,MAP*TILE,MAP,MAP);
  const mat = new T.MeshLambertMaterial({color:0x1b3a2a,roughness:.9});
  terrain = new T.Mesh(geo,mat); terrain.rotation.x=-Math.PI/2; terrain.name='ground'; scene.add(terrain);
  const water = new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshBasicMaterial({color:0x0a2335}));
  water.rotation.x=-Math.PI/2; water.position.y=-.18; scene.add(water);
}
function buildGrid(){
  gridGroup=new T.Group();
  const lineMat=new T.LineBasicMaterial({color:0x496d55,transparent:true,opacity:.3});
  for(let i=0;i<=MAP;i++){
    const x=-HALF*TILE+i*TILE;
    const g1=new T.BufferGeometry().setFromPoints([new T.Vector3(x,.02,-HALF*TILE),new T.Vector3(x,.02,HALF*TILE)]);
    const g2=new T.BufferGeometry().setFromPoints([new T.Vector3(-HALF*TILE,.02,x),new T.Vector3(HALF*TILE,.02,x)]);
    gridGroup.add(new T.Line(g1,lineMat),new T.Line(g2,lineMat));
  }
  scene.add(gridGroup);
}
function tilePos(x,z){ return new T.Vector3((x-HALF+.5)*TILE,0,(z-HALF+.5)*TILE); }
function makeTileHighlight(color=0x55b7ff){
  const m=new T.Mesh(new T.BoxGeometry(TILE*.94,.06,TILE*.94),new T.MeshBasicMaterial({color,transparent:true,opacity:.2})); m.position.y=.05; return m;
}
function makeArmy(owner,x,z,count){
  const group=new T.Group(); const p=tilePos(x,z); group.position.copy(p); group.userData={owner,x,z,count,id:Math.random().toString(36).slice(2)};
  const base=new T.Mesh(new T.CylinderGeometry(.62,.72,.18,8),new T.MeshStandardMaterial({color:owner==='player'?playerColor:enemyColor,roughness:.75})); base.position.y=.18; group.add(base);
  for(let i=0;i<Math.min(9,Math.max(3,Math.ceil(count/12)));i++){
    const soldier=new T.Mesh(new T.BoxGeometry(.23,.7,.23),new T.MeshStandardMaterial({color:owner==='player'?0xd8ecff:0xffd7d7}));
    soldier.position.set(rand(-.42,.42),.55,rand(-.42,.42)); soldier.rotation.y=rand(0,Math.PI*2); group.add(soldier);
  }
  const flag=new T.Mesh(new T.ConeGeometry(.18,.45,5),new T.MeshStandardMaterial({color:owner==='player'?playerColor:enemyColor})); flag.position.set(0,1.05,0); group.add(flag);
  const ring=makeTileHighlight(owner==='player'?0x55b7ff:0xef6262); ring.visible=false; ring.name='selection'; group.add(ring);
  group.traverse(o=>{o.userData.army=group;}); unitsGroup.add(group); armies.push(group); return group;
}
function makeCity(owner,x,z,name){
  const group=new T.Group(); group.position.copy(tilePos(x,z)); group.userData={owner,x,z,name};
  const base=new T.Mesh(new T.BoxGeometry(1.5,.25,1.5),new T.MeshStandardMaterial({color:owner==='player'?0x315f8c:0x6b3434})); base.position.y=.13; group.add(base);
  for(let i=0;i<3;i++){
    const b=new T.Mesh(new T.BoxGeometry(.45,rand(.8,1.5),.45),new T.MeshStandardMaterial({color:owner==='player'?0x8fb9d8:0xb97878})); b.position.set((i-1)*.48,.55,(i%2)*.45-.2); group.add(b);
    const roof=new T.Mesh(new T.ConeGeometry(.34,.35,4),new T.MeshStandardMaterial({color:0x2d3440})); roof.position.set(b.position.x,b.position.y+b.geometry.parameters.height/2+.17,b.position.z); roof.rotation.y=Math.PI/4; group.add(roof);
  }
  const marker=makeTileHighlight(owner==='player'?0x3b82f6:0xdc4a4a); marker.position.y=.01; marker.material.opacity=.09; group.add(marker); citiesGroup.add(group); cities.push(group);
}
function spawnWorld(){
  // Player starting army and city
  makeCity('player',3,19,'Capital'); makeArmy('player',4,18,80); makeArmy('player',6,19,55);
  // Enemy armies and cities
  makeCity('enemy',19,4,'Redhaven'); makeArmy('enemy',18,5,75); makeArmy('enemy',20,6,50); makeArmy('enemy',17,3,40);
  makeCity('neutral',11,11,'Free City');
  territory=4;
}
function clearSelection(){ if(selectedUnit){selectedUnit.getObjectByName('selection').visible=false;} selectedUnit=null; selectedTile=null; updateHUD(); }
function selectArmy(a){ if(selectedUnit) selectedUnit.getObjectByName('selection').visible=false; selectedUnit=a; a.getObjectByName('selection').visible=true; selectedTile={x:a.userData.x,z:a.userData.z}; updateHUD(); }
function moveArmy(a,x,z){
  if(a.userData.owner!=='player') return;
  const p=tilePos(x,z); const start=a.position.clone(); const target=p.clone();
  const duration=500; const t0=performance.now();
  function step(now){ const t=clamp((now-t0)/duration,0,1); const e=t*t*(3-2*t); a.position.lerpVectors(start,target,e); a.position.y=Math.sin(e*Math.PI)*.18; if(t<1) requestAnimationFrame(step); else {a.position.y=0; a.userData.x=x;a.userData.z=z; selectedTile={x,z}; updateHUD();} }
  requestAnimationFrame(step);
  $('orders').textContent='Army moving to the selected position.';
}
function attack(a,target){
  if(a.userData.owner!=='player' || target.userData.owner==='player') return;
  const power=a.userData.count, defense=target.userData.count;
  a.userData.count=Math.max(0,Math.floor(power*.18));
  target.userData.count=Math.max(0,Math.floor(defense*.72));
  if(a.userData.count>target.userData.count){ target.userData.owner='player'; a.userData.count+=target.userData.count; target.userData.count=0; territory+=2; $('orders').textContent='Victory! Enemy territory captured.'; target.children.forEach(c=>{if(c.material)c.material.color.set(c===target.children[0]?playerColor:0xd8ecff);}); }
  else { $('orders').textContent='Attack failed. Your army took heavy losses.'; }
  updateArmyVisual(a); updateArmyVisual(target); updateHUD();
}
function updateArmyVisual(a){
  const color=a.userData.owner==='player'?playerColor:enemyColor;
  a.children[0].material.color.set(color); a.children[a.children.length-2]?.material?.color?.set(color);
  a.children.forEach(c=>{if(c.userData.army===a && c.name==='selection'){} });
}
function nearestEnemy(x,z){ let best=null,dist=Infinity; armies.forEach(a=>{if(a.userData.owner==='enemy'){const d=Math.abs(a.userData.x-x)+Math.abs(a.userData.z-z);if(d<dist){dist=d;best=a;}}});return dist<=1?best:null; }
function pointFromEvent(e){ const r=renderer.domElement.getBoundingClientRect(); mouse.x=((e.clientX-r.left)/r.width)*2-1; mouse.y=-((e.clientY-r.top)/r.height)*2+1; raycaster.setFromCamera(mouse,camera); return raycaster.intersectObjects(scene.children,true); }
function handleClick(e){
  if(dragging) return;
  const hits=pointFromEvent(e); let army=null;
  for(const h of hits){if(h.object.userData.army){army=h.object.userData.army;break;}}
  if(army){selectArmy(army);return;}
  clearSelection();
}
function handleContext(e){
  e.preventDefault(); if(!selectedUnit || selectedUnit.userData.owner!=='player') return;
  const hits=pointFromEvent(e); let enemy=null; let ground=null;
  for(const h of hits){if(h.object.userData.army?.userData.owner==='enemy'){enemy=h.object.userData.army;break;} if(h.object===terrain) ground=h.point;}
  if(enemy){attack(selectedUnit,enemy);return;}
  if(ground){const x=clamp(Math.floor(ground.x/TILE+HALF),0,MAP-1),z=clamp(Math.floor(ground.z/TILE+HALF),0,MAP-1);moveArmy(selectedUnit,x,z);}
}
function updateCamera(){
  const target=new T.Vector3(0,0,0); camera.position.set(Math.sin(cameraYaw)*cameraDistance,cameraHeight,Math.cos(cameraYaw)*cameraDistance); camera.lookAt(target);
}
function addEvents(){
  renderer.domElement.addEventListener('click',handleClick);
  renderer.domElement.addEventListener('contextmenu',handleContext);
  renderer.domElement.addEventListener('pointerdown',e=>{dragging=false;lastX=e.clientX;lastY=e.clientY;});
  renderer.domElement.addEventListener('pointermove',e=>{if(e.buttons===1){const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>4)dragging=true;cameraYaw-=dx*.005;cameraHeight=clamp(cameraHeight+dy*.08,16,55);updateCamera();lastX=e.clientX;lastY=e.clientY;}});
  renderer.domElement.addEventListener('wheel',e=>{cameraDistance=clamp(cameraDistance+e.deltaY*.025,18,55);cameraHeight=clamp(cameraDistance*.9,16,55);updateCamera();},{passive:true});
  $('reset').addEventListener('click',()=>location.reload());
  $('split').addEventListener('click',()=>{if(!selectedUnit||selectedUnit.userData.count<20){$('orders').textContent='Select an army with at least 20 troops.';return;}const a=selectedUnit;const half=Math.floor(a.userData.count/2);a.userData.count-=half;makeArmy('player',clamp(a.userData.x+1,0,MAP-1),a.userData.z,half);updateArmyVisual(a);updateHUD();$('orders').textContent='Army split successfully.';});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r')location.reload();});
}
function updateHUD(){
  $('gold').textContent=Math.floor(gold).toLocaleString();$('food').textContent=Math.floor(food).toLocaleString();$('science').textContent=Math.floor(science).toLocaleString();
  const troops=armies.filter(a=>a.userData.owner==='player').reduce((s,a)=>s+a.userData.count,0);$('troops').textContent=troops.toLocaleString();$('territory').textContent=territory;
  $('selection').textContent=selectedUnit?`Selected army · ${selectedUnit.userData.count} troops · Position ${selectedUnit.userData.x+1}, ${selectedUnit.userData.z+1}`:'No army selected.';
}
let lastTick=performance.now();
function tick(now){
  if(now-lastTick>1000){lastTick=now;gold+=18;food+=12;science+=2;armies.filter(a=>a.userData.owner==='player').forEach(a=>{a.userData.count+=2;updateArmyVisual(a);});updateHUD();}
}
function animate(now=performance.now()){requestAnimationFrame(animate);tick(now);renderer.render(scene,camera);}

try{boot();}catch(err){console.error(err);loading.classList.remove('hidden');loading.textContent='3D game failed to start. Refresh the page.';}
})();