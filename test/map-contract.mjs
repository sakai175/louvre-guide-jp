import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {floorMapMarkup} from '../src/floor-map.js';
import {COMMON_BUILDING_OUTLINE, NON_RECTANGULAR_ROOM_NUMBERS, floorPlans, officialRoomNumbers} from '../src/floor-map-data.js';
import {buildNavigationView, indexNavigationGraph, navigationStateFromRoute} from '../src/navigation.js';
import {advanceOnRouteAudio} from '../src/route-progress.js';

const works = JSON.parse(await readFile(new URL('../src/works.json', import.meta.url), 'utf8'));
const navigationGraph = JSON.parse(await readFile(new URL('../src/navigation-graph.json', import.meta.url), 'utf8'));
const navigationIndex = indexNavigationGraph(navigationGraph);
const layers = ['wings', 'corridors', 'rooms', 'connections', 'doors', 'facilities', 'artworks', 'labels', 'alerts', 'route'];

for (const floor of [2, 1, 0, -1, -2]) {
  const markup = floorMapMarkup({floor, floorLabel:String(floor), works, selectedId:null});
  assert.match(markup, /viewBox="0 0 960 600"/, `floor ${floor} needs a stable viewBox`);
  assert.match(markup, /role="img"/, `floor ${floor} needs an image role`);
  for (const layer of layers) {
    assert.ok(markup.includes(`data-layer="${layer}"`), `floor ${floor} is missing ${layer} layer`);
  }
  for (const room of officialRoomNumbers[floor]) {
    assert.ok(markup.includes(`data-room="${room}"`), `floor ${floor} is missing official room ${room}`);
  }
  assert.doesNotMatch(markup, /route-arrow|marker-end|pin-number/, `floor ${floor} must not render a dummy route`);
  assert.doesNotMatch(markup, /概略|検証用/, `floor ${floor} must not retain legacy schematic copy`);
  assert.doesNotMatch(markup, /<path class="map-connection/, `floor ${floor} connections must use straight SVG lines only`);
}

const mapLegend = floorMapMarkup({floor:0, floorLabel:'0階', works, selectedId:null});
assert.match(mapLegend, /部屋間の接続/, 'the legend must distinguish room connections from the route');
assert.match(mapLegend, /map-connection wing-sully/, 'wing-coloured room connections must render');

assert.deepEqual([...new Set(Object.values(floorPlans).map(plan => plan.outline))], [COMMON_BUILDING_OUTLINE], 'every floor must use the identical building outline');
assert.doesNotMatch(COMMON_BUILDING_OUTLINE, /[AaCcQqSsTt]/, 'the shared building outline must contain straight segments only');
assert.deepEqual(NON_RECTANGULAR_ROOM_NUMBERS, ['135', '338', '536', '830'], 'only the four approved room numbers may use exception geometry');

for (const [floor, plan] of Object.entries(floorPlans)) {
  for (const mappedRoom of plan.rooms) {
    if (!NON_RECTANGULAR_ROOM_NUMBERS.includes(mappedRoom.number)) {
      assert.ok(!mappedRoom.points, `floor ${floor} room ${mappedRoom.number} must be rectangular`);
    }
  }
  for (const item of plan.connections) {
    assert.ok(!item.points || item.points.every(point => point.length === 2 && point.every(Number.isFinite)), `floor ${floor} connections must be composed of straight segments`);
  }
}

for (const floor of [2, 1, 0]) {
  const sullyRooms = floorPlans[floor].rooms.filter(room => room.wing === 'sully');
  const sullyConnections = floorPlans[floor].connections.filter(item => item.wing === 'sully');
  assert.ok(sullyConnections.length >= sullyRooms.length - 1, `floor ${floor} Sully connections must remain continuous`);
}

assert.equal(floorPlans[2].rooms.filter(room => room.wing === 'denon').length, 0, 'floor 2 Denon wing must remain empty');
assert.ok(floorPlans[2].wings.some(wing => wing.id === 'denon'), 'floor 2 must label the empty Denon wing inside the shared outline');

const floor2Rooms = Object.fromEntries(floorPlans[2].rooms.map(room => [room.number, room]));
assert.ok(floor2Rooms['900'].x < floor2Rooms['909'].x && floor2Rooms['900'].y > floor2Rooms['909'].y, 'floor 2 room 900 must remain at the Richelieu-side junction, outside the upper room row');
assert.deepEqual(['909','912','913','917'].map(number => floor2Rooms[number].y), [160,160,160,160], 'floor 2 upper Sully rooms must remain on the traced straight line');
assert.deepEqual(['936','944','952','940'].map(number => floor2Rooms[number].y), [240,240,240,240], 'floor 2 lower Sully rooms must remain on the traced straight line');
assert.ok(floorPlans[2].connections.some(item => item.from === '917' && item.to === '931'), 'floor 2 east bend must follow room 917 to room 931');
assert.ok(floorPlans[2].connections.some(item => item.from === '931' && item.to === '940'), 'floor 2 east bend must continue from room 931 to room 940');
assert.ok(floorPlans[0].connections.some(item => item.to === 'corridor:sully-west'), 'floor 0 Sully west closure must use its real corridor, not a direct room link');
assert.ok(!floorPlans[2].connections.some(item => item.from === '900' && ['909','912','913','917'].includes(item.to)), 'floor 2 room 900 must not be inserted into the outer upper room row');
assert.ok(!floorPlans[0].connections.some(item => item.from === '338' && item.to === '300'), 'floor 0 rooms separated by a corridor must not be linked directly');

const floor1Rooms = Object.fromEntries(floorPlans[1].rooms.map(room => [room.number, room]));
assert.deepEqual(['600','601','605','606','617','663'].map(number => floor1Rooms[number].y), [142,142,142,142,142,142], 'floor 1 upper Sully row must be straight');
assert.deepEqual(['663','661','660','656','652','651'].map(number => floor1Rooms[number].x), [859,859,859,859,859,859], 'floor 1 east Sully row must be straight');

const floor0Rooms = Object.fromEntries(floorPlans[0].rooms.map(room => [room.number, room]));
assert.deepEqual(['300','305','308','312','316','317'].map(number => floor0Rooms[number].y), [145,145,145,145,145,145], 'floor 0 upper Sully row must be straight');
assert.deepEqual(['317','321','323','328'].map(number => floor0Rooms[number].x), [862,862,862,862], 'floor 0 east Sully row must be straight');

const firstFloor = floorMapMarkup({floor:1, floorLabel:'1階', works, selectedId:'mona'});
assert.match(firstFloor, /data-map-work="mona"/, 'verified artwork room marker should render');
assert.match(firstFloor, /room-node is-selected/, 'selected artwork room should use a non-colour outline state');
const warningFloor = floorMapMarkup({floor:1, floorLabel:'1階', works, selectedId:null, roomNotices:[{floor:1,room:'711',label:'重要情報'}]});
assert.match(warningFloor, /class="room-alert"/, 'a room-specific warning can render without adding a global map overlay');

const navigation = buildNavigationView(navigationIndex, {journeyStartNodeId:'work:victory', currentNodeId:'door:f1:703', destinationNodeId:'work:venus'});
const routedFloor = floorMapMarkup({floor:1, floorLabel:'1階', works, selectedId:'venus', navigation});
const destinationFloor = floorMapMarkup({floor:0, floorLabel:'地上階', works, selectedId:'venus', navigation});
assert.match(routedFloor, /class="route-active"/, 'active route should render');
assert.match(routedFloor, /class="route-passed"/, 'passed route should render');
assert.match(routedFloor, /class="floor-transition is-leaving"/, 'floor transition should render');
assert.match(routedFloor, /最後に確認した地点/, 'explicit non-GPS location label should render');
assert.match(destinationFloor, /class="route-destination"/, 'next artwork should render above the route line on its floor');

const routeIds = ['victory','mona','liberty'];
const initialProgress = navigationStateFromRoute(navigationIndex, routeIds);
const arrivedProgress = advanceOnRouteAudio(navigationIndex, initialProgress, routeIds, 'mona').navigation;
const arrivedNavigation = buildNavigationView(navigationIndex, arrivedProgress);
const arrivedFloor = floorMapMarkup({floor:1, floorLabel:'1階', works, selectedId:'liberty', navigation:arrivedNavigation});
assert.match(arrivedFloor, /推定現在地/, 'audio arrival should change the location label');
assert.match(arrivedFloor, /class="route-passed"/, 'arrived leg should remain as a dotted route');
assert.match(arrivedFloor, /class="route-active"/, 'the newly calculated next leg should render');

console.log('floor map contract: passed');
