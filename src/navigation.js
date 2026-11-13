const floorLabel = floor => ({2:'2階', 1:'1階', 0:'地上階', '-1':'地下1階'}[floor] ?? `${floor}階`);

export function indexNavigationGraph(graph) {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const adjacency = new Map(graph.nodes.map(node => [node.id, []]));
  graph.edges.forEach((edge, index) => {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error(`navigation edge ${index} has an unknown node`);
    if (!Number.isFinite(edge.cost) || edge.cost < 0) throw new Error(`navigation edge ${index} has an invalid cost`);
    const forward = {...edge, edgeIndex:index, reversed:false};
    const reverse = {...edge, from:edge.to, to:edge.from, edgeIndex:index, reversed:true};
    adjacency.get(forward.from).push(forward);
    adjacency.get(reverse.from).push(reverse);
  });
  return {nodes, adjacency, graph};
}

export function shortestPath(graphOrIndex, startId, goalId) {
  const index = graphOrIndex.nodes instanceof Map ? graphOrIndex : indexNavigationGraph(graphOrIndex);
  if (!index.nodes.has(startId) || !index.nodes.has(goalId)) return null;
  if (startId === goalId) return {nodeIds:[startId], edges:[], totalCost:0};

  const distance = new Map([...index.nodes.keys()].map(id => [id, Infinity]));
  const previous = new Map();
  const unvisited = new Set(index.nodes.keys());
  distance.set(startId, 0);

  while (unvisited.size) {
    let current = null;
    let best = Infinity;
    for (const id of unvisited) {
      if (distance.get(id) < best) { best = distance.get(id); current = id; }
    }
    if (current === null || best === Infinity) break;
    unvisited.delete(current);
    if (current === goalId) break;
    for (const edge of index.adjacency.get(current)) {
      if (edge.available === false || !unvisited.has(edge.to)) continue;
      const candidate = best + edge.cost;
      if (candidate < distance.get(edge.to)) {
        distance.set(edge.to, candidate);
        previous.set(edge.to, {nodeId:current, edge});
      }
    }
  }

  if (!previous.has(goalId)) return null;
  const nodeIds = [goalId];
  const edges = [];
  let cursor = goalId;
  while (cursor !== startId) {
    const step = previous.get(cursor);
    if (!step) return null;
    edges.unshift(step.edge);
    nodeIds.unshift(step.nodeId);
    cursor = step.nodeId;
  }
  return {nodeIds, edges, totalCost:distance.get(goalId)};
}

export function navigationStateFromRoute(graphOrIndex, workIds) {
  const index = graphOrIndex.nodes instanceof Map ? graphOrIndex : indexNavigationGraph(graphOrIndex);
  const workNodes = workIds.map(id => index.nodes.get(`work:${id}`)).filter(Boolean);
  const first = workNodes[0];
  const destination = workNodes[1] ?? first;
  if (!first || !destination) return {journeyStartNodeId:null, currentNodeId:null, destinationNodeId:null};
  return {
    journeyStartNodeId:first.id,
    currentNodeId:first.exitNodeId ?? first.id,
    destinationNodeId:destination.id,
    passedNodeIds:first.id === (first.exitNodeId ?? first.id) ? [first.id] : [first.id, first.exitNodeId],
    passedNodeGroups:[first.id === (first.exitNodeId ?? first.id) ? [first.id] : [first.id, first.exitNodeId]],
    lastConfirmedWorkId:first.workId,
    lastConfirmedMethod:'route-start',
    routeComplete:workNodes.length < 2
  };
}

function pathFromNodeIds(index, nodeIds) {
  if (!Array.isArray(nodeIds) || !nodeIds.length) return null;
  const edges = [];
  let totalCost = 0;
  for (let position = 0; position < nodeIds.length - 1; position += 1) {
    const edge = index.adjacency.get(nodeIds[position])?.find(candidate => candidate.to === nodeIds[position + 1] && candidate.available !== false);
    if (!edge) return null;
    edges.push(edge);
    totalCost += edge.cost;
  }
  return {nodeIds:[...nodeIds], edges, totalCost};
}

function floorSegments(index, nodeIds) {
  const segments = [];
  let current = null;
  nodeIds.forEach(id => {
    const node = index.nodes.get(id);
    if (!node) return;
    if (!current || current.floor !== node.floor) {
      if (current?.points.length > 1) segments.push(current);
      current = {floor:node.floor, points:[[node.x, node.y]], nodeIds:[id]};
    } else {
      current.points.push([node.x, node.y]);
      current.nodeIds.push(id);
    }
  });
  if (current?.points.length > 1) segments.push(current);
  return segments;
}

