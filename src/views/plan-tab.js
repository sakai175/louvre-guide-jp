import {destinationWorkId} from '../route-progress.js';
import {catalogWorks} from '../catalog.js';
import {localizeWork, t} from '../i18n.js';
import {creatorMeta, esc, formatAudioLengthLabel, priorityBadgeMarkup, thumbMarkup, workStatus} from '../app/ui-helpers.js';

function bulkSaveSheetMarkup(ctx, items) {
  if (!ctx.state.bulkSaveOpen) return '';
  const lang = ctx.state.lang;
  const tr = (key, params) => t(key, params, lang);
  return `<div class="sheet-backdrop" data-close-bulk-save></div>
    <section class="bulk-save-sheet" role="dialog" aria-modal="true" aria-labelledby="bulk-save-title">
      <div class="bulk-save-head">
        <h2 id="bulk-save-title">${esc(tr('plan.bulkSaveTitle'))}</h2>
        <button type="button" class="sheet-close-btn" data-close-bulk-save>${esc(tr('app.closeBtn'))}</button>
      </div>
      <p class="bulk-save-help">${esc(tr('plan.bulkSaveHelp'))}</p>
      <div class="bulk-save-list">
        ${items.map(rawWork => {
          const work = localizeWork(rawWork, lang);
          const length = ctx.preferredLengthFor(rawWork);
          const saved = ctx.state.downloaded.has(`${work.id}-${length}`);
          return `<label class="bulk-save-item ${saved ? 'is-saved' : ''}">
            <input type="checkbox" data-bulk-save-work="${esc(work.id)}" ${saved ? 'disabled' : ''} ${ctx.state.bulkSaveSelectedIds.has(work.id) ? 'checked' : ''}>
            ${thumbMarkup(ctx, work, 'thumb-xs')}
            <span><strong>${esc(work.title)}</strong><small>${esc(saved ? tr('plan.bulkSaveSaved') : formatAudioLengthLabel(length, lang))}</small></span>
          </label>`;
        }).join('')}
      </div>
      <button type="button" class="primary bulk-save-confirm" data-confirm-bulk-save ${ctx.state.bulkSaveSelectedIds.size ? '' : 'disabled'}>${esc(tr('plan.bulkSaveAction', {count: ctx.state.bulkSaveSelectedIds.size}))}</button>
    </section>`;
}

function planAddResultsMarkup(ctx) {
  const {state, works, navigationIndex} = ctx;
  const tr = key => t(key, null, state.lang);
  const plan = ctx.currentPlan();
  const included = new Set([...plan.ids, ...(state.optionalWorkIds[plan.id] || [])]);
  const selectedSet = new Set(state.planAddSelected || []);
  const routeMode = state.planAddMode === 'route';
  const candidates = catalogWorks(works, {query: state.planAddQuery, sort: 'rank-asc', filter: routeMode ? 'mapped' : 'all', lang: state.lang})
    .filter(work => (!routeMode || navigationIndex.nodes.has(`work:${work.id}`)) && !included.has(work.id));
  if (!candidates.length) return `<p class="plan-add-empty">${esc(tr('catalog.emptyMsg'))}</p>`;
  return candidates.map(rawWork => {
    const work = localizeWork(rawWork, state.lang);
    const isPicked = selectedSet.has(work.id);
    const modeAttr = routeMode ? `data-add-route-work="${esc(work.id)}"` : `data-add-optional-work="${esc(work.id)}"`;
    return `<div class="plan-add-item ${isPicked ? 'is-selected' : ''}" ${modeAttr} data-toggle-plan-add="${esc(work.id)}" role="button" tabindex="0" aria-pressed="${isPicked}">
      ${thumbMarkup(ctx, work, 'thumb-sm')}
      <div class="plan-add-copy"><strong>${esc(work.title)}</strong><small>${esc(workStatus(work, state.lang))}</small></div>
      <span class="plan-add-check" aria-hidden="true">${esc(isPicked ? tr('plan.batchSelectedBtn') : tr('plan.batchSelectBtn'))}</span>
    </div>`;
  }).join('');
}

