import {APP_NAME} from './app-config.js';
import {detectBrowserLang, ensureWorkLocale, getLangMeta, normalizeLang, setLang, t} from './i18n.js';
import {indexNavigationGraph} from './navigation.js';
import {timeCourseBounds} from './my-plan.js';
import {createAppStore, readPersistedState, SESSION_PROGRESS_KEY, STORAGE_KEY} from './app/state.js';
import {bottomTabsMarkup, createNoticeController, esc, noticeMarkup} from './app/ui-helpers.js';
import {createAudioController} from './app/audio-controller.js';
import {createPlanActions} from './app/plan-actions.js';
import {createAuthSyncController} from './app/cloud-sync.js';
import {parseSharedPlanInput, readPendingSharedPlan, savePendingSharedPlan} from './app/plan-share.js';
import {authGateView, wireAuthGate} from './views/auth-gate.js';
import {courseSelectView, languageSelectView, wireCourseSelect} from './views/course-select.js';
import {mapTabView, wireMapTab} from './views/map-tab.js';
import {planTabView, wirePlanTab} from './views/plan-tab.js';
import {audioTabView, visibleAudioWorks, wireAudioTab} from './views/audio-tab.js';
import {settingsTabView, wireSettingsTab} from './views/settings-tab.js';
import {closeWorkDetail, openWorkDetail, workDetailSheetMarkup, wireWorkDetailSheet} from './views/work-detail-sheet.js';
import {audioSettingsModalMarkup, miniPlayerMarkup, wireAudioSettingsModal, wireMiniPlayer} from './views/mini-player.js';
import {incomingSharedPopupMarkup, sharePlanModalMarkup, sharedPlanBannerMarkup, stopQrScanner, wireSharedPlanUI} from './views/plan-share-modal.js';
import {cleanupOnboardingPositioning, finishOnboardingTour, onboardingTourMarkup, wireOnboardingTour} from './views/onboarding-tour.js';

const isLocalHost = typeof location !== 'undefined'
  && ['localhost', '127.0.0.1', '::1', ''].includes(location.hostname);

async function clearShellCachesAndSW() {
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith('louvre-shell-') || key.startsWith('louvre-images-'))
          .map(key => caches.delete(key))
      );
    } catch { /* ignore */ }
  }
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    } catch { /* ignore */ }
  }
}

async function forceRefreshApp({resetState = false, onOffline = null} = {}) {
  if (!resetState && typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (typeof onOffline === 'function') onOffline();
    return false;
  }
  if (resetState) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    try { sessionStorage.removeItem(SESSION_PROGRESS_KEY); } catch { /* ignore */ }
    savePendingSharedPlan(null);
  }
  await clearShellCachesAndSW();
  if (typeof location !== 'undefined') {
    const nextUrl = new URL(location.href);
    nextUrl.searchParams.delete('reset');
    nextUrl.searchParams.delete('clear');
    nextUrl.searchParams.set('_r', String(Date.now()));
    location.replace(nextUrl.toString());
  }
  return true;
}

if (typeof location !== 'undefined' && location.search) {
  const bootParams = new URLSearchParams(location.search);
  if (bootParams.has('reset') || bootParams.has('clear')) {
    const preLang = readPersistedState()?.lang ? normalizeLang(readPersistedState().lang) : detectBrowserLang();
    const ok = isLocalHost || (typeof window !== 'undefined' && window.confirm(t('settings.fullResetConfirm', null, preLang)));
    if (ok) {
      await forceRefreshApp({resetState: true});
      await new Promise(() => {});
    } else {
      try {
        const cleanUrl = new URL(location.href);
        cleanUrl.searchParams.delete('reset');
        cleanUrl.searchParams.delete('clear');
        history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      } catch { /* ignore */ }
    }
  }
  if (bootParams.has('_r')) {
    try {
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete('_r');
      history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    } catch { /* ignore */ }
  }
}

const bootStarted = performance.now();
const persistedBoot = readPersistedState();
const bootLang = setLang(persistedBoot?.lang ? normalizeLang(persistedBoot.lang) : detectBrowserLang());
const skipSplashImmediate = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

