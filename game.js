// DOMINATION - GAME ENGINE
// Cleaned-up game logic: one state object, one loop, consistent hex math,
// smarter bots, safe wave expansion, camera controls, and supply lines.

const DIFFICULTIES = {
  1: { name: 'Easy', startingTroops: 100, startingTiles: 5, troopRate: 3, botStrength: .45, botIntelligence: .45, shield: 0, score: .6, bots: 2, growth: 1.08 },
  2: { name: 'Normal', startingTroops: 50, startingTiles: 4, troopRate: 1.5, botStrength: .8, botIntelligence: .8, shield: 1, score: 1, bots: 3, growth: 1.15 },
  3: { name: 'Hard', startingTroops: 35, startingTiles: 3, troopRate: 1.15, botStrength: 1.15, botIntelligence: 1.15, shield: 2, score: 1.75, bots: 4, growth: 1.25 },
  4: { name: 'Expert', startingTroops: 20, startingTiles: 2, troopRate: .8, botStrength: 1.55, botIntelligence: 1.6, shield: 3, score: 3, bots: 5, growth: 1.35 },
  5: { name: 'Insane', startingTroops: 12, startingTiles: 1, troopRate: .55, botStrength: 2, botIntelligence: 2, shield: 5, score: 5, bots: 6, growth: 1.5 }
};

const state = {
  active: false, paused: false, mode: 'domination', difficulty: 2, playerName: 'Commander',
  score: 0, time: 0, wave: 1, waveTimer: 120, mapSize: 8,
  tiles: {}, bots: [], selected: null, deployment: 50, botsDefeated: 0,
  loop: null, lastTick: 0, lastBotAction: 0, lastSpawn: 0,
  zoom: 1, cameraX: 0, cameraY: 0, dragging: false, dragX: 0, dragY: 0, startCameraX: 0, startCameraY: 0,
  supplyMode: false, supplySource: null, supplyLines: {}, hexSize: 62
};

const DIFF_KEY = 'dominationDifficulty';
const $ = id => document.getElementById(id);
const els = {
  board: $('gameBoard'), grid: $('hexGrid'), gridWrap: $('hexGridWrapper'), gridContainer: $('hexGridContainer'),
  status: $('gameStatus'), playerName: $('playerName'), mode: $('currentMode'), slider: $('troopSlider'), troopValue: $('troopValue'),
  selected: $('selectedTileInfo'), pause: $('pauseBtn'), minimap: $('minimap'), sidePanel: $('sidePanel'),
  wave: $('currentWave'), timer: $('nextWaveTimer'), statTiles: $('statTiles'), statScore: $('statScore'), statTroops: $('statTroops'), statBots: $('statBots')
};

function difficulty() { return DIFFICULTIES[state.difficulty] || DIFFICULTIES[2]; }
function tile(id) { return state.tiles[id]; }
function ownedBy(owner) { return Object.keys(state.tiles).filter(id => state.tiles[id].owner === owner); }
function totalTroops(owner = 'player') { return ownedBy(owner).reduce((n, id) => n + Math.floor(tile(id)[owner + 'Troops']), 0); }
function setStatus(text, kind = 'player') { els.status.textContent = text; els.status.className = `status ${kind}`; }
function formatTime(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

function hexNeighbors(row, col) {
  const even = row % 2 === 0;
  const offsets = even
    ? [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]]
    : [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]];
  return offsets.map(([dr, dc]) => `${row + dr}-${col + dc}`).filter(id => state.tiles[id]);
}

function adjacent(a, b) {
  if (!state.tiles[a] || !state.tiles[b]) return false;
  const [r, c] = a.split('-').map(Number);
  return hexNeighbors(r, c).includes(b);
}

function gridMetrics() {
  const size = state.hexSize, height = size * 1.1547, xStep = size * .866, yStep = height * .75;
  return { size, height, xStep, yStep, width: state.mapSize * xStep + size * .134, heightTotal: state.mapSize * yStep + height * .25 };
}

