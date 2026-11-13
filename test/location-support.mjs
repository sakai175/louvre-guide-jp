import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildNavigationView, indexNavigationGraph} from '../src/navigation.js';
import {advanceOnRouteAudio} from '../src/route-progress.js';
import {correctLocation, findRoomCandidates, normalizeRoomNumber} from '../src/location-support.js';

const graph = JSON.parse(fs.readFileSync(new URL('../src/navigation-graph.json', import.meta.url)));
const works = JSON.parse(fs.readFileSync(new URL('../src/works.json', import.meta.url)));
const index = indexNavigationGraph(graph);
const base = {journeyStartNodeId:'work:victory', currentNodeId:'work:mona', destinationNodeId:'work:liberty', passedNodeIds:['work:victory','door:f1:703','door:f1:711','work:mona']};

assert.equal(normalizeRoomNumber(' ７１１室 '), '711');
assert.deepEqual(findRoomCandidates(index, works, '999'), []);
const candidates = findRoomCandidates(index, works, '711');
assert.equal(candidates.length, 1);
assert.equal(candidates[0].nodeId, 'door:f1:711');
assert.match(candidates[0].label, /ドゥノン翼 · 1階 · 711室/);

const corrected = correctLocation(index, base, 'door:f1:711');
assert.equal(corrected.updated, true);
assert.equal(corrected.navigation.currentNodeId, 'door:f1:711');
assert.deepEqual(corrected.navigation.passedNodeIds, base.passedNodeIds, 'past dotted route should be preserved');
assert.equal(corrected.navigation.lastConfirmedMethod, 'manual');
assert.equal(corrected.route.nodeIds.at(-1), 'work:liberty');
const remoteCorrection = correctLocation(index, base, 'door:f1:635').navigation;
const afterCorrectedArrival = advanceOnRouteAudio(index, remoteCorrection, ['victory','mona','liberty'], 'liberty').navigation;
assert.equal(afterCorrectedArrival.passedNodeGroups.length, 2, 'a correction must not connect separate passed sections with a fake line');
assert.ok(buildNavigationView(index, afterCorrectedArrival).passedSegments.length >= 2, 'past and post-correction dotted sections remain visible');

const synthetic = indexNavigationGraph({nodes:[
  {id:'room:a',type:'room',room:'12',floor:0,wing:'A',x:0,y:0},
  {id:'room:b',type:'room',room:'12',floor:1,wing:'B',x:1,y:1},
  {id:'goal',type:'artwork',floor:0,x:2,y:2}
],edges:[{from:'room:a',to:'goal',cost:1}]});
assert.equal(findRoomCandidates(synthetic, [], '12').length, 2, 'same room number must return selectable candidates');
const unavailable = correctLocation(synthetic, {destinationNodeId:'goal',passedNodeIds:[]}, 'room:b');
assert.equal(unavailable.updated, false);
assert.equal(unavailable.message, 'この地点から経路を作成できません。別の部屋番号を入力してください');
assert.equal(correctLocation(index, base, 'missing').message, '部屋番号を確認してください');

console.log('manual location correction: passed');