document.title = APP_NAME;
const app = document.querySelector('#app');
const appBase = new URL('../', import.meta.url);
const iconUrl = new URL('icons/icon-192.png', appBase).href;
const monaUrl = new URL('images/mona.jpg', appBase).href;

// Keep tap feedback visible even when an action immediately redraws its button.
document.addEventListener('pointerdown', event => {
  if (event.button !== 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button || button.disabled || !app.contains(button)) return;
  const ripple = document.createElement('span');
  ripple.className = 'tap-feedback';
  ripple.setAttribute('aria-hidden', 'true');
  ripple.style.left = `${event.clientX}px`;
  ripple.style.top = `${event.clientY}px`;
  document.body.append(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), {once: true});
}, {passive: true});

let splashReady = false;
let splashStartRequested = false;
let splashSkipped = false;
let finishSplashImpl = null;

function requestSplashFinish() {
  if (splashSkipped) return;
  splashStartRequested = true;
  if (splashReady && finishSplashImpl) {
    void finishSplashImpl();
    return;
  }
}

if (!skipSplashImmediate) {
  app.innerHTML = `<div class="splash" data-skip-splash role="button" tabindex="0" aria-label="${esc(t('app.skipSplashAria', null, bootLang))}"><div class="gallery-arches" aria-hidden="true"></div><div class="splash-stage"><figure class="splash-mona-frame"><div class="splash-mona-mat"><img class="splash-mona-img" src="${monaUrl}" alt="Mona Lisa"></div></figure><h1>${APP_NAME}</h1><span class="splash-hint">${esc(t('app.splashHint', null, bootLang))}</span></div></div>`;

  const skipEl = document.querySelector('[data-skip-splash]');
  skipEl?.addEventListener('click', requestSplashFinish);
  skipEl?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); requestSplashFinish(); }
  });
} else {
  app.innerHTML = `<div class="boot-loading"><p>${esc(t('app.loading', null, bootLang))}</p></div>`;
}

const [[works, routes, sources, navigationGraph, artworkImages, imageCredits]] = await Promise.all([
  Promise.all([
    'works.json',
    'routes.json',
    'provenance.json',
    'navigation-graph.json',
    'artwork-images.json',
    'image-credits.json'
  ].map(async name => {
    const response = await fetch(new URL(name, import.meta.url));
    if (!response.ok) throw new Error(`Failed to load ${name}`);
    return response.json();
  })),
  ensureWorkLocale(bootLang, appBase)
]).catch(error => {
  app.innerHTML = `<main class="error-screen"><h1>${esc(t('app.errorTitle', null, bootLang))}</h1><p>${esc(t('app.errorBody', null, bootLang))}</p><button class="primary" onclick="location.reload()">${esc(t('app.reload', null, bootLang))}</button></main>`;
  throw error;
});

const byId = Object.fromEntries(works.map(work => [work.id, work]));
const worksByFloorRoom = new Map();
for (const work of works) {
  if (work.locationPrecision === 'room' && work.room != null && work.floor != null) {
    const key = `${work.floor}:${work.room}`;
    if (!worksByFloorRoom.has(key)) worksByFloorRoom.set(key, []);
    worksByFloorRoom.get(key).push(work);
  }
}

const navigationIndex = indexNavigationGraph(navigationGraph);

const store = createAppStore({
  works,
  routes,
  byId,
  worksByFloorRoom,
  navigationIndex,
  persistedBoot,
  skipSplashImmediate,
  appBase
});

const notices = createNoticeController(store.state);

const ctx = {
  app,
  appBase,
  iconUrl,
  monaUrl,
  works,
  routes,
  sources,
  navigationGraph,
  artworkImages,
  imageCredits,
  byId,
  worksByFloorRoom,
  navigationIndex,
  ...store,
  ...notices,
  t: (key, params) => t(key, params, store.state.lang),
  visibleAudioWorks: () => visibleAudioWorks(ctx),
  openWorkDetail: (workId, roomWorkIds) => openWorkDetail(ctx, workId, roomWorkIds),
  closeWorkDetail: () => closeWorkDetail(ctx),
  forceRefreshApp: opts => forceRefreshApp({
    ...opts,
    onOffline: () => {
      ctx.setNotice(t('notice.offlineRefreshBlocked', null, ctx.state.lang), false, 3600);
      render();
    }
  }),
  render
};

