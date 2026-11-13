import {shortestPath} from './navigation.js';

const clone = value => JSON.parse(JSON.stringify(value));
const floorName = floor => ({2:'2階', 1:'1階', 0:'地上階', '-1':'地下1階'}[floor] ?? `${floor}階`);
const wingName = wing => ({Richelieu:'リシュリュー', Sully:'シュリー', Denon:'ドゥノン'}[wing] ?? wing);

export function normalizeRoomNumber(value) {
  return String(value ?? '')
    .trim()
    .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
    .replace(/\s*室\s*$/, '');
}

export function findRoomCandidates(index, works, value) {
  const room = normalizeRoomNumber(value);
  if (!room) return [];
  return [...index.nodes.values()]
    .filter(node => node.type === 'room' && String(node.room) === room)
    .map(node => {
      const work = works.find(item => String(item.room) === room && item.floor === node.floor);
      const wing = wingName(node.wing ?? work?.wing ?? '翼情報なし');
      return {nodeId:node.id, room, floor:node.floor, floorLabel:floorName(node.floor), wing, label:`${wing}翼 · ${floorName(node.floor)} · ${room}室`};
    });
}

export function correctLocation(index, navigation, candidateNodeId) {
  const candidate = index.nodes.get(candidateNodeId);
  if (!candidate || candidate.type !== 'room') return {updated:false, reason:'invalid-room', message:'部屋番号を確認してください'};
  if (!navigation?.destinationNodeId || !index.nodes.has(navigation.destinationNodeId)) {
    return {updated:false, reason:'route-unavailable', message:'この地点から経路を作成できません。別の部屋番号を入力してください'};
  }
  const route = shortestPath(index, candidateNodeId, navigation.destinationNodeId);
  if (!route) return {updated:false, reason:'route-unavailable', message:'この地点から経路を作成できません。別の部屋番号を入力してください'};
  return {
    updated:true,
    route,
    previous:clone(navigation),
    navigation:{
      ...navigation,
      currentNodeId:candidateNodeId,
      passedNodeGroups:clone(navigation.passedNodeGroups ?? [navigation.passedNodeIds ?? []]).filter(group => group.length),
      routeComplete:false,
      lastConfirmedWorkId:null,
      lastConfirmedRoom:String(candidate.room),
      lastConfirmedMethod:'manual'
    }
  };
}