function createMap() {
  els.grid.innerHTML = '';
  state.tiles = {};
  const m = gridMetrics();
  els.grid.style.width = `${m.width}px`;
  els.grid.style.height = `${m.heightTotal}px`;
  for (let r = 0; r < state.mapSize; r++) {
    for (let c = 0; c < state.mapSize; c++) {
      const id = `${r}-${c}`;
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'hex-tile neutral'; el.id = `hex-${id}`; el.dataset.id = id;
      el.style.width = `${m.size}px`; el.style.height = `${m.height}px`;
      el.style.left = `${c * m.xStep + (r % 2 ? m.xStep / 2 : 0)}px`; el.style.top = `${r * m.yStep}px`;
      el.innerHTML = '<span class="tile-content"><span class="tile-troops">0</span><span class="tile-id">0,0</span><span class="tile-shield"></span></span>';
      el.querySelector('.tile-id').textContent = `${r},${c}`;
      el.addEventListener('click', () => handleTileClick(id));
      els.grid.appendChild(el);
      state.tiles[id] = { owner: 'neutral', playerTroops: 0, botTroops: 0, neutralTroops: 2 + Math.floor(Math.random() * 4), shield: difficulty().shield };
    }
  }
  updateAllTiles(); updateCamera(); updateMinimap();
}

function setOwner(id, owner) {
  const t = tile(id); if (!t) return;
  t.owner = owner;
  if (owner === 'player') { t.neutralTroops = 0; t.botTroops = 0; }
  if (owner === 'bot') { t.neutralTroops = 0; t.playerTroops = 0; }
  if (owner === 'neutral') { t.playerTroops = 0; t.botTroops = 0; }
  updateTile(id);
}

function updateTile(id) {
  const t = tile(id), el = $(`hex-${id}`); if (!t || !el) return;
  el.className = `hex-tile ${t.owner}${state.selected === id ? ' selected' : ''}${state.supplySource === id ? ' supply-source' : ''}`;
  const count = t.owner === 'player' ? t.playerTroops : t.owner === 'bot' ? t.botTroops : t.neutralTroops;
  el.querySelector('.tile-troops').textContent = Math.floor(count);
  el.querySelector('.tile-shield').textContent = t.shield ? `+${t.shield}` : '';
  el.setAttribute('aria-label', `${t.owner} tile ${id}, ${Math.floor(count)} troops`);
}
function updateAllTiles() { Object.keys(state.tiles).forEach(updateTile); }

function updateUI() {
  els.playerName.textContent = state.playerName;
  els.mode.textContent = state.supplyMode ? 'Supply' : state.mode === 'domination' ? 'Domination' : state.mode === 'bots' ? 'Bots Battle' : '1v1 Duel';
  els.troopValue.textContent = `${state.deployment}%`;
  els.selected.textContent = state.selected ? `${state.selected} (${Math.floor(tile(state.selected)?.playerTroops || 0)})` : 'None';
  els.statTiles.textContent = ownedBy('player').length; els.statScore.textContent = Math.floor(state.score);
  els.statTroops.textContent = totalTroops(); els.statBots.textContent = ownedBy('bot').length;
  els.wave.textContent = state.wave; els.timer.textContent = formatTime(Math.max(0, state.waveTimer));
  els.pause.innerHTML = state.paused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
}

function startMode() {
  state.active = true; state.paused = false; state.score = 0; state.time = 0; state.wave = 1; state.waveTimer = 120;
  state.bots = []; state.selected = null; state.botsDefeated = 0; state.lastBotAction = 0; state.lastSpawn = 0;
  state.mapSize = 8; state.zoom = 1; state.cameraX = 0; state.cameraY = 0; state.supplyMode = false; state.supplySource = null; state.supplyLines = {};
  createMap();
  if (state.mode === 'domination') setupDomination(); else if (state.mode === 'bots') setupBotsBattle(); else setup1v1();
  centerCamera(); updateUI(); setStatus(`Welcome, ${state.playerName}. Select one of your tiles, then choose an adjacent tile.`);
}