ctx.audio = createAudioController(ctx);
ctx.planActions = createPlanActions(ctx);
ctx.cloudSync = createAuthSyncController(ctx);

async function switchAppLanguage(next) {
  if (!next || next === ctx.state.lang) return;
  const applied = ctx.setAppLang(next);
  ctx.audio.handleLanguageChange();
  const meta = getLangMeta(applied);
  ctx.setNotice(t('app.languageSwitched', {label: meta.label}, applied), false, 2800);
  render();
  const [localeLoaded] = await Promise.all([
    ensureWorkLocale(applied, appBase),
    ctx.audio.loadDownloads()
  ]);
  if (localeLoaded || ctx.state.lang === applied) render();
}

// Detect friend's shared plan link (?sp=...) without overwriting the user's own plan.
// Persist in sessionStorage so OAuth / Magic Link redirects preserve it across reloads.
let hadInvalidSharedParam = false;
if (typeof location !== 'undefined' && location.search) {
  const searchParams = new URLSearchParams(location.search);
  const hadSp = searchParams.has('sp');
  const incoming = hadSp ? parseSharedPlanInput(location.search, byId) : null;
  if (incoming) {
    store.state.incomingSharedPlan = incoming;
    savePendingSharedPlan(incoming);
  } else if (hadSp) {
    hadInvalidSharedParam = true;
  }
  if (hadSp) {
    try {
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete('sp');
      cleanUrl.searchParams.delete('sn');
      history.replaceState?.(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    } catch { /* ignore */ }
  }
}
if (!store.state.incomingSharedPlan) {
  const pending = readPendingSharedPlan(byId);
  if (pending) store.state.incomingSharedPlan = pending;
}
if (hadInvalidSharedParam) {
  ctx.setNotice(t('share.importInvalidError', null, store.state.lang), false, 4200);
}

function resolvePostLanguagePhase() {
  const {state} = ctx;
  if (state.auth.user && !state.hasCompletedAuthGate) {
    state.hasCompletedAuthGate = true;
    ctx.persistState({skipSync: true});
  }
  if (!state.hasCompletedAuthGate && !state.hasChosenCourse) {
    return 'auth_gate';
  }
  return state.hasChosenCourse ? 'main' : 'select_time';
}

function wireShell() {
  const {state, maxRoutableCount, planActions} = ctx;

  document.querySelector('[data-change-course]')?.addEventListener('click', () => {
    const plan = ctx.currentPlan();
    if (!plan.isCustom && plan.kind === 'time') {
      const bounds = timeCourseBounds(plan.minutes || state.minutes, maxRoutableCount);
      state.draftMinutes = bounds.minutes;
      state.draftCount = Math.max(bounds.min, Math.min(bounds.max, plan.ids.length || bounds.recommended));
    }
    state.detailWorkId = null;
    state.audioSettingsOpen = false;
    state.planAddOpen = false;
    state.bulkSaveOpen = false;
    state.courseEntry = 'main';
    state.appPhase = 'select_time';
    render();
    window.scrollTo({top: 0});
  });

  document.querySelectorAll('[data-prefer-elevator]').forEach(btn => {
    btn.onclick = () => planActions.setPreferElevator(btn.dataset.preferElevator === 'true');
  });

  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => {
      state.tab = btn.dataset.tab;
      if (state.tab !== 'plan') state.planAddOpen = false;
      state.bulkSaveOpen = false;
      state.detailWorkId = null;
      state.audioSettingsOpen = false;
      ctx.persistState();
      render();
      window.scrollTo({top: 0, behavior: 'smooth'});
    };
  });

  document.querySelectorAll('[data-go-audio-mapped]').forEach(btn => {
    btn.onclick = () => {
      state.tab = 'audio';
      state.audioFilter = 'mapped';
      ctx.persistState();
      render();
      window.scrollTo({top: 0, behavior: 'smooth'});
    };
  });

  document.querySelectorAll('[data-show-map]').forEach(btn => {
    btn.onclick = event => {
      event.stopPropagation();
      const id = btn.dataset.showMap;
      ctx.clearProgressNotice();
      planActions.selectRouteWork(id, {focusFloor: true});
      state.detailWorkId = null;
      state.tab = 'map';
      ctx.persistState();
      render();
      window.scrollTo({top: 0, behavior: 'smooth'});
    };
  });

  document.querySelectorAll('[data-toggle-viewed]').forEach(btn => {
    btn.onclick = event => {
      event.stopPropagation();
      planActions.toggleViewed(btn.dataset.toggleViewed);
    };
  });

  document.querySelectorAll('[data-toggle-myplan]').forEach(btn => {
    if (btn.closest('.audio-list')) return;
    btn.onclick = event => {
      event.stopPropagation();
      planActions.handleToggleMyPlan(btn.dataset.toggleMyplan);
    };
  });

  document.querySelectorAll('[data-open-detail]').forEach(el => {
    if (el.closest('.audio-list')) return;
    const open = () => { if (el.dataset.openDetail) openWorkDetail(ctx, el.dataset.openDetail); };
    el.onclick = open;
    el.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    };
  });

  document.querySelectorAll('[data-undo-arrival]').forEach(btn => {
    btn.onclick = planActions.undoArrival;
  });

  document.querySelectorAll('[data-notice-action="open-myplan"], [data-open-myplan-tab]').forEach(btn => {
    btn.onclick = () => {
      state.detailWorkId = null;
      planActions.chooseMyPlan({goMap: false, animate: false});
    };
  });

  document.querySelectorAll('[data-start-myplan-map]').forEach(btn => {
    btn.onclick = () => {
      state.detailWorkId = null;
      planActions.chooseMyPlan({goMap: true, animate: true});
    };
  });

  document.querySelectorAll('[data-set-lang]').forEach(btn => {
    btn.onclick = () => switchAppLanguage(btn.dataset.setLang);
  });
}

