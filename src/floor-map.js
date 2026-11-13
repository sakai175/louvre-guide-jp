import {FLOOR_MAP_VIEWBOX, floorPlans} from './floor-map-data.js';

const BASE_VIEW = Object.freeze({...FLOOR_MAP_VIEWBOX});
const MIN_VIEW_WIDTH = 360;
const floorName = floor => ({2:'2階', 1:'1階', 0:'0階', '-1':'−1階', '-2':'−2階'}[floor] ?? `${floor}階`);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

function roomCenter(room) {
  return {x:room.labelX ?? room.x + room.width / 2, y:room.labelY ?? room.y + room.height / 2};
}

function roomShapeMarkup(room) {
  if (room.points) return `<polygon points="${room.points.map(point => point.join(',')).join(' ')}"/>`;
  return `<rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.height}"/>`;
}

function roomMarkup(room, worksByRoom, selectedId) {
  const roomWorks = worksByRoom.get(room.number) || [];
  const selected = roomWorks.some(work => work.id === selectedId);
  return `<g class="room-node ${selected ? 'is-selected ' : ''}wing-${escapeHtml(room.wing)}" data-room="${escapeHtml(room.number)}" data-room-part="${escapeHtml(room.part ?? 'main')}">${roomShapeMarkup(room)}</g>`;
}

function roomLabelMarkup(room) {
  const {x, y} = roomCenter(room);
  const fontSize = room.width < 38 ? 8 : room.width < 45 ? 9 : 10;
  return `<text class="room-number" x="${x}" y="${y + fontSize * .34}" style="font-size:${fontSize}px">${escapeHtml(room.number)}</text>`;
}

function artworkMarkup(room, worksByRoom, selectedId) {
  const center = roomCenter(room);
  return (worksByRoom.get(room.number) || []).map((work, index) => {
    const x = center.x + (index - .5) * 10;
    const y = center.y;
    const destination = work.id === selectedId;
    return `<g class="artwork-marker ${destination ? 'is-selected is-destination' : ''}" data-map-work="${escapeHtml(work.id)}" tabindex="0" role="button" aria-label="${destination ? '次の作品、' : ''}${escapeHtml(work.title)}、${escapeHtml(work.room)}室">${destination ? `<circle class="destination-ring" cx="${x}" cy="${y}" r="12"/>` : ''}<circle cx="${x}" cy="${y}" r="6"/><path d="M${x-2.5} ${y}h5M${x} ${y-2.5}v5"/></g>`;
  }).join('');
}

function facilityIconMarkup(item) {
  const label = item.label ? `<text class="facility-label" x="${item.x + 10}" y="${item.y - 9}">${escapeHtml(item.label)}</text>` : '';
  const common = `transform="translate(${item.x} ${item.y})"`;
  const icons = {
    stairs:`<path d="M-8 7h4V3h4v-4h4v-4h4"/>`,
    elevator:`<rect x="-7" y="-8" width="14" height="16" rx="1"/><path d="M0-5v10M-3-2l3-3 3 3M-3 2l3 3 3-3"/>`,
    escalator:`<path d="M-8 6h4l8-12h4M-7-6h4l8 12h3"/>`,
    wc:`<path d="M-5-7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-3 15V-1h6v9M5-7a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM2 8l1-9h4l1 9"/>`,
    information:`<circle r="8"/><path d="M0-3v7M0-6h.01"/>`,
    ticket:`<path d="M-8-5h16v10H-8zM-3-5v10"/>`,
    cloak:`<path d="M-7 7V-5h14V7M-3-5v-3h6v3"/>`,
    friends:`<path d="M-5-6a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM-10 8c0-5 10-5 10 0M5-4a2.5 2.5 0 1 0 0 5M1 8c0-4 8-4 8 0"/>`,
    auditorium:`<path d="M-8 7h16M-6 4h12M-4 1h8M-2-2h4"/>`,
    group:`<path d="M-5-5a2 2 0 1 0 0 4M5-5a2 2 0 1 0 0 4M0-7a2.5 2.5 0 1 0 0 5M-9 7c0-4 7-4 7 0M2 7c0-4 7-4 7 0M-5 7c0-5 10-5 10 0"/>`,
    shop:`<path d="M-8-3h16l-2-5H-6zM-6-3V8H6V-3M-2 8V2h4v6"/>`,
    metro:`<circle r="8"/><text x="0" y="4" text-anchor="middle">M</text>`,
    exit:`<path d="M-8-7h9V7h-9M-3 0h11M4-4l4 4-4 4"/>`,
    studio:`<circle r="8"/><text x="0" y="3" text-anchor="middle">S</text>`,
    closed:`<path class="closed-hatch" d="M-8-8 8 8M-2-8 8 2M-8-2 2 8"/>`
  };
  return `<g class="facility facility-${escapeHtml(item.type)}" ${common} aria-label="${escapeHtml(item.label || item.type)}">${icons[item.type] || '<circle r="5"/>'}</g>${label}`;
}

