import {shortestPath} from './navigation.js';
import {priorityTierFor} from './catalog.js';
import {getLang, localizeRoute, t} from './i18n.js';

const TIME_COURSE_BOUNDS = Object.freeze({
  90: {min: 3, recommended: 8, max: 14},
  120: {min: 3, recommended: 12, max: 20},
  150: {min: 3, recommended: 15, max: 26},
  180: {min: 3, recommended: 18, max: 32}
});

export function timeCourseBounds(minutes, maxRoutable = 100) {
  const m = Number(minutes) || 90;
  const preset = TIME_COURSE_BOUNDS[m];
  const min = preset ? preset.min : 3;
  const rawRec = preset ? preset.recommended : Math.max(min, Math.round(m / 10));
  const rawMax = preset ? preset.max : Math.max(rawRec + 4, Math.round(m / 5.8));
  const cap = Math.max(min, Number(maxRoutable) || rawMax);
  const max = Math.min(rawMax, cap);
  const recommended = Math.min(rawRec, max);
  return {minutes: m, min, recommended, max};
}

export function countPaceZones(bounds) {
  const easyMax = Math.min(bounds.max, Math.max(bounds.min, bounds.recommended - 2));
  const standardMax = Math.min(bounds.max, Math.max(easyMax, bounds.recommended + 1));
  return [
    {key: 'easy', min: bounds.min, max: easyMax},
    {key: 'standard', min: easyMax + 1, max: standardMax},
    {key: 'hard', min: standardMax + 1, max: bounds.max}
  ].filter(zone => zone.min <= zone.max);
}

export function paceSummaryFor(minutes, count, bounds = timeCourseBounds(minutes), lang = getLang()) {
  const safeCount = Math.max(bounds.min, Math.min(bounds.max, Math.round(Number(count) || bounds.recommended)));
  const perWork = Math.round((minutes / safeCount) * 10) / 10;
  if (safeCount <= Math.max(bounds.min, bounds.recommended - 2)) {
    return {key: 'relaxed', label: t('pace.relaxed.label', null, lang), perWorkMinutes: perWork, detail: t('pace.relaxed.detail', {perWork}, lang)};
  }
  if (safeCount <= bounds.recommended + 1) {
    return {key: 'recommended', label: t('pace.recommended.label', null, lang), perWorkMinutes: perWork, detail: t('pace.recommended.detail', {perWork}, lang)};
  }
  if (safeCount < bounds.max) {
    return {key: 'brisk', label: t('pace.brisk.label', null, lang), perWorkMinutes: perWork, detail: t('pace.brisk.detail', {perWork}, lang)};
  }
  return {key: 'limit', label: t('pace.limit.label', null, lang), perWorkMinutes: perWork, detail: t('pace.limit.detail', {perWork}, lang)};
}

export function buildTimedRouteWorks(works, navigationIndex, {minutes = 90, count, preferElevator = false} = {}) {
  const routablePool = (Array.isArray(works) ? works : [])
    .filter(w => w && w.locationPrecision === 'room' && navigationIndex?.nodes?.has(`work:${w.id}`))
    .sort((a, b) => {
      const rankDiff = priorityTierFor(a).rank - priorityTierFor(b).rank;
      if (rankDiff !== 0) return rankDiff;
      return (a.catalogRank ?? 9999) - (b.catalogRank ?? 9999);
    });
  const bounds = timeCourseBounds(minutes, routablePool.length);
  const clamped = Math.max(bounds.min, Math.min(bounds.max, Math.round(Number(count) || bounds.recommended)));
  const pickedIds = routablePool.slice(0, clamped).map(w => w.id);
  const optimized = optimizeWorkOrder(navigationIndex, pickedIds, {preferElevator});
  return {
    minutes: bounds.minutes,
    count: clamped,
    bounds,
    pace: paceSummaryFor(bounds.minutes, clamped, bounds),
    ids: optimized.ids
  };
}

export function toggleMyPlan(ids, workId) {
  const list = Array.isArray(ids) ? [...ids] : [];
  const index = list.indexOf(workId);
  if (index >= 0) {
    list.splice(index, 1);
    return {ids: list, added: false};
  }
  list.push(workId);
  return {ids: list, added: true};
}