function givePlayerStart() {
  const d = difficulty(), center = Math.floor(state.mapSize / 2);
  const candidates = [`${center}-${center}`, `${center}-${center+1}`, `${center+1}-${center}`, `${center}-${center-1}`, `${center-1}-${center}`, `${center+1}-${center+1}`];
  candidates.slice(0, d.startingTiles).forEach(id => { if (tile(id)) { setOwner(id, 'player'); tile(id).playerTroops = d.startingTroops; updateTile(id); } });
}
function setupDomination() { givePlayerStart(); spawnBots(difficulty().bots); }
function setupBotsBattle() {
  const d = difficulty(), positions = [`0-0`, `0-${state.mapSize-1}`, `${state.mapSize-1}-0`, `${state.mapSize-1}-${state.mapSize-1}`, `1-${state.mapSize-2}`, `${state.mapSize-2}-1`];
  const start = positions[0]; setOwner(start, 'player'); tile(start).playerTroops = d.startingTroops;
  positions.slice(1, d.bots + 1).forEach((id, i) => spawnBotAt(id, d.startingTroops * (1 + i * .08), 1));
}
function setup1v1() {
  const d = difficulty(), row = Math.floor(state.mapSize / 2), p = `${row}-1`, b = `${row}-${state.mapSize-2}`;
  setOwner(p, 'player'); tile(p).playerTroops = d.startingTroops; spawnBotAt(b, d.startingTroops * 1.15, 1.25, true);
}

function spawnBotAt(id, troops, strength = 1, elite = false) {
  if (!tile(id) || tile(id).owner !== 'neutral') return false;
  setOwner(id, 'bot'); tile(id).botTroops = Math.min(100, Math.max(1, troops));
  state.bots.push({ id: `bot-${Date.now()}-${Math.random().toString(16).slice(2)}`, home: id, strength, intelligence: strength, aggression: elite ? .85 : .45 + Math.random() * .3 });
  return true;
}
function spawnBots(count) {
  const candidates = Object.keys(state.tiles).filter(id => tile(id).owner === 'neutral');
  for (let i = 0; i < count && candidates.length; i++) {
    const safe = candidates.filter(id => {
      const [r,c] = id.split('-').map(Number);
      return ownedBy('player').every(pid => { const [pr,pc] = pid.split('-').map(Number); return Math.abs(pr-r) + Math.abs(pc-c) >= 3; });
    });
    const pool = safe.length ? safe : candidates, id = pool[Math.floor(Math.random() * pool.length)], idx = candidates.indexOf(id);
    if (idx >= 0) candidates.splice(idx, 1);
    const growth = Math.pow(difficulty().growth, state.wave - 1);
    spawnBotAt(id, difficulty().startingTroops * (.75 + Math.random() * .45) * growth, growth);
  }
}

function attack(from, to, amount, owner = 'player') {
  const a = tile(from), d = tile(to); if (!a || !d || amount < 1) return false;
  const attackKey = owner === 'player' ? 'playerTroops' : 'botTroops'; if (a.owner !== owner || a[attackKey] < amount) return false;
  a[attackKey] -= amount;
  const defense = d.shield + (d.owner === 'neutral' ? d.neutralTroops : d.owner === 'player' ? d.playerTroops : d.botTroops);
  if (amount > defense) {
    const survivors = amount - defense, oldOwner = d.owner;
    if (oldOwner === 'bot' && owner === 'player') state.botsDefeated++;
    d.playerTroops = owner === 'player' ? survivors : 0; d.botTroops = owner === 'bot' ? survivors : 0; d.neutralTroops = 0;
    setOwner(to, owner);
    if (owner === 'player') state.score += oldOwner === 'bot' ? 100 : 25;
    else if (oldOwner === 'player') state.score = Math.max(0, state.score - 20);
    animateBattle(from, to); return true;
  }
  const remaining = Math.max(1, defense - amount);
  if (d.owner === 'neutral') d.neutralTroops = Math.max(1, remaining - d.shield);
  else if (d.owner === 'player') d.playerTroops = Math.max(1, remaining - d.shield);
  else d.botTroops = Math.max(1, remaining - d.shield);
  animateBattle(from, to); return false;
}

