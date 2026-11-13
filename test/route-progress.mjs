import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildNavigationView, indexNavigationGraph, navigationStateFromRoute} from '../src/navigation.js';
import {advanceOnRouteAudio, playbackModeFor, validStoredProgress} from '../src/route-progress.js';

const graph = JSON.parse(await readFile(new URL('../src/navigation-graph.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../src/routes.json', import.meta.url), 'utf8'));
const index = indexNavigationGraph(graph);
const routeIds = routes.find(route => route.minutes === 90).ids;
const initial = navigationStateFromRoute(index, routeIds);

assert.equal(playbackModeFor(index, initial, 'mona'), 'route', 'only the next work is route playback');
assert.equal(playbackModeFor(index, initial, 'victory'), 'standalone', 'a past work is standalone playback');
assert.equal(playbackModeFor(index, initial, 'liberty'), 'standalone', 'a later work is standalone until it becomes next');

const beforeArrival = buildNavigationView(index, initial);
const monaArrival = advanceOnRouteAudio(index, initial, routeIds, 'mona');
assert.equal(monaArrival.updated, true);
assert.equal(monaArrival.navigation.currentNodeId, 'work:mona');
assert.equal(monaArrival.navigation.destinationNodeId, 'work:liberty');
assert.equal(monaArrival.navigation.lastConfirmedWorkId, 'mona');
assert.equal(monaArrival.navigation.passedNodeIds.at(-1), 'work:mona');
assert.deepEqual(monaArrival.previous, initial, 'undo snapshot preserves the exact previous progress');

const afterArrival = buildNavigationView(index, monaArrival.navigation);
assert.equal(afterArrival.currentNode.label, 'モナ・リザ');
assert.equal(afterArrival.destinationNode.workId, 'liberty');
assert.ok(afterArrival.passedSegments.length >= beforeArrival.passedSegments.length, 'arrived route becomes passed history');
assert.notDeepEqual(afterArrival.remainingPath.nodeIds, beforeArrival.remainingPath.nodeIds, 'old unpassed plan is replaced');

const duplicateMona = advanceOnRouteAudio(index, monaArrival.navigation, routeIds, 'mona');
assert.equal(duplicateMona.updated, false, 'resume or duplicate arrival cannot update twice');
assert.equal(duplicateMona.reason, 'not-next-work');
const pastVictory = advanceOnRouteAudio(index, monaArrival.navigation, routeIds, 'victory');
assert.equal(pastVictory.updated, false, 'past standalone playback cannot move the location backwards');

const libertyArrival = advanceOnRouteAudio(index, monaArrival.navigation, routeIds, 'liberty');
assert.equal(libertyArrival.updated, true);
assert.equal(libertyArrival.navigation.currentNodeId, 'work:liberty');
assert.equal(libertyArrival.navigation.destinationNodeId, 'work:clubfoot');
assert.ok(libertyArrival.navigation.passedNodeIds.length > monaArrival.navigation.passedNodeIds.length, 'past route history is retained');

const shortRoute = ['victory','mona'];
const shortState = navigationStateFromRoute(index, shortRoute);
const completed = advanceOnRouteAudio(index, shortState, shortRoute, 'mona');
assert.equal(completed.navigation.routeComplete, true);
assert.equal(completed.navigation.destinationNodeId, null);
assert.equal(buildNavigationView(index, completed.navigation).complete, true);

const stored = {version:1, minutes:90, routeSignature:routeIds.join('|'), navigation:monaArrival.navigation, selected:'mona', floor:1};
assert.deepEqual(validStoredProgress(index, routes, stored)?.navigation, monaArrival.navigation, 'same-session reload restores progress');
assert.equal(validStoredProgress(index, routes, {...stored, routeSignature:'stale'}), null, 'changed route data invalidates stale progress');

console.log('audio-linked route progress: passed');