export function moveMyPlanItem(ids, workId, delta) {
  const list = Array.isArray(ids) ? [...ids] : [];
  const index = list.indexOf(workId);
  if (index < 0) return list;
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item);
  return list;
}

export function removeMyPlanItem(ids, workId) {
  return (Array.isArray(ids) ? ids : []).filter(id => id !== workId);
}

export function routableWorkIds(navigationIndex, workIds) {
  if (!Array.isArray(workIds) || !navigationIndex?.nodes) return [];
  return workIds.filter(id => navigationIndex.nodes.has(`work:${id}`));
}

export function optimizeWorkOrder(navigationIndex, workIds, {preferElevator = false, startNodeId = 'entrance:pyramid:fm2'} = {}) {
  const input = Array.isArray(workIds) ? [...workIds] : [];
  if (input.length <= 1 || !navigationIndex?.nodes) {
    return {ids: input, changed: false, beforeCost: 0, afterCost: 0, savedPercent: 0};
  }
  const routable = [];
  const unmapped = [];
  for (const id of input) {
    if (navigationIndex.nodes.has(`work:${id}`)) routable.push(id);
    else unmapped.push(id);
  }
  if (routable.length <= 1) {
    return {ids: input, changed: false, beforeCost: 0, afterCost: 0, savedPercent: 0};
  }

  const distCache = new Map();
  const dist = (from, to) => {
    if (from === to) return 0;
    const key = `${from}=>${to}`;
    if (distCache.has(key)) return distCache.get(key);
    const path = shortestPath(navigationIndex, from, to, {preferElevator});
    const cost = path ? (path.weightedCost ?? path.totalCost) : 1e9;
    distCache.set(key, cost);
    return cost;
  };

  const hasStart = navigationIndex.nodes.has(startNodeId);
  const pathCostForIds = seq => {
    let total = 0;
    let prev = hasStart ? startNodeId : null;
    for (const id of seq) {
      const cur = `work:${id}`;
      if (prev) total += dist(prev, cur);
      prev = cur;
    }
    return total;
  };

  const beforeCost = pathCostForIds(routable);

  // Group works sharing the same room exit so co-located works stay together.
  const roomMap = new Map();
  for (const id of routable) {
    const node = navigationIndex.nodes.get(`work:${id}`);
    const groupKey = node?.exitNodeId || `work:${id}`;
    if (!roomMap.has(groupKey)) roomMap.set(groupKey, []);
    roomMap.get(groupKey).push(id);
  }
  const groups = [...roomMap.values()].map(ids => ({ids, rep: `work:${ids[0]}`}));
  const m = groups.length;

  let orderedGroups = groups;
  if (m > 1) {
    const startD = groups.map(g => (hasStart ? dist(startNodeId, g.rep) : 0));
    const D = Array.from({length: m}, (_, i) =>
      Array.from({length: m}, (_, j) => (i === j ? 0 : dist(groups[i].rep, groups[j].rep)))
    );

    if (m <= 14) {
      const N = 1 << m;
      const dp = new Float64Array(N * m).fill(1e18);
      const parent = new Int16Array(N * m).fill(-1);
      for (let i = 0; i < m; i += 1) dp[(1 << i) * m + i] = startD[i];
      for (let mask = 1; mask < N; mask += 1) {
        for (let u = 0; u < m; u += 1) {
          if (!(mask & (1 << u))) continue;
          const cur = dp[mask * m + u];
          if (cur >= 1e17) continue;
          for (let v = 0; v < m; v += 1) {
            if (mask & (1 << v)) continue;
            const nmask = mask | (1 << v);
            const cand = cur + D[u][v];
            if (cand < dp[nmask * m + v]) {
              dp[nmask * m + v] = cand;
              parent[nmask * m + v] = u;
            }
          }
        }
      }
      let bestLast = 0;
      let bestCost = 1e18;
      const full = N - 1;
      for (let i = 0; i < m; i += 1) {
        if (dp[full * m + i] < bestCost) {
          bestCost = dp[full * m + i];
          bestLast = i;
        }
      }
      const seq = [];
      let mask = full;
      let cur = bestLast;
      while (cur !== -1) {
        seq.push(cur);
        const prev = parent[mask * m + cur];
        mask ^= (1 << cur);
        cur = prev;
      }
      seq.reverse();
      orderedGroups = seq.map(i => groups[i]);
    } else {
      const seqCost = seq => {
        let total = startD[seq[0]];
        for (let i = 0; i < seq.length - 1; i += 1) total += D[seq[i]][seq[i + 1]];
        return total;
      };
      let bestSeq = null;
      let bestCost = 1e18;
      for (let first = 0; first < m; first += 1) {
        const rem = new Set(Array.from({length: m}, (_, i) => i));
        rem.delete(first);
        const seq = [first];
        let cur = first;
        while (rem.size) {
          let next = -1;
          let bestD = 1e18;
          for (const k of rem) {
            if (D[cur][k] < bestD) { bestD = D[cur][k]; next = k; }
          }
          seq.push(next);
          rem.delete(next);
          cur = next;
        }
        let improved = true;
        while (improved) {
          improved = false;
          for (let i = 0; i < seq.length - 1; i += 1) {
            for (let j = i + 1; j < seq.length; j += 1) {
              const cand = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)];
              if (seqCost(cand) + 1e-6 < seqCost(seq)) {
                seq.splice(0, seq.length, ...cand);
                improved = true;
              }
            }
          }
        }
        const cost = seqCost(seq);
        if (cost < bestCost) {
          bestCost = cost;
          bestSeq = seq;
        }
      }
      orderedGroups = bestSeq.map(i => groups[i]);
    }
  }

  const optimizedRoutable = orderedGroups.flatMap(g => g.ids);
  const afterCost = pathCostForIds(optimizedRoutable);
  const finalIds = [...optimizedRoutable, ...unmapped];
  const changed = finalIds.some((id, idx) => id !== input[idx]);
  const savedPercent = beforeCost > 0 && beforeCost < 1e9 && afterCost < beforeCost
    ? Math.max(1, Math.round((1 - afterCost / beforeCost) * 100))
    : 0;
  return {
    ids: finalIds,
    changed,
    beforeCost: Math.round(beforeCost),
    afterCost: Math.round(afterCost),
    savedPercent
  };
}

