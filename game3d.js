(()=>{'use strict';
const $=id=>document.getElementById(id),mount=$('game'),loading=$('loading');
const fail=t=>{if(loading){loading.textContent=t;loading.classList.remove('hidden')}};
function boot(){
 if(!window.THREE||!window.NationWarsVisuals)throw Error('Three.js or art kit unavailable');const T=THREE,art=window.NationWarsVisuals;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,innerWidth/innerHeight,.1,220),renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'}),ray=new T.Raycaster(),mouse=new T.Vector2();
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.25:1.7));renderer.setSize(innerWidth,innerHeight);renderer.domElement.style.touchAction='none';mount.replaceChildren(renderer.domElement);
 art.atmosphere(T,scene,renderer,matchMedia('(pointer:coarse)').matches||(navigator.deviceMemory&&navigator.deviceMemory<=4));
 const MAP=24,H=MAP/2,TILE=2.5,PLAYER='#4da6ff',ENEMY='#ef6262';let selectedArmy=null,selectedPlot=null,territory=16,gold=1000,food=800,wood=300,iron=150,science=0,population=2500;
 let yaw=.35,pitch=.91,dist=39,targetX=-15,targetZ=15,dragging=false,dragMode='',lastX=0,lastY=0,movedDuringDrag=false;
 const armies=[],plots=new Map(),buildings=new T.Group(),units=new T.Group(),cities=new T.Group();scene.add(buildings,units,cities);
 const defs={
 farm:{name:'Farm',cost:{gold:80,wood:35},food:28},housing:{name:'Housing',cost:{gold:100,wood:70},pop:220},mine:{name:'Mine',cost:{gold:120,wood:55,iron:10},iron:16},factory:{name:'Factory',cost:{gold:180,wood:100,iron:30},gold:18},research:{name:'Research Center',cost:{gold:150,wood:70,iron:20},science:12},military:{name:'Military Base',cost:{gold:160,wood:80,iron:35},food:-4,troops:3},market:{name:'Market',cost:{gold:110,wood:60},gold:30},hospital:{name:'Hospital',cost:{gold:140,wood:80,iron:20},pop:120,science:2}};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pos=(x,z)=>new T.Vector3((x-H+.5)*TILE,0,(z-H+.5)*TILE),key=(x,z)=>x+'-'+z;
 function tilePoint(p){return{x:clamp(Math.floor(p.x/TILE+H),0,MAP-1),z:clamp(Math.floor(p.z/TILE+H),0,MAP-1)}}
 function own(x,z){return x>=1&&x<=7&&z>=15&&z<=22}
 function terrain(){return art.ground(T,scene,MAP,TILE)}
 function plotMesh(x,z,owner='player'){
   const m=art.tile(T,owner==='player'?0x51896c:owner==='enemy'?0xa66e6a:0x789182,TILE);
   const p=pos(x,z);m.position.x=p.x;m.position.z=p.z;
   m.userData={plot:key(x,z),owner};scene.add(m);return m;
 }
 function addPlot(x,z,type=null){plots.set(key(x,z),{x,z,type,owner:'player',mesh:plotMesh(x,z),building:null})}
 function building(plot){
   if(plot.building){buildings.remove(plot.building);plot.building.traverse(o=>{o.geometry?.dispose?.()})}
   if(!plot.type)return;
   const g=art.building(T,plot.type),p=pos(plot.x,plot.z),id=key(plot.x,plot.z);
   g.position.set(p.x,0,p.z);g.userData.plot=id;
   g.traverse(o=>{if(o.isMesh)o.userData.plot=id});
   buildings.add(g);plot.building=g;
 }
 function army(owner,x,z,count){
   const c=owner==='player'?PLAYER:ENEMY,g=art.army(T,c,count);
   g.position.copy(pos(x,z));
   g.userData={owner,x,z,count};
   g.traverse(o=>{if(o.isMesh)o.userData.army=g});
   const ring=new T.Mesh(new T.RingGeometry(.78,.96,40),new T.MeshBasicMaterial({color:0xfde39e,transparent:true,opacity:.98,side:T.DoubleSide}));
   ring.rotation.x=-Math.PI/2;ring.position.y=.22;ring.visible=false;ring.name='selection';ring.userData.army=g;
   g.add(ring);units.add(g);armies.push(g);return g;
 }
 terrain();for(let z=15;z<=22;z++)for(let x=1;x<=7;x++)addPlot(x,z);for(let z=1;z<=7;z++)for(let x=16;x<=22;x++)plotMesh(x,z,'enemy');
 function city(owner,x,z){
   const g=art.city(T,owner);
   g.position.copy(pos(x,z));cities.add(g);
 }
 city('player',4,19);city('enemy',19,4);addPlot(4,19,'housing');addPlot(3,19,'farm');addPlot(5,19,'farm');addPlot(4,18,'military');plots.forEach(p=>building(p));
 army('player',4,18,80);army('player',6,19,55);army('enemy',18,5,75);army('enemy',20,6,50);army('enemy',17,3,40);
 function updateCamera(){const h=Math.cos(pitch)*dist;camera.position.set(targetX+Math.sin(yaw)*h,Math.sin(pitch)*dist,targetZ+Math.cos(yaw)*h);camera.lookAt(targetX,0,targetZ)}
 function canPay(c){return Object.entries(c).every(([k,v])=>({gold,wood,iron,food,science,population}[k]||0)>=v)}
 function pay(c){for(const[k,v]of Object.entries(c)){if(k==='gold')gold-=v;if(k==='wood')wood-=v;if(k==='iron')iron-=v;if(k==='food')food-=v;if(k==='science')science-=v;if(k==='population')population-=v}}
 function hud(){ $('gold').textContent=Math.floor(gold).toLocaleString();$('food').textContent=Math.floor(food).toLocaleString();$('wood').textContent=Math.floor(wood).toLocaleString();$('iron').textContent=Math.floor(iron).toLocaleString();$('science').textContent=Math.floor(science).toLocaleString();$('population').textContent=Math.floor(population).toLocaleString();$('selection').textContent=selectedArmy?`Army selected · ${selectedArmy.userData.count} troops · ${selectedArmy.userData.x+1}, ${selectedArmy.userData.z+1}`:selectedPlot?`Plot selected · ${selectedPlot.x+1}, ${selectedPlot.z+1}`:'Select an army or plot.';if(selectedPlot){const d=selectedPlot.type?defs[selectedPlot.type]:null;$('plotInfo').textContent=d?`${d.name} · produces ${d.food||0} food, ${d.gold||0} gold, ${d.iron||0} iron, ${d.science||0} science per tick.`:'Empty development plot · choose a building.'}else $('plotInfo').textContent='No plot selected.';document.querySelectorAll('[data-build]').forEach(b=>{const d=defs[b.dataset.build];b.disabled=!selectedPlot||!!selectedPlot.type||!canPay(d.cost)})}
 function selectArmy(a){armies.forEach(q=>{const r=q.getObjectByName('selection');if(r)r.visible=false});selectedArmy=a;selectedPlot=null;const r=a.getObjectByName('selection');if(r)r.visible=true;$('orders').textContent='Army selected. Right-click a neighboring tile or enemy army.';hud()}
 function selectPlot(p){armies.forEach(q=>{const r=q.getObjectByName('selection');if(r)r.visible=false});selectedArmy=null;selectedPlot=p;if(p)$('orders').textContent=p.type?'This plot is already developed.':'Choose a building.';hud()}
 function rayHits(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(mouse,camera);return ray.intersectObjects(scene.children,true)}
 function groundTile(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(mouse,camera);const g=scene.children.find(o=>o.userData&&o.userData.ground);const hit=g&&ray.intersectObject(g,false)[0];return hit?tilePoint(hit.point):null}
 function adjacent(a,b){return Math.abs(a.x-b.x)<=1&&Math.abs(a.z-b.z)<=1&&!(a.x===b.x&&a.z===b.z)}
 function moveArmy(a,x,z){if(!adjacent(a.userData,{x,z})){$('orders').textContent='Move one tile at a time.';return}if(armies.some(q=>q!==a&&q.userData.owner==='player'&&q.userData.x===x&&q.userData.z===z)){$('orders').textContent='Another army is already there.';return}const from=a.position.clone(),to=pos(x,z),start=performance.now();function step(n){const t=clamp((n-start)/240,0,1),e=t*t*(3-2*t);a.position.lerpVectors(from,to,e);a.position.y=Math.sin(e*Math.PI)*.2;if(t<1)requestAnimationFrame(step);else{a.position.y=0;a.userData.x=x;a.userData.z=z;$('orders').textContent='Army moved.';hud()}}requestAnimationFrame(step)}
 function combat(a,d){if(!adjacent(a.userData,d.userData)){$('orders').textContent='That enemy army is too far away.';return}const p=a.userData.count,def=d.userData.count;a.userData.count=Math.max(0,p-Math.max(1,Math.floor(def*.2)));d.userData.count=Math.max(0,def-Math.max(1,Math.floor(p*.35)));if(d.userData.count===0){d.userData.owner='player';d.userData.count=Math.max(1,Math.floor(a.userData.count*.25));territory++;$('orders').textContent='Enemy army defeated and territory captured.'}else $('orders').textContent='Battle complete. Both armies took losses.';const c=d.userData.owner==='player'?PLAYER:ENEMY;d.children[0].material.color.set(c);hud()}
 function click(e){
  if(movedDuringDrag)return;
  const touch=window.matchMedia('(pointer:coarse)').matches;
  for(const h of rayHits(e)){
    const o=h.object;
    if(o.userData.army){
      const a=o.userData.army;
      if(a.userData.owner==='player'){selectArmy(a);return}
      if(touch&&selectedArmy&&a.userData.owner==='enemy'){combat(selectedArmy,a);return}
      return;
    }
    if(o.userData.plot){
      const p=plots.get(o.userData.plot);
      if(touch&&selectedArmy){const t=groundTile(e);if(t){moveArmy(selectedArmy,t.x,t.z);return}}
      if(p&&p.owner==='player')selectPlot(p);
      return;
    }
  }
  const t=groundTile(e);
  if(touch&&selectedArmy&&t){moveArmy(selectedArmy,t.x,t.z);return}
  if(t&&own(t.x,t.z))selectPlot(plots.get(key(t.x,t.z))||null);
  else if(!t)selectPlot(null);
}
 function context(e){e.preventDefault();if(movedDuringDrag)return;if(!selectedArmy)return;for(const h of rayHits(e)){if(h.object.userData.army){const a=h.object.userData.army;if(a.userData.owner==='enemy'){combat(selectedArmy,a);return}}}const t=groundTile(e);if(t)moveArmy(selectedArmy,t.x,t.z)}
 document.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>{if(!selectedPlot||selectedPlot.type)return;const type=b.dataset.build,d=defs[type];if(!canPay(d.cost)){$('orders').textContent='Not enough resources.';return}pay(d.cost);selectedPlot.type=type;building(selectedPlot);$('orders').textContent=`${d.name} built.`;hud()});
 $('split').onclick=()=>{if(!selectedArmy||selectedArmy.userData.count<20){$('orders').textContent='Select an army with at least 20 troops.';return}const half=Math.floor(selectedArmy.userData.count/2),spots=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]];let chosen=null;for(const[sx,sz]of spots){const x=selectedArmy.userData.x+sx,z=selectedArmy.userData.z+sz;if(x>=0&&x<MAP&&z>=0&&z<MAP&&!armies.some(a=>a.userData.x===x&&a.userData.z===z)){chosen={x,z};break}}if(!chosen){$('orders').textContent='No nearby space to split the army.';return}selectedArmy.userData.count-=half;selectArmy(army('player',chosen.x,chosen.z,half));hud()};
 $('reset').onclick=()=>location.reload();
 renderer.domElement.addEventListener('click',click);renderer.domElement.addEventListener('contextmenu',context);
 renderer.domElement.addEventListener('pointerdown',e=>{movedDuringDrag=false;if(e.button===1||e.button===2||(e.button===0&&e.shiftKey)||e.pointerType==='touch'){dragging=true;dragMode=e.button===1?'pan':'rotate';lastX=e.clientX;lastY=e.clientY;e.preventDefault();renderer.domElement.setPointerCapture?.(e.pointerId)}});
 renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>3)movedDuringDrag=true;if(dragMode==='rotate'){yaw-=dx*.006;pitch=clamp(pitch+dy*.004,.48,1.25)}else{const speed=dist*.0035;targetX-=Math.cos(yaw)*dx*speed;targetZ+=Math.sin(yaw)*dx*speed;targetX+=Math.sin(yaw)*dy*speed*.75;targetZ+=Math.cos(yaw)*dy*speed*.75}updateCamera();lastX=e.clientX;lastY=e.clientY});
 renderer.domElement.addEventListener('pointerup',e=>{if(dragging){dragging=false;try{renderer.domElement.releasePointerCapture(e.pointerId)}catch{}}});renderer.domElement.addEventListener('pointercancel',()=>{dragging=false});
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();dist=clamp(dist+e.deltaY*.025,15,62);updateCamera()},{passive:false});
 addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;const k=e.key.toLowerCase();if(k==='r')location.reload();if(['w','a','s','d'].includes(k)){const step=dist*.045;if(k==='w')targetZ-=step;if(k==='s')targetZ+=step;if(k==='a')targetX-=step;if(k==='d')targetX+=step;updateCamera()}if(k==='q'){yaw+=.12;updateCamera()}if(k==='e'){yaw-=.12;updateCamera()}if(k==='+'||k==='='){dist=clamp(dist-3,15,62);updateCamera()}if(k==='-'){dist=clamp(dist+3,15,62);updateCamera()}});
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);updateCamera()});updateCamera();hud();loading.classList.add('hidden');
 let last=performance.now();function loop(n=performance.now()){requestAnimationFrame(loop);if(n-last>=1000){last=n;let farm=0,mi=0,fac=0,res=0,mil=0,hosp=0,market=0;plots.forEach(p=>{if(!p.type)return;const d=defs[p.type];farm+=d.food||0;mi+=d.iron||0;fac+=d.gold||0;res+=d.science||0;mil+=d.troops||0;hosp+=d.pop||0;market+=d.gold||0});const use=Math.max(8,Math.floor(population/160))+mil;food+=farm-use;wood+=2;iron+=mi-2;gold+=8+fac+market;science+=res;population=Math.max(200,population+Math.floor(hosp/80)-Math.floor(Math.max(0,use-farm)/20));if(food<0){food=0;$('orders').textContent='Food shortage! Build more farms.'}armies.filter(a=>a.userData.owner==='player').forEach(a=>a.userData.count=Math.min(150,a.userData.count+mil));hud()}renderer.render(scene,camera)}loop()
}
try{if(window.THREE)boot();else{fail('Loading 3D engine…');const s=document.createElement('script');s.src='https://unpkg.com/three@0.160.0/build/three.min.js';s.onload=()=>{try{boot()}catch(e){console.error(e);fail('Could not start the 3D game. Try refreshing.')}};s.onerror=()=>fail('The 3D engine could not load. Check your connection and refresh.');document.head.appendChild(s)}}catch(e){console.error(e);fail('3D game failed to start. Refresh the page.')}
})();