function moveTroops(from, to, amount) {
  const a = tile(from), d = tile(to); if (!a || !d || amount < 1 || a.playerTroops < amount) return;
  if (d.owner === 'player') { const moved = Math.min(amount, 100 - d.playerTroops); a.playerTroops -= moved; d.playerTroops += moved; }
  else attack(from, to, amount, 'player');
  updateTile(from); updateTile(to); updateUI(); updateMinimap();
}

function handleTileClick(id) {
  if (!state.active || state.paused) return;
  if (state.supplyMode) return handleSupplyClick(id);
  const t = tile(id); if (!t) return;
  if (!state.selected) {
    if (t.owner === 'player' && t.playerTroops >= 1) { state.selected = id; updateTile(id); updateUI(); setStatus(`Selected ${id}. Choose an adjacent tile.`); }
    return;
  }
  if (id === state.selected) { deselect(); return; }
  const from = state.selected;
  if (!adjacent(from, id)) { setStatus('That tile is not adjacent.'); deselect(); return; }
  const amount = Math.floor(tile(from).playerTroops * state.deployment / 100);
  if (amount < 1) { setStatus('Not enough troops to deploy.'); return; }
  moveTroops(from, id, amount); deselect();
}
function deselect() { if (state.selected) updateTile(state.selected); state.selected = null; updateUI(); }

function botActions() {
  for (const bot of state.bots) {
    const owned = ownedBy('bot').filter(id => tile(id).botTroops >= 5); if (!owned.length) continue;
    const from = owned[Math.floor(Math.random() * owned.length)], options = hexNeighbors(...from.split('-').map(Number));
    const playerTargets = options.filter(id => tile(id).owner === 'player'), neutralTargets = options.filter(id => tile(id).owner === 'neutral');
    const amount = Math.floor(tile(from).botTroops * (.35 + bot.aggression * .3)); if (amount < 1) continue;
    let target = null;
    if (playerTargets.length && Math.random() < bot.aggression) target = playerTargets.sort((a,b) => (tile(a).playerTroops + tile(a).shield) - (tile(b).playerTroops + tile(b).shield))[0];
    else if (neutralTargets.length) target = neutralTargets.sort((a,b) => tile(a).neutralTroops - tile(b).neutralTroops)[0];
    else if (options.length) target = options[Math.floor(Math.random() * options.length)];
    if (target) attack(from, target, amount, 'bot');
    updateTile(from); if (target) updateTile(target);
  }
}

function generateTroops(dt) {
  const d = difficulty();
  for (const id of ownedBy('player')) tile(id).playerTroops = Math.min(100, tile(id).playerTroops + d.troopRate * dt);
  for (const id of ownedBy('bot')) tile(id).botTroops = Math.min(100, tile(id).botTroops + d.troopRate * .8 * d.botStrength * dt);
  processSupply(dt);
}
function processSupply(dt) {
  for (const source of Object.keys(state.supplyLines)) {
    const s = tile(source); if (!s || s.owner !== 'player') continue;
    for (const target of Object.keys(state.supplyLines[source])) {
      const t = tile(target); if (!t || t.owner !== 'player' || s.playerTroops <= 70 || t.playerTroops >= 100) continue;
      const amount = Math.min(s.playerTroops - 70, 8 * dt, 100 - t.playerTroops); s.playerTroops -= amount; t.playerTroops += amount;
    }
  }
}
function handleSupplyClick(id) {
  const t = tile(id);
  if (!state.supplySource) { if (t?.owner !== 'player') return; state.supplySource = id; updateTile(id); setStatus(`Supply source ${id} selected. Choose a friendly target.`); }
  else if (id === state.supplySource) { state.supplySource = null; updateAllTiles(); }
  else if (t?.owner === 'player') { const source = state.supplySource; state.supplyLines[source] ??= {}; state.supplyLines[source][id] = true; state.supplySource = null; updateAllTiles(); drawSupplyLines(); setStatus(`Supply line created: ${source} → ${id}`); }
}
function toggleSupplyMode() { state.supplyMode = !state.supplyMode; state.supplySource = null; deselect(); updateUI(); updateAllTiles(); drawSupplyLines(); setStatus(state.supplyMode ? 'Supply mode: choose a source tile.' : 'Supply mode disabled.'); }
function clearSupplyLines() { state.supplyLines = {}; state.supplySource = null; updateAllTiles(); drawSupplyLines(); setStatus('Supply lines cleared.'); }
function drawSupplyLines() {
  document.querySelectorAll('.supply-line').forEach(e => e.remove()); const box = els.gridContainer.getBoundingClientRect();
  for (const source of Object.keys(state.supplyLines)) for (const target of Object.keys(state.supplyLines[source])) {
    const a = $(`hex-${source}`), b = $(`hex-${target}`); if (!a || !b) continue;
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect(), x1 = ar.left + ar.width/2 - box.left, y1 = ar.top + ar.height/2 - box.top, x2 = br.left + br.width/2 - box.left, y2 = br.top + br.height/2 - box.top;
    const line = document.createElement('div'); line.className = 'supply-line'; line.style.left = `${x1}px`; line.style.top = `${y1}px`; line.style.width = `${Math.hypot(x2-x1,y2-y1)}px`; line.style.transform = `rotate(${Math.atan2(y2-y1,x2-x1)*180/Math.PI}deg)`; els.gridContainer.appendChild(line);
  }
}

