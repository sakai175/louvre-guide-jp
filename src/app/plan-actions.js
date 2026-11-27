import {navigationStateForSelection, navigationStateFromRoute} from '../navigation.js';
import {advanceOnRouteAudio, destinationWorkId} from '../route-progress.js';
import {correctLocation, findRoomCandidates} from '../location-support.js';
import {buildTimedRouteWorks, moveMyPlanItem, optimizeRemainingWorks, optimizeWorkOrder, paceSummaryFor, removeMyPlanItem, timeCourseBounds, toggleMyPlan} from '../my-plan.js';
import {localizeRoute, localizeWork, t} from '../i18n.js';
import {savePendingSharedPlan} from './plan-share.js';
import {runWithRouteLoader} from './route-loader.js';

export function createPlanActions(ctx) {
  const tr = (key, params) => t(key, params, ctx.state.lang);
  const previewImagesFor = ids => {
    if (!ctx.appBase) return [];
    return [...new Set(ids)].map(id => ctx.artworkImages?.[id]?.src)
      .filter(Boolean).slice(0, 3).map(src => new URL(src, ctx.appBase).href);
  };

  function activeStartNodeId() {
    const cur = ctx.state.navigation?.currentNodeId;
    if (cur && ctx.navigationIndex.nodes.has(cur)) return cur;
    return 'entrance:pyramid:fm2';
  }

  function floorForCurrentLocation(fallback = -2) {
    const curId = ctx.state.navigation?.currentNodeId;
    const node = curId ? ctx.navigationIndex.nodes.get(curId) : null;
    if (Number.isFinite(node?.floor)) return node.floor;
    const entrance = ctx.navigationIndex.nodes.get('entrance:pyramid:fm2');
    if (Number.isFinite(entrance?.floor)) return entrance.floor;
    return fallback;
  }

  function autoOptimizeMyPlan({startNodeId = null} = {}) {
    if (ctx.state.myPlanIds.length < 2) {
      return {ids: ctx.state.myPlanIds, changed: false, savedPercent: 0};
    }
    const anchor = startNodeId || (ctx.state.planMode === 'myplan' ? activeStartNodeId() : 'entrance:pyramid:fm2');
    const result = optimizeRemainingWorks(ctx.navigationIndex, ctx.state.myPlanIds, ctx.state.viewed, {
      preferElevator: ctx.state.preferElevator,
      startNodeId: anchor
    });
    ctx.state.myPlanIds = result.ids;
    return result;
  }

  function autoOptimizeActiveRoute({startNodeId = null} = {}) {
    if (ctx.state.planMode === 'myplan') {
      return autoOptimizeMyPlan({startNodeId});
    }
    if (ctx.state.planMode === 'preset') {
      const edited = ctx.state.routeEdits?.[ctx.state.routeId];
      if (Array.isArray(edited) && edited.length >= 2) {
        const anchor = startNodeId || activeStartNodeId();
        const result = optimizeRemainingWorks(ctx.navigationIndex, edited, ctx.state.viewed, {
          preferElevator: ctx.state.preferElevator,
          startNodeId: anchor
        });
        ctx.state.routeEdits[ctx.state.routeId] = result.ids;
        return result;
      }
      if (Array.isArray(ctx.state.customTimedIds) && ctx.state.customTimedIds.length >= 2) {
        const anchor = startNodeId || activeStartNodeId();
        const result = optimizeRemainingWorks(ctx.navigationIndex, ctx.state.customTimedIds, ctx.state.viewed, {
          preferElevator: ctx.state.preferElevator,
          startNodeId: anchor
        });
        ctx.state.customTimedIds = result.ids;
        return result;
      }
    }
    return {ids: [], changed: false, savedPercent: 0};
  }

  function rebuildNavigationFromCurrent(ids, startNodeId = null) {
    if (!ids.length) {
      ctx.state.navigation = navigationStateFromRoute(ctx.navigationIndex, []);
      return;
    }
    const nextUnviewed = ids.find(id => !ctx.state.viewed.has(id)) ?? null;
    if (!nextUnviewed) {
      const lastId = ids.at(-1);
      ctx.state.navigation = {
        ...navigationStateFromRoute(ctx.navigationIndex, ids),
        currentNodeId: startNodeId || `work:${lastId}`,
        destinationNodeId: null,
        routeComplete: true
      };
      ctx.state.selected = lastId;
      return;
    }
    if (startNodeId && ctx.navigationIndex.nodes.has(startNodeId) && startNodeId !== 'entrance:pyramid:fm2') {
      const base = navigationStateForSelection(ctx.navigationIndex, ids, nextUnviewed, ctx.navOptions());
      ctx.state.navigation = {
        ...base,
        currentNodeId: startNodeId,
        destinationNodeId: `work:${nextUnviewed}`,
        routeComplete: false
      };
    } else {
      ctx.state.navigation = navigationStateForSelection(ctx.navigationIndex, ids, nextUnviewed, ctx.navOptions());
    }
    ctx.state.selected = nextUnviewed;
  }

  function setPreferElevator(prefer) {
    const next = Boolean(prefer);
    if (ctx.state.preferElevator === next) return;
    const apply = () => {
      ctx.state.preferElevator = next;
      const optResult = autoOptimizeActiveRoute();
      if (optResult.ids.length) {
        rebuildNavigationFromCurrent(ctx.routableIds(), activeStartNodeId());
      }
      ctx.persistState();
      const noticeKey = optResult.changed
        ? (ctx.state.preferElevator ? 'notice.evOnOptimized' : 'notice.evOffOptimized')
        : (ctx.state.preferElevator ? 'notice.evOn' : 'notice.evOff');
      ctx.setNotice(tr(noticeKey), false, 3400);
      ctx.render();
    };
    if (ctx.state.appPhase === 'main' && ctx.routableIds().length > 0) {
      runWithRouteLoader({
        title: tr('loader.simpleTitle'),
        durationMs: 1650,
        previewImages: previewImagesFor(ctx.routableIds())
      }, apply);
    } else {
      apply();
    }
  }

  function choosePresetCourse(routeIdOrMinutes, {goMap = true, animate = true} = {}) {
    const target = typeof routeIdOrMinutes === 'string'
      ? ctx.routes.find(item => item.id === routeIdOrMinutes)
      : ctx.routes.find(item => item.kind !== 'theme' && item.minutes === routeIdOrMinutes);
    const chosen = localizeRoute(target || ctx.routes[0], ctx.state.lang);
    const apply = () => {
      ctx.clearProgressNotice();
      ctx.state.planMode = 'preset';
      ctx.state.routeId = chosen.id;
      ctx.state.minutes = chosen.minutes;
      ctx.state.customTimedIds = null;
      ctx.state.customTimedMinutes = null;
      ctx.state.hasChosenCourse = true;
      const ids = ctx.routableIds();
      ctx.state.navigation = navigationStateFromRoute(ctx.navigationIndex, ids);
      ctx.state.selected = ids[0] ?? null;
      ctx.state.floor = floorForCurrentLocation(-2);
      ctx.state.appPhase = 'main';
      if (goMap) ctx.state.tab = 'map';
      ctx.persistState();
      ctx.render();
      window.scrollTo({top: 0});
    };
    if (!animate) {
      apply();
      return;
    }
    runWithRouteLoader({
      title: tr('loader.simpleTitle'),
      durationMs: 2250,
      previewImages: previewImagesFor(ctx.state.routeEdits?.[chosen.id] || chosen.ids)
    }, apply);
  }

  function chooseTimedCourse(minutes, count, {goMap = true, animate = true} = {}) {
    const bounds = timeCourseBounds(minutes, ctx.maxRoutableCount);
    const safeCount = Math.max(bounds.min, Math.min(bounds.max, Math.round(Number(count) || bounds.recommended)));
    const built = buildTimedRouteWorks(ctx.works, ctx.navigationIndex, {
      minutes: bounds.minutes,
      count: safeCount,
      preferElevator: ctx.state.preferElevator
    });
    const apply = () => {
      ctx.clearProgressNotice();
      ctx.state.planMode = 'preset';
      ctx.state.routeId = `preset-${built.minutes}`;
      ctx.state.minutes = built.minutes;
      ctx.state.customTimedIds = built.ids;
      ctx.state.customTimedMinutes = built.minutes;
      delete ctx.state.routeEdits[`preset-${built.minutes}`];
      delete ctx.state.optionalWorkIds[`preset-${built.minutes}`];
      ctx.state.draftMinutes = built.minutes;
      ctx.state.draftCount = built.count;
      ctx.state.hasChosenCourse = true;
      const ids = ctx.routableIds();
      ctx.state.navigation = navigationStateFromRoute(ctx.navigationIndex, ids);
      ctx.state.selected = ids[0] ?? null;
      ctx.state.floor = floorForCurrentLocation(-2);
      ctx.state.appPhase = 'main';
      if (goMap) ctx.state.tab = 'map';
      ctx.persistState();
      ctx.render();
      window.scrollTo({top: 0});
    };
    if (!animate) {
      apply();
      return;
    }
    runWithRouteLoader({
      title: tr('loader.simpleTitle'),
      durationMs: 2250,
      previewImages: previewImagesFor(built.ids)
    }, apply);
  }

  function chooseMyPlan({goMap = false, animate = true} = {}) {
    const alreadyMyPlan = ctx.state.planMode === 'myplan' && ctx.state.hasChosenCourse;
    const apply = () => {
      ctx.clearProgressNotice();
      ctx.state.planMode = 'myplan';
      ctx.state.hasChosenCourse = true;
      const ids = ctx.routableIds();
      if (!alreadyMyPlan) {
        rebuildNavigationFromCurrent(ids);
        ctx.state.floor = floorForCurrentLocation(-2);
      }
      ctx.state.appPhase = 'main';
      ctx.state.tab = goMap && ids.length ? 'map' : 'plan';
      ctx.persistState();
      ctx.render();
      window.scrollTo({top: 0});
    };
    if (!animate || alreadyMyPlan || !ctx.state.myPlanIds.length) {
      apply();
      return;
    }
    runWithRouteLoader({
      title: tr('loader.simpleTitle'),
      durationMs: 2050,
      previewImages: previewImagesFor(ctx.state.myPlanIds)
    }, apply);
  }

  function handleOptimizeMyPlan() {
    if (ctx.state.planMode !== 'myplan') return;
    const routableCount = ctx.routableIds().length;
    if (routableCount < 2) {
      ctx.setNotice(tr('notice.optNeedTwo'), false, 3400);
      ctx.render();
      return;
    }
    runWithRouteLoader({
      title: tr('loader.simpleTitle'),
      durationMs: 2150,
      previewImages: previewImagesFor(ctx.state.myPlanIds)
    }, () => {
      const anchor = activeStartNodeId();
      const result = autoOptimizeMyPlan({startNodeId: anchor});
      const nextRoutable = ctx.routableIds();
      rebuildNavigationFromCurrent(nextRoutable, anchor);
      ctx.state.floor = floorForCurrentLocation(-2);
      ctx.persistState();
      const message = result.changed
        ? (result.savedPercent > 0
          ? tr('notice.optSaved', {pct: result.savedPercent})
          : tr('notice.optGrouped'))
        : tr('notice.optAlready');
      ctx.setNotice(message, false, 4500);
      ctx.render();
    });
  }

  function addWorksToActivePlan(workIds) {
    const plan = ctx.currentPlan();
    if (plan.isShared) return false;
    const list = (Array.isArray(workIds) ? workIds : [workIds])
      .filter((id, idx, arr) => id && arr.indexOf(id) === idx && ctx.byId[id] && ctx.navigationIndex.nodes.has(`work:${id}`) && !plan.ids.includes(id));
    if (!list.length) return false;
    const anchor = activeStartNodeId();
    const result = optimizeRemainingWorks(ctx.navigationIndex, [...plan.ids, ...list], ctx.state.viewed, {
      preferElevator: ctx.state.preferElevator,
      startNodeId: anchor
    });
    if (plan.isCustom) ctx.state.myPlanIds = result.ids;
    else ctx.state.routeEdits[ctx.state.routeId] = result.ids;
    const addedSet = new Set(list);
    ctx.state.optionalWorkIds[plan.id] = (ctx.state.optionalWorkIds[plan.id] || []).filter(id => !addedSet.has(id));
    const routableIds = result.ids.filter(id => ctx.navigationIndex.nodes.has(`work:${id}`));
    rebuildNavigationFromCurrent(routableIds, anchor);
    ctx.state.undo = null;
    ctx.state.planAddOpen = false;
    ctx.state.planAddMode = null;
    ctx.state.planAddQuery = '';
    ctx.state.planAddSelected = [];
    ctx.persistState();
    ctx.setNotice(
      list.length === 1
        ? tr('notice.routeWorkAdded')
        : tr('notice.routeWorksBatchAdded', {count: list.length}),
      false,
      3400
    );
    ctx.render();
    return true;
  }

  function addWorkToActivePlan(workId) {
    return addWorksToActivePlan([workId]);
  }

  function addOptionalWorksToActivePlan(workIds) {
    const plan = ctx.currentPlan();
    if (plan.isShared) return false;
    const optionalIds = ctx.state.optionalWorkIds[plan.id] || [];
    const list = (Array.isArray(workIds) ? workIds : [workIds])
      .filter((id, idx, arr) => id && arr.indexOf(id) === idx && ctx.byId[id] && !plan.ids.includes(id) && !optionalIds.includes(id));
    if (!list.length) return false;
    ctx.state.optionalWorkIds[plan.id] = [...optionalIds, ...list];
    ctx.state.planAddOpen = false;
    ctx.state.planAddMode = null;
    ctx.state.planAddQuery = '';
    ctx.state.planAddSelected = [];
    ctx.persistState();
    ctx.setNotice(
      list.length === 1
        ? tr('notice.optionalWorkAdded')
        : tr('notice.optionalWorksBatchAdded', {count: list.length}),
      false,
      3400
    );
    ctx.render();
    return true;
  }

  function addOptionalWorkToActivePlan(workId) {
    return addOptionalWorksToActivePlan([workId]);
  }

  function removeOptionalWorkFromActivePlan(workId) {
    const plan = ctx.currentPlan();
    const optionalIds = ctx.state.optionalWorkIds[plan.id] || [];
    if (!optionalIds.includes(workId)) return false;
    ctx.state.optionalWorkIds[plan.id] = optionalIds.filter(id => id !== workId);
    ctx.persistState();
    ctx.render();
    return true;
  }

  function syncMyPlanNavigation({preserveCurrentDest = false} = {}) {
    if (ctx.state.planMode !== 'myplan') return;
    const ids = ctx.routableIds();
    const anchor = activeStartNodeId();
    if (preserveCurrentDest) {
      const currentDest = destinationWorkId(ctx.navigationIndex, ctx.state.navigation);
      if (ids.length && currentDest && ids.includes(currentDest) && !ctx.state.viewed.has(currentDest)) {
        ctx.state.navigation = navigationStateForSelection(ctx.navigationIndex, ids, currentDest, ctx.navOptions());
        return;
      }
    }
    rebuildNavigationFromCurrent(ids, anchor);
  }

  function selectRouteWork(workId, {focusFloor = false} = {}) {
    ctx.state.selected = workId;
    const ids = ctx.routableIds();
    if (ids.includes(workId)) {
      ctx.state.navigation = navigationStateForSelection(ctx.navigationIndex, ids, workId, ctx.navOptions());
    } else if (ctx.navigationIndex.nodes.has(`work:${workId}`)) {
      ctx.state.navigation = {
        ...(ctx.state.navigation || navigationStateFromRoute(ctx.navigationIndex, [workId])),
        destinationNodeId: `work:${workId}`,
        routeComplete: false
      };
    }
    if (focusFloor && ctx.byId[workId]?.floor != null) {
      ctx.state.floor = ctx.byId[workId].floor;
    }
    ctx.persistState();
  }

  function handleToggleMyPlan(workId) {
    const result = toggleMyPlan(ctx.state.myPlanIds, workId);
    ctx.state.myPlanIds = result.ids;
    if (result.added) {
      ctx.state.optionalWorkIds.myplan = (ctx.state.optionalWorkIds.myplan || []).filter(id => id !== workId);
    }
    const opt = autoOptimizeMyPlan();
    syncMyPlanNavigation();
    ctx.persistState();
    const title = localizeWork(ctx.byId[workId], ctx.state.lang)?.title ?? tr('notice.workFallback');
    const addedIsRoutable = ctx.navigationIndex.nodes.has(`work:${workId}`);
    const routableCount = ctx.state.myPlanIds.filter(id => ctx.navigationIndex.nodes.has(`work:${id}`)).length;
    const msg = result.added
      ? (addedIsRoutable && routableCount >= 2
        ? tr('notice.myPlanAddedOpt', {title, count: ctx.state.myPlanIds.length})
        : tr('notice.myPlanAdded', {title}))
      : (opt.changed
        ? tr('notice.myPlanRemovedOpt', {title})
        : tr('notice.myPlanRemoved', {title}));
    const action = result.added && !(ctx.state.tab === 'plan' && ctx.state.planMode === 'myplan')
      ? {id: 'open-myplan', label: tr('notice.openMyPlanAction')}
      : null;
    ctx.setNotice(msg, false, 3800, action);
    ctx.render();
  }

  function handleMoveMyPlan(workId, delta) {
    ctx.state.myPlanIds = moveMyPlanItem(ctx.state.myPlanIds, workId, delta);
    syncMyPlanNavigation({preserveCurrentDest: true});
    ctx.persistState();
    ctx.render();
  }

  function handleRemoveMyPlan(workId) {
    ctx.state.myPlanIds = removeMyPlanItem(ctx.state.myPlanIds, workId);
    autoOptimizeMyPlan();
    syncMyPlanNavigation();
    ctx.persistState();
    ctx.render();
  }

  function toggleViewed(workId) {
    const wasViewed = ctx.state.viewed.has(workId);
    const title = localizeWork(ctx.byId[workId], ctx.state.lang)?.title ?? tr('notice.workFallback');
    const rIds = ctx.routableIds();

    if (wasViewed) {
      ctx.state.viewed.delete(workId);
      if (ctx.state.navigation?.routeComplete && rIds.includes(workId)) {
        ctx.state.navigation = navigationStateForSelection(ctx.navigationIndex, rIds, workId, ctx.navOptions());
        ctx.state.selected = workId;
      }
      ctx.persistState();
      ctx.setNotice(tr('notice.viewedRemoved', {title}), false, 2800);
      ctx.render();
      return;
    }

    ctx.state.undo = {
      planMode: ctx.state.planMode,
      routeId: ctx.state.routeId,
      minutes: ctx.state.minutes,
      navigation: ctx.state.navigation,
      selected: ctx.state.selected,
      floor: ctx.state.floor,
      viewedWorkId: workId
    };
    ctx.state.viewed.add(workId);

    const workIdx = rIds.indexOf(workId);
    if (workIdx >= 0) {
      const nextAfter = rIds.slice(workIdx + 1).find(id => !ctx.state.viewed.has(id));
      const nextBefore = rIds.slice(0, workIdx).find(id => !ctx.state.viewed.has(id));
      const nextId = nextAfter || nextBefore || null;
      if (nextId) {
        const base = navigationStateForSelection(ctx.navigationIndex, rIds, nextId, ctx.navOptions());
        ctx.state.navigation = {
          ...base,
          currentNodeId: `work:${workId}`,
          destinationNodeId: `work:${nextId}`,
          routeComplete: false
        };
        ctx.state.selected = nextId;
        const nextTitle = localizeWork(ctx.byId[nextId], ctx.state.lang)?.title ?? tr('notice.workFallback');
        ctx.persistState();
        ctx.setNotice(tr('notice.viewedAdvanced', {title, next: nextTitle}), true, 5200);
        ctx.render();
        return;
      }
      ctx.state.navigation = {
        ...(ctx.state.navigation || navigationStateFromRoute(ctx.navigationIndex, rIds)),
        currentNodeId: `work:${workId}`,
        destinationNodeId: null,
        routeComplete: true
      };
      ctx.state.selected = workId;
      ctx.persistState();
      ctx.setNotice(tr('notice.viewedComplete', {title}), true, 5800);
      ctx.render();
      return;
    }

    ctx.persistState();
    ctx.setNotice(tr('notice.viewedMarked', {title}), true, 4200);
    ctx.render();
  }

  function handleRouteArrival(workId, eventId) {
    if (ctx.state.processedArrivalEvents.has(eventId)) return false;
    ctx.state.processedArrivalEvents.add(eventId);
    const ids = ctx.routableIds();
    const result = advanceOnRouteAudio(ctx.navigationIndex, ctx.state.navigation, ids, workId, ctx.navOptions());
    if (!result.updated) return false;
    ctx.state.undo = {planMode: ctx.state.planMode, routeId: ctx.state.routeId, minutes: ctx.state.minutes, navigation: result.previous, selected: ctx.state.selected, floor: ctx.state.floor};
    ctx.state.navigation = result.navigation;
    ctx.state.selected = result.nextWorkId ?? workId;
    ctx.state.viewed.add(workId);
    ctx.persistState();
    const roomText = ctx.byId[workId]?.room
      ? tr('location.room', {room: ctx.byId[workId].room})
      : (localizeWork(ctx.byId[workId], ctx.state.lang)?.title ?? tr('notice.currentLocFallback'));
    ctx.setNotice(tr('notice.arrivalUpdated', {room: roomText}), true, 6500);
    ctx.render();
    return true;
  }

  function undoArrival() {
    if (!ctx.state.undo) return;
    const snapshot = ctx.state.undo;
    ctx.state.planMode = snapshot.planMode;
    ctx.state.routeId = snapshot.routeId ?? ctx.state.routeId;
    ctx.state.minutes = snapshot.minutes;
    ctx.state.navigation = snapshot.navigation;
    ctx.state.selected = snapshot.selected;
    if (Number.isFinite(snapshot.floor)) ctx.state.floor = snapshot.floor;
    if (snapshot.viewedWorkId) ctx.state.viewed.delete(snapshot.viewedWorkId);
    ctx.state.undo = null;
    ctx.persistState();
    ctx.setNotice(tr('notice.arrivalUndone'), false, 3200);
    ctx.render();
  }

  function lookupRoom(room) {
    ctx.state.support.room = room;
    ctx.state.support.candidates = findRoomCandidates(ctx.navigationIndex, ctx.works, room, ctx.state.lang);
    ctx.state.support.selectedCandidateId = ctx.state.support.candidates.length === 1 ? ctx.state.support.candidates[0].nodeId : null;
    ctx.state.support.error = ctx.state.support.candidates.length ? '' : tr('map.errCheckRoom');
    ctx.state.support.open = true;
    ctx.state.support.editing = true;
    ctx.render();
  }

  function confirmLocationCorrection() {
    const candidateId = ctx.state.support.selectedCandidateId;
    if (!candidateId) {
      ctx.state.support.error = ctx.state.support.candidates.length > 1 ? tr('map.errSelectCandidate') : tr('map.errCheckRoom');
      ctx.render();
      return;
    }
    const result = correctLocation(ctx.navigationIndex, ctx.state.navigation, candidateId, ctx.navOptions());
    if (!result.updated) {
      ctx.state.support.error = result.message;
      ctx.render();
      return;
    }
    const candidate = ctx.state.support.candidates.find(item => item.nodeId === candidateId);
    ctx.clearProgressNotice();
    const optResult = autoOptimizeActiveRoute({startNodeId: candidateId});
    if (optResult.ids.length) {
      rebuildNavigationFromCurrent(ctx.routableIds(), candidateId);
    } else {
      ctx.state.navigation = result.navigation;
    }
    ctx.state.support = {open: false, editing: false, room: '', candidates: [], selectedCandidateId: null, error: ''};
    ctx.persistState();
    const roomLabel = candidate?.label ?? tr('notice.enteredRoomFallback');
    ctx.setNotice(
      tr(optResult.changed ? 'notice.arrivalOptimized' : 'notice.arrivalUpdated', {room: roomLabel}),
      false,
      4500
    );
    ctx.render();
  }

  function captureReturnSnapshot() {
    if (ctx.state.planMode === 'shared') return;
    ctx.state.returnPlanSnapshot = {
      planMode: ctx.state.planMode,
      routeId: ctx.state.routeId,
      minutes: ctx.state.minutes,
      customTimedIds: ctx.state.customTimedIds ? [...ctx.state.customTimedIds] : null,
      customTimedMinutes: ctx.state.customTimedMinutes,
      selected: ctx.state.selected,
      floor: ctx.state.floor
    };
  }

  function activateSharedPlan(shared) {
    if (!shared || !Array.isArray(shared.ids) || !shared.ids.length) return;
    const validIds = shared.ids.filter(id => ctx.byId[id]);
    if (!validIds.length) return;
    ctx.clearProgressNotice();
    captureReturnSnapshot();
    ctx.state.sharedPlan = {title: shared.title || '', ids: validIds};
    ctx.state.planMode = 'shared';
    ctx.state.hasChosenCourse = true;
    ctx.state.incomingSharedPlan = null;
    savePendingSharedPlan(null);
    const ids = ctx.routableIds();
    ctx.state.navigation = navigationStateFromRoute(ctx.navigationIndex, ids);
    ctx.state.selected = validIds[0] ?? null;
    ctx.state.floor = floorForCurrentLocation(-2);
    ctx.state.appPhase = 'main';
    ctx.state.tab = ids.length ? 'map' : 'plan';
    ctx.persistState();
    const label = ctx.state.sharedPlan.title || tr('share.defaultPlanTitle');
    ctx.setNotice(tr('share.openedNotice', {title: label}), false, 3600);
    ctx.render();
    window.scrollTo({top: 0});
  }

  function chooseSharedPlan({goMap = false} = {}) {
    if (!ctx.state.sharedPlan?.ids?.length) return;
    ctx.clearProgressNotice();
    captureReturnSnapshot();
    ctx.state.planMode = 'shared';
    ctx.state.hasChosenCourse = true;
    const ids = ctx.routableIds();
    ctx.state.navigation = navigationStateFromRoute(ctx.navigationIndex, ids);
    ctx.state.selected = ctx.state.sharedPlan.ids[0] ?? null;
    ctx.state.floor = floorForCurrentLocation(-2);
    ctx.state.appPhase = 'main';
    if (goMap && ids.length) ctx.state.tab = 'map';
    ctx.persistState();
    ctx.render();
    window.scrollTo({top: 0});
  }

  function returnToOwnPlan() {
    ctx.clearProgressNotice();
    const snap = ctx.state.returnPlanSnapshot;
    if (snap && (snap.planMode === 'myplan' || snap.planMode === 'preset')) {
      ctx.state.planMode = snap.planMode;
      if (snap.routeId) ctx.state.routeId = snap.routeId;
      if (snap.minutes) ctx.state.minutes = snap.minutes;
      ctx.state.customTimedIds = Array.isArray(snap.customTimedIds) && snap.customTimedIds.length ? [...snap.customTimedIds] : null;
      ctx.state.customTimedMinutes = ctx.state.customTimedIds ? (snap.customTimedMinutes || snap.minutes) : null;
    } else {
      ctx.state.planMode = ctx.state.myPlanIds.length ? 'myplan' : 'preset';
    }
    const ids = ctx.routableIds();
    ctx.state.navigation = navigationStateFromRoute(ctx.navigationIndex, ids);
    ctx.state.selected = (snap?.selected && ctx.byId[snap.selected]) ? snap.selected : (ids[0] ?? null);
    if (Number.isFinite(snap?.floor)) {
      ctx.state.floor = snap.floor;
    } else {
      ctx.state.floor = floorForCurrentLocation(-2);
    }
    ctx.persistState();
    ctx.setNotice(tr('share.returnedOwnNotice', {label: ctx.currentPlan().label}), false, 3200);
    ctx.render();
    window.scrollTo({top: 0});
  }

  function copySharedToMyPlan(shared) {
    const source = shared || ctx.state.sharedPlan;
    if (!source?.ids?.length) return;
    const validIds = source.ids.filter(id => ctx.byId[id]);
    const merged = [...new Set([...ctx.state.myPlanIds, ...validIds])];
    const addedCount = merged.length - ctx.state.myPlanIds.length;
    ctx.state.myPlanIds = merged;
    ctx.state.incomingSharedPlan = null;
    savePendingSharedPlan(null);
    syncMyPlanNavigation();
    ctx.persistState();
    ctx.setNotice(
      addedCount > 0
        ? tr('share.copiedToMyPlanNotice', {added: addedCount, total: merged.length})
        : tr('share.alreadyInMyPlanNotice'),
      false,
      3600
    );
    ctx.render();
  }

  return {
    setPreferElevator,
    choosePresetCourse,
    chooseTimedCourse,
    chooseMyPlan,
    activateSharedPlan,
    chooseSharedPlan,
    returnToOwnPlan,
    copySharedToMyPlan,
    handleOptimizeMyPlan,
    addWorkToActivePlan,
    addWorksToActivePlan,
    addOptionalWorkToActivePlan,
    addOptionalWorksToActivePlan,
    removeOptionalWorkFromActivePlan,
    syncMyPlanNavigation,
    selectRouteWork,
    handleToggleMyPlan,
    handleMoveMyPlan,
    handleRemoveMyPlan,
    toggleViewed,
    handleRouteArrival,
    undoArrival,
    lookupRoom,
    confirmLocationCorrection
  };
}
