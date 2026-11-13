import {shortestPath} from './navigation.js';

const clone = value => JSON.parse(JSON.stringify(value));

export function destinationWorkId(index, navigation) {
  return index.nodes.get(navigation?.destinationNodeId)?.workId ?? null;
}

export function playbackModeFor(index, navigation, workId) {
  return !navigation?.routeComplete && destinationWorkId(index, navigation) === workId ? 'route' : 'standalone';
}

export function advanceOnRouteAudio(index, navigation, routeIds, workId) {
  if (playbackModeFor(index, navigation, workId) !== 'route') return {updated:false, reason:'not-next-work', navigation};
  const destinationNodeId = `work:${workId}`;
  const arrivalPath = shortestPath(index, navigation.currentNodeId, destinationNodeId);
  if (!arrivalPath) return {updated:false, reason:'route-unavailable', navigation};

  const previous = clone(navigation);
  const passedNodeGroups = clone(navigation.passedNodeGroups ?? [navigation.passedNodeIds ?? []]).filter(group => group.length);
  const lastGroup = passedNodeGroups.at(-1);
  if (lastGroup?.at(-1) === arrivalPath.nodeIds[0]) arrivalPath.nodeIds.slice(1).forEach(nodeId => lastGroup.push(nodeId));
  else passedNodeGroups.push([...arrivalPath.nodeIds]);
  const passedNodeIds = passedNodeGroups.flat();
  const routePosition = routeIds.indexOf(workId);
  const nextWorkId = routePosition >= 0 ? routeIds[routePosition + 1] : null;
  const nextNodeId = nextWorkId && index.nodes.has(`work:${nextWorkId}`) ? `work:${nextWorkId}` : null;
  return {
    updated:true,
    previous,
    arrivedNodeId:destinationNodeId,
    nextWorkId,
    navigation:{
      ...navigation,
      currentNodeId:destinationNodeId,
      destinationNodeId:nextNodeId,
      passedNodeIds,
      passedNodeGroups,
      lastConfirmedWorkId:workId,
      lastConfirmedMethod:'audio',
      routeComplete:!nextNodeId
    }
  };
}

export function validStoredProgress(index, routes, stored) {
  if (!stored || stored.version !== 1 || !Number.isFinite(stored.minutes) || !stored.navigation) return null;
  const activeRoute = routes.find(route => route.minutes === stored.minutes);
  if (!activeRoute || stored.routeSignature !== activeRoute.ids.join('|')) return null;
  const navigation = stored.navigation;
  if (!index.nodes.has(navigation.currentNodeId)) return null;
  if (!navigation.routeComplete && !index.nodes.has(navigation.destinationNodeId)) return null;
  if (!Array.isArray(navigation.passedNodeIds) || navigation.passedNodeIds.some(nodeId => !index.nodes.has(nodeId))) return null;
  if (navigation.passedNodeGroups && (!Array.isArray(navigation.passedNodeGroups) || navigation.passedNodeGroups.some(group => !Array.isArray(group) || group.some(nodeId => !index.nodes.has(nodeId))))) return null;
  return {minutes:stored.minutes, navigation:clone(navigation), selected:stored.selected ?? null, floor:stored.floor};
}
