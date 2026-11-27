import {audioLengthsFor} from '../catalog.js';
import {hasNativeAudio, localizeWork, t} from '../i18n.js';
import {creatorMeta, esc, formatAudioLengthLabel, formatClock, priorityBadgeMarkup, thumbMarkup} from '../app/ui-helpers.js';

export function openWorkDetail(ctx, workId, roomWorkIds = null) {
  const work = ctx.byId[workId];
  if (!work) return;
  ctx.state.detailWorkId = workId;
  const siblings = Array.isArray(roomWorkIds) && roomWorkIds.length
    ? roomWorkIds.filter(id => ctx.byId[id])
    : ctx.roomWorksFor(work).map(item => item.id);
  ctx.state.detailRoomWorks = siblings.length > 1 ? siblings : [];
  ctx.render({overlayOnly: true});
}

export function closeWorkDetail(ctx, {skipTransition = false} = {}) {
  if (!ctx.state.detailWorkId) return;
  ctx.state.detailWorkId = null;
  ctx.state.detailRoomWorks = [];
  ctx.render({skipTransition, overlayOnly: true});
}

export function workDetailSheetMarkup(ctx) {
  const {state, byId, navigationIndex, sources} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const player = ctx.audio.player;
  const rawWork = state.detailWorkId ? byId[state.detailWorkId] : null;
  if (!rawWork) return '';
  const work = localizeWork(rawWork, lang);
  const plan = ctx.currentPlan();
  const planIdx = plan.ids.indexOf(work.id);
  const lengths = audioLengthsFor(work);
  const length = ctx.preferredLengthFor(work);
  const inMyPlan = state.myPlanIds.includes(work.id);
  const myPlanOrder = inMyPlan ? state.myPlanIds.indexOf(work.id) + 1 : 0;
  const isViewed = state.viewed.has(work.id);
  const isPlaying = state.playing === work.id;
  const isLoaded = state.audio === player
    && state.player.workId === work.id
    && player.dataset?.audioLength === String(length);
  const savedPos = !isLoaded ? ctx.audio.getSavedPosition(work.id, length) : null;
  const duration = isLoaded && Number.isFinite(player.duration) && player.duration > 0
    ? player.duration
    : (savedPos?.duration || length);
  const current = isLoaded && Number.isFinite(player.currentTime)
    ? player.currentTime
    : (savedPos?.time || 0);
  const hasMidPosition = current > 1.5 && duration > 0 && current < duration - 1.5;
  const ratio = duration > 0 ? Math.round((current / duration) * 1000) : 0;
  const pct = (ratio / 10).toFixed(1);
  const playBtnLabel = isPlaying
    ? tr('detail.pauseBtn')
    : hasMidPosition
      ? tr('detail.resumeFromBtn', {time: formatClock(current)})
      : tr('detail.playBtn');
  const hasMap = navigationIndex.nodes.has(`work:${work.id}`);
  const siblings = state.detailRoomWorks.length > 1
    ? state.detailRoomWorks.map(id => byId[id]).filter(Boolean)
    : ctx.roomWorksFor(rawWork);
  const singleGuideLabel = lengths[0] === 60 ? tr('audio.guideOneMin') : tr('audio.guideSec', {sec: lengths[0]});

  return `<div class="sheet-backdrop" data-close-detail></div>
  <section class="work-sheet ${state.largeText ? 'large-text' : ''}" role="dialog" aria-modal="true" aria-label="${esc(tr('detail.dialogAria', {title: work.title}))}">
    <div class="sheet-handle-bar">
      <span class="sheet-grabber" aria-hidden="true"></span>
      <button type="button" class="sheet-close-btn" data-close-detail aria-label="${esc(tr('app.close'))}">${esc(tr('app.closeBtn'))}</button>
    </div>

    ${siblings.length > 1 ? `<div class="room-siblings" aria-label="${esc(tr('detail.siblingsAria'))}">
      <span class="room-siblings-label">${esc(tr('detail.siblingsLabel', {room: work.room, count: siblings.length}))}</span>
      <div class="room-siblings-list">
        ${siblings.map(item => `<button type="button" class="sibling-chip ${item.id === work.id ? 'active' : ''}" data-switch-detail="${esc(item.id)}">${esc(localizeWork(item, lang).title)}</button>`).join('')}
      </div>
    </div>` : ''}

    <article class="work-detail-body">
      <div class="work-hero">
        ${thumbMarkup(ctx, work, 'thumb-hero')}
        <div class="work-hero-copy">
          <h2>${esc(work.title)}</h2>
          <p class="artist">${esc(creatorMeta(work, lang))}</p>
          <div class="hero-badges">
            ${priorityBadgeMarkup(work, lang)}
          </div>
        </div>
      </div>

      <div class="detail-quick-actions">
        <button type="button" class="action-pill action-pill-myplan ${inMyPlan ? 'active' : ''}" data-toggle-myplan="${esc(work.id)}" aria-pressed="${inMyPlan}">${esc(inMyPlan ? tr('detail.inMyPlanOrder', {order: myPlanOrder}) : tr('detail.addMyPlan'))}</button>
        <button type="button" class="action-pill action-pill-done ${isViewed ? 'done' : ''}" data-toggle-viewed="${esc(work.id)}" aria-pressed="${isViewed}">${esc(isViewed ? tr('detail.viewed') : tr('detail.markViewed'))}</button>
        ${hasMap ? `<button type="button" class="action-pill" data-show-map="${esc(work.id)}">${esc(tr('detail.showOnMap'))}</button>` : ''}
      </div>

      <div class="sheet-audio-box sticky-audio-box">
        <div class="sheet-audio-top">
          <h3>${esc(tr('detail.audioTitle'))}</h3>
          ${lengths.length > 1
            ? `<div class="durations">${lengths.map(opt => `<button type="button" class="chip ${length === opt ? 'active' : ''}" data-detail-duration="${opt}" data-detail-work="${esc(work.id)}">${esc(formatAudioLengthLabel(opt, lang))}</button>`).join('')}</div>`
            : `<span class="minor">${esc(tr('audio.guideDuration', {label: singleGuideLabel}))}</span>`}
        </div>
        ${!hasNativeAudio(lang) ? `<p class="audio-lang-note">${esc(tr('audio.jpAudioNote'))}</p>` : ''}
        <div class="sheet-seek-wrap">
          <input type="range" min="0" max="1000" value="${ratio}" style="--seek-pct:${pct}%" data-seek data-seek-work="${esc(work.id)}" aria-label="${esc(tr('detail.seekAria'))}">
          <div class="sheet-time-row">
            <span data-time-current data-time-work="${esc(work.id)}">${formatClock(current)}</span>
            <span data-time-total data-time-work="${esc(work.id)}">${duration > 0 ? formatClock(duration) : '--:--'}</span>
          </div>
        </div>
        <button type="button" class="primary sheet-play-main" data-detail-play="${esc(work.id)}">${esc(playBtnLabel)}</button>
        ${planIdx >= 0 ? `<div class="sheet-player-sub">
            <button type="button" class="secondary compact-btn" data-plan-step="${planIdx - 1}" ${planIdx <= 0 ? 'disabled' : ''}>${esc(tr('detail.prevWork'))}</button>
            <button type="button" class="secondary compact-btn" data-plan-step="${planIdx + 1}" ${planIdx >= plan.ids.length - 1 ? 'disabled' : ''}>${esc(tr('detail.nextWork'))}</button>
          </div>` : ''}
        ${state.audioError ? `<p class="audio-error" role="alert">${esc(state.audioError)}</p>` : ''}
      </div>

      <div class="detail-text-section">
        <h3>${esc(tr('detail.backgroundTitle'))}</h3>
        <p>${esc(work.background)}</p>
        <h3>${esc(tr('detail.lookTitle'))}</h3>
        <p>${esc(work.look)}</p>
      </div>

      <p class="source">${esc(tr('detail.sourceLine'))}<a href="${esc(work.source)}" target="_blank" rel="noreferrer">${esc(tr('detail.officialLink'))}</a>${esc(tr('detail.verifiedAt', {date: work.verifiedAt || sources.checkedAt}))}</p>
    </article>
  </section>`;
}