function connectionMarkup(item, rooms) {
  const classes = `map-connection wing-${escapeHtml(item.wing)} type-${escapeHtml(item.type)}`;
  if (item.points) return `<polyline class="${classes}" points="${item.points.map(point => point.join(',')).join(' ')}" data-from="${escapeHtml(item.from)}" data-to="${escapeHtml(item.to)}"/>`;
  const fromRoom = rooms.find(room => room.number === item.from);
  const toRoom = rooms.find(room => room.number === item.to);
  if (!fromRoom || !toRoom) return '';
  const from = roomCenter(fromRoom);
  const to = roomCenter(toRoom);
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  let x1;
  let y1;
  let x2;
  let y2;
  if (horizontal) {
    const direction = Math.sign(to.x - from.x) || 1;
    const openingX = ((direction > 0 ? fromRoom.x + fromRoom.width : fromRoom.x) + (direction > 0 ? toRoom.x : toRoom.x + toRoom.width)) / 2;
    const openingY = (from.y + to.y) / 2;
    x1 = openingX - direction * 6;
    y1 = openingY;
    x2 = openingX + direction * 6;
    y2 = openingY;
  } else {
    const direction = Math.sign(to.y - from.y) || 1;
    const openingY = ((direction > 0 ? fromRoom.y + fromRoom.height : fromRoom.y) + (direction > 0 ? toRoom.y : toRoom.y + toRoom.height)) / 2;
    const openingX = (from.x + to.x) / 2;
    x1 = openingX;
    y1 = openingY - direction * 6;
    x2 = openingX;
    y2 = openingY + direction * 6;
  }
  return `<line class="${classes}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" data-from="${escapeHtml(item.from)}" data-to="${escapeHtml(item.to)}"/>`;
}

const polylineMarkup = (segments, floor, className) => segments.filter(segment => segment.floor === floor).map(segment => `<polyline class="${className}" points="${segment.points.map(point => point.join(',')).join(' ')}"/>`).join('');

function routeLayerMarkup(floor, navigation) {
  if (!navigation) return '';
  const passed = polylineMarkup(navigation.passedSegments ?? [], floor, 'route-passed');
  const remaining = polylineMarkup(navigation.remainingSegments ?? [], floor, 'route-active');
  const currentLabel = ['audio','manual'].includes(navigation.locationMethod) ? '推定現在地' : '最後に確認した地点';
  const current = navigation.currentNode?.floor === floor ? `<g class="current-location" transform="translate(${navigation.currentNode.x} ${navigation.currentNode.y})"><circle class="current-halo" r="17"/><circle class="current-dot" r="8"/><rect x="-70" y="-43" width="140" height="24" rx="7"/><text x="0" y="-27" text-anchor="middle">${currentLabel}</text></g>` : '';
  const destination = navigation.destinationNode?.floor === floor ? `<g class="route-destination" transform="translate(${navigation.destinationNode.x} ${navigation.destinationNode.y})"><circle class="destination-halo" r="18"/><circle class="destination-dot" r="9"/><rect x="-48" y="24" width="96" height="24" rx="7"/><text x="0" y="40" text-anchor="middle">次の作品</text></g>` : '';
  const transitions = (navigation.transitions ?? []).flatMap(transition => {
    if (transition.from.floor !== floor && transition.to.floor !== floor) return [];
    const leaving = transition.from.floor === floor;
    const node = leaving ? transition.from : transition.to;
    const direction = transition.to.floor > transition.from.floor ? '↑' : '↓';
    const label = leaving ? transition.message : `${escapeHtml(transition.facilityName)}から到着・経路続行`;
    return [`<g class="floor-transition ${leaving ? 'is-leaving' : 'is-arriving'}" transform="translate(${node.x} ${node.y})"><circle r="18"/><text class="transition-arrow" x="0" y="6" text-anchor="middle">${direction}</text><rect x="24" y="-20" width="250" height="40" rx="8"/><text class="transition-label" x="36" y="5">${escapeHtml(label)}</text></g>`];
  }).join('');
  const passedTransitions = (navigation.passedTransitions ?? []).flatMap(transition => [transition.from, transition.to].filter(node => node.floor === floor).map(node => `<g class="passed-floor-transition" transform="translate(${node.x} ${node.y})"><circle r="11"/><path d="M-4 0h8"/></g>`)).join('');
  return `${passed}${passedTransitions}${remaining}${transitions}${current}${destination}`;
}

