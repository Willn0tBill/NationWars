/* Nation Wars 3D squad orders: deterministic grid routing.
   8-direction movement matches visible square territory tiles.
   Obstacles include other squads; all paths remain inside the map. */
(function(){
  'use strict';
  function route({start, goal, size=24, blocked=[], approach=false}){
    const inside=p=>!!p&&Number.isInteger(p.x)&&Number.isInteger(p.z)&&p.x>=0&&p.z>=0&&p.x<size&&p.z<size;
    if(!inside(start)||!inside(goal))return null;
    const key=p=>p.x+','+p.z;
    const obstacles=blocked instanceof Set?blocked:new Set(blocked);
    const goalKey=key(goal);
    // Breadth-first search ensures the first available route uses the fewest steps.
    const queue=[{x:start.x,z:start.z}],previous=new Map([[key(start),null]]),visited=new Map([[key(start),queue[0]]]);
    const offsets=[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
    let found=null;
    for(let i=0;i<queue.length&&i<size*size;i++){
      const p=queue[i],pKey=key(p);
      if(approach?Math.max(Math.abs(p.x-goal.x),Math.abs(p.z-goal.z))===1:pKey===goalKey){found=p;break;}
      for(const [dx,dz] of offsets){
        const next={x:p.x+dx,z:p.z+dz},nk=key(next);
        if(!inside(next)||previous.has(nk)||obstacles.has(nk))continue;
        previous.set(nk,pKey);visited.set(nk,next);queue.push(next);
      }
    }
    if(!found)return null;
    const path=[];
    let pKey=key(found);
    while(pKey!==key(start)){
      path.push(visited.get(pKey));pKey=previous.get(pKey);
      if(!pKey)return null;
    }
    return path.reverse();
  }
  window.NationWarsOrders={route};
})();