/**
 * 鑑賞済み作品の順序を保ったまま、未鑑賞（残りの）作品だけを
 * 現在地（または最後の鑑賞済み作品・ピラミッド入口）から最短一筆書きに自動最適化する。
 */
export function optimizeRemainingWorks(
  navigationIndex,
  workIds,
  viewedIds = null,
  {preferElevator = false, startNodeId = 'entrance:pyramid:fm2'} = {}
) {
  const input = Array.isArray(workIds) ? [...workIds] : [];
  if (input.length <= 1 || !navigationIndex?.nodes) {
    return {ids: input, changed: false, beforeCost: 0, afterCost: 0, savedPercent: 0};
  }
  const viewedSet = viewedIds instanceof Set
    ? viewedIds
    : new Set(Array.isArray(viewedIds) ? viewedIds : []);
  if (!viewedSet.size) {
    return optimizeWorkOrder(navigationIndex, input, {preferElevator, startNodeId});
  }
  const doneIds = [];
  const remainingIds = [];
  for (const id of input) {
    if (viewedSet.has(id)) doneIds.push(id);
    else remainingIds.push(id);
  }
  if (remainingIds.length <= 1) {
    const finalIds = [...doneIds, ...remainingIds];
    const changed = finalIds.some((id, idx) => id !== input[idx]);
    return {ids: finalIds, changed, beforeCost: 0, afterCost: 0, savedPercent: 0};
  }
  let anchorNode = startNodeId;
  if ((!anchorNode || anchorNode === 'entrance:pyramid:fm2') && doneIds.length) {
    for (let i = doneIds.length - 1; i >= 0; i -= 1) {
      const candidate = `work:${doneIds[i]}`;
      if (navigationIndex.nodes.has(candidate)) {
        anchorNode = candidate;
        break;
      }
    }
  }
  const opt = optimizeWorkOrder(navigationIndex, remainingIds, {preferElevator, startNodeId: anchorNode});
  const finalIds = [...doneIds, ...opt.ids];
  const changed = finalIds.some((id, idx) => id !== input[idx]);
  return {
    ids: finalIds,
    changed,
    beforeCost: opt.beforeCost,
    afterCost: opt.afterCost,
    savedPercent: opt.savedPercent
  };
}

