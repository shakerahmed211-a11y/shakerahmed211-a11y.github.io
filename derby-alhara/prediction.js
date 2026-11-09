import {GROUND,W,clamp} from './engine.js';
// The server owns outcomes; only the local player's motion is predicted for display.
export class LocalPrediction{
 constructor(){this.reset();}
 reset(){this.player=null;this.jumpSeq=0;this.axis=0;this.changedAt=0;this.snapshot=null;this.receivedAt=0;this.rtt=0;}
 receive(player,now,rtt,hard=false){if(!player)return;this.snapshot={...player};this.receivedAt=now;this.rtt=Math.min(600,Math.max(0,rtt));if(!this.player||hard||player.red||player.frozen>0){this.player={...player};this.jumpSeq=player.usedjump||0;}}
 step(input,dt,now,others=[]){if(!this.player||!this.snapshot)return null;const p=this.player,s=this.snapshot,h=clamp(dt/1000,0,.05);
 if(s.red||s.frozen>0){Object.assign(p,s);return p;}
 if(Math.sign(input.axis)!==Math.sign(this.axis)){this.changedAt=now;this.axis=input.axis;}
 p.vx=input.axis*285;if(input.axis)p.face=Math.sign(input.axis);
 if(input.jumpSeq&&input.jumpSeq!==this.jumpSeq){this.jumpSeq=input.jumpSeq;if(p.y>=GROUND-1)p.vy=-620;}
 p.vy+=1450*h;p.x=clamp(p.x+p.vx*h,70,W-70);p.y=Math.min(GROUND,p.y+p.vy*h);if(p.y===GROUND)p.vy=0;
 const age=clamp((now-this.receivedAt+this.rtt*.5)/1000,0,.35),tx=clamp(s.x+s.vx*age,70,W-70);
 if(now-this.changedAt>220&&Math.sign(s.vx)===Math.sign(p.vx)){const error=tx-p.x;p.x+=error*(1-Math.exp(-h*5));}
 if(Math.abs(p.x-tx)>210&&now-this.changedAt>500)p.x=tx;
 if(!input.jumpSeq||input.jumpSeq===s.usedjump){const ty=Math.min(GROUND,s.y+s.vy*age+725*age*age);if(Math.abs(p.y-ty)>90)p.y+=(ty-p.y)*(1-Math.exp(-h*5));}
 for(const q of others){if(q.id===p.id||q.red)continue;const dx=p.x-q.x;if(Math.abs(dx)<48&&Math.abs(p.y-q.y)<40)p.x=clamp(q.x+(dx<0?-48:48),70,W-70);}
 return p;
 }
}
