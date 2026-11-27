import {DEFAULT_DURATIONS} from '../app-config.js';
import {buildNavigationView, navigationStateFromRoute} from '../navigation.js';
import {validStoredProgress} from '../route-progress.js';
import {audioLengthsFor} from '../catalog.js';
import {activePlanMeta, planStopEstimates, timeCourseBounds} from '../my-plan.js';
import {audioRelativePath, detectBrowserLang, normalizeLang, setLang} from '../i18n.js';

export const STORAGE_KEY = 'louvre-guide-state-v3';
export const SESSION_PROGRESS_KEY = 'louvre-route-progress-v2';

export function readPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const clampRate = value => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.round(Math.min(2, Math.max(0.5, num)) * 100) / 100;
};

export function createAppStore({
  works,
  routes,
  byId,
  worksByFloorRoom,
  navigationIndex,
  persistedBoot,
  skipSplashImmediate,
  appBase
}) {
  const initialLang = setLang(persistedBoot?.lang ? normalizeLang(persistedBoot.lang) : detectBrowserLang());
  const maxRoutableCount = works.filter(w => w.locationPrecision === 'room' && navigationIndex.nodes.has(`work:${w.id}`)).length;
  const initialMinutes = routes.some(r => r.kind !== 'theme' && r.minutes === persistedBoot?.minutes) ? persistedBoot.minutes : 90;
  const initialBounds = timeCourseBounds(initialMinutes, maxRoutableCount);
  const initialCustomTimedIds = Array.isArray(persistedBoot?.customTimedIds)
    ? persistedBoot.customTimedIds.filter(id => byId[id] && navigationIndex.nodes.has(`work:${id}`))
    : null;
  const routeEdits = Object.fromEntries(Object.entries(persistedBoot?.routeEdits || {})
    .filter(([routeId, ids]) => routes.some(route => route.id === routeId) && Array.isArray(ids))
    .map(([routeId, ids]) => [routeId, [...new Set(ids.filter(id => byId[id] && navigationIndex.nodes.has(`work:${id}`)))]]));
  const optionalWorkIds = Object.fromEntries(Object.entries(persistedBoot?.optionalWorkIds || {})
    .filter(([planId, ids]) => (planId === 'myplan' || routes.some(route => route.id === planId)) && Array.isArray(ids))
    .map(([planId, ids]) => [planId, [...new Set(ids.filter(id => byId[id]))]]));

  const initialSharedIds = Array.isArray(persistedBoot?.sharedPlan?.ids)
    ? persistedBoot.sharedPlan.ids.filter(id => byId[id])
    : [];
  const initialSharedPlan = initialSharedIds.length
    ? {title: String(persistedBoot.sharedPlan?.title || ''), ids: initialSharedIds}
    : null;
  const initialPlanMode = persistedBoot?.planMode === 'shared' && initialSharedPlan
    ? 'shared'
    : persistedBoot?.planMode === 'myplan'
      ? 'myplan'
      : 'preset';

  const state = {
    lang: initialLang,
    hasChosenLang: Boolean(persistedBoot?.hasChosenLang),
    hasCompletedAuthGate: Boolean(persistedBoot?.hasCompletedAuthGate),
    hasSeenOnboarding: Boolean(persistedBoot?.hasSeenOnboarding),
    appPhase: skipSplashImmediate ? 'select_language' : 'splash',
    hasChosenCourse: Boolean(persistedBoot?.hasChosenCourse),
    tab: ['map', 'plan', 'audio', 'settings'].includes(persistedBoot?.tab) ? persistedBoot.tab : 'map',
    planMode: initialPlanMode,
    routeId: routes.some(r => r.id === persistedBoot?.routeId)
      ? persistedBoot.routeId
      : (routes.find(r => r.kind !== 'theme' && r.minutes === persistedBoot?.minutes)?.id ?? routes[0]?.id ?? 'preset-90'),
    minutes: initialMinutes,
    customTimedIds: initialCustomTimedIds?.length ? initialCustomTimedIds : null,
    customTimedMinutes: initialCustomTimedIds?.length ? (Number(persistedBoot?.customTimedMinutes) || initialMinutes) : null,
    routeEdits,
    optionalWorkIds,
    draftMinutes: initialMinutes,
    draftCount: initialCustomTimedIds?.length
      ? Math.max(initialBounds.min, Math.min(initialBounds.max, initialCustomTimedIds.length))
      : initialBounds.recommended,
    preferElevator: Boolean(persistedBoot?.preferElevator),
    facilityFilter: 'none',
    autoPlayNext: Boolean(persistedBoot?.autoPlayNext),
    largeText: Boolean(persistedBoot?.largeText),
    offline: typeof navigator !== 'undefined' && navigator.onLine === false,
    myPlanIds: Array.isArray(persistedBoot?.myPlanIds) ? persistedBoot.myPlanIds.filter(id => byId[id]) : [],
    sharedPlan: initialSharedPlan,
    returnPlanSnapshot: persistedBoot?.returnPlanSnapshot || null,
    incomingSharedPlan: null,
    shareModal: {open: false, mode: 'export', titleDraft: '', importDraft: '', error: '', scanning: false},
    viewed: new Set(Array.isArray(persistedBoot?.viewed) ? persistedBoot.viewed.filter(id => byId[id]) : []),
    floor: Number.isFinite(persistedBoot?.floor) ? persistedBoot.floor : -2,
    selected: persistedBoot?.selected && byId[persistedBoot.selected] ? persistedBoot.selected : null,
    detailWorkId: null,
    detailRoomWorks: [],
    planAddOpen: false,
    planAddMode: null,
    planAddQuery: '',
    planAddSelected: [],
    audioSettingsOpen: false,
    duration: DEFAULT_DURATIONS.includes(persistedBoot?.duration) ? persistedBoot.duration : 60,
    playbackRate: clampRate(persistedBoot?.playbackRate ?? 1),
    audioDurations: {},
    audioPositions: persistedBoot?.audioPositions && typeof persistedBoot.audioPositions === 'object' ? {...persistedBoot.audioPositions} : {},
    audioQuery: '',
    audioSort: 'rank-asc',
    audioFilter: 'all',
    playing: null,
    audio: null,
    audioError: '',
    downloaded: new Set(),
    bulkDownload: {active: false, done: 0, total: 0},
    bulkSaveOpen: false,
    bulkSaveSelectedIds: new Set(),
    navigation: null,
    player: {workId: null, mode: 'standalone', sessionId: 0, hasStarted: false, arrivalHandled: false},
    notice: null,
    undo: null,
    processedArrivalEvents: new Set(),
    support: {open: false, editing: false, room: '', candidates: [], selectedCandidateId: null, error: ''},
    onboarding: {active: false, step: 0},
    auth: {configured: false, user: null, status: 'idle', emailDraft: '', pending: false, lastSyncedAt: null, message: '', error: ''}
  };

  let persistListener = null;
  function setPersistListener(fn) {
    persistListener = typeof fn === 'function' ? fn : null;
  }

  const navOptions = () => ({preferElevator: state.preferElevator, lang: state.lang});
  const currentPlan = () => activePlanMeta({
    planMode: state.planMode,
    routeId: state.routeId,
    minutes: state.minutes,
    routes,
    myPlanIds: state.myPlanIds,
    sharedPlan: state.sharedPlan,
    navigationIndex,
    duration: state.duration,
    customTimedIds: state.customTimedIds,
    customTimedMinutes: state.customTimedMinutes,
    routeEdits: state.routeEdits,
    lang: state.lang
  });
  const planWorks = () => currentPlan().ids.map(id => byId[id]).filter(Boolean);
  const routableIds = () => currentPlan().routableIds;
  const currentEstimates = () => planStopEstimates(currentPlan(), navigationIndex, navOptions());
  const audioPath = (id, length, lang = state.lang) => new URL(audioRelativePath(id, length, lang), appBase).href;

  function setAppLang(lang, {confirm = true} = {}) {
    const next = setLang(lang);
    state.lang = next;
    if (confirm) state.hasChosenLang = true;
    persistState();
    return next;
  }

  function preferredLengthFor(work) {
    const lengths = audioLengthsFor(work);
    const chosen = state.audioDurations[work.id] ?? state.duration;
    return lengths.includes(chosen) ? chosen : lengths[0];
  }

  function validCustomNavigation(nav, ids) {
    if (!nav || !ids.length) return false;
    if (!navigationIndex.nodes.has(nav.currentNodeId)) return false;
    if (!nav.routeComplete && !navigationIndex.nodes.has(nav.destinationNodeId)) return false;
    if (!Array.isArray(nav.routeWorkIds) || nav.routeWorkIds.join('|') !== ids.join('|')) return false;
    if (!Array.isArray(nav.passedNodeIds) || nav.passedNodeIds.some(id => !navigationIndex.nodes.has(id))) return false;
    return true;
  }

  function restoreInitialNavigation() {
    if (state.planMode === 'myplan' || state.planMode === 'shared' || state.customTimedIds?.length || state.routeEdits[state.routeId]?.length) {
      const ids = routableIds();
      if (validCustomNavigation(persistedBoot?.navigation, ids)) {
        state.navigation = persistedBoot.navigation;
      } else {
        state.navigation = navigationStateFromRoute(navigationIndex, ids);
      }
      return;
    }
    const fromLocal = validStoredProgress(navigationIndex, routes, persistedBoot?.sessionProgress);
    if (fromLocal) {
      state.routeId = fromLocal.routeId ?? state.routeId;
      state.minutes = fromLocal.minutes;
      state.navigation = fromLocal.navigation;
      state.selected = fromLocal.selected ?? state.selected;
      state.floor = Number.isFinite(fromLocal.floor) ? fromLocal.floor : state.floor;
      return;
    }
    try {
      const legacy = validStoredProgress(navigationIndex, routes, JSON.parse(sessionStorage.getItem(SESSION_PROGRESS_KEY)));
      if (legacy) {
        state.routeId = legacy.routeId ?? state.routeId;
        state.minutes = legacy.minutes;
        state.navigation = legacy.navigation;
        state.selected = legacy.selected ?? state.selected;
        state.floor = Number.isFinite(legacy.floor) ? legacy.floor : state.floor;
        return;
      }
    } catch { /* ignore */ }
    state.navigation = navigationStateFromRoute(navigationIndex, routableIds());
  }

  restoreInitialNavigation();
  if (!state.selected) {
    state.selected = currentPlan().ids[0] ?? works[0]?.id ?? null;
  }

  function persistState({skipSync = false} = {}) {
    const plan = currentPlan();
    const sessionProgress = !plan.isCustom && !plan.isShared && !state.routeEdits[state.routeId]?.length ? {
      version: 2,
      routeId: plan.id,
      minutes: plan.minutes,
      routeSignature: plan.ids.join('|'),
      navigation: state.navigation,
      selected: state.selected,
      floor: state.floor
    } : null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 3,
        lang: state.lang,
        hasChosenLang: state.hasChosenLang,
        hasCompletedAuthGate: state.hasCompletedAuthGate,
        hasSeenOnboarding: state.hasSeenOnboarding,
        hasChosenCourse: state.hasChosenCourse,
        tab: state.tab,
        planMode: state.planMode,
        routeId: state.routeId,
        minutes: state.minutes,
        customTimedIds: state.customTimedIds,
        customTimedMinutes: state.customTimedMinutes,
        routeEdits: state.routeEdits,
        optionalWorkIds: state.optionalWorkIds,
        preferElevator: state.preferElevator,
        autoPlayNext: state.autoPlayNext,
        largeText: state.largeText,
        myPlanIds: state.myPlanIds,
        sharedPlan: state.sharedPlan,
        returnPlanSnapshot: state.returnPlanSnapshot,
        viewed: [...state.viewed],
        floor: state.floor,
        selected: state.selected,
        duration: state.duration,
        playbackRate: state.playbackRate,
        audioPositions: state.audioPositions,
        navigation: state.navigation,
        sessionProgress
      }));
    } catch { /* localStorage optional */ }
    if (sessionProgress) {
      try { sessionStorage.setItem(SESSION_PROGRESS_KEY, JSON.stringify(sessionProgress)); }
      catch { /* sessionStorage optional */ }
    }
    if (!skipSync && persistListener) persistListener();
  }

  function navigationView() {
    return buildNavigationView(navigationIndex, state.navigation, navOptions());
  }

  function roomWorksFor(work) {
    if (!work || work.locationPrecision !== 'room' || work.room == null || work.floor == null) return [];
    return worksByFloorRoom.get(`${work.floor}:${work.room}`) || [work];
  }

  return {
    maxRoutableCount,
    state,
    navOptions,
    currentPlan,
    planWorks,
    routableIds,
    currentEstimates,
    audioPath,
    preferredLengthFor,
    setAppLang,
    setPersistListener,
    persistState,
    navigationView,
    roomWorksFor
  };
}