function wireLangButtons() {
  document.querySelectorAll('[data-set-lang]').forEach(btn => {
    btn.onclick = () => switchAppLanguage(btn.dataset.setLang);
  });
}

function wireMain() {
  wireShell();
  wireAudioSettingsModal(ctx);
  wireMapTab(ctx);
  wirePlanTab(ctx);
  wireWorkDetailSheet(ctx);
  wireMiniPlayer(ctx);
  wireAudioTab(ctx);
  wireSettingsTab(ctx);
  wireSharedPlanUI(ctx);
  wireOnboardingTour(ctx);
}

let renderedPageKey = null;
let renderedLayerKey = null;
let activeViewTransition = null;
let renderSequence = 0;

function render({skipTransition = false} = {}) {
  const {state} = ctx;
  if (state.appPhase === 'splash') return;
  const pageKey = state.appPhase === 'main'
    ? `main:${state.tab}:${state.planAddOpen ? 'add' : 'list'}`
    : state.appPhase;
  const layerKey = [state.detailWorkId, state.audioSettingsOpen, state.bulkSaveOpen, state.shareModal?.open,
    Boolean(state.incomingSharedPlan)].join(':');
  const kind = renderedPageKey && renderedPageKey !== pageKey
    ? (renderedPageKey.startsWith('main:') && pageKey.startsWith('main:') ? 'tab' : 'page')
    : renderedLayerKey !== null && renderedLayerKey !== layerKey ? 'layer' : null;
  renderedPageKey = pageKey;
  renderedLayerKey = layerKey;
  const sequence = ++renderSequence;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (kind && !skipTransition && !reduceMotion && document.startViewTransition) {
    activeViewTransition?.skipTransition();
    document.documentElement.dataset.guideTransition = kind;
    const transition = document.startViewTransition(() => {
      if (sequence === renderSequence) {
        renderContent();
      }
    });
    activeViewTransition = transition;
    transition.finished.then(() => {
      if (activeViewTransition === transition) {
        activeViewTransition = null;
        delete document.documentElement.dataset.guideTransition;
      }
    }, () => {});
    return;
  }
  activeViewTransition?.skipTransition();
  renderContent();
  if (kind && !skipTransition && !reduceMotion) {
    if (kind === 'tab') app.querySelector('.bottom-tabs button.active')?.classList.add('guide-tab-arrive');
    const target = kind === 'layer'
      ? app.querySelector('.work-sheet, .audio-settings-sheet, .bulk-save-sheet, .share-modal-sheet, .share-popup-dialog')
      : kind === 'tab' ? app.querySelector('.tab-screen') : app.firstElementChild;
    target?.classList.add(kind === 'layer' ? 'guide-layer-enter' : 'guide-screen-enter');
  }
}

