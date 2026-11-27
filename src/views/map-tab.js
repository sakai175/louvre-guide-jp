import {FLOORS} from '../app-config.js';
import {floorMapMarkup, wireFloorMap} from '../floor-map.js';
import {floorGeoData} from '../floor-map-geo.js';
import {getFloorName, localizeWork, t} from '../i18n.js';
import {esc, workStatus} from '../app/ui-helpers.js';

export function navigationPanel(ctx, view, plan) {
  const {works, byId, state} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  if (!plan.routableIds.length) {
    return `<section class="route-guidance route-empty">
      <div><span class="guidance-label">${esc(tr('map.emptyTitle'))}</span><strong>${esc(tr('map.emptyStrong'))}</strong></div>
      <p>${esc(tr('map.emptyBody'))}</p>
      <button class="secondary compact-btn" type="button" data-go-audio-mapped>${esc(tr('map.emptyBtn', {count: works.filter(w => w.locationPrecision === 'room').length}))}</button>
    </section>`;
  }
  if (!view.available) {
    return `<section class="route-guidance route-unavailable" role="status">
      <div><span class="guidance-label">${esc(tr('map.routeUnavailable'))}</span><strong>${esc(view.reason)}</strong></div>
      <p>${esc(tr('map.routeUnavailableBody'))}</p>
    </section>`;
  }
  const locationLabel = view.locationMethod === 'selection'
    ? tr('svg.locSelection')
    : ['audio', 'manual'].includes(view.locationMethod)
      ? tr('svg.locEstimated')
      : tr('svg.locLastConfirmed');
  if (view.complete) {
    return `<section class="route-guidance route-complete" aria-label="${esc(tr('map.completeAria'))}">
      <div class="guidance-points">
        <div><span class="guidance-label">${esc(locationLabel)}</span><strong><i class="current-symbol"></i>${esc(view.currentNode.label)}</strong></div>
        <span class="guidance-arrow" aria-hidden="true">✓</span>
        <div><span class="guidance-label">${esc(tr('map.progressLabel'))}</span><strong class="destination-name">${esc(tr('map.completeLead'))}</strong></div>
      </div>
      <p class="next-action"><span>${esc(tr('map.completeThanks'))}</span>${esc(tr('map.completeThanksBody'))}</p>
    </section>`;
  }
  const rawDestWork = byId[view.destinationNode.workId];
  const destinationWork = rawDestWork ? localizeWork(rawDestWork, lang) : null;
  const transition = view.transitions[0];
  const estimates = ctx.currentEstimates();
  const destEst = destinationWork ? estimates[destinationWork.id] : null;
  return `<section class="route-guidance" aria-label="${esc(tr('map.guidanceAria'))}">
    <div class="guidance-points">
      <div>
        <span class="guidance-label">${esc(locationLabel)}</span>
        <strong><i class="current-symbol"></i>${esc(view.currentNode.label)}</strong>
      </div>
      <span class="guidance-arrow" aria-hidden="true">→</span>
      <button class="guidance-dest-btn" type="button" data-open-detail="${esc(destinationWork?.id || '')}">
        <span class="guidance-label">${esc(tr('map.nextDestLabel'))}</span>
        <strong class="destination-name">${esc(destinationWork?.title ?? view.destinationNode.label)}</strong>
        <small>${destinationWork ? esc(workStatus(destinationWork, lang)) : ''}${destEst ? ` · ${esc(destEst.elapsedLabel)}` : ''}</small>
      </button>
    </div>
    <p class="next-action"><span>${esc(tr('map.nextActionLabel'))}</span>${esc(view.nextAction)}</p>
    ${transition ? `<p class="transition-summary">${transition.to.floor > transition.from.floor ? '↑' : '↓'} ${esc(transition.message)}</p>` : ''}
  </section>`;
}

export function movementSupportMarkup(ctx) {
  const support = ctx.state.support;
  const lang = ctx.state.lang;
  const tr = (key, params) => t(key, params, lang);
  const candidates = support.candidates.length
    ? `<fieldset class="room-candidates">
        <legend>${esc(support.candidates.length > 1 ? tr('map.selectCandidateLegend') : tr('map.confirmRoomLegend'))}</legend>
        ${support.candidates.map(candidate => `<label><input type="radio" name="room-candidate" value="${esc(candidate.nodeId)}" ${support.selectedCandidateId === candidate.nodeId ? 'checked' : ''}><span><strong>${esc(tr('location.room', {room: candidate.room}))}</strong><small>${esc(candidate.wingLabel || candidate.wing)} · ${esc(candidate.floorLabel)}</small></span></label>`).join('')}
      </fieldset>
      <button class="primary confirm-location" type="button" data-confirm-location>${esc(tr('map.confirmLocationBtn'))}</button>`
    : '';
  const editor = support.editing
    ? `<form class="room-correction-form" data-room-search novalidate>
        <label for="room-number">${esc(tr('map.roomLabel'))}</label>
        <div class="room-input-row">
          <input id="room-number" name="room" inputmode="numeric" autocomplete="off" value="${esc(support.room)}" placeholder="${esc(tr('map.roomPlaceholder'))}" aria-describedby="room-help room-error">
          <button class="secondary" type="submit">${esc(tr('map.checkCandidates'))}</button>
        </div>
        <small id="room-help">${esc(tr('map.roomHelp'))}</small>
        ${support.error ? `<p class="room-error" id="room-error" role="alert">${esc(support.error)}</p>` : ''}
        ${candidates}
      </form>`
    : '';
  return `<details class="movement-support" ${support.open ? 'open' : ''}>
    <summary>${esc(tr('map.supportSummary'))}</summary>
    <div class="movement-support-body">
      <button class="location-correction-trigger" type="button" data-edit-location>
        <span>${esc(tr('map.editLocationTitle'))}</span>
        <small>${esc(tr('map.editLocationSub'))}</small>
      </button>
      ${editor}
    </div>
  </details>`;
}

