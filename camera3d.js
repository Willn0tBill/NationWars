/* Nation Wars camera controller v0.6.
   Consistent camera-relative RTS controls for Practice and Multiplayer. */
(function(){
'use strict';
function create({camera, renderer, initial={}, bounds=31, buttons={}}){
  if(!camera||!renderer?.domElement)throw Error('Camera controller requires a camera and renderer.');
  const canvas=renderer.domElement,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const home={x:initial.x??0,z:initial.z??0,yaw:initial.yaw??.35,pitch:initial.pitch??.92,zoom:initial.zoom??43};
  const target={...home}, current={...home};
  const keys=new Set(),activePointers=new Map();
  let gesture='none',lastX=0,lastY=0,downX=0,downY=0,dragged=false,pinchStart=0,lastFrame=0,suppressUntil=0,disposed=false;
  const speed=()=>clamp(current.zoom*.38,10,30);
  const controller={
    reset(){Object.assign(target,home);keys.clear();},
    zoomBy(amount){target.zoom=clamp(target.zoom*Math.exp(amount),12,90);},
    consumeClick(){return Date.now()<suppressUntil||dragged;},
    update(now){
      if(disposed)return;
      const dt=lastFrame?clamp((now-lastFrame)/1000,0,.05):1/60;lastFrame=now;
      const k=x=>keys.has(x),angle=current.yaw;
      const forward=(Number(k('w')||k('arrowup'))-Number(k('s')||k('arrowdown')));
      const strafe=(Number(k('d')||k('arrowright'))-Number(k('a')||k('arrowleft')));
      if(forward||strafe){
        const length=Math.hypot(forward,strafe)||1,d=speed()*dt/length;
        target.x+=(-Math.sin(angle)*forward+Math.cos(angle)*strafe)*d;
        target.z+=(-Math.cos(angle)*forward-Math.sin(angle)*strafe)*d;
      }
      if(k('q'))target.yaw+=dt*1.18;
      if(k('e'))target.yaw-=dt*1.18;
      if(k('+')||k('='))controller.zoomBy(-dt*1.35);
      if(k('-')||k('_'))controller.zoomBy(dt*1.35);
      target.x=clamp(target.x,-bounds,bounds);target.z=clamp(target.z,-bounds,bounds);
      target.pitch=clamp(target.pitch,.48,1.34);
      target.zoom=clamp(target.zoom,12,90);
      const smooth=1-Math.exp(-dt*12);
      for(const p of ['x','z','yaw','pitch','zoom'])current[p]+=(target[p]-current[p])*smooth;
      const h=Math.cos(current.pitch)*current.zoom;
      camera.position.set(current.x+Math.sin(current.yaw)*h,Math.sin(current.pitch)*current.zoom,current.z+Math.cos(current.yaw)*h);
      camera.lookAt(current.x,0,current.z);
    },
    dispose(){disposed=true;keys.clear();activePointers.clear();}
  };
  function typing(e){const t=e.target;return t?.isContentEditable||t?.closest?.('input,textarea,select,[contenteditable]')}
  const controlled=new Set(['w','a','s','d','q','e','+','=','-','_','arrowup','arrowdown','arrowleft','arrowright']);
  addEventListener('keydown',e=>{
    if(typing(e)||e.ctrlKey||e.metaKey||e.altKey)return;
    const k=e.key.toLowerCase();
    if(controlled.has(k)){keys.add(k);e.preventDefault();}
    if(k==='home'&&e.repeat===false){controller.reset();e.preventDefault();}
  });
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear()});
  const worldPan=(dx,dy)=>{
    const factor=current.zoom*2*Math.tan((camera.fov*Math.PI/180)/2)/Math.max(300,canvas.clientHeight);
    const scale=factor*.8;
    target.x+=(-Math.cos(target.yaw)*dx-Math.sin(target.yaw)*dy)*scale;
    target.z+=(Math.sin(target.yaw)*dx-Math.cos(target.yaw)*dy)*scale;
  };
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();});
  canvas.addEventListener('wheel',e=>{
    if(e.ctrlKey)return; // preserve accessibility/browser zoom gestures.
    e.preventDefault();
    const normalized=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
    controller.zoomBy(clamp(normalized*.0016,-.24,.24));
  },{passive:false});
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button===0&&!e.shiftKey)return;
    if(e.pointerType==='mouse'&&![0,1,2].includes(e.button))return;
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    gesture=e.pointerType==='touch'?'touch':e.button===1?'pan':'rotate';
    if(e.pointerType==='mouse'&&e.button===0&&e.shiftKey)gesture='rotate';
    downX=lastX=e.clientX;downY=lastY=e.clientY;dragged=false;
    try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!activePointers.has(e.pointerId))return;
    const old=activePointers.get(e.pointerId);
    activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePointers.size>=2&&e.pointerType==='touch'){
      const pts=[...activePointers.values()],sep=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      if(pinchStart>0&&sep>4)controller.zoomBy(clamp(Math.log(pinchStart/sep),-.14,.14));
      pinchStart=sep;dragged=true;
      return;
    }
    pinchStart=0;
    const dx=e.clientX-old.x,dy=e.clientY-old.y;
    if(Math.hypot(e.clientX-downX,e.clientY-downY)>6)dragged=true;
    if(!dragged)return; // Small movement remains a normal selection.
    if(gesture==='rotate'){
      target.yaw-=dx*.006;
      target.pitch=clamp(target.pitch+dy*.004,.48,1.34);
    }else worldPan(dx,dy);
    lastX=e.clientX;lastY=e.clientY;
  });
  function stop(e){
    if(!activePointers.has(e.pointerId))return;
    activePointers.delete(e.pointerId);
    if(dragged)suppressUntil=Date.now()+350;
    if(activePointers.size<2)pinchStart=0;
    if(!activePointers.size){gesture='none';dragged=false;}
    try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}catch(_){}
  }
  canvas.addEventListener('pointerup',stop);
  canvas.addEventListener('pointercancel',stop);
  canvas.addEventListener('lostpointercapture',e=>{
    activePointers.delete(e.pointerId);
    if(!activePointers.size){gesture='none';dragged=false;pinchStart=0;}
  });
  for(const [id,handler] of [
    [buttons.zoomIn,()=>controller.zoomBy(-.2)],
    [buttons.zoomOut,()=>controller.zoomBy(.2)],
    [buttons.reset,()=>controller.reset()]
  ]){
    if(id)document.getElementById(id)?.addEventListener('click',handler);
  }
  controller.update(performance.now());
  return controller;
}
window.NationWarsCamera={create};
})();