export function formatMinutesLabel(minutes, lang = getLang()) {
  const rounded = Math.round(minutes * 2) / 2;
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return t('time.minutes', {value}, lang);
}

export function planStopEstimates(plan, navigationIndex, {preferElevator = false, lang = getLang()} = {}) {
  const ids = plan?.ids || [];
  if (!ids.length) return {};
  const perVisit = plan.ids.length ? (plan.visitMinutes / plan.ids.length) : 6;
  const rawMoves = [];
  let fromNode = navigationIndex?.nodes?.has('entrance:pyramid:fm2') ? 'entrance:pyramid:fm2' : null;
  for (const id of ids) {
    const nodeId = `work:${id}`;
    if (fromNode && navigationIndex?.nodes?.has(nodeId)) {
      const path = shortestPath(navigationIndex, fromNode, nodeId, {preferElevator});
      rawMoves.push(path ? Math.max(2, path.totalCost) : 12);
      fromNode = nodeId;
    } else {
      rawMoves.push(10);
    }
  }
  const sumRaw = rawMoves.reduce((a, b) => a + b, 0) || 1;
  const targetWalk = plan.walkMinutes || Math.max(8, ids.length * 4);
  const result = {};
  let cumulative = 0;
  ids.forEach((id, idx) => {
    const moveMin = (rawMoves[idx] / sumRaw) * targetWalk;
    const viewMin = perVisit;
    cumulative += moveMin + viewMin;
    const rounded = Math.round(cumulative * 2) / 2;
    result[id] = {
      order: idx + 1,
      moveMinutes: Math.round(moveMin * 2) / 2,
      viewMinutes: Math.round(viewMin * 2) / 2,
      elapsedMinutes: rounded,
      elapsedLabel: t('time.elapsed', {label: formatMinutesLabel(rounded, lang)}, lang)
    };
  });
  return result;
}

