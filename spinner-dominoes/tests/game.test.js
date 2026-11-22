import test from 'node:test';
import assert from 'node:assert/strict';
import { createSet, beginRound, getLegalMoves, place, drawOrPass, tileValue, nextRound } from '../src/game.js';

const fixed = () => 0.314159;
test('builds the 45-tile Double-7 set with Spinner wilds',()=>{
  const set=createSet();assert.equal(set.length,45);assert.equal(set.filter(t=>t.a!=='W'&&t.b!=='W').length,36);assert.equal(set.filter(t=>t.a==='W'||t.b==='W').length,9);assert.ok(set.every(t=>t.a==='W'||t.a<=7)&&set.every(t=>t.b==='W'||t.b<=7));
});
test('deals hands, selects the round starter and opens the first three spinner arms',()=>{
  const s=beginRound(['A','B','C','D'],0,fixed);assert.equal(s.players.length,4);assert.ok(s.board[0].tile.id==='d7-7'||s.board[0].tile.id==='w-w');assert.equal(s.forced.slots.length,3);assert.ok(s.turn>=0&&s.turn<4);assert.equal(s.players.reduce((n,p)=>n+p.hand.length,0)+s.bag.length+1,45);
});
test('legal placement consumes a matching arm and rejects an out-of-turn move',()=>{
  const s=beginRound(['A','B'],0,fixed);const moves=getLegalMoves(s,s.players[s.turn].hand);assert.ok(moves.length);const m=moves[0];assert.equal(place(s,(s.turn+1)%2,m).ok,false);const current=s.turn;assert.equal(place(s,current,m).ok,true);assert.equal(s.forced.remaining,2);
});
test('wild ends are counted as ten and round scoring adds remaining hand values',()=>{
  assert.equal(tileValue({a:'W',b:8}),18);assert.equal(tileValue({a:'W',b:'W'}),20);
  const s={started:true,round:0,players:[{name:'A',hand:[{id:'x',a:2,b:3}],score:4},{name:'B',hand:[{id:'y',a:'W',b:2}],score:7}],bag:[],board:[],ends:[{id:'e',value:2,used:false}],forced:null,forcedQueue:[],turn:0,passes:0,finished:false,log:[]};
  assert.equal(place(s,0,{tileId:'x',endId:'e'}).ok,true);assert.equal(s.finished,true);assert.equal(s.players[0].score,4);assert.equal(s.players[1].score,19);assert.equal(s.roundWinner,0);
});
test('a player cannot pass while a legal move exists; blocked rounds end after everyone passes',()=>{
  const s={started:true,round:0,players:[{name:'A',hand:[{id:'a',a:1,b:2}],score:0},{name:'B',hand:[{id:'b',a:4,b:5}],score:0}],bag:[],board:[],ends:[{id:'e',value:2,used:false}],forced:null,forcedQueue:[],turn:0,passes:0,finished:false,log:[]};
  assert.equal(drawOrPass(s,0).ok,false);s.players[0].hand=[{id:'a',a:1,b:1}];assert.equal(drawOrPass(s,0).ok,true);assert.equal(s.turn,1);assert.equal(drawOrPass(s,1).ok,true);assert.equal(s.finished,true);assert.equal(s.result,'blocked');assert.equal(s.players[0].score,2);
});
test('draw keeps drawing until a playable tile appears',()=>{
  const s={started:true,round:0,players:[{name:'A',hand:[{id:'a',a:1,b:1}],score:0},{name:'B',hand:[{id:'b',a:3,b:4}],score:0}],bag:[{id:'x',a:5,b:6},{id:'y',a:4,b:2}],board:[],ends:[{id:'e',value:2,used:false}],forced:null,forcedQueue:[],turn:0,passes:0,finished:false,log:[]};
  const r=drawOrPass(s,0);assert.equal(r.playable,true);assert.equal(r.drawn,2);assert.equal(s.players[0].hand.length,3);assert.equal(s.turn,0);
});
test('round progression advances from double-seven to double-six',()=>{
  const s=beginRound(['A','B'],0,fixed);s.finished=true;const n=nextRound(s,fixed);assert.equal(n.ok,true);assert.equal(n.state.round,1);assert.ok(['d6-6','w-w'].includes(n.state.board[0].tile.id));
});
test('room options preserve team mode and configured match length across hands',()=>{
  const s=beginRound(['A','B','C','D'],0,fixed,{teamMode:true,roundsTotal:3});s.finished=true;const n=nextRound(s,fixed);assert.equal(n.ok,true);assert.equal(n.state.teamMode,true);assert.equal(n.state.roundsTotal,3);n.state.finished=true;const last=nextRound(n.state,fixed);assert.equal(last.ok,true);last.state.finished=true;assert.equal(nextRound(last.state,fixed).ok,false);
});
test('the optional house rule restarts every hand from double-seven',()=>{
  const s=beginRound(['A','B'],3,fixed,{starterMode:'repeat-seven'});assert.ok(['d7-7','w-w'].includes(s.board[0].tile.id));assert.equal(s.starterMode,'repeat-seven');s.finished=true;const n=nextRound(s,fixed);assert.equal(n.state.starterMode,'repeat-seven');assert.ok(['d7-7','w-w'].includes(n.state.board[0].tile.id));
});
