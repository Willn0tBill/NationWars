(()=>{'use strict';
const $=id=>document.getElementById(id),mount=$('game'),loading=$('loading');
const fail=t=>{if(loading){loading.textContent=t;loading.classList.remove('hidden')}};
function boot(){
 if(!window.THREE||!window.NationWarsVisuals||!window.NationWarsSystems||!window.NationWarsOrders||!window.NationWarsCamera)throw Error('Required Nation Wars game modules unavailable');const T=THREE,art=window.NationWarsVisuals,systems=window.NationWarsSystems;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,innerWidth/innerHeight,.1,220),renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'}),ray=new T.Raycaster(),mouse=new T.Vector2();
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.25:1.7));renderer.setSize(innerWidth,innerHeight);renderer.domElement.style.touchAction='none';mount.replaceChildren(renderer.domElement);
 art.atmosphere(T,scene,renderer,matchMedia('(pointer:coarse)').matches||(navigator.deviceMemory&&navigator.deviceMemory<=4));
 const MAP=24,H=MAP/2,TILE=2.5,PLAYER='#4da6ff',ENEMY='#ef6262';let selectedArmy=null,selectedPlot=null,territory=56,gold=1000,food=800,wood=300,iron=150,oil=145,science=0,population=2500,gameSeconds=0,waveNumber=0,rallyPicking=null;
 let yaw=.35,pitch=.91,dist=39,targetX=-15,targetZ=15,dragging=false,dragMode='',lastX=0,lastY=0,movedDuringDrag=false;
 const armies=[],plots=new Map(),claims=new Map(),tileMeshes=new Map(),supplyLines=new Map(),buildings=new T.Group(),units=new T.Group(),cities=new T.Group(),routeFinder=window.NationWarsOrders;let moving=false,commandMode=false;scene.add(buildings,units,cities);
 const targetMarker=new T.Mesh(new T.RingGeometry(.7,.94,36),new T.MeshBasicMaterial({color:0xeac978,side:T.DoubleSide,transparent:true,opacity:.9,depthTest:false}));
 targetMarker.rotation.x=-Math.PI/2;targetMarker.position.y=.29;targetMarker.visible=false;scene.add(targetMarker);
 const defs={
 farm:{name:'Farm',cost:{gold:80,wood:35},food:28},housing:{name:'Housing',cost:{gold:100,wood:70},pop:220},mine:{name:'Mine',cost:{gold:120,wood:55,iron:10},iron:16},factory:{name:'Factory',cost:{gold:180,wood:100,iron:30},gold:18},research:{name:'Research Center',cost:{gold:150,wood:70,iron:20},science:12},military:{name:'Military Barracks',cost:{gold:160,wood:80,iron:35},food:-4},market:{name:'Market',cost:{gold:110,wood:60},gold:30},hospital:{name:'Hospital',cost:{gold:140,wood:80,iron:20},pop:120,science:2},refinery:{name:'Oil Refinery',cost:{gold:225,wood:95,iron:45},oil:14,gold:-3}};
 const cam=window.NationWarsCamera.create({camera,renderer,initial:{x:-15,z:15,yaw:.35,pitch:.91,zoom:39},bounds:34,buttons:{zoomIn:'zoomIn',zoomOut:'zoomOut',reset:'resetView'}});
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pos=(x,z)=>new T.Vector3((x-H+.5)*TILE,0,(z-H+.5)*TILE),key=(x,z)=>x+'-'+z;
 function tilePoint(p){const x=Math.floor(p.x/TILE+H),z=Math.floor(p.z/TILE+H);return x>=0&&z>=0&&x<MAP&&z<MAP?{x,z}:null}
 function own(x,z){return claims.get(key(x,z))==='player'}
 function terrain(){return art.ground(T,scene,MAP,TILE)}
 function plotMesh(x,z,owner='player'){
   const id=key(x,z),existing=tileMeshes.get(id);
   if(existing){claims.set(id,owner);existing.material.color.set(owner==='player'?0x51896c:owner==='enemy'?0xa66e6a:0x789182);existing.userData.owner=owner;return existing}
   const m=art.tile(T,owner==='player'?0x51896c:owner==='enemy'?0xa66e6a:0x789182,TILE),p=pos(x,z);
   m.position.x=p.x;m.position.z=p.z;
   m.userData={plot:id,owner};scene.add(m);tileMeshes.set(id,m);claims.set(id,owner);return m;
 }
 function addPlot(x,z,type=null){
   const id=key(x,z),mesh=plotMesh(x,z,'player');
   let plot=plots.get(id);
   if(!plot){plot={x,z,type,owner:'player',mesh,building:null};plots.set(id,plot)}
   if(type)plot.type=type;
   return plot;
 }
 function claimCell(x,z,owner){
   if(x<0||z<0||x>=MAP||z>=MAP)return;
   const id=key(x,z),old=claims.get(id);
   if(old===owner)return;
   if(owner==='player'){addPlot(x,z)}
   else{
     const plot=plots.get(id);
     if(plot){if(plot.building)buildings.remove(plot.building);plots.delete(id);supplyLines.delete(id)}
     plotMesh(x,z,owner);
     if(selectedPlot?.x===x&&selectedPlot?.z===z)selectPlot(null);
   }
   if(owner==='player'&&old!=='player')territory++;
   if(owner==='enemy'&&old==='player')territory=Math.max(0,territory-1);
 }
 function building(plot){
   if(plot.building){buildings.remove(plot.building);plot.building.traverse(o=>{o.geometry?.dispose?.()})}
   if(!plot.type)return;
   const g=art.building(T,plot.type),p=pos(plot.x,plot.z),id=key(plot.x,plot.z);
   g.position.set(p.x,0,p.z);g.userData.plot=id;
   g.traverse(o=>{if(o.isMesh)o.userData.plot=id});
   buildings.add(g);plot.building=g;
 }
 function army(owner,x,z,count,type='infantry'){
   const c=owner==='player'?PLAYER:ENEMY,g=art.army(T,c,count,false,type);
   g.position.copy(pos(x,z));g.userData={owner,x,z,count,type,busy:false};
   g.traverse(o=>{if(o.isMesh)o.userData.army=g});
   const ring=new T.Mesh(new T.RingGeometry(.78,.96,40),new T.MeshBasicMaterial({color:0xfde39e,transparent:true,opacity:.98,side:T.DoubleSide}));
   ring.rotation.x=-Math.PI/2;ring.position.y=.22;ring.visible=false;ring.name='selection';ring.userData.army=g;
   g.add(ring);units.add(g);armies.push(g);return g;
 }
 function alive(owner){return armies.filter(a=>a.userData.owner===owner&&a.userData.count>0)}
 function removeArmy(a){
   const i=armies.indexOf(a);if(i>=0)armies.splice(i,1);
   units.remove(a);
   a.traverse(o=>{if(o.geometry)o.geometry.dispose()});
   if(selectedArmy===a){selectedArmy=null;commandMode=false;targetMarker.visible=false}
 }
 function wallet(){return{gold,food,wood,iron,oil,science,population}}
 function changeWallet(w){gold=w.gold;food=w.food;wood=w.wood;iron=w.iron;oil=w.oil;science=w.science;population=w.population}
 terrain();for(let z=15;z<=22;z++)for(let x=1;x<=7;x++)addPlot(x,z);for(let z=1;z<=7;z++)for(let x=16;x<=22;x++)plotMesh(x,z,'enemy');
 function city(owner,x,z){
   const g=art.city(T,owner);
   g.position.copy(pos(x,z));cities.add(g);
 }
 city('player',4,19);city('enemy',19,4);addPlot(4,19,'housing');addPlot(3,19,'farm');addPlot(5,19,'farm');addPlot(4,18,'military');plots.forEach(p=>building(p));
 army('player',4,18,80,'infantry');army('player',6,19,55,'recon');army('enemy',18,5,75,'infantry');army('enemy',20,6,50,'armor');army('enemy',17,3,40,'recon');
 function canPay(c){return systems.resourcesCanPay(wallet(),c)}
 function pay(c){const w=wallet();if(!systems.applyCost(w,c))return false;changeWallet(w);return true}
 function hud(){
   const put=(id,value)=>{const el=$(id);if(el)el.textContent=String(value)};
   for(const[k,v]of Object.entries({gold,food,wood,iron,oil,science,population}))put(k,Math.floor(v).toLocaleString());
   put('territoryCount',territory);
   put('enemyCount',alive('enemy').length);
   put('waveClock',Math.max(0,systems.WAVE_INTERVAL-gameSeconds%systems.WAVE_INTERVAL)+'s');
   put('selection',selectedArmy?`${systems.types[selectedArmy.userData.type]?.label||'Squad'} · ${selectedArmy.userData.count} units · ${selectedArmy.userData.x+1},${selectedArmy.userData.z+1}`:selectedPlot?`Plot ${selectedPlot.x+1},${selectedPlot.z+1} · ${selectedPlot.type?defs[selectedPlot.type]?.name:'Empty'}`:'Select an army or plot.');
   if(selectedPlot){
     const d=selectedPlot.type?defs[selectedPlot.type]:null;
     put('plotInfo',d?`${d.name} · ${Object.entries(d).filter(([k,v])=>typeof v==='number').map(([k,v])=>v+' '+k).join(' · ')} each second.`:'Empty development plot · choose a building.');
   }else put('plotInfo','Choose a friendly territory to develop.');
   document.querySelectorAll('[data-build]').forEach(b=>{
     const def=defs[b.dataset.build];b.disabled=!selectedPlot||!!selectedPlot.type||!canPay(def.cost);
   });
   if($('moveOrder')){$('moveOrder').disabled=!selectedArmy||moving;$('moveOrder').setAttribute('aria-pressed',String(commandMode&&!!selectedArmy))}
   if($('cancelOrder'))$('cancelOrder').disabled=!selectedArmy||moving;
   if($('split'))$('split').disabled=!selectedArmy||moving||selectedArmy.userData.count<20;
   const select=$('trainUnit'),train=$('recruitBtn'),barrack=selectedPlot?.type==='military'?selectedPlot:null,type=select?.value||'infantry';
   const price=systems.trainingCost(type);
   put('trainCost',systems.formattedCost(price));
   const chosen=systems.types[type];
   if(chosen)put('unitDescription',`Strength ×${chosen.power} · Move ${chosen.oilPerTile} oil/tile or ${chosen.cashPerTile} cash/tile · Speed ×${chosen.speed}`);
   if(train)train.disabled=!barrack||!canPay(price)||alive('player').length>=systems.PLAYER_CAP||!freeSpawn(barrack);
   if($('barracksSelect'))$('barracksSelect').disabled=!barracks().length;
   const unlocked=supplyUnlocked();
   const unlockText=unlocked?'UNLOCKED':`Requires ${systems.AUTO_TERRITORY} territories (${territory}), ${systems.AUTO_SCIENCE} science (${Math.floor(science)}), and 2 barracks (${barracks().length}).`;
   put('automationInfo',unlockText);
   const line=barrack?supplyLines.get(key(barrack.x,barrack.z)):null;
   if($('supplyToggle')){$('supplyToggle').disabled=!barrack||!unlocked;$('supplyToggle').textContent=line?.enabled?'Pause Supply Line':'Enable Supply Line'}
   if($('setRally'))$('setRally').disabled=!barrack||!unlocked;
   put('supplyStatus',line?`${line.enabled?'Active':'Paused'} · ${systems.types[line.type]?.label||'Infantry'} · ${line.rally?`Rally ${line.rally.x+1},${line.rally.z+1}`:'No rally tile'} · ${line.shipments||0} shipment(s)`:'Select a barracks to configure a supply line.');
   put('supplyCount',[...supplyLines.values()].filter(line=>line.enabled).length);
 }
 function selectArmy(a){if(moving)return;armies.forEach(q=>{const r=q.getObjectByName('selection');if(r)r.visible=false});selectedArmy=a;selectedPlot=null;commandMode=true;const r=a.getObjectByName('selection');if(r)r.visible=true;$('orders').textContent='Squad selected. Click or tap any destination to march there. Select an enemy squad to approach and attack.';hud()}
 function selectPlot(p){if(moving)return;armies.forEach(q=>{const r=q.getObjectByName('selection');if(r)r.visible=false});selectedArmy=null;commandMode=false;selectedPlot=p;if(p)$('orders').textContent=p.type==='military'?'Barracks selected. Recruit a unit or configure a supply line.':p.type?'This plot is already developed.':'Choose a building.';hud()}
 function rayHits(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(mouse,camera);return ray.intersectObjects(scene.children,true)}
 function groundTile(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(mouse,camera);const point=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());return point?tilePoint(point):null}

 function adjacent(a,b){return Math.abs(a.x-b.x)<=1&&Math.abs(a.z-b.z)<=1&&!(a.x===b.x&&a.z===b.z)}
 function combat(a,d){
   if(!a||!d||a===d||!adjacent(a.userData,d.userData)||a.userData.owner===d.userData.owner)return;
   const attacker=a.userData,defender=d.userData;
   const offense=systems.types[attacker.type]?.power||1,defense=systems.types[defender.type]?.power||1;
   const attackDamage=Math.max(3,Math.floor(attacker.count*offense*.34));
   const counterDamage=Math.max(2,Math.floor(defender.count*defense*.18));
   defender.count=Math.max(0,defender.count-attackDamage);
   attacker.count=Math.max(0,attacker.count-counterDamage);
   const winner=defender.count===0?attacker.owner:attacker.count===0?defender.owner:null;
   if(defender.count===0){removeArmy(d);if(attacker.count>0)claimCell(defender.x,defender.z,attacker.owner)}
   if(attacker.count===0)removeArmy(a);
   $('orders').textContent=winner?(winner==='player'?'Your squad secured the battlefield.':'Enemy forces took the position.'):'Clash resolved; squads are still contesting the area.';
   hud();
 }
 function nearestDestination(x,z,owner){
   const candidates=alive(owner);
   if(!candidates.length)return null;
   return candidates.reduce((a,b)=>Math.max(Math.abs(a.userData.x-x),Math.abs(a.userData.z-z))<=Math.max(Math.abs(b.userData.x-x),Math.abs(b.userData.z-z))?a:b);
 }
 function occupied(x,z,ignore=null){return armies.find(a=>a!==ignore&&a.userData.count>0&&a.userData.x===x&&a.userData.z===z)}
 function findRoute(a,x,z,approach=false){
   const blocked=new Set(armies.filter(o=>o!==a&&o.userData.count>0).map(o=>o.userData.x+','+o.userData.z));
   return routeFinder.route({start:{x:a.userData.x,z:a.userData.z},goal:{x,z},size:MAP,blocked,approach});
 }
 function travelBill(a,steps){
   const cost=systems.travelQuote(a.userData.type,steps,wallet());
   if(!cost)return null;
   const w=wallet();w[cost.currency]-=cost.amount;changeWallet(w);
   return cost;
 }
 function march(a,path,done=()=>{},quiet=false){
   if(a.userData.busy)return false;
   a.userData.busy=true;
   if(!quiet&&selectedArmy===a)moving=true;
   if(!path.length){a.userData.busy=false;moving=false;done();hud();return true}
   function step(index){
     if(a.userData.count<=0||!armies.includes(a)){a.userData.busy=false;moving=false;targetMarker.visible=false;return}
     if(index>=path.length){
       a.userData.busy=false;
       if(!quiet){moving=false;targetMarker.visible=false}
       done();hud();return;
     }
     const target=path[index],from=a.position.clone(),to=pos(target.x,target.z),started=performance.now();
     const duration=240/(systems.types[a.userData.type]?.speed||1);
     function frame(now){
       const t=clamp((now-started)/duration,0,1),ease=t*t*(3-2*t);
       a.position.lerpVectors(from,to,ease);
       a.position.y=Math.sin(Math.PI*ease)*.16;
       if(t<1){requestAnimationFrame(frame);return}
       a.position.copy(to);a.userData.x=target.x;a.userData.z=target.z;
       if(!occupied(target.x,target.z,a))claimCell(target.x,target.z,a.userData.owner);
       if(!quiet)$('orders').textContent=`Moving squad · ${index+1}/${path.length} tile(s)…`;
       if(!quiet)hud();step(index+1);
     }
     requestAnimationFrame(frame);
   }
   step(0);hud();return true;
 }
 function issueOrder(x,z){
   if(!selectedArmy||selectedArmy.userData.owner!=='player'){ $('orders').textContent='Select a friendly squad first.';return }
   if(moving||selectedArmy.userData.busy){$('orders').textContent='This squad is already moving.';return}
   if(!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x>=MAP||z>=MAP){$('orders').textContent='Choose a tile inside the map.';return}
   const a=selectedArmy,other=occupied(x,z,a);
   if(other?.userData.owner==='player'){selectArmy(other);return}
   const enemy=other?.userData.owner==='enemy'?other:null;
   const path=findRoute(a,x,z,!!enemy);
   if(!path){$('orders').textContent='No path available. Try another destination.';return}
   if(!enemy&&!path.length){$('orders').textContent='Squad already at destination.';return}
   const fare=travelBill(a,path.length);
   if(!fare){$('orders').textContent=`Not enough oil or cash to move ${path.length} tile(s). Build an Oil Refinery or earn more cash.`;return}
   targetMarker.position.set(pos(x,z).x,.29,pos(x,z).z);targetMarker.visible=true;
   $('orders').textContent=`Movement funded: ${fare.amount} ${fare.currency==='gold'?'cash':'oil'}. ${enemy?'Approaching enemy…':'Marching…'}`;
   march(a,path,()=>{if(enemy&&enemy.userData.count>0)combat(a,enemy);else $('orders').textContent='Squad arrived. Select another destination.';hud()});
 }
 function freeSpawn(plot){
   const options=[];
   for(let radius=1;radius<=3;radius++)for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
     if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
     const x=plot.x+dx,z=plot.z+dz;
     if(x>=0&&z>=0&&x<MAP&&z<MAP&&own(x,z)&&!occupied(x,z))options.push({x,z});
   }
   return options[0]||null;
 }
 function trainAt(plot,type,automatic=false){
   if(!plot||plot.type!=='military'||!own(plot.x,plot.z))return{error:'Select a friendly Military Barracks first.'};
   const spec=systems.types[type];if(!spec)return{error:'Choose a valid unit type.'};
   if(alive('player').length>=systems.PLAYER_CAP)return{error:'Unit cap reached. Merge or reposition squads.'};
   const spot=freeSpawn(plot);if(!spot)return{error:'Clear an empty friendly tile near the barracks to recruit.'};
   const price=systems.trainingCost(type,automatic);
   if(!canPay(price))return{error:`Need ${systems.formattedCost(price)}.`};
   pay(price);
   const squad=army('player',spot.x,spot.z,spec.count,type);
   return{squad,spot,price};
 }
 function barracks(){return[...plots.values()].filter(p=>p.type==='military'&&own(p.x,p.z))}
 function supplyUnlocked(){return systems.unlockAuto({territories:territory,science,barracks:barracks().length})}
 function processSupplyLines(){
   if(!supplyUnlocked())return;
   for(const[id,line]of supplyLines){
     if(!line.enabled||!line.rally)continue;
     const plot=plots.get(id);
     if(!plot||plot.type!=='military'||!own(plot.x,plot.z)){supplyLines.delete(id);continue}
     if(alive('player').length>=systems.PLAYER_CAP)continue;
     const spot=freeSpawn(plot);if(!spot)continue;
     if(!own(line.rally.x,line.rally.z))continue;
     // Each shipment needs a free friendly delivery space. Once the rally tile
     // is occupied, use the nearest available friendly neighboring tile.
     let delivery=null;
     for(let radius=0;radius<=3&&!delivery;radius++)for(let dx=-radius;dx<=radius&&!delivery;dx++)for(let dz=-radius;dz<=radius;dz++){
       const x=line.rally.x+dx,z=line.rally.z+dz;
       if(x<0||z<0||x>=MAP||z>=MAP||!own(x,z)||occupied(x,z)||x===spot.x&&z===spot.z)continue;
       delivery={x,z};
       break;
     }
     if(!delivery)continue;
     const blocked=new Set(armies.filter(a=>a.userData.count>0).map(a=>a.userData.x+','+a.userData.z));
     const path=routeFinder.route({start:spot,goal:delivery,size:MAP,blocked});
     if(!path)continue;
     const training=systems.trainingCost(line.type,true);
     const fare=systems.travelQuote(line.type,path.length,{gold:gold-(training.gold||0),oil:oil-(training.oil||0)});
     if(!fare||!canPay(training))continue;
     const trained=trainAt(plot,line.type,true);
     if(trained.error)continue;
     const a=trained.squad;
     const travel=travelBill(a,path.length);
     if(!travel)continue;
     march(a,path,()=>{if(selectedArmy!==a)$('orders').textContent=`Supply line delivered a ${systems.types[line.type].label} squad.`;},true);
     line.shipments=(line.shipments||0)+1;
   }
   hud();
 }
 function spawnWave(){
   const total=alive('enemy').length;
   waveNumber++;
   if(total>=systems.ENEMY_CAP){hud();return}
   const slots=[];
   for(let z=1;z<=8;z++)for(let x=15;x<=22;x++){
     if(claims.get(key(x,z))==='enemy'&&!occupied(x,z))slots.push({x,z});
   }
   slots.sort((a,b)=>Math.hypot(a.x-19,a.z-4)-Math.hypot(b.x-19,b.z-4));
   const amount=Math.min(1+Math.floor(waveNumber/3),3,systems.ENEMY_CAP-total,slots.length);
   for(let i=0;i<amount;i++){
     const k=(waveNumber*3+i*7)%Math.max(1,slots.length),site=slots.splice(k,1)[0];
     if(!site)continue;
     const choices=['infantry','recon','armor','artillery'];
     const type=choices[(waveNumber+i)%Math.min(4,2+Math.floor(waveNumber/2))];
     army('enemy',site.x,site.z,systems.types[type].count+6+waveNumber*2,type);
   }
   $('orders').textContent=`Enemy wave ${waveNumber} arrived (${amount} squad${amount===1?'':'s'}). Defend your borders!`;
   hud();
 }
 function enemyTurn(){
   const player=alive('player');if(!player.length)return;
   const candidates=alive('enemy').filter(a=>!a.userData.busy).sort((a,b)=>a.userData.x-b.userData.x);
   for(const enemy of candidates.slice(0,Math.min(4,2+Math.floor(waveNumber/2)))){
     const target=nearestDestination(enemy.userData.x,enemy.userData.z,'player');if(!target)break;
     if(adjacent(enemy.userData,target.userData)){combat(enemy,target);continue}
     const path=findRoute(enemy,target.userData.x,target.userData.z,true);
     if(path?.length)march(enemy,[path[0]],()=>{},true);
   }
 }
 function click(e){
   if(moving)return;
   if(rallyPicking){
     const tile=groundTile(e);
     if(!tile){$('orders').textContent='Select a valid tile on the map for your rally point.';return}
     if(!own(tile.x,tile.z)){$('orders').textContent='Supply rally points must be inside your controlled territory.';return}
     const line=supplyLines.get(rallyPicking)||{enabled:false,type:$('trainUnit')?.value||'infantry',shipments:0};
     line.rally=tile;supplyLines.set(rallyPicking,line);rallyPicking=null;
     $('orders').textContent=`Rally point set to ${tile.x+1}, ${tile.z+1}. Enable the supply line to start automatic training.`;
     hud();return;
   }
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
 $('barracksSelect').onclick=()=>{
   const list=barracks();if(!list.length){$('orders').textContent='Build a Military Barracks first.';return}
   selectPlot(list[0]);
   $('trainingSection')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 };
 $('trainUnit').onchange=()=>{
   if(selectedPlot?.type==='military'){
     const id=key(selectedPlot.x,selectedPlot.z),line=supplyLines.get(id);
     if(line)line.type=$('trainUnit').value;
   }
   hud();
 };
 $('recruitBtn').onclick=()=>{
   const result=trainAt(selectedPlot,$('trainUnit').value,false);
   $('orders').textContent=result.error||`${systems.types[$('trainUnit').value].label} trained at the Military Barracks. Click the new squad to command it.`;
   hud();
 };
 $('setRally').onclick=()=>{
   if(!selectedPlot||selectedPlot.type!=='military'||!supplyUnlocked())return;
   rallyPicking=key(selectedPlot.x,selectedPlot.z);
   $('orders').textContent='Rally selection: click a friendly tile to deliver new units automatically.';
 };
 $('supplyToggle').onclick=()=>{
   if(!selectedPlot||selectedPlot.type!=='military'||!supplyUnlocked())return;
   const id=key(selectedPlot.x,selectedPlot.z);
   const line=supplyLines.get(id)||{enabled:false,type:$('trainUnit').value,rally:null,shipments:0};
   if(!line.enabled&&!line.rally){$('orders').textContent='Set a rally tile before enabling your supply line.';return}
   line.enabled=!line.enabled;line.type=$('trainUnit').value;supplyLines.set(id,line);
   $('orders').textContent=line.enabled?`Automated ${systems.types[line.type].label} shipments enabled. Training costs 2× resources; delivery consumes oil or cash.`:'Supply line paused.';
   hud();
 };
 $('moveOrder').onclick=()=>{if(!selectedArmy||moving)return;commandMode=true;$('orders').textContent='Move / Attack active. Click or tap a destination, even several tiles away.';hud()};
 $('cancelOrder').onclick=()=>{if(moving)return;selectPlot(null);$('orders').textContent='Order cancelled. Select a squad or plot.';};
 $('split').onclick=()=>{if(!selectedArmy||selectedArmy.userData.count<20){$('orders').textContent='Select an army with at least 20 troops.';return}if(!canPay({oil:2})&&!canPay({gold:14})){$('orders').textContent='Splitting a squad requires 2 oil or 14 cash.';return}const half=Math.floor(selectedArmy.userData.count/2),spots=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]];let chosen=null;for(const[sx,sz]of spots){const x=selectedArmy.userData.x+sx,z=selectedArmy.userData.z+sz;if(x>=0&&x<MAP&&z>=0&&z<MAP&&!armies.some(a=>a.userData.x===x&&a.userData.z===z)){chosen={x,z};break}}if(!chosen){$('orders').textContent='No nearby space to split the army.';return}if(oil>=2)oil-=2;else gold-=14;selectedArmy.userData.count-=half;selectArmy(army('player',chosen.x,chosen.z,half,selectedArmy.userData.type));hud()};
 $('reset').onclick=()=>location.reload();
 renderer.domElement.addEventListener('click',e=>{if(!cam.consumeClick())click(e)});renderer.domElement.addEventListener('contextmenu',e=>{if(cam.consumeClick()){e.preventDefault();return}context(e)});
 // Mouse, touch and keyboard camera controls are owned by shared camera3d.js.
 addEventListener('keydown',e=>{
   if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;
   if(e.key.toLowerCase()==='r'&&!e.repeat&&!(e.ctrlKey||e.metaKey||e.altKey))location.reload();
 });
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);cam.update(performance.now())});cam.update(performance.now());hud();loading.classList.add('hidden');
 let last=performance.now();
 function economyTick(){
   gameSeconds++;
   let foodRate=0,ironRate=0,cashRate=0,scienceRate=0,oilRate=0,popRate=0;
   plots.forEach(p=>{
     if(!own(p.x,p.z)||!p.type)return;
     const d=defs[p.type];foodRate+=d.food||0;ironRate+=d.iron||0;
     cashRate+=d.gold||0;scienceRate+=d.science||0;oilRate+=d.oil||0;popRate+=d.pop||0;
   });
   const foodUse=Math.max(6,Math.floor(population/180))+Math.ceil(alive('player').reduce((sum,a)=>sum+a.userData.count,0)/150);
   food=Math.max(0,food+foodRate-foodUse);
   iron=Math.max(0,iron+ironRate-2);
   wood+=3;gold=Math.max(0,gold+10+cashRate);oil=Math.max(0,oil+oilRate);
   science=Math.max(0,science+scienceRate);
   population=Math.max(200,population+Math.floor(popRate/80)-(food===0?8:0));
   if(gameSeconds%systems.WAVE_INTERVAL===0)spawnWave();
   if(gameSeconds%5===0)enemyTurn();
   if(gameSeconds%systems.AUTO_INTERVAL===0)processSupplyLines();
   if(food===0&&gameSeconds%10===0)$('orders').textContent='Food shortage! Build farms to support your nation.';
   hud();
 }
 function loop(now=performance.now()){
   requestAnimationFrame(loop);
   // Limit catch-up work when a background tab resumes.
   if(now-last>=1000){
     const elapsed=Math.min(3,Math.floor((now-last)/1000));
     last=now;
     for(let i=0;i<elapsed;i++)economyTick();
   }
   cam.update(now);renderer.render(scene,camera);
 }
 loop()
}
try{if(window.THREE)boot();else{fail('Loading 3D engine…');const s=document.createElement('script');s.src='https://unpkg.com/three@0.160.0/build/three.min.js';s.onload=()=>{try{boot()}catch(e){console.error(e);fail('Could not start the 3D game. Try refreshing.')}};s.onerror=()=>fail('The 3D engine could not load. Check your connection and refresh.');document.head.appendChild(s)}}catch(e){console.error(e);fail('3D game failed to start. Refresh the page.')}
})();