/* Nation Wars 3D art kit — procedural assets, no additional downloads.
   The same visual language is shared by practice and multiplayer. */
(function(){
'use strict';
const cache=new WeakMap();
function materials(T){
  if(cache.has(T))return cache.get(T);
  const m={
    soil:new T.MeshStandardMaterial({color:0x6b8462,roughness:1}),
    path:new T.MeshStandardMaterial({color:0xb5a78a,roughness:1}),
    stone:new T.MeshStandardMaterial({color:0x788690,roughness:.93}),
    wall:new T.MeshStandardMaterial({color:0xe1ddd0,roughness:.89}),
    roof:new T.MeshStandardMaterial({color:0xa64f44,roughness:.87}),
    timber:new T.MeshStandardMaterial({color:0x70543c,roughness:.98}),
    blue:new T.MeshStandardMaterial({color:0x477e9a,roughness:.65,metalness:.17}),
    gold:new T.MeshStandardMaterial({color:0xe0b967,roughness:.55,metalness:.25}),
    leaf:new T.MeshStandardMaterial({color:0x4c8d58,roughness:1,flatShading:true}),
    darkLeaf:new T.MeshStandardMaterial({color:0x315c45,roughness:1,flatShading:true}),
    paleLeaf:new T.MeshStandardMaterial({color:0x7b9b61,roughness:1,flatShading:true}),
    canvas:new T.MeshStandardMaterial({color:0xe4ba81,roughness:1}),
    glass:new T.MeshStandardMaterial({color:0x75c4d6,metalness:.35,roughness:.22}),
    red:new T.MeshStandardMaterial({color:0xb45d5b,roughness:.87}),
    ink:new T.MeshStandardMaterial({color:0x344551,roughness:.95})
  };
  cache.set(T,m);return m;
}
function mesh(T,geo,mat,x=0,y=0,z=0){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o}
function cube(T,parent,w,h,d,mat,x=0,y=0,z=0){const a=mesh(T,new T.BoxGeometry(w,h,d),mat,x,y,z);parent.add(a);return a}
function column(T,parent,r,h,mat,x=0,y=0,z=0,n=12){const a=mesh(T,new T.CylinderGeometry(r,r,h,n),mat,x,y,z);parent.add(a);return a}
function roof(T,parent,size,mat,y,x=0,z=0){const a=mesh(T,new T.ConeGeometry(size,.48,4),mat,x,y,z);a.rotation.y=Math.PI/4;parent.add(a);return a}
function sphere(T,parent,r,mat,x=0,y=0,z=0){const a=mesh(T,new T.SphereGeometry(r,12,8),mat,x,y,z);parent.add(a);return a}
function atmosphere(T,scene,renderer,lowPower=false){
  scene.background=new T.Color(0x91afbf);
  scene.fog=new T.Fog(0x91afbf,48,122);
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.22;
  renderer.outputColorSpace=T.SRGBColorSpace;
  const hemisphere=new T.HemisphereLight(0xf2f7f9,0x415c45,2.1);
  scene.add(hemisphere);
  const light=new T.DirectionalLight(0xffe7b9,2.25);
  light.position.set(-18,39,26);light.castShadow=!lowPower;
  if(light.castShadow){
    light.shadow.mapSize.set(1024,1024);
    light.shadow.camera.left=-43;light.shadow.camera.right=43;
    light.shadow.camera.top=43;light.shadow.camera.bottom=-43;
    light.shadow.camera.near=1;light.shadow.camera.far=115;
    light.shadow.bias=-.0005;light.shadow.normalBias=.04;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  }
  scene.add(light);
}
function ground(T,scene,size,spacing=2.5){
  const span=size*spacing,mat=materials(T);
  const water=mesh(T,new T.PlaneGeometry(span+72,span+72),new T.MeshStandardMaterial({color:0x48798a,roughness:.45,metalness:.08}),0,-.35,0);
  water.rotation.x=-Math.PI/2;water.receiveShadow=false;water.userData.decoration=true;scene.add(water);
  const geo=new T.PlaneGeometry(span+5,span+5,64,64),positions=geo.attributes.position;
  const colors=[];
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getY(i);
    const n=Math.sin(x*.51)*Math.cos(z*.37)+Math.sin(x*.13+z*.22)*.8;
    const col=new T.Color().setHSL(.285+n*.011,.25,.35+n*.022);
    colors.push(col.r,col.g,col.b);
    positions.setZ(i,.045*Math.sin(x*.7)*Math.sin(z*.56));
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const floor=mesh(T,geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}),0,-.19,0);
  floor.rotation.x=-Math.PI/2;floor.userData.ground=true;floor.receiveShadow=true;floor.castShadow=false;scene.add(floor);
  // Decorative woodland outside the board, sparse enough for mobile GPUs.
  const clusters=Math.min(115,Math.round(size*2.8));
  const trunkGeometry=new T.CylinderGeometry(.09,.14,.65,6);
  const crownGeometry=new T.ConeGeometry(.43,1.15,7);
  const trunks=new T.InstancedMesh(trunkGeometry,mat.timber,clusters);
  const crowns=new T.InstancedMesh(crownGeometry,mat.darkLeaf,clusters);
  const dummy=new T.Object3D();
  for(let i=0;i<clusters;i++){
    const a=i*2.399963,offset=span/2+1.5+(i%7)*.47;
    const x=Math.cos(a)*offset,z=Math.sin(a)*offset,scale=.75+(i%5)*.15;
    dummy.position.set(x,.1,z);dummy.scale.setScalar(scale);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,.83*scale,z);dummy.scale.setScalar(scale);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
  }
  trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;
  trunks.userData.decoration=true;crowns.userData.decoration=true;
  scene.add(trunks,crowns);
  return floor;
}
function roundedTileGeometry(T,spacing=2.5){
  const size=spacing*.91,half=size/2,rad=.17;
  const s=new T.Shape();
  s.moveTo(-half+rad,-half);s.lineTo(half-rad,-half);s.quadraticCurveTo(half,-half,half,-half+rad);
  s.lineTo(half,half-rad);s.quadraticCurveTo(half,half,half-rad,half);
  s.lineTo(-half+rad,half);s.quadraticCurveTo(-half,half,-half,half-rad);
  s.lineTo(-half,-half+rad);s.quadraticCurveTo(-half,-half,-half+rad,-half);
  const g=new T.ExtrudeGeometry(s,{depth:.13,bevelEnabled:true,bevelThickness:.035,bevelSize:.025,bevelSegments:1,curveSegments:3,steps:1});
  g.rotateX(-Math.PI/2);g.computeVertexNormals();return g;
}
function tile(T,color,spacing=2.5){
  const g=roundedTileGeometry(T,spacing);
  const o=mesh(T,g,new T.MeshStandardMaterial({color,roughness:.9,metalness:.03}));
  o.position.y=.035;return o;
}
function building(T,type){
  const m=materials(T),g=new T.Group(),soil=m.soil;
  const add=(w,h,d,mat,x=0,y=h/2+.18,z=0)=>cube(T,g,w,h,d,mat,x,y,z);
  add(1.9,.15,1.9,m.path,0,.18,0);
  const home=(x,z,wall=m.wall,rf=m.roof,scale=1)=>{
    add(.58*scale,.65*scale,.55*scale,wall,x,.23+.325*scale,z);
    roof(T,g,.51*scale,rf,.23+.65*scale+.18,x,z);
    add(.14*scale,.25*scale,.05*scale,m.timber,x,.3*scale+.2,z+.285*scale);
  };
  if(type==='farm'){
    add(1.55,.08,1.5,m.soil,0,.32,0);
    for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++){
      const x=col*.27,z=row*.27;
      const spr=mesh(T,new T.ConeGeometry(.1,.32,5),row%2?m.leaf:m.paleLeaf,x,.51,z);
      g.add(spr);
    }
    home(-.68,-.68,m.wall,m.roof,.52);
  }else if(type==='housing'){
    home(-.39,-.38);home(.42,.38,m.wall,m.red,.84);
    add(.2,.22,.2,m.ink,-.08,.32,.57);
  }else if(type==='mine'){
    for(let i=0;i<6;i++){const r=.21+(i%3)*.11;const b=mesh(T,new T.DodecahedronGeometry(r,0),m.stone,-.65+(i%3)*.52,.33+(i%2)*.1,-.33+Math.floor(i/3)*.57);g.add(b);}
    cube(T,g,.12,1.1,.12,m.timber,.61,.8,-.51);
    cube(T,g,.7,.11,.12,m.timber,.37,1.34,-.51);
    column(T,g,.07,.43,m.ink,.08,1.12,-.51,7);
  }else if(type==='factory'){
    add(1.43,.75,.8,m.stone,0,.63,.1);
    add(1.5,.12,.9,m.ink,0,1.03,.1);
    for(let i=0;i<2;i++){column(T,g,.18,.82,m.red,-.45+i*.7,1.4,-.23);column(T,g,.21,.1,m.ink,-.45+i*.7,1.82,-.23);}
    for(let i=0;i<3;i++)add(.21,.22,.06,m.glass,-.46+i*.45,.66,.54);
  }else if(type==='research'){
    column(T,g,.62,.82,m.wall,0,.66,0,14);sphere(T,g,.54,m.glass,0,1.14,0);
    column(T,g,.09,.55,m.gold,0,1.66,0);
    sphere(T,g,.17,m.blue,0,2.01,0);
  }else if(type==='military'){
    add(1.3,.58,.84,m.blue,0,.51,0);
    roof(T,g,.9,m.ink,1.05);
    column(T,g,.05,1.4,m.ink,-.72,.98,-.7);
    add(.5,.27,.025,m.red,-.47,1.54,-.7);
  }else if(type==='market'){
    for(let i=0;i<3;i++){
      const x=-.53+i*.53;
      add(.37,.46,.6,m.timber,x,.46,.1);
      const roofShape=mesh(T,new T.ConeGeometry(.43,.35,4),i%2?m.red:m.canvas,x,.91,.1);roofShape.rotation.y=Math.PI/4;g.add(roofShape);
    }
  }else if(type==='hospital'){
    add(1.25,.83,1.13,m.wall,0,.64,0);add(1.37,.11,1.22,m.blue,0,1.12,0);
    add(.12,.5,.06,m.red,0,.78,.596);add(.42,.12,.07,m.red,0,.79,.599);
    add(.32,.49,.21,m.glass,-.35,.65,-.56);
  }else{home(0,0);}
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return g;
}
function army(T,color,count,compact=false){
  const g=new T.Group();
  const armyMat=new T.MeshStandardMaterial({color,roughness:.73,metalness:.12});
  const jacket=new T.MeshStandardMaterial({color:0xddd7c7,roughness:.9});
  const helmet=new T.MeshStandardMaterial({color:0x2a4151,roughness:.77});
  const base=column(T,g,.62,.1,armyMat,0,.19,0,20);
  base.userData.role='army-base';
  const number=compact?3:Math.min(7,Math.max(3,Math.ceil(count/18)));
  for(let i=0;i<number;i++){
    const a=(i/number)*Math.PI*2,rad=number>4?.39:.32,x=Math.cos(a)*rad,z=Math.sin(a)*rad;
    column(T,g,.10,.40,jacket,x,.5,z,8);
    sphere(T,g,.135,helmet,x,.79,z);
    const boot=column(T,g,.12,.08,armyMat,x,.28,z,8);boot.castShadow=false;
  }
  column(T,g,.032,.8,helmet,.47,.68,.02,6);
  const flag=mesh(T,new T.PlaneGeometry(.33,.2),armyMat,.61,1.02,.02);
  flag.material.side=T.DoubleSide;g.add(flag);
  return g;
}
function city(T,owner){
 const g=new T.Group(),m=materials(T);
 const plinth=mesh(T,new T.CylinderGeometry(.82,.93,.2,16),m.stone,0,.18,0);g.add(plinth);
 for(let i=0;i<4;i++){
   const a=i*Math.PI/2,x=Math.cos(a)*.44,z=Math.sin(a)*.44;
   const h=.62+(i%2)*.28;
   cube(T,g,.38,h,.4,i%2?m.wall:m.path,x,.24+h/2,z);
   roof(T,g,.35,i%2?m.red:m.blue,.26+h+.14,x,z);
 }
 const keep=cube(T,g,.34,1.0,.34,m.wall,0,.79,0);
 const flag=mesh(T,new T.PlaneGeometry(.38,.22),new T.MeshBasicMaterial({color:owner==='enemy'?0xd87b73:0x91b8e2,side:T.DoubleSide}),.22,1.5,.0);g.add(flag);
 return g;
}
window.NationWarsVisuals={atmosphere,ground,tile,roundedTileGeometry,building,army,city};
})();