function expandWave() {
  const oldSize = state.mapSize, oldTiles = JSON.parse(JSON.stringify(state.tiles)), oldPlayer = ownedBy('player'), oldBots = ownedBy('bot'), oldLines = state.supplyLines;
  state.wave++; state.waveTimer = 120; state.mapSize += 25; createMap();
  const offset = Math.floor((state.mapSize - oldSize) / 2), remap = id => { const [r,c] = id.split('-').map(Number); return `${r+offset}-${c+offset}`; };
  for (const id of [...oldPlayer, ...oldBots]) { const nid = remap(id), data = oldTiles[id]; if (!tile(nid)) continue; state.tiles[nid] = data; updateTile(nid); }
  state.supplyLines = {};
  for (const source of Object.keys(oldLines)) for (const target of Object.keys(oldLines[source])) { const ns = remap(source), nt = remap(target); if (tile(ns)?.owner === 'player' && tile(nt)?.owner === 'player') { state.supplyLines[ns] ??= {}; state.supplyLines[ns][nt] = true; } }
  spawnBots(Math.min(2 + Math.floor(state.wave / 2), 8)); updateCamera(); centerCamera(); updateAllTiles(); drawSupplyLines(); updateUI();
  setStatus(`Wave ${state.wave}! The battlefield expanded to ${state.mapSize}×${state.mapSize}.`);
}

function updateCameraBounds() {
  const m = gridMetrics(), w = els.gridContainer.clientWidth, h = els.gridContainer.clientHeight;
  state.minX = Math.min(0, w - m.width * state.zoom - 80); state.maxX = 80; state.minY = Math.min(0, h - m.heightTotal * state.zoom - 80); state.maxY = 80;
  state.cameraX = Math.max(state.minX, Math.min(state.maxX, state.cameraX)); state.cameraY = Math.max(state.minY, Math.min(state.maxY, state.cameraY));
}
function updateCamera() { updateCameraBounds(); els.gridWrap.style.transform = `translate3d(${state.cameraX}px,${state.cameraY}px,0) scale(${state.zoom})`; }
function centerCamera() {
  const ids = ownedBy('player'); if (!ids.length) { state.cameraX = 0; state.cameraY = 0; updateCamera(); return; }
  const points = ids.map(id => { const e = $(`hex-${id}`); return e ? { x:e.offsetLeft+e.offsetWidth/2, y:e.offsetTop+e.offsetHeight/2 } : null; }).filter(Boolean);
  const x = points.reduce((n,p)=>n+p.x,0)/points.length, y = points.reduce((n,p)=>n+p.y,0)/points.length;
  state.cameraX = els.gridContainer.clientWidth/2 - x*state.zoom; state.cameraY = els.gridContainer.clientHeight/2 - y*state.zoom; updateCamera(); drawSupplyLines(); updateMinimap();
}
function zoom(delta, cx = els.gridContainer.clientWidth/2, cy = els.gridContainer.clientHeight/2) {
  const old = state.zoom, next = Math.max(.55, Math.min(2.5, old + delta)); if (old === next) return;
  const factor = next / old; state.cameraX = cx - (cx - state.cameraX) * factor; state.cameraY = cy - (cy - state.cameraY) * factor; state.zoom = next; updateCamera(); drawSupplyLines(); updateMinimap();
}
function animateBattle(a,b) { for (const id of [a,b]) { const e=$(`hex-${id}`); if(!e) continue; e.classList.remove('battle'); void e.offsetWidth; e.classList.add('battle'); setTimeout(()=>e.classList.remove('battle'),280); } }

