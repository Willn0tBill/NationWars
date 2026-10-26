/* Nation Wars economy & strategic simulation rules (3D Practice only).
   Fully deterministic pricing/eligibility; world rendering belongs to game3d.js. */
(function(){
 'use strict';
 const types=Object.freeze({
  infantry:Object.freeze({label:'Infantry',count:30,cost:{gold:75,food:24},power:1,speed:1,oilPerTile:1,cashPerTile:7}),
  recon:Object.freeze({label:'Recon',count:18,cost:{gold:110,food:16,iron:12,oil:8},power:.85,speed:1.4,oilPerTile:2,cashPerTile:11}),
  armor:Object.freeze({label:'Armor',count:12,cost:{gold:235,iron:75,oil:38},power:2.7,speed:.78,oilPerTile:5,cashPerTile:24}),
  artillery:Object.freeze({label:'Artillery',count:10,cost:{gold:200,iron:60,oil:25},power:2.2,speed:.7,oilPerTile:4,cashPerTile:19})
 });
 const AUTO_TERRITORY=70,AUTO_SCIENCE=30,AUTO_INTERVAL=12,WAVE_INTERVAL=22,ENEMY_CAP=16,PLAYER_CAP=65;
 function trainingCost(type,automatic=false){
  if(!types[type])return null;
  const multiplier=automatic?2:1;
  return Object.fromEntries(Object.entries(types[type].cost).map(([k,v])=>[k,v*multiplier]));
 }
 function resourcesCanPay(wallet,cost){
  return !!cost&&Object.entries(cost).every(([k,v])=>Number.isFinite(wallet[k])&&wallet[k]>=v);
 }
 function applyCost(wallet,cost){
  if(!resourcesCanPay(wallet,cost))return false;
  for(const[k,v]of Object.entries(cost))wallet[k]-=v;
  return true;
 }
 function travelQuote(type,steps,wallet){
  if(!types[type]||!Number.isInteger(steps)||steps<0)return null;
  const unit=types[type];
  const fuel=unit.oilPerTile*steps,cash=unit.cashPerTile*steps;
  if(wallet.oil>=fuel)return{currency:'oil',amount:fuel};
  if(wallet.gold>=cash)return{currency:'gold',amount:cash};
  return null;
 }
 function unlockAuto({territories=0,science=0,barracks=0}={}){
  return territories>=AUTO_TERRITORY&&science>=AUTO_SCIENCE&&barracks>=2;
 }
 function formattedCost(cost){
  return Object.entries(cost||{}).map(([k,v])=>v+' '+(k==='gold'?'cash':k)).join(' · ');
 }
 window.NationWarsSystems={types,AUTO_TERRITORY,AUTO_SCIENCE,AUTO_INTERVAL,WAVE_INTERVAL,ENEMY_CAP,PLAYER_CAP,trainingCost,resourcesCanPay,applyCost,travelQuote,unlockAuto,formattedCost};
})();