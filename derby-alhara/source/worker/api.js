// Engine and ASSETS are injected by scripts/build.mjs.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
const fail=(s,m)=>{throw Object.assign(new Error(m),{status:s});};
function view(r,token){return {code:r.code,mode:r.mode,host:r.host,status:r.status,series:r.series,wins:r.wins,seriesOver:r.seriesOver,game:r.game,players:r.players.map(({token:_,...p})=>p),you:r.players.find(p=>p.token===token)?.id};}
function maintain(r,now){
 if(r.status==='lobby'){r.players=r.players.filter(p=>now-p.seen<45000);if(!r.players.some(p=>p.id===r.host))r.host=r.players[0]?.id;}
 const active=r.players.filter(p=>now-p.seen<45000);if(active.length&&!active.some(p=>p.id===r.host))r.host=active[0].id;
 if(r.status==='match'&&r.game){for(const gp of r.game.players){const p=r.players.find(p=>p.id===gp.id);if(p&&!gp.bot)gp.input=now-p.seen>700?{}:p.input;}advance(r.game,now);if(r.game.phase==='ended'&&!r.counted){r.counted=true;const [a,b]=r.game.score;const winner=r.game.winner??(a===b?null:a>b?0:1);if(winner!==null)r.wins[winner]++;r.seriesOver=r.series&&Math.max(...r.wins)>=2;}}
}
export async function api(request,env){const url=new URL(request.url);if(request.method==='OPTIONS')return new Response(null,{headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'content-type'}});if(url.pathname==='/api/health')return json({ok:true,rooms:!!env.DB,version:'0.3.0'});
 try{if(request.method!=='POST')fail(405,'الطلب غير مدعوم');if(!env.DB)fail(503,'خادم الغرف غير متاح حاليًا. تقدر تلعب ضد الكمبيوتر.');if(Number(request.headers.get('content-length'))>8192)fail(413,'الطلب كبير جدًا');const text=await request.text();if(text.length>8192)fail(413,'الطلب كبير جدًا');let body;try{body=JSON.parse(text);}catch{fail(400,'طلب غير صالح');}const action=url.pathname.split('/').pop();const now=Date.now();
 if(action==='create'){
 const mode=Number(body.mode);if(![1,2,3].includes(mode))fail(400,'اختار عدد اللاعبين');const code=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();const p=newPlayer(body,0,now);const r={code,mode,host:p.id,players:[p],status:'lobby',game:null,wins:[0,0],series:!!body.series,seriesOver:false};await env.DB.prepare('DELETE FROM rooms WHERE updated < ?').bind(now-86400000).run();await env.DB.prepare('INSERT INTO rooms(code,data,version,updated) VALUES (?,?,0,?)').bind(code,JSON.stringify(r),now).run();return json({room:view(r,p.token),token:p.token});}
 const code=String(body.code||'').toUpperCase();if(!/^[A-F0-9]{8}$/.test(code))fail(400,'كود الغرفة ٨ حروف وأرقام');
 for(let retry=0;retry<7;retry++){
 const row=await env.DB.prepare('SELECT data,version,updated FROM rooms WHERE code=?').bind(code).first();if(!row||now-row.updated>86400000)fail(404,'الغرفة غير موجودة أو انتهت');const r=JSON.parse(row.data);maintain(r,now);let token=body.token;let p=r.players.find(p=>p.token===token);let extra={};
 if(action==='join'&&!p){if(r.status!=='lobby')fail(409,'المباراة بدأت. انتظر الجولة التالية');if(r.players.length>=r.mode*2)fail(409,'الغرفة مكتملة');const team=r.players.filter(p=>p.team===0).length<r.mode?0:1;p=newPlayer(body,team,now);r.players.push(p);if(!r.host)r.host=p.id;token=p.token;extra.token=token;}
 else if(!p)fail(401,'انتهت الجلسة. ادخل الغرفة مرة تانية');
 p.seen=now;
 if(action==='sync'){p.input=cleanInput(body.input);}
 else if(action==='ready'){if(r.status!=='lobby')fail(409,'المباراة بدأت');p.ready=!p.ready;}
 else if(action==='team'){if(r.status!=='lobby')fail(409,'المباراة بدأت');const t=body.team;if(![0,1].includes(t))fail(400,'فريق غير صالح');if(t!==p.team&&r.players.filter(q=>q.team===t).length>=r.mode)fail(409,'الفريق مكتمل');p.team=t;p.ready=false;}
 else if(action==='start'){
 if(p.id!==r.host)fail(403,'صاحب الغرفة يبدأ المباراة');if(r.status!=='lobby')fail(409,'المباراة بدأت بالفعل');if(r.players.some(q=>!q.ready))fail(409,'استنى كل اللاعبين يضغطوا جاهز');const roster=r.players.map(q=>({...q,bot:false}));for(const team of [0,1]){let missing=r.mode-roster.filter(q=>q.team===team).length;if(missing&&!body.fillBots)fail(409,'كمّلوا الفريقين أو فعّل إكمال بالكمبيوتر');while(missing-->0)roster.push({id:'bot-'+team+'-'+missing,name:NAMES[(team*5+missing+1)%NAMES.length],avatar:(team*5+missing+1)%NAMES.length,team,bot:true});}
 r.game=makeGame(roster,now);r.status='match';r.counted=false;
 }else if(action==='rematch'){if(p.id!==r.host)fail(403,'صاحب الغرفة يفتح الجولة التالية');if(r.status!=='match'||r.game?.phase!=='ended')fail(409,'استنى نهاية المباراة');if(r.seriesOver)r.wins=[0,0];r.seriesOver=false;r.status='lobby';r.game=null;for(const q of r.players){q.ready=false;q.input={};}}
 else if(action==='leave'){r.players=r.players.filter(q=>q.id!==p.id);if(r.host===p.id)r.host=r.players[0]?.id;}
 else if(!['sync','join'].includes(action))fail(404,'طلب غير معروف');
 const result=await env.DB.prepare('UPDATE rooms SET data=?,version=version+1,updated=? WHERE code=? AND version=?').bind(JSON.stringify(r),now,code,row.version).run();if(result.meta.changes===1)return json({room:view(r,token),...extra});
 }fail(409,'الغرفة مشغولة لحظة.. جرّب تاني');
 }catch(e){return json({error:e.status?e.message:'حصلت مشكلة في الخادم. جرّب مرة تانية.'},e.status||500);}}
function newPlayer(b,team,now){return {id:crypto.randomUUID(),token:crypto.randomUUID(),name:String(b.name||'لاعب').trim().slice(0,24)||'لاعب',avatar:clamp(Math.trunc(Number(b.avatar)||0),0,NAMES.length-1),team,ready:false,seen:now,input:{}};}