function updateMinimap() {
  if (!els.minimap) return; els.minimap.innerHTML=''; const size=150, cell=size/state.mapSize;
  for (const id of Object.keys(state.tiles)) { const [r,c]=id.split('-').map(Number), e=document.createElement('span'), t=tile(id); e.className=`mini-cell ${t.owner}`; e.style.width=`${Math.max(2,cell)}px`; e.style.height=`${Math.max(2,cell)}px`; e.style.left=`${c*cell+(r%2?cell/2:0)}px`; e.style.top=`${r*cell*.86}px`; els.minimap.appendChild(e); }
}

function checkEnd() { if (!state.active) return; if (!ownedBy('player').length) return endGame(false); if ((state.mode==='bots'||state.mode==='1v1') && !ownedBy('bot').length) return endGame(true); }
function endGame(win) {
  state.active=false; if(state.loop) clearInterval(state.loop); state.loop=null; const d=difficulty();
  const finalScore=Math.floor((state.score+state.time*2+ownedBy('player').length*50+totalTroops()*.5+state.botsDefeated*100+(state.mode==='domination'?state.wave*1000:0))*d.score*(win?1.5:1));
  saveLeaderboard(finalScore); $('gameOverTitle').textContent=win?'VICTORY!':'DEFEAT'; $('gameOverMessage').textContent=win?'You controlled the battlefield.':'Your territory was overwhelmed.';
  $('finalScore').textContent=finalScore; $('finalTime').textContent=formatTime(state.time); $('finalWaves').textContent=state.wave; $('finalTiles').textContent=ownedBy('player').length; $('finalBots').textContent=state.botsDefeated; $('finalDifficulty').textContent=d.name; $('finalWavesContainer')?.style && ($('finalWavesContainer').style.display=state.mode==='domination'?'block':'none'); $('gameOverModal').style.display='flex'; setStatus(win?'Victory!':'Defeat!',win?'player':'bot');
}
function saveLeaderboard(score) { const list=JSON.parse(localStorage.getItem('dominationLeaderboard')||'[]'); list.push({player:state.playerName,score,mode:state.mode,difficulty:state.difficulty,time:Math.floor(state.time),date:new Date().toISOString(),waves:state.wave,tiles:ownedBy('player').length,botsDefeated:state.botsDefeated}); list.sort((a,b)=>b.score-a.score); localStorage.setItem('dominationLeaderboard',JSON.stringify(list.slice(0,100))); }

function gameTick() {
  if(!state.active||state.paused) return; const now=performance.now(), dt=Math.min(.25,(now-state.lastTick)/1000); state.lastTick=now; state.time+=dt; generateTroops(dt);
  if(now-state.lastBotAction>900){state.lastBotAction=now;botActions();}
  if(state.mode==='domination'){state.waveTimer-=dt;if(state.waveTimer<=0)expandWave();if(now-state.lastSpawn>45000){state.lastSpawn=now;spawnBots(1+Math.floor(state.wave/4));}}
  updateUI(); updateMinimap(); checkEnd();
}
function startLoop(){if(state.loop)clearInterval(state.loop);state.lastTick=performance.now();state.loop=setInterval(gameTick,250);}
function togglePause(){if(!state.active)return;state.paused=!state.paused;if(!state.paused)state.lastTick=performance.now();updateUI();setStatus(state.paused?'Game paused.':'Game resumed.');}
function restartGame(){$('gameOverModal').style.display='none';startMode();startLoop();}
function goToMenu(){if(state.loop)clearInterval(state.loop);location.href='index.html';}
function viewLeaderboard(){location.href='leaderboard.html';}
function toggleSidePanel(){els.sidePanel?.classList.toggle('active');}