function transitionSteps(index, path) {
  if (!path) return [];
  const transitions = [];
  for (let edgeIndex = 0; edgeIndex < path.edges.length; edgeIndex += 1) {
    const edge = path.edges[edgeIndex];
    const from = index.nodes.get(path.nodeIds[edgeIndex]);
    let to = index.nodes.get(path.nodeIds[edgeIndex + 1]);
    if (!from || !to || from.floor === to.floor) continue;
    let finalEdgeIndex = edgeIndex;
    while (finalEdgeIndex + 1 < path.edges.length) {
      const nextEdge = path.edges[finalEdgeIndex + 1];
      const nextFrom = index.nodes.get(path.nodeIds[finalEdgeIndex + 1]);
      const nextTo = index.nodes.get(path.nodeIds[finalEdgeIndex + 2]);
      if (!nextFrom || !nextTo || nextFrom.floor === nextTo.floor || nextEdge.kind !== edge.kind || nextEdge.facilityId !== edge.facilityId) break;
      finalEdgeIndex += 1;
      to = nextTo;
    }
    const delta = to.floor - from.floor;
    const count = Math.abs(delta);
    const direction = delta > 0 ? '上' : '下';
    const facilityName = from.label || to.label || (edge.kind === 'elevator' ? 'エレベーター' : '階段');
    const message = `${facilityName}で${count}階${direction}へ（${floorLabel(to.floor)}）`;
    transitions.push({kind:edge.kind, facilityName, from, to, message});
    edgeIndex = finalEdgeIndex;
  }
  return transitions;
}

function nextAction(index, path, destination) {
  if (!path || path.nodeIds.length < 2) return destination ? `${destination.label}に到着しました` : '経路を確認できません';
  const current = index.nodes.get(path.nodeIds[0]);
  const next = index.nodes.get(path.nodeIds[1]);
  if (current.floor !== next.floor) {
    const transition = transitionSteps(index, path)[0];
    return transition?.message ?? `${floorLabel(next.floor)}へ移動します`;
  }
  const dx = next.x - current.x;
  const dy = next.y - current.y;
  const direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? '右' : '左') : (dy >= 0 ? '下方向' : '上方向');
  const room = destination?.room ? `${destination.room}室` : destination?.label;
  return `青い実線に沿って${direction}へ進み、${room}を目指してください`;
}

export function buildNavigationView(graphOrIndex, input) {
  const index = graphOrIndex.nodes instanceof Map ? graphOrIndex : indexNavigationGraph(graphOrIndex);
  const {journeyStartNodeId, currentNodeId, destinationNodeId} = input ?? {};
  const currentNode = index.nodes.get(currentNodeId) ?? null;
  const destinationNode = index.nodes.get(destinationNodeId) ?? null;
  const storedGroups = Array.isArray(input?.passedNodeGroups) ? input.passedNodeGroups : (Array.isArray(input?.passedNodeIds) ? [input.passedNodeIds] : []);
  const storedPassedPaths = storedGroups.map(group => pathFromNodeIds(index, group)).filter(Boolean);
  const fallbackPassedPath = !storedPassedPaths.length && journeyStartNodeId && currentNode ? shortestPath(index, journeyStartNodeId, currentNodeId) : null;
  const passedPaths = storedPassedPaths.length ? storedPassedPaths : (fallbackPassedPath ? [fallbackPassedPath] : []);
  const passedPath = passedPaths[0] ?? null;
  const passedSegments = passedPaths.flatMap(path => floorSegments(index, path.nodeIds));
  const passedTransitions = passedPaths.flatMap(path => transitionSteps(index, path));
  if (currentNode && input?.routeComplete) {
    const floors = new Set([currentNode.floor]);
    passedSegments.forEach(segment => floors.add(segment.floor));
    passedTransitions.forEach(transition => { floors.add(transition.from.floor); floors.add(transition.to.floor); });
    return {available:true, complete:true, currentNode, destinationNode:null, locationMethod:input?.lastConfirmedMethod, passedPath, passedSegments, passedTransitions, remainingSegments:[], transitions:[], routeFloors:[...floors], nextAction:'このルートは完了しました', totalCost:0};
  }
  if (!currentNode || !destinationNode) {
    return {available:false, reason:'現在地または目的地の接続データがありません', passedSegments:[], remainingSegments:[], transitions:[], routeFloors:[]};
  }

  const remainingPath = shortestPath(index, currentNodeId, destinationNodeId);
  if (!remainingPath) {
    return {available:false, reason:'この地点間を結ぶ確認済み経路がありません', currentNode, destinationNode, locationMethod:input?.lastConfirmedMethod, passedSegments, passedTransitions, remainingSegments:[], transitions:[], routeFloors:[currentNode.floor]};
  }

  const remainingSegments = floorSegments(index, remainingPath.nodeIds);
  const transitions = transitionSteps(index, remainingPath);
  const floors = new Set([currentNode.floor, destinationNode.floor]);
  passedSegments.forEach(segment => floors.add(segment.floor));
  passedTransitions.forEach(transition => { floors.add(transition.from.floor); floors.add(transition.to.floor); });
  remainingSegments.forEach(segment => floors.add(segment.floor));
  transitions.forEach(transition => { floors.add(transition.from.floor); floors.add(transition.to.floor); });
  return {
    available:true,
    currentNode,
    destinationNode,
    locationMethod:input?.lastConfirmedMethod,
    passedPath,
    remainingPath,
    passedSegments,
    passedTransitions,
    remainingSegments,
    transitions,
    routeFloors:[...floors],
    nextAction:nextAction(index, remainingPath, destinationNode),
    totalCost:remainingPath.totalCost
  };
}