export function activePlanMeta({planMode, routeId, minutes, routes, myPlanIds, sharedPlan = null, navigationIndex, duration = 40, customTimedIds = null, customTimedMinutes = null, routeEdits = {}, lang = getLang()}) {
  if (planMode === 'shared' && Array.isArray(sharedPlan?.ids) && sharedPlan.ids.length) {
    const ids = sharedPlan.ids;
    const routableIds = routableWorkIds(navigationIndex, ids);
    const visitMinutes = ids.length * 6;
    const walkMinutes = routableIds.length ? Math.max(8, routableIds.length * 5) : 0;
    const audioMinutes = Math.ceil((ids.length * duration) / 60);
    const bufferMinutes = ids.length ? Math.min(15, Math.ceil(ids.length * 1.5)) : 0;
    return {
      mode: 'shared',
      id: 'shared',
      kind: 'shared',
      label: sharedPlan.title || t('share.defaultPlanTitle', null, lang),
      subtitle: t('share.activeSubtitle', null, lang),
      minutes: null,
      ids,
      routableIds,
      visitMinutes,
      walkMinutes,
      audioMinutes,
      bufferMinutes,
      estimatedMinutes: visitMinutes + walkMinutes + audioMinutes + bufferMinutes,
      isCustom: false,
      isShared: true
    };
  }
  if (planMode === 'myplan') {
    const ids = Array.isArray(myPlanIds) ? myPlanIds : [];
    const routableIds = routableWorkIds(navigationIndex, ids);
    const visitMinutes = ids.length * 6;
    const walkMinutes = routableIds.length ? Math.max(8, routableIds.length * 5) : 0;
    const audioMinutes = Math.ceil((ids.length * duration) / 60);
    const bufferMinutes = ids.length ? Math.min(15, Math.ceil(ids.length * 1.5)) : 0;
    return {
      mode: 'myplan',
      id: 'myplan',
      kind: 'custom',
      label: t('routes.myplan.label', null, lang),
      subtitle: t('routes.myplan.subtitle', null, lang),
      minutes: null,
      ids,
      routableIds,
      visitMinutes,
      walkMinutes,
      audioMinutes,
      bufferMinutes,
      estimatedMinutes: visitMinutes + walkMinutes + audioMinutes + bufferMinutes,
      isCustom: true
    };
  }
  const rawRoute = (routeId ? routes.find(item => item.id === routeId) : null)
    || routes.find(item => item.kind !== 'theme' && item.minutes === minutes)
    || routes.find(item => item.minutes === minutes)
    || routes[0];
  const route = rawRoute ? localizeRoute(rawRoute, lang) : null;
  const editedIds = Array.isArray(routeEdits?.[route?.id]) && routeEdits[route.id].length ? routeEdits[route.id] : null;
  const timedIds = editedIds || customTimedIds;
  if (route?.kind !== 'theme' && Array.isArray(timedIds) && timedIds.length) {
    const targetMinutes = Number(customTimedMinutes || minutes || route?.minutes || 90);
    const bounds = timeCourseBounds(targetMinutes, 120);
    const pace = paceSummaryFor(targetMinutes, timedIds.length, bounds, lang);
    const audioMinutes = Math.ceil((timedIds.length * duration) / 60);
    const bufferMinutes = Math.max(6, Math.round(targetMinutes * 0.08));
    const walkMinutes = Math.min(Math.round(targetMinutes * 0.34), Math.max(14, Math.round(timedIds.length * 2.4)));
    const addedCount = editedIds ? Math.max(0, editedIds.length - (customTimedIds?.length || route?.ids?.length || 0)) : 0;
    const visitMinutes = Math.max(timedIds.length * 2, targetMinutes - walkMinutes - audioMinutes - bufferMinutes) + addedCount * 8;
    return {
      mode: 'preset',
      id: `preset-${targetMinutes}`,
      kind: 'time',
      label: t('routes.customTimed.label', {minutes: targetMinutes, count: timedIds.length}, lang),
      subtitle: editedIds ? t('routes.edited.subtitle', null, lang) : t('routes.customTimed.subtitle', {pace: pace.label}, lang),
      minutes: targetMinutes,
      ids: timedIds,
      routableIds: routableWorkIds(navigationIndex, timedIds),
      visitMinutes,
      walkMinutes,
      audioMinutes,
      bufferMinutes,
      estimatedMinutes: visitMinutes + walkMinutes + audioMinutes + bufferMinutes,
      isCustom: false
    };
  }
  const ids = editedIds || route?.ids || [];
  const visitPerWork = route?.visit ?? 6;
  const visitMinutes = ids.length * visitPerWork;
  const extraWorks = Math.max(0, ids.length - (route?.ids?.length || 0));
  const walkMinutes = (route?.walk ?? 0) + extraWorks * 3;
  const audioMinutes = Math.ceil((ids.length * duration) / 60);
  const bufferMinutes = (route?.buffer ?? 0) + extraWorks * 2;
  return {
    mode: 'preset',
    id: route?.id ?? `preset-${route?.minutes ?? 90}`,
    kind: route?.kind ?? 'time',
    label: route?.label ?? t('routes.fallback.label', {minutes: route?.minutes ?? 90}, lang),
    subtitle: editedIds ? t('routes.edited.subtitle', null, lang) : (route?.subtitle ?? ''),
    minutes: route?.minutes ?? 90,
    ids,
    routableIds: routableWorkIds(navigationIndex, ids),
    visitMinutes,
    walkMinutes,
    audioMinutes,
    bufferMinutes,
    estimatedMinutes: visitMinutes + walkMinutes + audioMinutes + bufferMinutes,
    isCustom: false
  };
}