export function floorMapMarkup({floor, floorLabel, works, selectedId, navigation, roomNotices=[]}) {
  const plan = floorPlans[floor];
  if (!plan) throw new Error(`Unknown floor plan: ${floor}`);
  const worksByRoom = new Map();
  works.filter(work => work.floor === floor && work.locationPrecision === 'room').forEach(work => {
    if (!worksByRoom.has(String(work.room))) worksByRoom.set(String(work.room), []);
    worksByRoom.get(String(work.room)).push(work);
  });
  const wings = `<path class="building-outline" d="${plan.outline}"/>`;
  const wingLabels = plan.wings.map(wing => `<text class="wing-label" x="${wing.labelX}" y="${wing.labelY}">${escapeHtml(wing.label)}</text>${wing.range ? `<text class="wing-range" x="${wing.labelX}" y="${wing.labelY + 15}">${escapeHtml(wing.range)}</text>` : ''}`).join('');
  const corridors = plan.corridors.map(path => `<path d="${path}"/>`).join('');
  const rooms = plan.rooms.map(item => roomMarkup(item, worksByRoom, selectedId)).join('');
  const connections = (plan.connections ?? []).map(item => connectionMarkup(item, plan.rooms)).join('');
  const doors = plan.doors.map(item => `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}"/>`).join('');
  const facilities = plan.facilities.map(facilityIconMarkup).join('');
  const roomLabels = plan.rooms.map(roomLabelMarkup).join('');
  const mapLabels = plan.labels.map(label => `<text class="map-label" x="${label.x}" y="${label.y}" text-anchor="middle">${escapeHtml(label.text)}</text>`).join('');
  const artworks = plan.rooms.map(item => artworkMarkup(item, worksByRoom, selectedId)).join('');
  const alerts = roomNotices.filter(notice => notice.floor === floor).map(notice => {
    const mappedRoom = plan.rooms.find(item => item.number === String(notice.room));
    if (!mappedRoom) return '';
    return `<g class="room-alert" transform="translate(${mappedRoom.x + mappedRoom.width - 8} ${mappedRoom.y + 2})" aria-label="${escapeHtml(notice.label)}"><path d="M0 14L8 0l8 14Z"/><text x="8" y="11" text-anchor="middle">!</text></g>`;
  }).join('');
  const routeLayer = routeLayerMarkup(floor, navigation);
  const continuationFloors = (navigation?.routeFloors ?? []).filter(routeFloor => routeFloor !== floor);
  const continuation = continuationFloors.length ? `<span class="map-route-continuation">経路の続き：${continuationFloors.map(floorName).join('・')}</span>` : '';

  return `<div class="map-heading"><div><span class="map-floor-kicker">表示中の階</span><strong>${escapeHtml(floorLabel)}</strong><span>${escapeHtml(plan.subtitle)}</span>${continuation}</div><div class="map-legend" aria-label="地図の凡例"><span><i class="legend-room"></i>展示室</span><span><i class="legend-connection"></i>部屋間の接続</span><span><i class="legend-current"></i>確認地点</span><span><i class="legend-route"></i>進行経路</span></div></div><svg id="floor-map" viewBox="0 0 960 600" role="img" aria-labelledby="map-title map-description"><title id="map-title">${escapeHtml(floorLabel)}の2Dフロアマップ</title><desc id="map-description">公式館内マップを基準に、建物輪郭、全部屋番号、通路、部屋間の接続、扉、階段、エレベーター、エスカレーター、主要施設、作品位置を階別に表示。</desc><rect class="map-background" width="960" height="600"/><g class="map-layer layer-wings" data-layer="wings">${wings}</g><g class="map-layer layer-corridors" data-layer="corridors">${corridors}</g><g class="map-layer layer-rooms" data-layer="rooms">${rooms}</g><g class="map-layer layer-connections" data-layer="connections">${connections}</g><g class="map-layer layer-doors" data-layer="doors">${doors}</g><g class="map-layer layer-facilities" data-layer="facilities">${facilities}</g><g class="map-layer layer-artworks" data-layer="artworks">${artworks}</g><g class="map-layer layer-labels" data-layer="labels">${wingLabels}${mapLabels}${roomLabels}<text x="902" y="575" text-anchor="end">上側：リヴォリ通り</text></g><g class="map-layer layer-alerts" data-layer="alerts">${alerts}</g><g class="map-layer layer-route" data-layer="route" aria-label="最短経路">${routeLayer}</g></svg>`;
}

