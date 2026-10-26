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
 const armies=[],plots=new Map(),buildings=new T.Group(),units=new T.Group(),cities=new T.Group(),routeFinder=window.NationWarsOrders;let moving=false,commandMode=false;scene.add(buildings,units,cities);
 const targetMarker=new T.Mesh(new T.RingGeometry(.7,.94,36),new T.MeshBasicMaterial({color:0xeac978,side:T.DoubleSide,transparent:true,opacity:.9,depthTest:false}));
 targetMarker.rotation.x=-Math.PI/2;targetMarker.position.y=.29;targetMarker.visible=false;scene.add(targetMarker);
 const defs={
 farm:{name:'Farm',cost:{gold:80,wood:35},food:28},housing:{name:'Housing',cost:{gold:100,wood:70},pop:220},mine:{name:'Mine',cost:{gold:120,wood:55,iron:10},iron:16},factory:{name:'Factory',cost:{gold:180,wood:100,iron:30},gold:18},research:{name:'Research Center',cost:{gold:150,wood:70,iron:20},science:12},military:{name:'Military Base',cost:{gold:160,wood:80,iron:35},food:-4,troops:3},market:{name:'Market',cost:{gold:110,wood:60},gold:30},hospital:{name:'Hospital',cost:{gold:140,wood:80,iron:20},pop:120,science:2}};
 const cam=window.NationWarsCamera.create({camera,renderer,initial:{x:-15,z:15,yaw:.35,pitch:.91,zoom:39},bounds:34,buttons:{zoomIn:'zoomIn',zoomOut:'zoomOut',reset:'resetView'}});
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pos=(x,z)=>new T.Vector3((x-H+.5)*TILE,0,(z-H+.5)*TILE),key=(x,z)=>x+'-'+z;
 function tilePoint(p){const x=Math.floor(p.x/TILE+H),z=Math.floor(p.z/TILE+H);return x>=0&&z>=0&&x<MAP&&z<MAP?{x,z}:null}
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
 function canPay(c){return Object.entries(c).every(([k,v])=>({gold,wood,iron,food,science,population}[k]||0)>=v)}
 function pay(c){for(const[k,v]of Object.entries(c)){if(k==='gold')gold-=v;if(k==='wood')wood-=v;if(k==='iron')iron-=v;if(k==='food')food-=v;if(k==='science')science-=v;if(k==='population')population-=v}}
 function hud(){ $('gold').textContent=Math.floor(gold).toLocaleString();$('food').textContent=Math.floor(food).toLocaleString();$('wood').textContent=Math.floor(wood).toLocaleString();$('iron').textContent=Math.floor(iron).toLocaleString();$('science').textContent=Math.floor(science).toLocaleString();$('population').textContent=Math.floor(population).toLocaleString();$('selection').textContent=selectedArmy?`Army selected · ${selectedArmy.userData.count} troops · ${selectedArmy.userData.x+1}, ${selectedArmy.userData.z+1}`:selectedPlot?`Plot selected · ${selectedPlot.x+1}, ${selectedPlot.z+1}`:'Select an army or plot.';if(selectedPlot){const d=selectedPlot.type?defs[selectedPlot.type]:null;$('plotInfo').textContent=d?`${d.name} · produces ${d.food||0} food, ${d.gold||0} gold, ${d.iron||0} iron, ${d.science||0} science per tick.`:'Empty development plot · choose a building.'}else $('plotInfo').textContent='No plot selected.';document.querySelectorAll('[data-build]').forEach(b=>{const d=defs[b.dataset.build];b.disabled=!selectedPlot||!!selectedPlot.type||!canPay(d.cost)});if($('moveOrder')){$('moveOrder').disabled=!selectedArmy||moving;$('moveOrder').setAttribute('aria-pressed',String(commandMode&&!!selectedArmy));}if($('cancelOrder'))$('cancelOrder').disabled=!selectedArmy||moving;if($('split'))$('split').disabled=!selectedArmy||moving||selectedArmy.userData.count<20;}
 function selectArmy(a){if(moving)return;armies.forEach(q=>{const r=q.getObjectByName('selection');if(r)r.visible=false});selectedArmy=a;selectedPlot=null;commandMode=true;const r=a.getObjectByName('selection');if(r)r.visible=true;$('orders').textContent='Squad selected. Click or tap any destination to march there. Select an enemy squad to approach and attack.';hud()}
 function selectPlot(p){if(moving)return;armies.forEach(q=>{const r=q.getObjectByName('selection');if(r)r.visible=false});selectedArmy=null;commandMode=false;selectedPlot=p;if(p)$('orders').textContent=p.type?'This plot is already developed.':'Choose a building.';hud()}
 function rayHits(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(mouse,camera);return ray.intersectObjects(scene.children,true)}
 function groundTile(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(mouse,camera);const point=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());return point?tilePoint(point):null}

 function adjacent(a,b){return Math.abs(a.x-b.x)<=1&&Math.abs(a.z-b.z)<=1&&!(a.x===b.x&&a.z===b.z)}
 function combat(a,d){
   if(!adjacent(a.userData,d.userData)){$('orders').textContent='Move closer to the enemy first.';return}
   if(a.userData.count<=0){$('orders').textContent='This squad has no troops left.';return}
   const attack=a.userData.count,defense=d.userData.count;
   a.userData.count=Math.max(0,attack-Math.max(1,Math.floor(defense*.2)));
   d.userData.count=Math.max(0,defense-Math.max(1,Math.floor(attack*.35)));
   if(d.userData.count===0){
     d.userData.owner='player';
     d.userData.count=Math.max(1,Math.floor(a.userData.count*.25));
     territory++;
     $('orders').textContent='Enemy squad defeated. Territory secured.';
   }else $('orders').textContent='Battle finished. Both squads took losses.';
   d.children[0]?.material?.color?.set(d.userData.owner==='player'?PLAYER:ENEMY);
   hud();
 }
 function issueOrder(x,z){
   if(!selectedArmy){$('orders').textContent='Select a friendly squad first.';return}
   if(moving){$('orders').textContent='That squad is already moving.';return}
   if(!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x>=MAP||z>=MAP){
     $('orders').textContent='Select a tile inside the battlefield.';return;
   }
   const movingArmy=selectedArmy;
   const occupant=armies.find(a=>a!==movingArmy&&a.userData.count>0&&a.userData.x===x&&a.userData.z===z);
   if(occupant?.userData.owner==='player'){selectArmy(occupant);return}
   const enemy=occupant?.userData.owner==='enemy'?occupant:null;
   const start={x:movingArmy.userData.x,z:movingArmy.userData.z};
   const blocked=new Set(armies.filter(a=>a!==movingArmy&&a.userData.count>0).map(a=>a.userData.x+','+a.userData.z));
   const path=routeFinder.route({start,goal:{x,z},size:MAP,blocked,approach:!!enemy});
   if(!path){$('orders').textContent='No clear route to that destination. Try a different tile.';return}
   if(!enemy&&!path.length){$('orders').textContent='Your squad is already on that tile.';return}
   moving=true;commandMode=true;targetMarker.position.x=pos(x,z).x;targetMarker.position.z=pos(x,z).z;targetMarker.visible=true;
   $('orders').textContent=enemy?'Marching toward the enemy squad…':`Moving squad · ${path.length} tile(s) to destination…`;
   hud();
   function finish(){
     moving=false;targetMarker.visible=false;
     if(enemy&&enemy.userData.owner==='enemy')combat(movingArmy,enemy);
     else $('orders').textContent='Squad arrived. Choose another destination or select another squad.';
     hud();
   }
   function takeStep(index){
     if(index>=path.length){finish();return}
     const target=path[index],from=movingArmy.position.clone(),to=pos(target.x,target.z),startTime=performance.now();
     function frame(now){
       const progress=clamp((now-startTime)/230,0,1),eased=progress*progress*(3-2*progress);
       movingArmy.position.lerpVectors(from,to,eased);
       movingArmy.position.y=Math.sin(Math.PI*eased)*.16;
       if(progress<1){requestAnimationFrame(frame);return}
       movingArmy.position.copy(to);
       movingArmy.userData.x=target.x;movingArmy.userData.z=target.z;
       $('orders').textContent=enemy
         ?`Approaching enemy · ${index+1}/${path.length} tile(s)…`
         :`Moving squad · ${index+1}/${path.length} tile(s)…`;
       hud();takeStep(index+1);
     }
     requestAnimationFrame(frame);
   }
   takeStep(0);
 }
 function click(e){
   if(moving)return;
   const hits=rayHits(e);
   const armyHit=hits.find(h=>h.object.userData.army)?.object.userData.army;
   if(armyHit?.userData.owner==='player'){selectArmy(armyHit);return}
   if(selectedArmy&&commandMode){
     if(armyHit?.userData.owner==='enemy'){issueOrder(armyHit.userData.x,armyHit.userData.z);return}
     const destination=groundTile(e);
     if(destination){issueOrder(destination.x,destination.z);return}
     $('orders').textContent='Click or tap a tile inside the battlefield.';return;
   }
   for(const hit of hits){
     const key=hit.object.userData.plot,p=key?plots.get(key):null;
     if(p&&p.owner==='player'){selectPlot(p);return}
   }
   const destination=groundTile(e);
   if(destination&&own(destination.x,destination.z))selectPlot(plots.get(key(destination.x,destination.z))||null);
   else selectPlot(null);
 }
 function context(e){
   e.preventDefault();
   if(moving)return;
   if(!selectedArmy){$('orders').textContent='First select a friendly squad.';return}
   const hits=rayHits(e),enemy=hits.find(h=>h.object.userData.army?.userData.owner==='enemy')?.object.userData.army;
   if(enemy){issueOrder(enemy.userData.x,enemy.userData.z);return}
   const target=groundTile(e);
   if(target)issueOrder(target.x,target.z);
 }
 document.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>{if(!selectedPlot||selectedPlot.type)return;const type=b.dataset.build,d=defs[type];if(!canPay(d.cost)){$('orders').textContent='Not enough resources.';return}pay(d.cost);selectedPlot.type=type;building(selectedPlot);$('orders').textContent=`${d.name} built.`;hud()});
 $('moveOrder').onclick=()=>{if(!selectedArmy||moving)return;commandMode=true;$('orders').textContent='Move / Attack active. Click or tap a destination, even several tiles away.';hud()};
 $('cancelOrder').onclick=()=>{if(moving)return;selectPlot(null);$('orders').textContent='Order cancelled. Select a squad or plot.';};
 $('split').onclick=()=>{if(!selectedArmy||selectedArmy.userData.count<20){$('orders').textContent='Select an army with at least 20 troops.';return}const half=Math.floor(selectedArmy.userData.count/2),spots=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]];let chosen=null;for(const[sx,sz]of spots){const x=selectedArmy.userData.x+sx,z=selectedArmy.userData.z+sz;if(x>=0&&x<MAP&&z>=0&&z<MAP&&!armies.some(a=>a.userData.x===x&&a.userData.z===z)){chosen={x,z};break}}if(!chosen){$('orders').textContent='No nearby space to split the army.';return}selectedArmy.userData.count-=half;selectArmy(army('player',chosen.x,chosen.z,half));hud()};
 $('reset').onclick=()=>location.reload();
 renderer.domElement.addEventListener('click',e=>{if(!cam.consumeClick())click(e)});renderer.domElement.addEventListener('contextmenu',e=>{if(cam.consumeClick()){e.preventDefault();return}context(e)});
 // Mouse, touch and keyboard camera controls are owned by shared camera3d.js.
 addEventListener('keydown',e=>{
   if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;
   if(e.key.toLowerCase()==='r'&&!e.repeat&&!(e.ctrlKey||e.metaKey||e.altKey))location.reload();
 });
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);cam.update(performance.now())});cam.update(performance.now());hud();loading.classList.add('hidden');
 let last=performance.now();function loop(n=performance.now()){requestAnimationFrame(loop);if(n-last>=1000){last=n;let farm=0,mi=0,fac=0,res=0,mil=0,hosp=0,market=0;plots.forEach(p=>{if(!p.type)return;const d=defs[p.type];farm+=d.food||0;mi+=d.iron||0;fac+=d.gold||0;res+=d.science||0;mil+=d.troops||0;hosp+=d.pop||0;market+=d.gold||0});const use=Math.max(8,Math.floor(population/160))+mil;food+=farm-use;wood+=2;iron+=mi-2;gold+=8+fac+market;science+=res;population=Math.max(200,population+Math.floor(hosp/80)-Math.floor(Math.max(0,use-farm)/20));if(food<0){food=0;$('orders').textContent='Food shortage! Build more farms.'}armies.filter(a=>a.userData.owner==='player').forEach(a=>a.userData.count=Math.min(150,a.userData.count+mil));hud()}cam.update(n);renderer.render(scene,camera)}loop()
}
try{if(window.THREE)boot();else{fail('Loading 3D engine…');const s=document.createElement('script');s.src='https://unpkg.com/three@0.160.0/build/three.min.js';s.onload=()=>{try{boot()}catch(e){console.error(e);fail('Could not start the 3D game. Try refreshing.')}};s.onerror=()=>fail('The 3D engine could not load. Check your connection and refresh.');document.head.appendChild(s)}}catch(e){console.error(e);fail('3D game failed to start. Refresh the page.')}
})();