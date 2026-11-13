import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildNavigationView, indexNavigationGraph, navigationStateFromRoute, shortestPath} from '../src/navigation.js';

const graph = JSON.parse(await readFile(new URL('../src/navigation-graph.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../src/routes.json', import.meta.url), 'utf8'));
const index = indexNavigationGraph(graph);

const sameFloor = buildNavigationView(index, {
  journeyStartNodeId:'work:victory',
  currentNodeId:'door:f1:703',
  destinationNodeId:'work:mona'
});
assert.equal(sameFloor.available, true);
assert.deepEqual(sameFloor.routeFloors, [1]);
assert.equal(sameFloor.transitions.length, 0);
assert.match(sameFloor.nextAction, /右/);
assert.match(sameFloor.nextAction, /711室/);
assert.ok(sameFloor.passedSegments.length > 0, 'passed route should be available');
assert.ok(sameFloor.remainingSegments.length > 0, 'remaining route should be available');

const multipleFloors = buildNavigationView(index, {
  journeyStartNodeId:'work:victory',
  currentNodeId:'door:f1:703',
  destinationNodeId:'work:venus'
});
assert.equal(multipleFloors.available, true);
assert.deepEqual(new Set(multipleFloors.routeFloors), new Set([1, 0]));
assert.equal(multipleFloors.transitions.length, 1);
assert.equal(multipleFloors.transitions[0].kind, 'stairs');
assert.match(multipleFloors.transitions[0].message, /1階下へ/);

const threeFloorMove = buildNavigationView(index, {
  journeyStartNodeId:'work:lacemaker',
  currentNodeId:'door:f2:837',
  destinationNodeId:'work:marly'
});
assert.equal(threeFloorMove.transitions.length, 1);
assert.match(threeFloorMove.transitions[0].message, /3階下へ/);
assert.deepEqual(new Set(threeFloorMove.routeFloors), new Set([2, -1]));

const routeState = navigationStateFromRoute(index, ['victory', 'mona', 'venus']);
assert.deepEqual(routeState, {
  journeyStartNodeId:'work:victory',
  currentNodeId:'door:f1:703',
  destinationNodeId:'work:mona',
  passedNodeIds:['work:victory','door:f1:703'],
  passedNodeGroups:[['work:victory','door:f1:703']],
  lastConfirmedWorkId:'victory',
  lastConfirmedMethod:'route-start',
  routeComplete:false
});

const elevatorGraph = structuredClone(graph);
elevatorGraph.edges.forEach(edge => { if (edge.kind === 'stairs') edge.available = false; });
const elevatorPath = shortestPath(elevatorGraph, 'door:f1:703', 'work:venus');
assert.ok(elevatorPath);
assert.ok(elevatorPath.edges.some(edge => edge.kind === 'elevator'), 'elevator remains a connected alternative');
const elevatorView = buildNavigationView(indexNavigationGraph(elevatorGraph), {
  journeyStartNodeId:'work:victory',
  currentNodeId:'door:f1:703',
  destinationNodeId:'work:venus'
});
assert.equal(elevatorView.transitions[0].kind, 'elevator');
assert.match(elevatorView.transitions[0].message, /エレベーター/);

const unavailable = buildNavigationView(index, {
  journeyStartNodeId:'unknown',
  currentNodeId:'unknown',
  destinationNodeId:'work:mona'
});
assert.equal(unavailable.available, false);
assert.deepEqual(unavailable.remainingSegments, []);

const disconnectedGraph = structuredClone(graph);
disconnectedGraph.edges.forEach(edge => {
  if (edge.from === 'work:mona' || edge.to === 'work:mona') edge.available = false;
});
const disconnected = buildNavigationView(disconnectedGraph, {
  journeyStartNodeId:'work:victory',
  currentNodeId:'door:f1:703',
  destinationNodeId:'work:mona'
});
assert.equal(disconnected.available, false);
assert.match(disconnected.reason, /経路がありません/);

for (const workNode of graph.nodes.filter(node => node.type === 'artwork')) {
  assert.ok(index.nodes.has(workNode.exitNodeId), `${workNode.id} needs a mapped room exit`);
}

for (const route of routes) {
  for (let position = 0; position < route.ids.length - 1; position += 1) {
    const from = index.nodes.get(`work:${route.ids[position]}`);
    const to = `work:${route.ids[position + 1]}`;
    assert.ok(from, `${route.ids[position]} needs a graph node`);
    assert.ok(shortestPath(index, from.exitNodeId, to), `${route.ids[position]} to ${route.ids[position + 1]} needs a connected route`);
  }
}

console.log('navigation graph and Dijkstra: passed');