function bindInput(){
  els.slider.addEventListener('input',e=>{state.deployment=Number(e.target.value);updateUI();localStorage.setItem('dominationDeploymentPercentage',state.deployment);});
  $('pauseBtn')?.addEventListener('click',togglePause); $('restartBtn')?.addEventListener('click',restartGame); $('centerBtn')?.addEventListener('click',centerCamera); $('supplyModeBtn')?.addEventListener('click',toggleSupplyMode); $('clearSupplyBtn')?.addEventListener('click',clearSupplyLines); $('sidePanelToggle')?.addEventListener('click',toggleSidePanel);
  els.board.addEventListener('contextmenu',e=>e.preventDefault());
  els.board.addEventListener('mousedown',e=>{if(e.button!==2)return;state.dragging=true;state.dragX=e.clientX;state.dragY=e.clientY;state.startCameraX=state.cameraX;state.startCameraY=state.cameraY;els.board.classList.add('grabbing');});
  window.addEventListener('mousemove',e=>{if(!state.dragging)return;state.cameraX=state.startCameraX+e.clientX-state.dragX;state.cameraY=state.startCameraY+e.clientY-state.dragY;updateCamera();});
  window.addEventListener('mouseup',()=>{state.dragging=false;els.board.classList.remove('grabbing');});
  els.board.addEventListener('wheel',e=>{e.preventDefault();const r=els.gridContainer.getBoundingClientRect();zoom(e.deltaY<0?.1:-.1,e.clientX-r.left,e.clientY-r.top);},{passive:false});
  let touch=null;
  els.gridContainer.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0],el=document.elementFromPoint(t.clientX,t.clientY)?.closest('.hex-tile');touch={x:t.clientX,y:t.clientY,id:el?.dataset.id,time:Date.now(),drag:false};},{passive:false});
  els.gridContainer.addEventListener('touchmove',e=>{if(!touch||e.touches.length!==1)return;const t=e.touches[0];if(Math.hypot(t.clientX-touch.x,t.clientY-touch.y)>8&&!touch.drag){touch.drag=true;state.dragging=true;state.dragX=touch.x;state.dragY=touch.y;state.startCameraX=state.cameraX;state.startCameraY=state.cameraY;}if(touch.drag){e.preventDefault();state.cameraX=state.startCameraX+t.clientX-touch.x;state.cameraY=state.startCameraY+t.clientY-touch.y;updateCamera();}},{passive:false});
  els.gridContainer.addEventListener('touchend',()=>{if(!touch)return;if(!touch.drag&&touch.id&&Date.now()-touch.time<350)handleTileClick(touch.id);touch=null;state.dragging=false;},{passive:false});
  document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.key==='Escape'){state.supplySource=null;deselect();updateAllTiles();}if(e.key.toLowerCase()==='p')togglePause();if(e.key.toLowerCase()==='r'&&state.active)restartGame();if(e.key==='+'||e.key==='=')zoom(.1);if(e.key==='-')zoom(-.1);if(e.key==='0'){state.zoom=1;centerCamera();}});
  window.addEventListener('resize',()=>{state.hexSize=window.innerWidth<600?44:window.innerWidth<1000?54:62;updateCamera();updateMinimap();drawSupplyLines();});
}

function init(){
  state.playerName=localStorage.getItem('dominationPlayerName')||'Commander'; state.mode=localStorage.getItem('dominationGameMode')||'domination'; state.difficulty=Number(localStorage.getItem(DIFF_KEY))||2; state.deployment=Number(localStorage.getItem('dominationDeploymentPercentage'))||50;
  state.hexSize=window.innerWidth<600?44:window.innerWidth<1000?54:62; els.slider.value=state.deployment; bindInput(); startMode(); startLoop();
}
window.addEventListener('load',init);
EOF