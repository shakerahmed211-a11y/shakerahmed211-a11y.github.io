import test from 'node:test';
import assert from 'node:assert/strict';
import { createSet, beginRound, getLegalMoves, place, drawOrPass, tileValue, nextRound } from '../src/game.js';

const fixed = () => 0.314159;

test('builds the real Double-6 set: seven values and 28 tiles',()=>{
  const set=createSet();assert.equal(set.length,28);
  assert.ok(set.every(t=>Number.isInteger(t.a)&&Number.isInteger(t.b)&&t.a>=0&&t.b<=6));
  for(let n=0;n<=6;n++)assert.equal(set.filter(t=>t.a===n||t.b===n).length,7,`value ${n} appears on seven tiles`);
});
test('deals seven tiles and opens three arms from the double-six starter',()=>{
  const s=beginRound(['A','B','C','D'],0,fixed);assert.equal(s.players.length,4);assert.ok(s.board[0].tile.id==='d6-6');assert.equal(s.forced.slots.length,3);assert.ok(s.turn>=0&&s.turn<4);assert.equal(s.players.reduce((n,p)=>n+p.hand.length,0)+s.bag.length+1,28);assert.ok(s.players.every(p=>p.hand.length===7||p.hand.length===6));
});
test('legal placement consumes a matching arm and rejects an out-of-turn move',()=>{
  const s=beginRound(['A','B'],0,()=>0.009900990099009901);const moves=getLegalMoves(s,s.players[s.turn].hand);assert.ok(moves.length);const m=moves[0];assert.equal(place(s,(s.turn+1)%2,m).ok,false);const current=s.turn;assert.equal(place(s,current,m).ok,true);assert.equal(s.forced.remaining,2);
});
test('scores remaining pip values and finishes when a player empties their hand',()=>{
  assert.equal(tileValue({a:6,b:5}),11);assert.equal(tileValue({a:0,b:0}),0);
  const s={started:true,round:0,players:[{name:'A',hand:[{id:'x',a:2,b:3}],score:4},{name:'B',hand:[{id:'y',a:6,b:2}],score:7}],bag:[],board:[],ends:[{id:'e',value:2,used:false}],forced:null,forcedQueue:[],turn:0,passes:0,finished:false,log:[]};
  assert.equal(place(s,0,{tileId:'x',endId:'e'}).ok,true);assert.equal(s.finished,true);assert.equal(s.players[0].score,4);assert.equal(s.players[1].score,15);assert.equal(s.roundWinner,0);
});
test('a player cannot pass while a legal move exists; blocked rounds score remaining tiles',()=>{
  const s={started:true,round:0,players:[{name:'A',hand:[{id:'a',a:1,b:2}],score:0},{name:'B',hand:[{id:'b',a:4,b:5}],score:0}],bag:[],board:[],ends:[{id:'e',value:2,used:false}],forced:null,forcedQueue:[],turn:0,passes:0,finished:false,log:[]};
  assert.equal(drawOrPass(s,0).ok,false);s.players[0].hand=[{id:'a',a:1,b:1}];assert.equal(drawOrPass(s,0).ok,true);assert.equal(s.turn,1);assert.equal(drawOrPass(s,1).ok,true);assert.equal(s.finished,true);assert.equal(s.result,'blocked');assert.equal(s.players[0].score,2);
});
test('draw continues until a playable piece appears',()=>{
  const s={started:true,round:0,players:[{name:'A',hand:[{id:'a',a:1,b:1}],score:0},{name:'B',hand:[{id:'b',a:3,b:4}],score:0}],bag:[{id:'x',a:5,b:6},{id:'y',a:4,b:2}],board:[],ends:[{id:'e',value:2,used:false}],forced:null,forcedQueue:[],turn:0,passes:0,finished:false,log:[]};
  const r=drawOrPass(s,0);assert.equal(r.playable,true);assert.equal(r.drawn,2);assert.equal(s.players[0].hand.length,3);assert.equal(s.turn,0);
});
test('round progression descends from double-six to double-five',()=>{
  const s=beginRound(['A','B'],0,fixed);s.finished=true;const n=nextRound(s,fixed);assert.equal(n.ok,true);assert.equal(n.state.round,1);assert.equal(n.state.board[0].tile.id,'d5-5');
});
test('room settings persist across hands and the final round cannot advance',()=>{
  const s=beginRound(['A','B','C','D'],0,fixed,{teamMode:true,roundsTotal:3});s.finished=true;const n=nextRound(s,fixed);assert.equal(n.ok,true);assert.equal(n.state.teamMode,true);assert.equal(n.state.roundsTotal,3);n.state.finished=true;const last=nextRound(n.state,fixed);assert.equal(last.ok,true);last.state.finished=true;assert.equal(nextRound(last.state,fixed).ok,false);
});
test('the optional house rule restarts every hand from double-six',()=>{
  const s=beginRound(['A','B'],3,fixed,{starterMode:'repeat-six'});assert.equal(s.board[0].tile.id,'d6-6');assert.equal(s.starterMode,'repeat-six');s.finished=true;const n=nextRound(s,fixed);assert.equal(n.state.starterMode,'repeat-six');assert.equal(n.state.board[0].tile.id,'d6-6');
});
