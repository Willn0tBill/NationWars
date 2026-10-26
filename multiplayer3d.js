(()=>{'use strict';
const SERVER=window.NW_SERVER_URL||new URLSearchParams(location.search).get('server')||'wss://nationwars.onrender.com/ws', $=id=>document.getElementById(id),mount=$('game');let T=window.THREE,scene,camera,renderer,ray,mouse,ws,state=null,myId=null,selected=null,drag=false,lx=0,ly=0,yaw=.15,pitch=.9,dist=43,retry=0;const art=window.NationWarsVisuals;let world=null;
function status(x){$('status').textContent=x}function fail(x){status(x)}
function start(){if(!T||!art){fail('3D engine or visual assets did not load. Refresh the page.');return}try{init()}catch(e){console.error(e);fail('3D multiplayer failed to start. Refresh the page.')}}
if(!T){status('Loading 3D engine…');let s=document.createElement('script');s.src='https://unpkg.com/three@0.160.0/build/three.min.js';s.onload=()=>{T=window.THREE;start()};s.onerror=()=>fail('Could not load the 3D engine.');document.head.appendChild(s)}else start();
function init(){
 scene=new T.Scene();camera=new T.PerspectiveCamera(50,innerWidth/innerHeight,.1,220);renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.1:1.5));renderer.setSize(innerWidth,innerHeight);renderer.domElement.style.touchAction='none';mount.replaceChildren(renderer.domElement);ray=new T.Raycaster();mouse=new T.Vector2();art.atmosphere(T,scene,renderer,true);events();cameraUpdate();connect();loop()}
 function connect(){if(ws&&ws.readyState===1)return;status(retry?'Reconnecting to multiplayer server…':'Connecting to multiplayer server…');try{ws=new WebSocket(SERVER)}catch(e){schedule();return}ws.onopen=()=>{retry=0;status('Connected. Create a room or join with a code.')};ws.onerror=()=>status('Server connection failed. Retrying…');ws.onclose=()=>{status('Disconnected. Retrying…');schedule()};ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='error'){status(m.message||'Server error');return}if(m.type==='created'||m.type==='joined'){myId=m.you;$('roomOut').textContent=m.room;if($('lobbyRoom'))$('lobbyRoom').textContent=m.room;if($('readyLobby'))$('readyLobby').disabled=false;status('Room '+m.room+' ready. Share the code and ready up when everyone has joined.')}if(m.type==='lobby'){
  $('roomOut').textContent=m.room;
  if($('lobbyRoom'))$('lobbyRoom').textContent=m.room;
  const you=m.players.find(p=>p.id===myId),isReady=!!you?.ready;
  if($('readyLobby')){$('readyLobby').disabled=!myId;$('readyLobby').textContent=isReady?'Not Ready':'Ready Up';}
  if($('lobbyPlayers'))$('lobbyPlayers').textContent=m.players.map(p=>p.name+(p.ready?' ✓ Ready':' · Waiting')).join('  |  ');
  status(m.players.length+' player(s) in lobby · '+(m.players.length<2?'At least two players are needed.':'Everyone must ready up to begin.'));
}if(m.type==='start'||m.type==='state'){state=m.state||m;$('lobby').classList.add('hidden');draw();hud();}if(m.type==='gameOver'){state=m.final;draw();hud();$('help').innerHTML=m.winner===myId?'<span class="win">Victory! You control the winning nation.</span>':'The battle has ended.'}}}
 function schedule(){if(retry>6)return;retry++;setTimeout(connect,Math.min(8000,1500*retry))}function send(m){if(ws&&ws.readyState===1)ws.send(JSON.stringify(m));else status('Still connecting to the multiplayer server…')}
 function mapSize(){return state?Math.round(Math.sqrt(Object.keys(state.tiles||{}).length))||16:16}function pof(id,size){let [r,c]=id.split('-').map(Number),h=size/2;return new T.Vector3((c-h+.5)*2.5,0,(r-h+.5)*2.5)}
 function disposeTree(root){
  root.traverse(o=>{
    if(o.geometry)o.geometry.dispose();
    if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());
  });
  scene.remove(root);
}
function createWorld(size){
  if(world&&world.size===size)return world;
  if(world){
    for(const obj of world.objects)disposeTree(obj);
    world=null;
  }
  const before=new Set(scene.children);
  art.ground(T,scene,size,2.5);
  const decorations=scene.children.filter(o=>!before.has(o));
  const count=size*size, ids=[];
  for(let r=0;r<size;r++)for(let c=0;c<size;c++)ids.push(r+'-'+c);
  const tileMesh=new T.InstancedMesh(
    art.roundedTileGeometry(T,2.5),
    new T.MeshStandardMaterial({color:0xffffff,roughness:.88,metalness:.03}),
    count
  );
  tileMesh.userData={instanceToId:ids};
  tileMesh.castShadow=false;tileMesh.receiveShadow=true;
  const platform=new T.InstancedMesh(
    new T.CylinderGeometry(.49,.55,.13,16),
    new T.MeshStandardMaterial({color:0xffffff,roughness:.78,metalness:.08}),
    count
  );
  const bodies=new T.InstancedMesh(
    new T.CapsuleGeometry(.115,.29,4,8),
    new T.MeshStandardMaterial({color:0xffffff,roughness:.85}),
    count*3
  );
  const heads=new T.InstancedMesh(
    new T.SphereGeometry(.145,10,7),
    new T.MeshStandardMaterial({color:0xffffff,roughness:.82}),
    count*3
  );
  const towers=new T.InstancedMesh(
    new T.ConeGeometry(.25,.4,5),
    new T.MeshStandardMaterial({color:0xffffff,roughness:.86}),
    count
  );
  for(const obj of [tileMesh,platform,bodies,heads,towers]){obj.frustumCulled=false;scene.add(obj)}
  const ring=new T.Mesh(new T.RingGeometry(.87,1.03,48),new T.MeshBasicMaterial({color:0xffdc85,side:T.DoubleSide,transparent:true,opacity:.96}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.32;ring.visible=false;scene.add(ring);
  world={size,ids,tileMesh,platform,bodies,heads,towers,ring,objects:[...decorations,tileMesh,platform,bodies,heads,towers,ring]};
  return world;
}
let tmp=null;const skyHex=0xe0e8df;
function pose(inst,i,x,y,z,scale=1){
  if(!tmp)tmp=new T.Object3D();
  tmp.position.set(x,y,z);tmp.rotation.set(0,0,0);
  tmp.scale.setScalar(scale);
  tmp.updateMatrix();inst.setMatrixAt(i,tmp.matrix);
}
function draw(){
  if(!state||!state.tiles)return;
  const size=mapSize(),w=createWorld(size),players=new Map((state.players||[]).map(p=>[p.id,p]));
  const neutral=new T.Color(0x749081),skyColor=new T.Color(skyHex);
  for(let i=0;i<w.ids.length;i++){
    const id=w.ids[i],t=state.tiles[id]||{owner:null,troops:0};
    const p=pof(id,size),player=players.get(t.owner);
    const color=player?new T.Color(player.color):neutral.clone();
    if(player)color.lerp(skyColor,.14);
    else color.offsetHSL((i%5-2)*.008,0,(i%7-3)*.008);
    pose(w.tileMesh,i,p.x,.055,p.z);
    w.tileMesh.setColorAt(i,color);
    const active=(Number(t.troops)||0)>0;
    pose(w.platform,i,p.x,.25,p.z,active?1:.0001);
    w.platform.setColorAt(i,player?new T.Color(player.color):new T.Color(0xa5ad9b));
    const n=active?Math.min(3,Math.max(1,Math.floor(t.troops/15)+1)):0;
    for(let j=0;j<3;j++){
      const instance=i*3+j,visible=j<n;
      const angle=j*Math.PI*2/3-.45,x=p.x+Math.cos(angle)*.23,z=p.z+Math.sin(angle)*.23;
      pose(w.bodies,instance,x,.58,z,visible?1:.0001);
      pose(w.heads,instance,x,.88,z,visible?1:.0001);
      w.bodies.setColorAt(instance,player?new T.Color(player.color).lerp(skyColor,.43):new T.Color(0xaeb9ad));
      w.heads.setColorAt(instance,player?new T.Color(0x273c46):new T.Color(0x6b7971));
    }
    pose(w.towers,i,p.x+.60,.51,p.z-.55,player?1:.0001);
    w.towers.setColorAt(i,player?new T.Color(player.color):neutral);
  }
  for(const inst of [w.tileMesh,w.platform,w.bodies,w.heads,w.towers]){
    inst.instanceMatrix.needsUpdate=true;
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  }
  highlight();
}
 function tileFrom(e){let r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1;ray.setFromCamera(mouse,camera);for(const h of ray.intersectObjects(scene.children,true)){if(h.object.userData.instanceToId&&Number.isInteger(h.instanceId))return h.object.userData.instanceToId[h.instanceId];if(h.object.userData.id&&h.object.userData.id!=='ground')return h.object.userData.id;}return null}
 function adjacent(a,b){let [ar,ac]=a.split('-').map(Number),[br,bc]=b.split('-').map(Number);if(Math.abs(ar-br)>1)return false;if(ar===br)return Math.abs(ac-bc)===1;let allowed=(ar%2===0)?[ac-1,ac]:[ac,ac+1];return Math.abs(ar-br)===1&&allowed.includes(bc)}
 function click(e){if(drag){drag=false;return}if(!state)return;let id=tileFrom(e);if(!id||!state.tiles[id])return;let t=state.tiles[id];if(t.owner===myId){selected=id;$('selected').textContent=`Selected territory ${id} · ${t.troops} troops`;$('help').textContent='Right-click an adjacent territory to move or attack.';highlight()}else if(selected)order(id)}
 function order(to){let from=selected,t=state.tiles[from];if(!t||t.owner!==myId)return;if(!adjacent(from,to)){$('help').textContent='That territory is not adjacent.';return}if(t.troops<2){$('help').textContent='This territory needs more troops before moving.';return}let amount=Math.max(1,Math.floor(t.troops*.6));send({type:'action',from,to,amount});$('help').textContent='Order sent. Waiting for server update.'}
 function highlight(){
  if(!world)return;
  world.ring.visible=!!selected&&!!state?.tiles?.[selected];
  if(world.ring.visible){const p=pof(selected,world.size);world.ring.position.set(p.x,.32,p.z)}
 }
 function hud(){if(!state)return;let mine=Object.values(state.tiles).filter(t=>t.owner===myId);$('territory').textContent=mine.length;$('troops').textContent=mine.reduce((s,t)=>s+t.troops,0);let sec=state.time||0;$('time').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');if(selected&&!state.tiles[selected]){selected=null;$('selected').textContent='Select one of your territories.'}}
 function cameraUpdate(){let h=Math.cos(pitch)*dist;camera.position.set(Math.sin(yaw)*h,Math.sin(pitch)*dist,Math.cos(yaw)*h);camera.lookAt(0,0,0)}
 function events(){
  $('create').onclick=()=>send({type:'create',name:$('name').value.trim()||'Commander',settings:{mapSize:24,gameLength:30}});
  if($('readyLobby'))$('readyLobby').onclick=()=>{
    if(!myId){status('Create or join a room first.');return;}
    const ready=$('readyLobby').textContent==='Ready Up';
    send({type:'ready',ready});
    $('readyLobby').textContent=ready?'Not Ready':'Ready Up';
  };$('join').onclick=()=>{let room=$('room').value.trim().toUpperCase();if(!room){status('Enter a room code first.');return}send({type:'join',name:$('name').value.trim()||'Commander',room})};$('ready').onclick=()=>send({type:'ready',ready:true});$('back').onclick=()=>{try{if(ws)ws.close()}catch{}location.href='index.html'};
  renderer.domElement.addEventListener('click',click);renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();if(state&&selected){let id=tileFrom(e);if(id)order(id)}});
  renderer.domElement.addEventListener('pointerdown',e=>{
    drag=false;lx=e.clientX;ly=e.clientY;
    if(e.button===1||(e.button===0&&e.shiftKey))renderer.domElement.setPointerCapture?.(e.pointerId);
  });renderer.domElement.addEventListener('pointermove',e=>{if((e.buttons&4)||(e.buttons&1&&e.shiftKey)){let dx=e.clientX-lx,dy=e.clientY-ly;if(Math.abs(dx)+Math.abs(dy)>3)drag=true;yaw-=dx*.006;pitch=Math.max(.48,Math.min(1.18,pitch+dy*.004));cameraUpdate();lx=e.clientX;ly=e.clientY}});renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(17,Math.min(58,dist+e.deltaY*.025));cameraUpdate()},{passive:false});addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})}
 function loop(){requestAnimationFrame(loop);renderer.render(scene,camera)}})();