import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { beginRound, place, drawOrPass, nextRound, chooseAiMove } from './src/game.js';

const root = path.dirname(fileURLToPath(import.meta.url)), publicDir = path.join(root, 'public');
const rooms = new Map(), sockets = new Set();
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json' };
const server = http.createServer((req,res)=>{
  if (req.url === '/health') { res.writeHead(200,{'content-type':'application/json'}); return res.end(JSON.stringify({ok:true,rooms:rooms.size})); }
  const safe = path.normalize(decodeURIComponent((req.url||'/').split('?')[0])).replace(/^\.\.(\/|\\|$)/,'');
  const base = safe.startsWith('/src/') ? root : publicDir;
  let file = path.join(base, safe === '/' ? 'index.html' : safe);
  if (!file.startsWith(base)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file,(err,data)=>{ if(err){res.writeHead(404);res.end('Not found');return;} res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});res.end(data); });
});
const send = (socket, data) => { if (!socket.destroyed) socket.write(frame(JSON.stringify(data))); };
function frame(data, opcode=1) {
  const body = Buffer.from(data), len=body.length; let head;
  if(len<126){head=Buffer.from([0x80|opcode,len]);}
  else if(len<65536){head=Buffer.alloc(4);head[0]=0x80|opcode;head[1]=126;head.writeUInt16BE(len,2);}
  else {head=Buffer.alloc(10);head[0]=0x80|opcode;head[1]=127;head.writeBigUInt64BE(BigInt(len),2);}
  return Buffer.concat([head,body]);
}
function parseFrames(sock, chunk) {
  sock.buffer = Buffer.concat([sock.buffer||Buffer.alloc(0),chunk]);
  while(sock.buffer.length>=2){
    const b=sock.buffer, opcode=b[0]&15, masked=!!(b[1]&128); let len=b[1]&127, off=2;
    if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4;} else if(len===127){if(b.length<10)return;len=Number(b.readBigUInt64BE(2));off=10;}
    if(masked)off+=4;if(b.length<off+len)return;
    let payload=b.subarray(off,off+len); if(masked){const key=b.subarray(off-4,off);payload=Buffer.from(payload);for(let i=0;i<payload.length;i++)payload[i]^=key[i%4];}
    sock.buffer=b.subarray(off+len);
    if(opcode===8){sock.end();return;} if(opcode===9){sock.write(frame(payload,10));continue;} if(opcode!==1)continue;
    try{handle(sock,JSON.parse(payload.toString()));}catch(e){send(sock,{type:'error',message:e.message||'تعذر تنفيذ الطلب.'});}
  }
}
function code(){return crypto.randomBytes(3).toString('hex').toUpperCase();}
function getRoom(code){const r=rooms.get(String(code||'').toUpperCase());if(!r)throw Error('الغرفة غير موجودة أو انتهت صلاحيتها.');return r;}
function seatOf(room,token){return room.seats.findIndex(s=>s.token===token);}
function personalized(room,index){
  const state=room.state;
  const activeEnds=state?(state.forced?state.forced.slots:state.ends.filter(e=>!e.used)):[];
  return {type:'state',room:{code:room.code,host:room.host,max:room.max,teamMode:room.teamMode,roundsTotal:room.roundsTotal,starterMode:room.starterMode,speed:room.speed,seats:room.seats.map(s=>({name:s.name,online:!!s.socket,token:s.token===room.seats[index]?.token? s.token:undefined})),started:!!state},game:state?{round:state.round,roundsTotal:state.roundsTotal,teamMode:state.teamMode,starterMode:state.starterMode,speed:state.speed,players:state.players.map((p,i)=>({name:p.name,count:p.hand.length,score:p.score,hand:i===index?p.hand:undefined})),turn:state.turn,board:state.board,ends:activeEnds,forced:state.forced?{remaining:state.forced.remaining,value:state.forced.value,slots:state.forced.slots}:null,bagCount:state.bag.length,finished:state.finished,roundWinner:state.roundWinner,result:state.result,log:state.log.slice(-12)}:null};
}
function broadcast(room){room.seats.forEach((s,i)=>{if(s.socket)send(s.socket,personalized(room,i));});}
function bind(sock,room,token){sock.room=room.code;sock.token=token;const i=seatOf(room,token);if(i>=0)room.seats[i].socket=sock;broadcast(room);}
function handle(sock,msg){
  if(msg.type==='create'){
    const name=cleanName(msg.name), teamMode=!!msg.teamMode, max=teamMode?4:Math.max(2,Math.min(4,Number(msg.max)||4)), roundsTotal=[3,5,10].includes(Number(msg.roundsTotal))?Number(msg.roundsTotal):10, starterMode=msg.starterMode==='repeat-nine'?'repeat-nine':'official', speed=msg.speed==='fast'?'fast':'normal'; let c=code();while(rooms.has(c))c=code();
    const token=crypto.randomUUID(), room={code:c,host:token,max,teamMode,roundsTotal,starterMode,speed,seats:[{name,token,socket:sock}],state:null,created:Date.now()};rooms.set(c,room);bind(sock,room,token);send(sock,{type:'created',code:c,token});return;
  }
  if(msg.type==='join'){
    const room=getRoom(msg.code),name=cleanName(msg.name); if(room.seats.length>=room.max)throw Error('الغرفة مكتملة.');
    const token=crypto.randomUUID();room.seats.push({name,token,socket:sock});bind(sock,room,token);send(sock,{type:'joined',code:room.code,token});return;
  }
  if(msg.type==='reconnect'){
    const room=getRoom(msg.code),i=seatOf(room,msg.token);if(i<0)throw Error('انتهت صلاحية مقعدك في هذه الغرفة.');bind(sock,room,msg.token);send(sock,{type:'reconnected',code:room.code,token:msg.token});return;
  }
  if(!sock.room||!sock.token)throw Error('اتصل بغرفة أولًا.');
  const room=getRoom(sock.room),i=seatOf(room,sock.token);if(i<0)throw Error('لم أجد مقعدك في الغرفة.');
  if(msg.type==='start'){
    if(room.host!==sock.token)throw Error('مضيف الغرفة فقط يمكنه بدء المباراة.');if(room.seats.length<2)throw Error('تحتاج إلى لاعب آخر على الأقل.');if(room.state&&!room.state.finished)throw Error('المباراة جارية بالفعل.');
    if(room.teamMode&&room.seats.length!==4)throw Error('اللعب بنظام الفرق يحتاج إلى أربعة لاعبين.');room.state=beginRound(room.seats.map(s=>s.name),0,Math.random,{teamMode:room.teamMode,roundsTotal:room.roundsTotal,starterMode:room.starterMode,speed:room.speed});broadcast(room);return;
  }
  if(msg.type==='play'){
    if(!room.state)throw Error('لم تبدأ المباراة.');const result=place(room.state,i,msg.move);if(!result.ok)throw Error(result.reason);broadcast(room);return;
  }
  if(msg.type==='draw'){
    if(!room.state)throw Error('لم تبدأ المباراة.');const result=drawOrPass(room.state,i);if(!result.ok)throw Error(result.reason);broadcast(room);return;
  }
  if(msg.type==='next'){
    if(room.host!==sock.token)throw Error('مضيف الغرفة يبدأ الجولة التالية.');const result=nextRound(room.state);if(!result.ok)throw Error(result.reason);room.state=result.state;broadcast(room);return;
  }
  if(msg.type==='chat'){
    const text=String(msg.text||'').trim().slice(0,160);if(!text)return;room.seats.forEach(s=>s.socket&&send(s.socket,{type:'chat',name:room.seats[i].name,text}));return;
  }
  throw Error('طلب غير معروف.');
}
function cleanName(v){const n=String(v||'لاعب').trim().slice(0,18);return n||'لاعب';}
server.on('upgrade',(req,socket)=>{
  const key=req.headers['sec-websocket-key'];if(!key){socket.destroy();return;}
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  socket.buffer=Buffer.alloc(0);sockets.add(socket);socket.on('data',b=>parseFrames(socket,b));
  socket.on('close',()=>{sockets.delete(socket);if(socket.room){const r=rooms.get(socket.room),i=r?seatOf(r,socket.token):-1;if(i>=0&&r.seats[i].socket===socket){r.seats[i].socket=null;broadcast(r);setTimeout(()=>{if(!r.seats[i].socket&&r.state?.players?.[i])r.state.players[i].online=false;},60000);}}});
});
setInterval(()=>{for(const [key,r] of rooms)if(Date.now()-r.created>6*60*60*1000&&!r.seats.some(s=>s.socket))rooms.delete(key);},60000).unref();
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`Spinner Dominoes listening on ${port}`));
