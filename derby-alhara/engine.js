export const NAMES=['شاكر','عاطف','فوزي','صلاح مشرف','طرفة','جرجس','أبو آدم','شاهين المالكي','عبده','أبو أنس','طه','النمس','بكر'];
export const W=1280,H=640,FLOOR=540,R=26,BR=16,GROUND=FLOOR-66;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
export function cleanInput(a={}){return {axis:clamp(finite(a?.axis),-1,1),jump:a?.jump===true,kick:a?.kick===true,pass:a?.pass===true,jumpSeq:Math.max(0,Math.trunc(finite(a?.jumpSeq))),kickSeq:Math.max(0,Math.trunc(finite(a?.kickSeq))),passSeq:Math.max(0,Math.trunc(finite(a?.passSeq))),aimX:clamp(finite(a?.aimX),-1,1),aimY:clamp(finite(a?.aimY,-.22),-.9,.35),power:clamp(finite(a?.power,.65),.3,1),skillSeq:Math.max(0,Math.trunc(finite(a?.skillSeq))),skill:Object.hasOwn(SKILLS,a?.skill)?a.skill:'',tackleSeq:Math.max(0,Math.trunc(finite(a?.tackleSeq)))};}
export const SKILLS={freeze:{name:'تجميد',icon:'❄',duration:3},rocket:{name:'صاروخ',icon:'🚀',duration:5},grow:{name:'كبّر جونهم',icon:'↗',duration:7},shrink:{name:'صغّر جونك',icon:'🛡',duration:7}};
export function ensureRules(g){g.rules=3;g.goals??=[{grow:0,shrink:0},{grow:0,shrink:0}];g.noticeId??=0;for(const p of g.players){p.skills??={freeze:1,rocket:1,grow:1,shrink:1};for(const k of ['skillCooldown','frozen','freezeImmunity','rocket','tackleCd','tackleTime','fouls','yellow','activeSkillTime'])p[k]??=0;p.red??=false;}return g;}
export function goalGeometry(g,team){const e=g.goals?.[team]||{},height=160+(e.grow>0?60:0)-(e.shrink>0?55:0);return {top:FLOOR-height,height,line:team===0?62:W-62};}
function announce(g,text,kind='skill',team=null){g.notice={id:++g.noticeId,text,kind,team,life:4};g.event++;}
export function activateSkill(g,p,id){ensureRules(g);let reason='';
 if(g.phase!=='play')reason='المهارات متاحة أثناء اللعب فقط';else if(p.red)reason='اللاعب مطرود حتى نهاية المباراة';else if(p.frozen>0)reason='استنى التجميد يخلص';else if(!SKILLS[id])reason='مهارة غير معروفة';else if(!p.skills[id])reason='المهارة اتستخدمت في الماتش ده';else if(p.skillCooldown>0)reason='استنى '+Math.ceil(p.skillCooldown)+' ثوانٍ بين المهارات';
 let target;if(!reason&&id==='freeze'){target=g.players.filter(q=>q.team!==p.team&&!q.red&&q.frozen<=0&&q.freezeImmunity<=0).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];if(!target)reason='الخصوم عندهم حماية مؤقتة من التجميد';}
 const goalTeam=id==='grow'?1-p.team:p.team;if(!reason&&(id==='grow'||id==='shrink')&&g.goals[goalTeam][id]>0)reason='المهارة دي نشطة على المرمى بالفعل';
 if(reason){p.skillFeedback={id:p.input?.skillSeq||0,text:reason};return false;}
 p.skills[id]--;p.skillCooldown=8;p.lastSkill=id;p.activeSkillTime=SKILLS[id].duration;
 if(id==='freeze'){target.frozen=3;target.freezeImmunity=8;target.freezeReason='مهارة الخصم';target.pending=null;target.tackleTime=0;announce(g,p.name+' جمّد '+target.name+' · ٣ ثوانٍ','freeze',p.team);}
 if(id==='rocket'){p.rocket=5;announce(g,p.name+' جهّز الصاروخ · سدّد خلال ٥ ثوانٍ','rocket',p.team);}
 if(id==='grow'||id==='shrink'){g.goals[goalTeam][id]=7;announce(g,p.name+(id==='grow'?' كبّر مرمى الخصم':' صغّر مرمى فريقه')+' · ٧ ثوانٍ',id,p.team);}
 return true;
}
export function recordFoul(g,p,victim){ensureRules(g);if(g.phase!=='play'||p.red)return false;p.fouls++;p.pending=null;p.tackleTime=0;p.vx=0;
 let text;if(p.fouls===1){text='تنبيه لـ '+p.name+': تدخل من الخلف أو بعيد عن الكرة';}
 else if(p.fouls===2){p.yellow=1;p.frozen=3;p.freezeImmunity=8;p.freezeReason='عقوبة الأصفر';text='🟨 أصفر لـ '+p.name+' · تجميد ٣ ثوانٍ لتكرار المخالفة';}
 else{p.yellow=2;p.red=true;p.vy=0;text='🟥 أصفر ثانٍ وطرد '+p.name+' حتى نهاية الماتش';}
 if(victim&&!victim.red){g.ball={x:clamp(victim.x+victim.face*55,90,W-90),y:FLOOR-BR,vx:0,vy:0,lastTouch:null};}
 announce(g,text,p.red?'red':p.yellow?'yellow':'warning',p.team);
 if(g.players.filter(q=>q.team===p.team).every(q=>q.red)){g.phase='ended';g.winner=1-p.team;g.endReason='forfeit';g.message=(g.winner===0?'البرتقالي':'الأزرق')+' فاز اعتباريًّا: طرد آخر لاعب من الفريق الآخر';}
 return true;
}
export function attemptTackle(g,p){ensureRules(g);if(g.phase!=='play'||p.red||p.frozen>0||p.tackleCd>0)return false;p.tackleCd=1.2;p.tackleTime=.14;
 const victim=g.players.filter(q=>q.team!==p.team&&!q.red&&(q.x-p.x)*p.face>=-8&&(q.x-p.x)*p.face<100&&Math.abs(q.y-p.y)<65).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];if(!victim)return true;
 const ballClose=Math.hypot(g.ball.x-p.x,g.ball.y-(p.y+35))<86;
 const behind=(p.x-victim.x)*victim.face<-18;
 if(!ballClose||behind)return recordFoul(g,p,victim);
 g.ball.vx=p.face*290;g.ball.vy=-165;g.ball.lastTouch={id:p.id,team:p.team,kind:'tackle'};return true;
}
function botSkill(p,g){if(p.skillCooldown>0||p.red||p.frozen>0)return;const u=p.team===0?g.ball.x:W-g.ball.x,near=Math.abs(g.ball.x-p.x)<120;
 if(u<290&&Math.abs(g.ball.vx)>350&&p.skills.shrink)return activateSkill(g,p,'shrink');
 if(near&&u>450&&p.skills.rocket)return activateSkill(g,p,'rocket');
 if(near&&p.skills.freeze&&g.players.some(q=>q.team!==p.team&&!q.red&&!q.red&&Math.abs(q.x-g.ball.x)<120&&q.freezeImmunity<=0))return activateSkill(g,p,'freeze');
 if(g.score[p.team]<g.score[1-p.team]&&p.skills.grow)return activateSkill(g,p,'grow');
}
export function makeGame(roster,now=0){
 const g={rules:2,players:roster.map((p,i)=>({id:p.id,name:p.name,avatar:p.avatar??i,team:p.team,bot:!!p.bot,supportOnly:!!p.bot&&roster.some(q=>q.team===p.team&&!q.bot),difficulty:p.difficulty||'normal',x:0,y:GROUND,vx:0,vy:0,face:p.team===0?1:-1,cool:0,swing:0,shotId:0,input:{}})),ball:{},score:[0,0],phase:'countdown',until:now+3000,remaining:90,last:now,event:0,message:'استعدوا للديربي'};
 ensureRules(g);kickoff(g);return g;
}
function kickoff(g){for(const t of [0,1]){const ps=g.players.filter(p=>p.team===t);ps.forEach((p,i)=>{const u=ps.length===1?300:i===ps.length-1?125:420+i*160;p.x=t===0?u:W-u;p.y=GROUND;p.vx=p.vy=0;p.face=t===0?1:-1;p.cool=p.swing=0;p.pending=null;p.ai=null;p.think=0;p.keeper=ps.length>1&&i===ps.length-1;});}g.ball={x:W/2,y:270,vx:0,vy:0,lastTouch:null,trail:[]};}
export function botInput(p,g){
 const b=g.ball,dir=p.team===0?1:-1,u=p.team===0?p.x:W-p.x,bu=p.team===0?b.x:W-b.x,bvx=b.vx*dir;
 const mates=g.players.filter(q=>q.team===p.team&&!q.red),humans=mates.filter(q=>!q.bot),field=mates.filter(q=>!q.keeper);
 const chase=field.reduce((a,q)=>Math.abs(q.x-b.x)<Math.abs(a.x-b.x)?q:a,p);
 // Estimate a short landing interval, then get goal-side of the ball.
 const fall=Math.max(0,Math.min(.38,(-b.vy+Math.sqrt(Math.max(0,b.vy*b.vy+2100*(FLOOR-BR-b.y))))/1050));
 let target=clamp(bu+bvx*fall*.65-46,90,W-115);
 const danger=bu<400&&(bvx<-45||bu<215),solo=mates.length===1;
 if(p.keeper&&!solo){target=danger?clamp(bu-44,92,285):125;}
 else if(!solo&&chase.id!==p.id){const role=field.indexOf(p);target=clamp(bu-200-role*110,230,750);}
 if(bu<100&&b.y>420)target=78;
 const dx=target-u;const axis=Math.abs(dx)>12?clamp(dx/40,-1,1)*dir:0;
 const front=(b.x-p.x)*dir,footDist=Math.hypot(b.x-(p.x+dir*29),b.y-(p.y+45));
 const close=front>=-10&&front<88&&(footDist<64||p.y<GROUND-20&&Math.hypot(b.x-p.x,b.y-p.y)<57);
 const interceptY=b.y+b.vy*.12+7.5;
 const jump=p.y>=GROUND-.5&&Math.abs(b.x-p.x)<115&&interceptY<p.y-30&&interceptY>p.y-180;
 const human=humans.slice().sort((a,c)=>Math.abs(a.x-p.x)-Math.abs(c.x-p.x))[0];
 const blocked=g.players.some(q=>q.team!==p.team&&!q.red&&(q.x-p.x)*dir>30&&(q.x-p.x)*dir<150&&Math.abs(q.y-p.y)<65);
 const teammate=mates.find(q=>q.id!==p.id&&(q.x-p.x)*dir>120&&!q.keeper);
 const pass=close&&!!(human||blocked&&teammate)&&bu>210;
 // A mixed-team bot supports its human: passes or clears danger, never auto-shoots at the far goal.
 const kick=close&&!pass&&(!p.supportOnly||danger);
 const chip=blocked&&!teammate&&!p.supportOnly;
 const aimY=chip?-.9:p.keeper||danger?-.42:bu>W-340?-.08:-.25;
 return {axis,jump,kick,pass,aimX:chip?dir*.32:dir,aimY,power:p.keeper?.67:p.difficulty==='easy'?.52:.8};
}
function consume(p,a,key){const seq=a[key+'Seq']||0,field='used'+key;if(seq){if(p[field]===seq)return false;p[field]=seq;return true;}const held=!!a[key],old=p[field+'Held'];p[field+'Held']=held;return held&&!old;}
function tryStrike(g,p,a,pass){
 const b=g.ball,dx=b.x-p.x,dy=b.y-p.y;
 const foot=Math.hypot(b.x-(p.x+p.face*29),b.y-(p.y+45));
 const head=p.y<GROUND-15&&Math.hypot(dx,dy)<60;
 if(dx*p.face<-12||!(foot<67||head))return false;
 let tx=a.aimX||p.face,ty=a.aimY??-.22,speed=480+360*(a.power??.65);
 if(pass){const mates=g.players.filter(q=>q.team===p.team&&!q.red&&q.id!==p.id);mates.sort((a,c)=>(Number(a.bot)-Number(c.bot))||Math.abs(a.x-p.x)-Math.abs(c.x-p.x));const mate=mates[0];if(mate){tx=mate.x-p.x;ty=(mate.y+44)-(p.y+44)-Math.min(70,Math.abs(tx)*.15);speed=clamp(Math.abs(tx)*1.35,340,580);}else{speed=440;ty=-.15;}}
 if(!pass&&p.rocket>0){speed*=1.85;p.rocket=0;p.activeSkillTime=0;b.rocket=1.4;}
 const norm=Math.hypot(tx,ty)||1;tx/=norm;ty/=norm;b.vx=tx*speed;b.vy=ty*speed;b.lastTouch={id:p.id,team:p.team,kind:pass?'pass':'shot'};g.event++;p.hit=.16;return true;
}
export function advance(g,now){ensureRules(g);let dt=clamp((now-g.last)/1000,0,2);g.last=now;if(g.phase==='ended')return;
 if(g.phase==='countdown'||g.phase==='goal'){if(now<g.until)return;g.phase='play';g.message='';dt=0;}
 if(g.phase!=='play')return;const n=Math.ceil(dt*120);if(!n)return;const h=dt/n;
 for(let k=0;k<n;k++){
 for(const e of g.goals){e.grow=Math.max(0,e.grow-h);e.shrink=Math.max(0,e.shrink-h);}if(g.notice)g.notice.life=Math.max(0,g.notice.life-h);
 g.remaining-=h;if(g.remaining<=0){g.remaining=0;g.phase='ended';g.winner=g.score[0]===g.score[1]?null:g.score[0]>g.score[1]?0:1;g.message=g.score[0]===g.score[1]?'تعادل.. الحساب لسه مفتوح!':g.score[0]>g.score[1]?'فريق البرتقالي كسب الديربي!':'فريق الأزرق كسب الديربي!';g.event++;return;}
 for(const p of g.players){
 for(const key of ['skillCooldown','frozen','freezeImmunity','rocket','tackleCd','tackleTime','activeSkillTime'])p[key]=Math.max(0,p[key]-h);
 if(p.red){p.vx=p.vy=0;p.pending=null;continue;}
 p.cool=Math.max(0,(p.cool||0)-h);p.swing=Math.max(0,(p.swing||0)-h);p.hit=Math.max(0,(p.hit||0)-h);
 if(p.bot){p.think=(p.think||0)-h;if(p.think<=0){p.ai=botInput(p,g);botSkill(p,g);p.think=p.difficulty==='easy'?.23:.10;}}const a=p.bot?p.ai:(p.input||{});
 if(p.frozen>0){p.vx=0;p.pending=null;for(const key of ['jump','kick','pass','skill','tackle'])consume(p,a,key);p.vy+=1450*h;p.y=Math.min(GROUND,p.y+p.vy*h);if(p.y===GROUND)p.vy=0;continue;}
 if(!p.bot&&consume(p,a,'skill'))activateSkill(g,p,a.skill);
 const tackle=p.bot?a.kick&&p.tackleCd<=0&&Math.abs(g.ball.x-p.x)<55&&g.players.some(q=>q.team!==p.team&&!q.red&&Math.abs(q.x-p.x)<75):consume(p,a,'tackle');
 if(tackle)attemptTackle(g,p);if(g.phase==='ended')return;if(p.frozen>0||p.red){p.vx=0;continue;}
 p.vx=p.tackleTime>0?p.face*440:clamp(finite(a.axis),-1,1)*285;if(Math.abs(a.axis)>.08&&p.swing<.1)p.face=Math.sign(a.axis);
 const jump=p.bot?a.jump:consume(p,a,'jump');if(jump&&p.y>=GROUND-.1)p.vy=-620;
 p.vy+=1450*h;p.x=clamp(p.x+p.vx*h,70,W-70);p.y+=p.vy*h;if(p.y>GROUND){p.y=GROUND;p.vy=0;}
 const shot=p.bot?a.kick:consume(p,a,'kick'),pass=p.bot?a.pass:consume(p,a,'pass');
 if((shot||pass)&&p.cool<=0){if(p.bot)p.face=p.team===0?1:-1;else if(Math.abs(a.aimX)>.15)p.face=Math.sign(a.aimX);p.swing=.30;p.cool=p.bot?(p.difficulty==='easy'?.95:.62):.38;p.shotId=(p.shotId||0)+1;p.pending={a:cleanInput(a),pass:!!pass,wait:.065};}
 if(p.pending){p.pending.wait-=h;if(p.pending.wait<=0){if(Math.abs(p.pending.a.aimX)>.01)p.face=Math.sign(p.pending.a.aimX);tryStrike(g,p,p.pending.a,p.pending.pass);p.pending=null;}}
 }
 // Player separation has no extra ball acceleration.
 for(let i=0;i<g.players.length;i++)for(let j=i+1;j<g.players.length;j++){const a=g.players[i],b=g.players[j];if(a.red||b.red)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<50&&Math.abs(dy)<40){const push=(50-d)*.5,sign=dx===0?1:Math.sign(dx);a.x=clamp(a.x-sign*push,70,W-70);b.x=clamp(b.x+sign*push,70,W-70);}}
 const b=g.ball;b.rocket=Math.max(0,(b.rocket||0)-h);b.vy+=1050*h;b.x+=b.vx*h;b.y+=b.vy*h;b.vx*=Math.exp(-.18*h);
 if(b.y>FLOOR-BR){b.y=FLOOR-BR;b.vy=-Math.abs(b.vy)*.48;if(Math.abs(b.vy)<45)b.vy=0;b.vx*=Math.exp(-1.45*h);}
 if(b.y<BR){b.y=BR;b.vy=Math.abs(b.vy)*.65;}
 for(const team of [0,1]){const {top}=goalGeometry(g,team),lo=team===0?0:W-62,hi=team===0?62:W;if(b.x>lo-BR&&b.x<hi+BR&&b.y>top-6-BR&&b.y<top+6+BR){if(b.vy>=0&&b.y<top+6){b.y=top-6-BR;b.vy=-Math.abs(b.vy)*.65;}else{b.y=top+6+BR;b.vy=Math.abs(b.vy)*.65;}}}
 const crossed=b.x+BR<62?0:b.x-BR>W-62?1:null;
 if(crossed!==null&&b.y-BR>=goalGeometry(g,crossed).top+6){const t=1-crossed;g.score[t]++;const own=b.lastTouch?.team===1-t;g.phase='goal';g.until=now+1900;g.message=(t===0?'جووول للبرتقالي!':'جووول للأزرق!')+(own?' · هدف عكسي':'');g.lastGoal={team:t,touch:b.lastTouch,own};g.event++;kickoff(g);return;}
 if(b.x<BR){b.x=BR;b.vx=Math.abs(b.vx)*.65;}if(b.x>W-BR){b.x=W-BR;b.vx=-Math.abs(b.vx)*.65;}
 for(const p of g.players){if(p.red)continue;for(const body of [{y:p.y,r:R},{y:p.y+37,r:18}]){
 const dx=b.x-p.x,dy=b.y-body.y,d=Math.hypot(dx,dy),min=body.r+BR;if(d>=min)continue;let nx=d>.01?dx/d:p.face,ny=d>.01?dy/d:-1;
 b.x=p.x+nx*(min+.25);b.y=body.y+ny*(min+.25);if(b.y>FLOOR-BR){b.y=FLOOR-BR;const vertical=b.y-body.y,horizontal=Math.sqrt(Math.max(0,(min+.25)**2-vertical**2));b.x=p.x+(dx===0?p.face:Math.sign(dx))*horizontal;nx=(b.x-p.x)/(min+.25);ny=vertical/(min+.25);}const relative=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny;
 if(relative<0){const restitution=body.r===R?.28:.08;b.vx-=(1+restitution)*relative*nx;b.vy-=(1+restitution)*relative*ny;}
 b.lastTouch={id:p.id,team:p.team,kind:'contact'};
 // Never add velocity each overlapping frame. A passive nudge is bounded.
 const maxContact=b.rocket>0?1750:1100;if(Math.hypot(b.vx,b.vy)>maxContact){const f=maxContact/Math.hypot(b.vx,b.vy);b.vx*=f;b.vy*=f;}
 }}const maxSpeed=b.rocket>0?1750:1050;b.vx=clamp(b.vx,-maxSpeed,maxSpeed);b.vy=clamp(b.vy,-maxSpeed,maxSpeed);
 }
}