export function wireWorkDetailSheet(ctx) {
  const {state, byId, audio, planActions} = ctx;

  const sheet = document.querySelector('.work-sheet');
  const backdrop = document.querySelector('.sheet-backdrop[data-close-detail]');
  if (sheet && backdrop) {
    let gesture = null;
    const interactive = target => target instanceof Element
      && Boolean(target.closest('button, a, input, select, textarea, .room-siblings-list'));
    const startGesture = (x, y) => {
      gesture = {x, y, startedAt: Date.now(), dragging: false, distance: 0};
    };
    sheet.addEventListener('touchstart', event => {
      if (event.touches.length !== 1 || interactive(event.target)) return;
      const touch = event.touches[0];
      startGesture(touch.clientX, touch.clientY);
    }, {passive: true});
    const moveGesture = (x, y, event) => {
      if (!gesture) return;
      const dx = x - gesture.x;
      const dy = y - gesture.y;
      if (!gesture.dragging) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { gesture = null; return; }
        if (dy < -8 || sheet.scrollTop > 0) { gesture = null; return; }
        if (dy < 8) return;
        gesture.dragging = true;
        sheet.classList.add('is-dragging');
        backdrop.classList.add('is-dragging');
      }
      event.preventDefault();
      const distance = Math.min(Math.max(dy, 0), sheet.clientHeight);
      gesture.distance = distance;
      sheet.style.transform = `translate(-50%, ${distance}px)`;
      backdrop.style.opacity = String(Math.max(.15, 1 - distance / (sheet.clientHeight * .8)));
    };
    sheet.addEventListener('touchmove', event => {
      if (!gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      moveGesture(touch.clientX, touch.clientY, event);
    }, {passive: false});
    const finishGesture = cancelled => {
      if (!gesture?.dragging) { gesture = null; return; }
      const distance = gesture.distance;
      const elapsed = Math.max(1, Date.now() - gesture.startedAt);
      const dismiss = !cancelled && (distance > Math.min(120, sheet.clientHeight * .25)
        || (distance > 45 && distance / elapsed > .55));
      const workId = state.detailWorkId;
      gesture = null;
      sheet.classList.remove('is-dragging');
      backdrop.classList.remove('is-dragging');
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        if (dismiss) closeWorkDetail(ctx, {skipTransition: true});
        else { sheet.style.transform = ''; backdrop.style.opacity = ''; }
        return;
      }
      sheet.classList.add('is-settling');
      backdrop.classList.add('is-settling');
      sheet.style.transform = dismiss ? 'translate(-50%, 100%)' : '';
      backdrop.style.opacity = dismiss ? '0' : '';
      window.setTimeout(() => {
        if (dismiss && state.detailWorkId === workId) closeWorkDetail(ctx, {skipTransition: true});
        else { sheet.classList.remove('is-settling'); backdrop.classList.remove('is-settling'); }
      }, 220);
    };
    sheet.addEventListener('touchend', () => finishGesture(false));
    sheet.addEventListener('touchcancel', () => finishGesture(true));
    sheet.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.button !== 0 || interactive(event.target)) return;
      startGesture(event.clientX, event.clientY);
      sheet.setPointerCapture(event.pointerId);
    });
    sheet.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch') moveGesture(event.clientX, event.clientY, event);
    });
    sheet.addEventListener('pointerup', event => {
      if (event.pointerType !== 'touch') finishGesture(false);
    });
    sheet.addEventListener('pointercancel', event => {
      if (event.pointerType !== 'touch') finishGesture(true);
    });
  }

  document.querySelectorAll('[data-close-detail]').forEach(el => {
    el.onclick = () => closeWorkDetail(ctx);
  });
  document.querySelectorAll('[data-switch-detail]').forEach(btn => {
    btn.onclick = () => {
      state.detailWorkId = btn.dataset.switchDetail;
      ctx.render();
    };
  });
  document.querySelectorAll('[data-detail-duration]').forEach(btn => {
    btn.onclick = () => {
      const workId = btn.dataset.detailWork;
      const length = Number(btn.dataset.detailDuration);
      if (state.audio === audio.player && state.player.workId === workId) {
        audio.saveCurrentPosition({persist: true});
      }
      state.duration = length;
      state.audioDurations[workId] = length;
      ctx.persistState();
      if (state.playing === workId) audio.toggleAudio(workId, length);
      else ctx.render();
    };
  });
  document.querySelectorAll('[data-detail-play]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.detailPlay;
      audio.toggleAudio(id, ctx.preferredLengthFor(byId[id]));
    };
  });
  document.querySelectorAll('[data-plan-step]').forEach(btn => {
    btn.onclick = () => {
      const nextIndex = Number(btn.dataset.planStep);
      const ids = ctx.currentPlan().ids;
      if (nextIndex < 0 || nextIndex >= ids.length) return;
      const nextId = ids[nextIndex];
      planActions.selectRouteWork(nextId, {focusFloor: false});
      state.detailWorkId = nextId;
      state.detailRoomWorks = [];
      ctx.render();
    };
  });
}
