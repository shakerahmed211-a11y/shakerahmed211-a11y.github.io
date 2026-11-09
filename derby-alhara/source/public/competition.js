export function createLeague(players){
 if(players.length<2||players.length>6)throw new Error('الدوري يحتاج من ٢ إلى ٦ لاعبين');
 const ids=players.map(p=>p.id);if(new Set(ids).size!==ids.length)throw new Error('اللاعب مكرر');
 const ring=[...ids];if(ring.length%2)ring.push(null);const fixtures=[];
 for(let round=0;round<ring.length-1;round++){for(let i=0;i<ring.length/2;i++){const a=ring[i],b=ring[ring.length-1-i];if(a&&b)fixtures.push({a,b,round:round+1,result:null});}ring.splice(1,0,ring.pop());}
 return {fixtures,index:0,finished:false,table:players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,points:0}))};
}
export function recordLeagueResult(league,game){const f=league.fixtures[league.index];if(!f||f.result||game.phase!=='ended')return false;
 const winner=game.winner??(game.score[0]===game.score[1]?null:game.score[0]>game.score[1]?0:1);
 f.result={score:[...game.score],winner,forfeit:game.endReason==='forfeit'};
 for(const [team,id] of [f.a,f.b].entries()){const row=league.table.find(r=>r.id===id);if(!row)continue;row.played++;row.gf+=game.score[team];row.ga+=game.score[1-team];if(winner===null){row.draws++;row.points++;}else if(winner===team){row.wins++;row.points+=3;}else row.losses++;}
 league.finished=league.fixtures.every(f=>f.result);return true;
}
export function rankTable(table){return [...table].sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name,'ar'));}