export function mapTabView(ctx, hasMini) {
  const {state, works, navigationGraph} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const plan = ctx.currentPlan();
  const mapPlanLabel = plan.kind === 'time' && plan.minutes
    ? tr('routes.fallback.label', {minutes: plan.minutes})
    : plan.label;
  const nav = ctx.navigationView();
  const destinationId = nav.destinationNode?.workId ?? null;
  const destinationFloor = !nav.complete && Number.isFinite(nav.destinationNode?.floor)
    ? nav.destinationNode.floor
    : null;
  const floorWorkCounts = Object.fromEntries(FLOORS.map(f => {
    const anchors = floorGeoData.floors[String(f)]?.roomAnchors || {};
    return [f, works.filter(w => w.floor === f && w.locationPrecision === 'room' && Boolean(anchors[String(w.room)])).length];
  }));
  const viewedInPlan = ctx.planWorks().filter(w => state.viewed.has(w.id)).length;
  const planTotal = plan.ids.length;
  const planPct = planTotal ? Math.round((viewedInPlan / planTotal) * 100) : 0;
  const destWork = destinationId && ctx.byId?.[destinationId] ? localizeWork(ctx.byId[destinationId], lang) : null;
  const currentFloorGeo = floorGeoData.floors[String(state.floor)];
  const wcCount = (currentFloorGeo?.facilities || []).filter(item => item.type === 'wc').length;
  const cafeCount = (currentFloorGeo?.facilities || []).filter(item => item.type === 'cafe').length;
  const emptyOrCompleteNote = !plan.routableIds.length
    ? `<section class="route-guidance route-empty">
        <div><span class="guidance-label">${esc(tr('map.emptyTitle'))}</span><strong>${esc(tr('map.emptyStrong'))}</strong></div>
        <p>${esc(tr('map.emptyBody'))}</p>
        <button class="secondary compact-btn" type="button" data-go-audio-mapped>${esc(tr('map.emptyBtn', {count: works.filter(w => w.locationPrecision === 'room').length}))}</button>
      </section>`
    : nav.complete
      ? `<section class="route-guidance route-complete" aria-label="${esc(tr('map.completeAria'))}">
          <p class="next-action"><span>${esc(tr('map.completeLead'))}</span>${esc(tr('map.completeBody'))}</p>
        </section>`
      : '';

  return `<main class="tab-screen map-screen ${hasMini ? 'has-mini-player' : ''}">
    <div class="map-frame">
      <div class="map-scroll">
        ${floorMapMarkup({
          floor: state.floor,
          floorLabel: getFloorName(state.floor, lang),
          works,
          selectedId: destinationId,
          navigation: nav,
          roomNotices: navigationGraph.roomNotices,
          routeWorkIds: plan.routableIds,
          viewedIds: state.viewed,
          facilityFilter: state.facilityFilter,
          lang
        })}
      </div>
      <div class="map-controls" aria-label="${esc(tr('map.controlsAria'))}">
        <button type="button" data-map-action="in" aria-label="${esc(tr('map.zoomInAria'))}">＋</button>
        <output data-map-status aria-live="polite">100%</output>
        <button type="button" data-map-action="out" aria-label="${esc(tr('map.zoomOutAria'))}">−</button>
        <button type="button" data-map-action="reset">${esc(tr('map.resetBtn'))}</button>
      </div>
    </div>

    <div class="floor-tabs map-floor-tabs-below" role="tablist" aria-label="${esc(tr('map.floorTabsAria'))}">
      ${FLOORS.map(floor => {
        const hasRoute = nav.routeFloors?.includes(floor);
        const isDestinationFloor = destinationFloor === floor;
        const count = floorWorkCounts[floor];
        const floorLabel = getFloorName(floor, lang);
        const ariaLabel = isDestinationFloor
          ? tr('map.floorHasNextAria', {floor: floorLabel})
          : floorLabel;
        return `<button type="button" data-floor="${floor}"${isDestinationFloor ? ' data-destination-floor="true"' : ''} class="${floor === state.floor ? 'active' : ''} ${hasRoute ? 'has-route' : ''} ${isDestinationFloor ? 'has-destination' : ''}" aria-pressed="${floor === state.floor}" aria-label="${esc(ariaLabel)}">
          ${isDestinationFloor ? `<em class="floor-next-badge">${esc(tr('map.nextWorkBadge'))}</em>` : ''}
          <span>${esc(floorLabel)}</span>
          ${count ? `<small>${esc(tr('map.floorWorksShort', {count}))}</small>` : ''}
          ${hasRoute && !isDestinationFloor ? '<i aria-hidden="true"></i>' : ''}
        </button>`;
      }).join('')}
    </div>

    <div class="map-subbar" aria-label="${esc(tr('map.subbarAria'))}">
      <div class="map-subtabs" role="tablist" aria-label="${esc(tr('map.facilityAria'))}">
        <button type="button" class="${state.facilityFilter === 'none' ? 'active' : ''}" data-facility-filter="none">${esc(tr('map.showWorks'))}</button>
        <button type="button" class="${state.facilityFilter === 'wc' ? 'active' : ''}" data-facility-filter="wc">${esc(tr('map.wcFilter', {count: wcCount}))}</button>
        <button type="button" class="${state.facilityFilter === 'cafe' ? 'active' : ''}" data-facility-filter="cafe">${esc(tr('map.cafeFilter', {count: cafeCount}))}</button>
      </div>
      <div class="route-mode-subtoggle" role="group" aria-label="${esc(tr('map.routeModeAria'))}">
        <button type="button" class="${!state.preferElevator ? 'active' : ''}" data-prefer-elevator="false">${esc(tr('course.shortest'))}</button>
        <button type="button" class="${state.preferElevator ? 'active' : ''}" data-prefer-elevator="true">${esc(tr('course.elevatorShort'))}</button>
      </div>
    </div>

    <div class="map-toolbar map-toolbar-below">
      <div class="map-toolbar-meta">
        <div class="map-toolbar-head">
          <strong>${esc(mapPlanLabel)}</strong>
          <span class="map-toolbar-pct">${esc(tr('map.viewedCount', {viewed: viewedInPlan, total: planTotal}))}${planTotal ? ` (${planPct}%)` : ''}</span>
        </div>
        ${planTotal ? `<div class="map-mini-progress" aria-hidden="true"><span style="width:${planPct}%"></span></div>` : ''}
      </div>
      <div class="map-toolbar-actions">
        ${destWork && !state.viewed.has(destWork.id) ? `<button type="button" class="done-quick-cta map-done-cta" data-toggle-viewed="${esc(destWork.id)}" title="${esc(destWork.title)}">${esc(tr('plan.markDoneCta'))}</button>` : ''}
        <button type="button" class="pill-action-btn" data-open-plan>${esc(tr('map.openPlan'))}</button>
      </div>
    </div>

    ${emptyOrCompleteNote}
    ${state.facilityFilter === 'wc' && wcCount === 0 ? `<p class="map-tip">${esc(tr('map.noWcTip'))}</p>` : state.facilityFilter === 'cafe' && cafeCount === 0 ? `<p class="map-tip">${esc(tr('map.noCafeTip'))}</p>` : ''}
    ${movementSupportMarkup(ctx)}
  </main>`;
}