function renderContent() {
  const {state} = ctx;
  const lang = state.lang;
  if (state.appPhase === 'splash') return;
  if (state.appPhase !== 'main') cleanupOnboardingPositioning();
  if (state.appPhase === 'select_language') {
    app.innerHTML = languageSelectView(ctx) + noticeMarkup(ctx, false);
    document.querySelectorAll('[data-set-lang]').forEach(btn => {
      btn.onclick = async () => {
        const next = btn.dataset.setLang;
        if (!next || (next === state.lang && state.hasChosenLang)) return;
        const scrollTop = document.querySelector('.home-language-list')?.scrollTop || 0;
        const restoreScroll = () => {
          const list = document.querySelector('.home-language-list');
          if (list) list.scrollTop = scrollTop;
        };
        const applied = ctx.setAppLang(next);
        ctx.audio.handleLanguageChange();
        const meta = getLangMeta(applied);
        ctx.setNotice(t('app.languageSwitched', {label: meta.label}, applied), false, 2800);
        render();
        restoreScroll();
        const [localeLoaded] = await Promise.all([
          ensureWorkLocale(applied, appBase),
          ctx.audio.loadDownloads()
        ]);
        if (localeLoaded || state.lang === applied) {
          render();
          restoreScroll();
        }
      };
    });
    document.querySelector('[data-language-next]')?.addEventListener('click', () => {
      ctx.setAppLang(state.lang);
      state.courseEntry = 'language';
      state.appPhase = resolvePostLanguagePhase();
      render();
      window.scrollTo({top: 0});
    });
    return;
  }
  if (state.appPhase === 'auth_gate') {
    app.innerHTML = authGateView(ctx) + noticeMarkup(ctx, false);
    wireAuthGate(ctx);
    wireLangButtons();
    return;
  }
  if (state.appPhase === 'select_time') {
    app.innerHTML = courseSelectView(ctx) + incomingSharedPopupMarkup(ctx) + noticeMarkup(ctx, false);
    wireCourseSelect(ctx);
    wireSharedPlanUI(ctx);
    wireLangButtons();
    return;
  }

  if (state.tab === 'map' && state.planMode !== 'shared' && !state.hasSeenOnboarding && !state.onboarding.active && !state.incomingSharedPlan && !state.shareModal?.open) {
    state.onboarding = {active: true, step: 0};
  }

  const plan = ctx.currentPlan();
  const hasMini = Boolean(ctx.audio.miniPlayerContext());
  const body = state.tab === 'plan'
    ? planTabView(ctx, hasMini)
    : state.tab === 'audio'
      ? audioTabView(ctx, hasMini)
      : state.tab === 'settings'
        ? settingsTabView(ctx, hasMini)
        : mapTabView(ctx, hasMini);

  app.innerHTML = `
    <header class="main-header">
      <div class="header-brand">
        <img class="header-app-icon" src="${iconUrl}" alt="">
        <b>${esc(APP_NAME)}</b>
        <span class="header-course-tag">${esc(plan.label)}</span>
        ${state.offline ? `<span class="offline-pill" role="status">${esc(t('app.offline', null, lang))}</span>` : ''}
      </div>
      <div class="header-actions">
        <button type="button" class="header-course-btn" data-change-course>${esc(t('app.changeCourse', null, lang))}</button>
        <button type="button" class="header-audio-btn" data-open-audio-settings aria-label="${esc(t('app.audioSettingsAria', null, lang))}" title="${esc(t('app.audioSettingsTitle', null, lang))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>
      </div>
    </header>
    ${sharedPlanBannerMarkup(ctx)}
    ${body}
    ${miniPlayerMarkup(ctx)}
    ${bottomTabsMarkup(ctx)}
    ${workDetailSheetMarkup(ctx)}
    ${audioSettingsModalMarkup(ctx)}
    ${sharePlanModalMarkup(ctx)}
    ${incomingSharedPopupMarkup(ctx)}
    ${onboardingTourMarkup(ctx)}
    ${noticeMarkup(ctx, hasMini)}
  `;
  wireMain();
  ctx.audio.syncSeekBars();
}