function clampView(view) {
  view.width = Math.min(BASE_VIEW.width, Math.max(MIN_VIEW_WIDTH, view.width));
  view.height = view.width * BASE_VIEW.height / BASE_VIEW.width;
  view.x = Math.min(BASE_VIEW.width - view.width, Math.max(0, view.x));
  view.y = Math.min(BASE_VIEW.height - view.height, Math.max(0, view.y));
}

export function wireFloorMap({onWorkSelect}) {
  const svg = document.querySelector('#floor-map');
  const frame = svg?.closest('.map-frame');
  if (!svg || !frame) return;
  const view = {...BASE_VIEW};
  const pointers = new Map();
  let lastDrag = null;
  let lastPinch = null;
  const status = frame.querySelector('[data-map-status]');
  const applyView = () => {
    clampView(view);
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    if (status) status.textContent = `${Math.round(BASE_VIEW.width / view.width * 100)}%`;
  };
  const zoomAt = (factor, clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const pointX = view.x + (clientX - rect.left) / rect.width * view.width;
    const pointY = view.y + (clientY - rect.top) / rect.height * view.height;
    const nextWidth = Math.min(BASE_VIEW.width, Math.max(MIN_VIEW_WIDTH, view.width * factor));
    const nextHeight = nextWidth * BASE_VIEW.height / BASE_VIEW.width;
    const ratio = nextWidth / view.width;
    view.x = pointX - (pointX - view.x) * ratio;
    view.y = pointY - (pointY - view.y) * ratio;
    view.width = nextWidth;
    view.height = nextHeight;
    applyView();
  };
  const reset = () => { Object.assign(view, BASE_VIEW); applyView(); };

  frame.querySelectorAll('[data-map-action]').forEach(button => button.addEventListener('click', () => {
    const rect = svg.getBoundingClientRect();
    if (button.dataset.mapAction === 'reset') reset();
    else zoomAt(button.dataset.mapAction === 'in' ? 0.8 : 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }));
  svg.addEventListener('wheel', event => {
    event.preventDefault();
    zoomAt(event.deltaY < 0 ? 0.88 : 1.14, event.clientX, event.clientY);
  }, {passive:false});
  svg.addEventListener('pointerdown', event => {
    svg.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {x:event.clientX, y:event.clientY});
    lastDrag = {x:event.clientX, y:event.clientY};
    svg.classList.add('is-dragging');
  });
  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, {x:event.clientX, y:event.clientY});
    const active = [...pointers.values()];
    if (active.length === 2) {
      const distance = Math.hypot(active[0].x - active[1].x, active[0].y - active[1].y);
      const midpoint = {x:(active[0].x + active[1].x) / 2, y:(active[0].y + active[1].y) / 2};
      if (lastPinch) zoomAt(lastPinch.distance / distance, midpoint.x, midpoint.y);
      lastPinch = {distance, midpoint};
      lastDrag = midpoint;
      return;
    }
    lastPinch = null;
    if (!lastDrag) return;
    const rect = svg.getBoundingClientRect();
    view.x -= (event.clientX - lastDrag.x) / rect.width * view.width;
    view.y -= (event.clientY - lastDrag.y) / rect.height * view.height;
    lastDrag = {x:event.clientX, y:event.clientY};
    applyView();
  });
  const endPointer = event => {
    pointers.delete(event.pointerId);
    lastPinch = null;
    lastDrag = pointers.size ? [...pointers.values()][0] : null;
    if (!pointers.size) svg.classList.remove('is-dragging');
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  document.querySelectorAll('[data-map-work]').forEach(marker => {
    const choose = () => onWorkSelect(marker.dataset.mapWork);
    marker.addEventListener('click', choose);
    marker.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
    });
  });
  applyView();
}
