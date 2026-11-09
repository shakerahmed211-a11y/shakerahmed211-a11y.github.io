// Pointer-independent gesture state: the same rules work with touch, pen and mouse.
export class GesturePad {
 constructor(){this.reset();}
 reset(){this.pointers=new Map();this.axis=0;this.jumpSeq=0;this.kickSeq=0;this.aimX=0;this.aimY=-.22;this.power=.65;this.move=null;this.shot=null;}
 begin(id,x,y,width,height,forceShoot=false){const kind=forceShoot||x>width*.64?'shot':'move';if([...this.pointers.values()].some(p=>p.kind===kind))return false;const p={id,kind,x0:x,y0:y,x,y,jumped:false,unit:Math.min(width,height)};this.pointers.set(id,p);if(kind==='move')this.move=p;else{this.shot=p;this.aimX=0;this.aimY=-.22;this.power=.65;}return true;}
 moveTo(id,x,y){const p=this.pointers.get(id);if(!p)return;p.x=x;p.y=y;const dx=x-p.x0,dy=y-p.y0;
 if(p.kind==='move'){const radius=Math.max(30,p.unit*.12),dead=radius*.08;this.axis=Math.abs(dx)<dead?0:Math.max(-1,Math.min(1,(dx-Math.sign(dx)*dead)/(radius-dead)));const jumpDistance=Math.max(20,p.unit*.08);if(dy<-jumpDistance&&!p.jumped){this.jumpSeq++;p.jumped=true;}if(dy>-jumpDistance*.35)p.jumped=false;}
 else{const d=Math.hypot(dx,dy);if(d>10){this.aimX=dx/d;this.aimY=Math.max(-.9,Math.min(.35,dy/d));this.power=Math.max(.3,Math.min(1,d/Math.max(65,p.unit*.38)));}}
 }
 end(id,cancel=false){const p=this.pointers.get(id);if(!p)return null;this.pointers.delete(id);if(p.kind==='move'){this.axis=0;this.move=null;return null;}this.shot=null;if(cancel)return null;this.kickSeq++;const d=Math.hypot(p.x-p.x0,p.y-p.y0);return{aimX:d>10?this.aimX:0,aimY:d>10?this.aimY:-.22,power:d>10?this.power:.65,manual:d>10};}
}