export function wireMapTab(ctx) {
  const {state, planActions} = ctx;

  document.querySelectorAll('[data-facility-filter]').forEach(btn => {
    btn.onclick = () => {
      state.facilityFilter = btn.dataset.facilityFilter;
      ctx.render();
    };
  });
  document.querySelectorAll('[data-open-plan]').forEach(btn => {
    btn.onclick = () => {
      state.tab = 'plan';
      state.detailWorkId = null;
      ctx.persistState();
      window.scrollTo(0, 0);
      ctx.render();
    };
  });

  document.querySelectorAll('button[data-floor]').forEach(btn => {
    btn.onclick = () => {
      state.floor = Number(btn.dataset.floor);
      ctx.persistState();
      ctx.render();
    };
  });

  const supportDetails = document.querySelector('.movement-support');
  if (supportDetails) supportDetails.ontoggle = () => { state.support.open = supportDetails.open; };
  document.querySelectorAll('[data-edit-location]').forEach(btn => {
    btn.onclick = () => {
      state.support.open = true;
      state.support.editing = true;
      state.support.error = '';
      ctx.render();
      document.querySelector('#room-number')?.focus();
    };
  });
  document.querySelectorAll('[data-room-search]').forEach(form => {
    form.onsubmit = event => {
      event.preventDefault();
      planActions.lookupRoom(new FormData(form).get('room'));
    };
  });
  document.querySelectorAll('[name="room-candidate"]').forEach(input => {
    input.onchange = () => {
      state.support.selectedCandidateId = input.value;
      state.support.error = '';
      document.querySelector('.room-error')?.remove();
    };
  });
  document.querySelectorAll('[data-confirm-location]').forEach(btn => {
    btn.onclick = planActions.confirmLocationCorrection;
  });

  wireFloorMap({
    onWorkSelect: (id, roomWorkIds) => {
      ctx.openWorkDetail(id, roomWorkIds);
    }
  });
}