function planAddBatchBarMarkup(ctx, hasMini) {
  const {state} = ctx;
  const pickedCount = (state.planAddSelected || []).length;
  if (!pickedCount) return '';
  const tr = (key, params) => t(key, params, state.lang);
  const isRouteMode = state.planAddMode === 'route';
  return `<aside class="plan-add-batch-bar ${hasMini ? 'with-mini-player' : ''}" data-plan-add-batch-bar>
    <span class="plan-add-batch-meta">${esc(tr('plan.batchCount', {count: pickedCount}))}</span>
    <div class="plan-add-batch-actions">
      <button type="button" class="secondary compact-btn" data-clear-plan-add>${esc(tr('plan.batchClearBtn'))}</button>
      <button type="button" class="primary compact-btn" data-confirm-plan-add>${esc(tr(isRouteMode ? 'plan.batchConfirmRoute' : 'plan.batchConfirmOptional', {count: pickedCount}))}</button>
    </div>
  </aside>`;
}

function optionalWorksMarkup(ctx, plan) {
  const {state, byId, navigationIndex} = ctx;
  const tr = (key, params) => t(key, params, state.lang);
  const optionalIds = (state.optionalWorkIds[plan.id] || []).filter(id => byId[id] && !plan.ids.includes(id));
  if (!optionalIds.length) return '';
  return `<section class="plan-optional-section" aria-label="${esc(tr('plan.optionalTitle'))}">
    <div class="plan-optional-heading"><h2>${esc(tr('plan.optionalTitle'))}</h2><span>${optionalIds.length}</span></div>
    <p>${esc(tr('plan.optionalNote'))}</p>
    <ul class="plan-optional-list">${optionalIds.map(id => {
      const work = localizeWork(byId[id], state.lang);
      const mapped = navigationIndex.nodes.has(`work:${id}`);
      return `<li class="plan-optional-item">
        <div class="plan-optional-main" data-open-detail="${esc(id)}" role="button" tabindex="0">
          ${thumbMarkup(ctx, work, 'thumb-sm')}
          <div><strong>${esc(work.title)}</strong><small>${esc(workStatus(work, state.lang))}</small></div>
        </div>
        <div class="plan-optional-actions">
          ${mapped ? `<button type="button" class="action-chip" data-promote-optional="${esc(id)}">${esc(tr('plan.promoteOptional'))}</button>` : ''}
          <button type="button" class="action-chip" data-remove-optional="${esc(id)}">${esc(tr('plan.removeOptional'))}</button>
        </div>
      </li>`;
    }).join('')}</ul>
  </section>`;
}