if ('serviceWorker' in navigator) {
  const allowLocalSw = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sw');
  if (isLocalHost && !allowLocalSw) {
    void clearShellCachesAndSW();
  } else {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let swReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || swReloading) return;
      const busy = Boolean(ctx.state.playing || ctx.state.planAddOpen || ctx.state.bulkSaveOpen || ctx.state.bulkDownload?.active || ctx.state.shareModal?.open);
      if (busy) return;
      swReloading = true;
      location.reload();
    });
    navigator.serviceWorker.register(new URL('sw.js', appBase), {updateViaCache: 'none'})
      .then(reg => reg.update().catch(() => {}))
      .catch(() => {});
  }
}

window.addEventListener('online', () => { ctx.state.offline = false; ctx.cloudSync.flushPending(); render(); });
window.addEventListener('offline', () => { ctx.state.offline = true; render(); });

ctx.audio.player.addEventListener('timeupdate', ctx.audio.syncSeekBars);
ctx.audio.player.addEventListener('loadedmetadata', ctx.audio.syncSeekBars);
ctx.audio.player.addEventListener('pause', () => {
  if (ctx.state.playing && ctx.audio.player.paused) {
    ctx.audio.saveCurrentPosition({persist: true});
    ctx.state.playing = null;
    render();
  }
});
ctx.audio.player.addEventListener('play', () => {
  if (ctx.state.player.workId && ctx.state.playing !== ctx.state.player.workId) {
    ctx.state.playing = ctx.state.player.workId;
    render();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') ctx.audio.saveCurrentPosition({persist: true});
});
window.addEventListener('pagehide', () => {
  ctx.audio.saveCurrentPosition({persist: true});
});
window.addEventListener('keydown', event => {
  if (!event.repeat && (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    void ctx.forceRefreshApp({resetState: false});
    return;
  }
  if (event.key === 'Escape') {
    if (ctx.state.incomingSharedPlan) { ctx.state.incomingSharedPlan = null; savePendingSharedPlan(null); render(); }
    else if (ctx.state.shareModal?.open) { stopQrScanner(); ctx.state.shareModal.open = false; ctx.state.shareModal.scanning = false; render(); }
    else if (ctx.state.onboarding?.active) { finishOnboardingTour(ctx); }
    else if (ctx.state.audioSettingsOpen) { ctx.state.audioSettingsOpen = false; render(); }
    else if (ctx.state.bulkSaveOpen) { ctx.state.bulkSaveOpen = false; render(); }
    else if (ctx.state.detailWorkId) closeWorkDetail(ctx);
  }
});

const downloadsPromise = Promise.all([
  ctx.audio.loadDownloads(),
  ctx.cloudSync.init()
]);

if (!skipSplashImmediate) {
  finishSplashImpl = async () => {
    if (splashSkipped) return;
    splashSkipped = true;
    document.querySelector('.splash')?.classList.add('leaving');
    setTimeout(() => {
      ctx.state.appPhase = 'select_language';
      render();
    }, 460);
  };

  await downloadsPromise;
  splashReady = true;

  if (splashStartRequested) {
    await finishSplashImpl();
  } else {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 2800 - (performance.now() - bootStarted))));
    if (!splashSkipped) await finishSplashImpl();
  }
} else {
  await downloadsPromise;
  ctx.state.appPhase = 'select_language';
  render();
}
