const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 16;
const TICK_MS = 1000;
const rooms = new Map();

const COLORS = ['#4da3ff','#ff5c5c','#55d68a','#b47cff','#ffb84d','#35c9c9','#ff78b7','#c7d64a','#8b9cff','#ff8c42','#62d6ff','#d68cff','#72d68c','#f06d9b','#d6c05c','#8fa8b8'];

function cleanName(name) {
  return String(name || 'Commander').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 18) || 'Commander';
}
function roomCode() {
  let code;
  do code = crypto.randomBytes(3).toString('hex').toUpperCase(); while (rooms.has(code));
  return code;
}
function key(r,c) { return `${r}-${c}`; }
function neighbors(id, size) {
  const [r,c] = id.split('-').map(Number), even = r % 2 === 0;
  const offsets = even ? [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]] : [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]];
  return offsets.map(([dr,dc]) => key(r+dr,c+dc)).filter(x => {
    const [rr,cc] = x.split('-').map(Number); return rr >= 0 && rr < size && cc >= 0 && cc < size;
  });
}
function distance(a,b) { const [ar,ac]=a.split('-').map(Number), [br,bc]=b.split('-').map(Number); return Math.abs(ar-br)+Math.abs(ac-bc); }

function makeMap(size, playerCount) {
  const tiles = {};
  for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
    const id=key(r,c); tiles[id]={owner:null,troops:Math.floor(3+Math.random()*4),shield:1};
  }
  const starts=[];
  for (let i=0;i<playerCount;i++) {
    const angle=(Math.PI*2*i)/playerCount, radius=Math.max(2, Math.floor(size*.34));
    const r=Math.max(0,Math.min(size-1,Math.round(size/2+Math.sin(angle)*radius)));
    const c=Math.max(0,Math.min(size-1,Math.round(size/2+Math.cos(angle)*radius)));
    let id=key(r,c);
    if (starts.includes(id)) { for (const candidate of Object.keys(tiles)) if (!starts.includes(candidate) && distance(candidate,id)>=3) { id=candidate; break; } }
    starts.push(id);
  }
  return {tiles,starts};
}

function newRoom(host, settings={}) {
  const room={code:roomCode(),players:new Map(),status:'lobby',size:settings.mapSize===24?24:16,gameLength:settings.gameLength===60?60:30,created:Date.now(),state:null};
  room.players.set(host.id,host); host.room=room.code; host.host=true;
  rooms.set(room.code,room); return room;
}
function publicPlayers(room) { return [...room.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,ready:p.ready,host:!!p.host,connected:p.ws&&p.ws.readyState===1})); }
function broadcast(room,msg) { const data=JSON.stringify(msg); for(const p of room.players.values()) if(p.ws&&p.ws.readyState===1) p.ws.send(data); }
function lobby(room) { broadcast(room,{type:'lobby',room:room.code,players:publicPlayers(room),settings:{mapSize:room.size,gameLength:room.gameLength}}); }

function startGame(room) {
  if (room.status==='game') return;
  const players=[...room.players.values()]; if(players.length<2) return;
  const {tiles,starts}=makeMap(room.size,players.length);
  players.forEach((p,i)=>{p.index=i;p.ready=true;tiles[starts[i]]={owner:p.id,troops:40,shield:2};});
  room.state={time:0,tiles,started:Date.now()}; room.status='game';
  broadcast(room,{type:'start',players:publicPlayers(room),state:snapshot(room)});
}
function snapshot(room) { return {time:room.state.time,tiles:room.state.tiles,players:publicPlayers(room),status:room.status}; }
function player(room,id){return room.players.get(id);}
function validAction(room,p,msg){
  if(room.status!=='game'||!room.state) return false;
  const a=room.state.tiles[msg.from], d=room.state.tiles[msg.to];
  if(!a||!d||a.owner!==p.id||!neighbors(msg.from,room.size).includes(msg.to)) return false;
  const amount=Math.floor(Number(msg.amount)); if(!Number.isFinite(amount)||amount<1||amount>a.troops) return false;
  if(d.owner===p.id) { const moved=Math.min(amount,100-d.troops); if(moved<1)return false; a.troops-=moved;d.troops+=moved;return true; }
  a.troops-=amount;
  const defense=d.troops+d.shield;
  if(amount>defense){d.owner=p.id;d.troops=Math.min(100,amount-defense);}
  else d.troops=Math.max(1,defense-amount-d.shield);
  return true;
}
function tick(room){
  if(room.status!=='game'||!room.state)return;
  room.state.time++;
  for(const p of room.players.values()){
    for(const t of Object.values(room.state.tiles)) if(t.owner===p.id) t.troops=Math.min(100,t.troops+1);
  }
  const counts=[...room.players.values()].map(p=>Object.values(room.state.tiles).filter(t=>t.owner===p.id).length);
  const active=counts.filter(x=>x>0).length;
  const winner=active===1 && room.players.size>1 ? room.players[[...counts].findIndex(x=>x>0)].id : null;
  if(winner || room.state.time>=room.gameLength*60){
    room.status='finished'; broadcast(room,{type:'gameOver',winner,final:snapshot(room)}); return;
  }
  broadcast(room,{type:'state',state:snapshot(room)});
}

const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify({name:'Nation Wars',version:'0.4.0',rooms:rooms.size}));});
const wss=new WebSocketServer({server});

wss.on('connection',ws=>{
  const id=crypto.randomUUID(); const p={id,ws,name:'Commander',color:COLORS[0],ready:false,host:false,room:null};
  ws.on('message',raw=>{
    let msg; try{msg=JSON.parse(raw.toString())}catch{return;}
    if(msg.type==='create'){
      p.name=cleanName(msg.name);p.color=COLORS[0];const room=newRoom(p,msg.settings||{});ws.send(JSON.stringify({type:'created',room:room.code,you:p.id}));lobby(room);return;
    }
    if(msg.type==='join'){
      const room=rooms.get(String(msg.room||'').toUpperCase());if(!room||room.status!=='lobby'||room.players.size>=MAX_PLAYERS){ws.send(JSON.stringify({type:'error',message:'That room is unavailable.'}));return;}
      p.name=cleanName(msg.name);p.color=COLORS[room.players.size%COLORS.length];p.room=room.code;room.players.set(p.id,p);ws.send(JSON.stringify({type:'joined',room:room.code,you:p.id}));lobby(room);return;
    }
    if(!p.room)return;const room=rooms.get(p.room);if(!room)return;
    if(msg.type==='ready'){p.ready=!!msg.ready;lobby(room);if([...room.players.values()].length>=2&&[...room.players.values()].every(x=>x.ready))startGame(room);return;}
    if(msg.type==='start'&&p.host){startGame(room);return;}
    if(msg.type==='action'&&validAction(room,p,msg)){broadcast(room,{type:'state',state:snapshot(room)});return;}
    if(msg.type==='leave'){room.players.delete(p.id);lobby(room);}
  });
  ws.on('close',()=>{if(!p.room)return;const room=rooms.get(p.room);if(!room)return;p.ws=null;if(room.status==='lobby'){room.players.delete(p.id);if(p.host){const next=room.players.values().next().value;if(next){next.host=true;next.color=COLORS[0];}}lobby(room);} });
});

setInterval(()=>{for(const room of rooms.values())tick(room);},TICK_MS);
setInterval(()=>{for(const [code,room] of rooms){if(room.players.size===0||Date.now()-room.created>6*60*60*1000)rooms.delete(code);}},60000);
server.listen(PORT,()=>console.log(`Nation Wars server listening on ${PORT}`));