export function planTabView(ctx, hasMini) {
  const {state, works, navigationIndex} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  if (state.planAddOpen && !state.planAddMode) {
    return `<main class="tab-screen plan-add-screen ${hasMini ? 'has-mini-player' : ''}">
      <button type="button" class="text-back-btn" data-plan-add-back>← ${esc(tr('app.close'))}</button>
      <h1>${esc(tr('plan.addMethodTitle'))}</h1>
      <p class="plan-add-intro">${esc(tr('plan.addMethodIntro'))}</p>
      <div class="plan-add-choices">
        <button type="button" class="plan-add-choice" data-plan-add-mode="route">
          <strong>${esc(tr('plan.addRouteChoice'))}</strong><span>${esc(tr('plan.addRouteDescription'))}</span>
        </button>
        <button type="button" class="plan-add-choice" data-plan-add-mode="optional">
          <strong>${esc(tr('plan.addOptionalChoice'))}</strong><span>${esc(tr('plan.addOptionalDescription'))}</span>
        </button>
      </div>
    </main>`;
  }
  if (state.planAddOpen) {
    const pickedCount = (state.planAddSelected || []).length;
    const isRouteMode = state.planAddMode === 'route';
    return `<main class="tab-screen plan-add-screen ${hasMini ? 'has-mini-player' : ''} ${pickedCount > 0 ? 'has-batch-bar' : ''}" data-plan-add-screen data-has-mini="${hasMini ? '1' : '0'}">
      <button type="button" class="text-back-btn" data-plan-add-back>← ${esc(tr('plan.addMethodBack'))}</button>
      <h1>${esc(tr(isRouteMode ? 'plan.addRouteTitle' : 'plan.addOptionalTitle'))}</h1>
      <p class="plan-add-intro">${esc(tr(isRouteMode ? 'plan.addRouteDescription' : 'plan.addOptionalDescription'))}</p>
      <input type="search" class="plan-add-search" data-plan-add-search value="${esc(state.planAddQuery)}" placeholder="${esc(tr('catalog.searchPlaceholder'))}" aria-label="${esc(tr('catalog.searchAria'))}">
      <div class="plan-add-results" data-plan-add-results>${planAddResultsMarkup(ctx)}</div>
      <div data-plan-add-batch-host>${planAddBatchBarMarkup(ctx, hasMini)}</div>
    </main>`;
  }
  const plan = ctx.currentPlan();
  const items = ctx.planWorks();
  const estimates = ctx.currentEstimates();
  const destId = destinationWorkId(navigationIndex, state.navigation);
  const viewedInPlan = items.filter(w => state.viewed.has(w.id)).length;
  const remainingCount = Math.max(0, items.length - viewedInPlan);
  const pct = items.length ? Math.round((viewedInPlan / items.length) * 100) : 0;
  const estRemainingMinutes = items.length > 0 && remainingCount > 0
    ? Math.max(5, Math.round((plan.estimatedMinutes * remainingCount) / items.length))
    : 0;
  const nextRawWork = (destId && !state.viewed.has(destId) ? items.find(w => w.id === destId) : null)
    || items.find(w => !state.viewed.has(w.id))
    || null;
  const nextWork = nextRawWork ? localizeWork(nextRawWork, lang) : null;
  const isAllDone = items.length > 0 && viewedInPlan === items.length;
  const allSaved = items.length > 0 && items.every(w => state.downloaded.has(`${w.id}-${ctx.preferredLengthFor(w)}`));
  const saveBtnText = state.bulkDownload.active
    ? tr('plan.savingBulk', {done: state.bulkDownload.done, total: state.bulkDownload.total})
    : allSaved
      ? tr('plan.allSaved')
      : tr('plan.saveCourseBtn');
  return `<main class="tab-screen plan-screen ${hasMini ? 'has-mini-player' : ''}">
    <section class="plan-summary-card ${isAllDone ? 'is-complete' : ''}">
      <div class="plan-summary-top">
        <div>
          <span class="eyebrow">${esc(plan.isShared ? tr('plan.eyebrowShared') : plan.isCustom ? tr('plan.eyebrowCustom') : plan.kind === 'theme' ? tr('plan.eyebrowTheme') : tr('plan.eyebrowRec'))}</span>
          <h1>${esc(plan.label)}</h1>
        </div>
        <div class="plan-progress-badge">${esc(tr('plan.progressBadge', {viewed: viewedInPlan, total: items.length}))}${items.length ? ` (${pct}%)` : ''}</div>
      </div>
      ${items.length ? `<div class="plan-progress-panel">
        <div class="plan-progress-foot">
          ${isAllDone
            ? `<span class="progress-complete-banner">${esc(tr('plan.completeBanner', {total: items.length}))}</span>`
            : `<span class="progress-remaining-text">${esc(tr('plan.remainingSummary', {count: remainingCount, minutes: estRemainingMinutes}))}</span>`}
        </div>
        ${!isAllDone && nextWork ? `<div class="progress-next-strip">
          <button type="button" class="progress-next-info" data-open-detail="${esc(nextWork.id)}">
            ${thumbMarkup(ctx, nextWork, 'thumb-sm')}
            <span>
              <small>${esc(tr('plan.nextStopLabel'))}</small>
              <strong>${esc(nextWork.title)}</strong>
              <em>${esc(workStatus(nextWork, lang))}</em>
            </span>
          </button>
          <div class="progress-next-actions">
            <button type="button" class="done-quick-cta" data-toggle-viewed="${esc(nextWork.id)}">${esc(tr('plan.markDoneCta'))}</button>
            ${navigationIndex.nodes.has(`work:${nextWork.id}`) ? `<button type="button" class="action-chip" data-show-map="${esc(nextWork.id)}">${esc(tr('plan.mapBtn'))}</button>` : ''}
          </div>
        </div>` : ''}
      </div>` : ''}

      <div class="plan-summary-actions">
        ${items.length && plan.isCustom && plan.routableIds.length >= 2 ? `<button type="button" class="optimize-plan-btn" data-optimize-myplan>${esc(tr('plan.optimizeBtn'))}</button>` : ''}
        ${!plan.isShared ? `<button type="button" class="secondary compact-btn" data-open-plan-add>${esc(tr('plan.addWorkBtn'))}</button>` : ''}
        <button type="button" class="secondary compact-btn" data-open-share-modal="${items.length ? 'export' : 'import'}">${esc(tr('share.shareBtn'))}</button>
        ${plan.isShared ? `<button type="button" class="secondary compact-btn" data-copy-active-shared>${esc(tr('share.copyToMyPlanBtn'))}</button>` : ''}
        ${items.length ? `<button type="button" class="secondary compact-btn" data-bulk-download ${state.bulkDownload.active || allSaved ? 'disabled' : ''}>${esc(saveBtnText)}</button>` : ''}
      </div>
    </section>

    ${!items.length ? `<section class="empty-plan-box">
      <h2>${esc(tr('plan.emptyTitle'))}</h2>
      <p>${tr('plan.emptyBody', {total: works.length})}</p>
      <button type="button" class="primary" data-open-plan-add>${esc(tr('plan.addWorkBtn'))}</button>
    </section>` : `<ol class="plan-list">
      ${items.map((rawWork, index) => {
        const work = localizeWork(rawWork, lang);
        const isViewed = state.viewed.has(work.id);
        const isDest = work.id === destId;
        const isPlaying = state.playing === work.id;
        const hasMap = navigationIndex.nodes.has(`work:${work.id}`);
        const est = estimates[work.id];
        return `<li class="plan-card ${isDest ? 'is-destination' : ''} ${isViewed ? 'is-viewed' : ''}">
          <div class="plan-card-main" data-open-detail="${esc(work.id)}" role="button" tabindex="0">
            <span class="plan-order ${isViewed ? 'is-done' : ''}">${isViewed ? '✓' : index + 1}</span>
            ${thumbMarkup(ctx, work, 'thumb-md')}
            <div class="plan-card-copy">
              <div class="plan-card-badges">
                ${priorityBadgeMarkup(work, lang)}
                ${isDest ? `<span class="status-pill dest">${esc(tr('plan.statusDest'))}</span>` : isViewed ? `<span class="status-pill done">${esc(tr('plan.statusDone'))}</span>` : `<span class="status-pill">${esc(tr('plan.statusPlanned'))}</span>`}
                ${!hasMap ? `<span class="status-pill warn">${esc(tr('plan.statusUnmapped'))}</span>` : ''}
              </div>
              <strong>${esc(work.title)}</strong>
              <small>${esc(creatorMeta(work, lang))}</small>
              <div class="plan-meta-chips">
                <small class="plan-loc-line">${esc(workStatus(work, lang))}</small>
                ${est ? `<span class="elapsed-pill">${esc(est.elapsedLabel)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="plan-card-actions">
            <button type="button" class="action-chip done-toggle-btn ${isViewed ? 'is-done' : isDest ? 'is-next-cta' : ''}" data-toggle-viewed="${esc(work.id)}" aria-pressed="${isViewed}">
              <span class="done-check-dot" aria-hidden="true">${isViewed ? '✓' : ''}</span>
              <span>${esc(isViewed ? tr('plan.doneShort') : isDest ? tr('plan.markDoneCta') : tr('plan.markDone'))}</span>
            </button>
            <button type="button" class="action-chip play-chip ${isPlaying ? 'active' : ''}" data-quick-play="${esc(work.id)}">${esc(isPlaying ? tr('plan.stop') : tr('plan.play'))}</button>
            ${hasMap ? `<button type="button" class="action-chip" data-show-map="${esc(work.id)}">${esc(tr('plan.mapBtn'))}</button>` : ''}
            ${plan.isCustom ? `
              <button type="button" class="icon-chip" data-move-myplan="${esc(work.id)}" data-delta="-1" ${index === 0 ? 'disabled' : ''} aria-label="${esc(tr('plan.moveUpAria'))}">↑</button>
              <button type="button" class="icon-chip" data-move-myplan="${esc(work.id)}" data-delta="1" ${index === items.length - 1 ? 'disabled' : ''} aria-label="${esc(tr('plan.moveDownAria'))}">↓</button>
              <button type="button" class="icon-chip danger" data-remove-myplan="${esc(work.id)}" aria-label="${esc(tr('plan.removeAria'))}">✕</button>
            ` : ''}
          </div>
        </li>`;
      }).join('')}
    </ol>`}
    ${optionalWorksMarkup(ctx, plan)}
  </main>${bulkSaveSheetMarkup(ctx, items)}`;
}

export function wirePlanTab(ctx) {
  const {byId, planActions, audio, state} = ctx;

  document.querySelector('[data-bulk-download]')?.addEventListener('click', () => {
    if (state.bulkDownload.active) return;
    state.bulkSaveSelectedIds = new Set();
    state.bulkSaveOpen = true;
    ctx.render();
  });
  document.querySelectorAll('[data-close-bulk-save]').forEach(el => {
    el.addEventListener('click', () => {
      state.bulkSaveOpen = false;
      state.bulkSaveSelectedIds = new Set();
      ctx.render();
    });
  });
  document.querySelectorAll('[data-bulk-save-work]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) state.bulkSaveSelectedIds.add(input.dataset.bulkSaveWork);
      else state.bulkSaveSelectedIds.delete(input.dataset.bulkSaveWork);
      const confirm = document.querySelector('[data-confirm-bulk-save]');
      if (confirm) {
        confirm.disabled = state.bulkSaveSelectedIds.size === 0;
        confirm.textContent = t('plan.bulkSaveAction', {count: state.bulkSaveSelectedIds.size}, state.lang);
      }
    });
  });
  document.querySelector('[data-confirm-bulk-save]')?.addEventListener('click', () => {
    const ids = [...state.bulkSaveSelectedIds];
    if (!ids.length) return;
    state.bulkSaveOpen = false;
    state.bulkSaveSelectedIds = new Set();
    void audio.downloadCurrentPlanAudio(ids);
  });

  document.querySelector('[data-open-plan-add]')?.addEventListener('click', () => {
    if (ctx.currentPlan().isShared) return;
    state.bulkSaveOpen = false;
    state.planAddOpen = true;
    state.planAddMode = null;
    state.planAddQuery = '';
    state.planAddSelected = [];
    ctx.render();
    window.scrollTo({top: 0});
  });
  document.querySelector('[data-plan-add-back]')?.addEventListener('click', () => {
    if (state.planAddMode) state.planAddMode = null;
    else state.planAddOpen = false;
    state.planAddQuery = '';
    state.planAddSelected = [];
    ctx.render();
  });
  document.querySelectorAll('[data-plan-add-mode]').forEach(btn => {
    btn.onclick = () => {
      state.planAddMode = btn.dataset.planAddMode;
      state.planAddQuery = '';
      state.planAddSelected = [];
      ctx.render();
    };
  });
  const results = document.querySelector('[data-plan-add-results]');
  const batchHost = document.querySelector('[data-plan-add-batch-host]');
  const screenEl = document.querySelector('[data-plan-add-screen]');
  const hasMini = screenEl?.dataset.hasMini === '1';

  const wireBatchBar = () => {
    document.querySelector('[data-clear-plan-add]')?.addEventListener('click', () => {
      state.planAddSelected = [];
      results?.querySelectorAll('[data-toggle-plan-add].is-selected').forEach(el => {
        el.classList.remove('is-selected');
        el.setAttribute('aria-pressed', 'false');
        const badge = el.querySelector('.plan-add-check');
        if (badge) badge.textContent = t('plan.batchSelectBtn', null, state.lang);
      });
      if (batchHost) batchHost.innerHTML = '';
      screenEl?.classList.remove('has-batch-bar');
    });
    document.querySelector('[data-confirm-plan-add]')?.addEventListener('click', () => {
      const picked = Array.isArray(state.planAddSelected) ? [...state.planAddSelected] : [];
      if (!picked.length) return;
      const ok = state.planAddMode === 'route'
        ? planActions.addWorksToActivePlan(picked)
        : planActions.addOptionalWorksToActivePlan(picked);
      if (!ok) {
        state.planAddSelected = [];
        ctx.setNotice(t('share.alreadyInMyPlanNotice', null, state.lang), false, 3000);
        ctx.render();
      }
    });
  };

  const syncBatchBar = () => {
    if (!batchHost) return;
    const count = (state.planAddSelected || []).length;
    batchHost.innerHTML = planAddBatchBarMarkup(ctx, hasMini);
    screenEl?.classList.toggle('has-batch-bar', count > 0);
    wireBatchBar();
  };

  const wireAddResults = () => results?.querySelectorAll('[data-toggle-plan-add]').forEach(el => {
    const toggle = () => {
      const id = el.dataset.togglePlanAdd;
      if (!id) return;
      const cur = Array.isArray(state.planAddSelected) ? [...state.planAddSelected] : [];
      const idx = cur.indexOf(id);
      const nextPicked = idx < 0;
      if (nextPicked) cur.push(id);
      else cur.splice(idx, 1);
      state.planAddSelected = cur;
      el.classList.toggle('is-selected', nextPicked);
      el.setAttribute('aria-pressed', String(nextPicked));
      const badge = el.querySelector('.plan-add-check');
      if (badge) badge.textContent = t(nextPicked ? 'plan.batchSelectedBtn' : 'plan.batchSelectBtn', null, state.lang);
      syncBatchBar();
    };
    el.onclick = toggle;
    el.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
    };
  });
  wireAddResults();
  wireBatchBar();
  document.querySelector('[data-plan-add-search]')?.addEventListener('input', event => {
    state.planAddQuery = event.target.value;
    if (results) {
      results.innerHTML = planAddResultsMarkup(ctx);
      wireAddResults();
    }
  });

  document.querySelector('[data-copy-active-shared]')?.addEventListener('click', () => planActions.copySharedToMyPlan());
  document.querySelector('[data-optimize-myplan]')?.addEventListener('click', planActions.handleOptimizeMyPlan);
  document.querySelectorAll('[data-promote-optional]').forEach(btn => {
    btn.onclick = () => planActions.addWorkToActivePlan(btn.dataset.promoteOptional);
  });
  document.querySelectorAll('[data-remove-optional]').forEach(btn => {
    btn.onclick = () => planActions.removeOptionalWorkFromActivePlan(btn.dataset.removeOptional);
  });
  document.querySelectorAll('[data-quick-play]').forEach(btn => {
    btn.onclick = event => {
      event.stopPropagation();
      const id = btn.dataset.quickPlay;
      audio.toggleAudio(id, ctx.preferredLengthFor(byId[id]));
    };
  });
  document.querySelectorAll('[data-move-myplan]').forEach(btn => {
    btn.onclick = event => {
      event.stopPropagation();
      planActions.handleMoveMyPlan(btn.dataset.moveMyplan, Number(btn.dataset.delta));
    };
  });
  document.querySelectorAll('[data-remove-myplan]').forEach(btn => {
    btn.onclick = event => {
      event.stopPropagation();
      planActions.handleRemoveMyPlan(btn.dataset.removeMyplan);
    };
  });
}
