import http from 'node:http';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build.mjs']);
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('drizzle/0000_rooms.sql','utf8').replaceAll('--> statement-breakpoint',''));
export function adapter(db){return {prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};}
const worker=(await import('../dist/server/index.js')).default;
const env={DB:adapter(db)};
const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const init={method:req.method,headers:req.headers};if(!['GET','HEAD'].includes(req.method)){init.body=Buffer.concat(chunks);init.duplex='half';}const response=await worker.fetch(new Request('http://localhost'+req.url,init),env,{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){console.error(e);res.writeHead(500);res.end('Server error');}});server.listen(Number(process.env.PORT)||Number(process.argv[process.argv.indexOf('--port')+1])||3000,'0.0.0.0',()=>console.log('Derby preview ready'));
