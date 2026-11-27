import {DEFAULT_DURATIONS, PLAYBACK_RATES} from '../app-config.js';
import {localizeWork, t} from '../i18n.js';
import {creatorMeta, esc, formatAudioLengthLabel, formatClock, formatRate, thumbMarkup} from '../app/ui-helpers.js';

export function miniPlayerMarkup(ctx) {
  const {state, audio} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const player = audio.player;
  const mini = audio.miniPlayerContext();
  if (!mini) return '';
  const {work: rawWork, prevId, nextId, isLastInPlan} = mini;
  const work = localizeWork(rawWork, lang);
  const isPlaying = state.playing === work.id;
  const isLoaded = state.audio === player
    && state.player.workId === work.id
    && Number.isFinite(player.duration) && player.duration > 0;
  const savedPos = !isLoaded ? audio.getSavedPosition(work.id) : null;
  const duration = isLoaded ? player.duration : (savedPos?.duration || ctx.preferredLengthFor(rawWork));
  const current = isLoaded && Number.isFinite(player.currentTime) ? player.currentTime : (savedPos?.time || 0);
  const ratio = duration > 0 ? Math.round((current / duration) * 1000) : 0;
  const pct = (ratio / 10).toFixed(1);
  return `<aside class="mini-player spotify-bar" aria-label="${esc(tr('mini.aria'))}">
    <div class="mini-progress-wrap">
      <input class="mini-seek" type="range" min="0" max="1000" value="${ratio}" style="--seek-pct:${pct}%" data-seek data-seek-work="${esc(work.id)}" aria-label="${esc(tr('detail.seekAria'))}">
    </div>
    <div class="mini-player-row">
      <button type="button" class="mini-info" data-open-detail="${esc(work.id)}">
        ${thumbMarkup(ctx, work, 'thumb-mini')}
        <span class="mini-copy">
          <strong>${esc(work.title)}</strong>
          <small>${esc(creatorMeta(work, lang))}</small>
          <span class="mini-time-line"><span data-time-current data-time-work="${esc(work.id)}">${formatClock(current)}</span> / <span data-time-total data-time-work="${esc(work.id)}">${duration > 0 ? formatClock(duration) : '--:--'}</span></span>
        </span>
      </button>
      <div class="mini-controls" aria-label="${esc(tr('mini.controlsAria'))}">
        <button type="button" class="mini-ctrl-btn" data-mini-prev aria-label="${esc(tr('mini.prevAria'))}" title="${esc(tr('mini.prevTitle'))}" ${!prevId ? 'disabled' : ''}>⏮</button>
        <button type="button" class="mini-play-btn ${isPlaying ? 'active' : ''}" data-mini-play="${esc(work.id)}" aria-label="${esc(isPlaying ? tr('catalog.pauseAria') : tr('catalog.playAria'))}" title="${esc(isPlaying ? tr('catalog.pauseAria') : tr('catalog.playAria'))}">${isPlaying ? '⏸' : '▶'}</button>
        <button type="button" class="mini-ctrl-btn" data-mini-next aria-label="${esc(isLastInPlan ? tr('mini.nextLastAria') : tr('mini.nextAria'))}" title="${esc(isLastInPlan ? tr('mini.nextLastTitle') : tr('mini.nextTitle'))}" ${!nextId && !isLastInPlan ? 'disabled' : ''}>⏭</button>
        <span class="mini-divider" aria-hidden="true"></span>
        <button type="button" class="mini-close-btn" data-mini-close aria-label="${esc(tr('mini.closeAria'))}" title="${esc(tr('mini.closeAria'))}">✕</button>
      </div>
    </div>
  </aside>`;
}

export function audioSettingsModalMarkup(ctx) {
  const {state} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  if (!state.audioSettingsOpen) return '';
  return `<div class="sheet-backdrop" data-close-audio-settings></div>
  <section class="audio-settings-sheet" role="dialog" aria-modal="true" aria-label="${esc(tr('mini.settingsTitle'))}">
    <div class="sheet-handle-bar">
      <h2>${esc(tr('mini.settingsTitle'))}</h2>
      <button type="button" class="sheet-close-btn" data-close-audio-settings aria-label="${esc(tr('app.close'))}">${esc(tr('app.closeBtn'))}</button>
    </div>
    <div class="audio-setting-block">
      <div class="audio-setting-head">
        <strong>${esc(tr('mini.speedTitle'))}</strong>
        <span class="rate-value-badge" data-rate-readout>${formatRate(state.playbackRate)}</span>
      </div>
      <input class="rate-slider" type="range" min="0.5" max="2" step="0.05" value="${state.playbackRate}" data-rate-slider aria-label="${esc(tr('mini.speedSliderAria'))}">
      <div class="rate-slider-scale"><span>${esc(tr('mini.speedSlow'))}</span><span>${esc(tr('mini.speedNormal'))}</span><span>${esc(tr('mini.speedFast'))}</span></div>
      <div class="rate-chips">
        ${PLAYBACK_RATES.map(r => `<button type="button" class="chip ${Math.abs(state.playbackRate - r) < 0.01 ? 'active' : ''}" data-set-rate="${r}">${r}x</button>`).join('')}
      </div>
    </div>
    <div class="audio-setting-block audio-setting-inline">
      <div>
        <strong>${esc(tr('mini.autoPlayTitle'))}</strong>
        <small>${esc(tr('mini.autoPlaySub'))}</small>
      </div>
      <button type="button" class="chip ${state.autoPlayNext ? 'active' : ''}" data-toggle-autoplay aria-pressed="${state.autoPlayNext}">${state.autoPlayNext ? 'ON' : 'OFF'}</button>
    </div>
    <div class="audio-setting-block audio-setting-inline">
      <div>
        <strong>${esc(tr('mini.textSizeTitle'))}</strong>
        <small>${esc(tr('mini.textSizeSub'))}</small>
      </div>
      <div class="rate-chips">
        <button type="button" class="chip ${!state.largeText ? 'active' : ''}" data-set-large-text="false">${esc(tr('mini.textNormal'))}</button>
        <button type="button" class="chip ${state.largeText ? 'active' : ''}" data-set-large-text="true">${esc(tr('mini.textLarge'))}</button>
      </div>
    </div>
    <div class="audio-setting-block">
      <div class="audio-setting-head">
        <strong>${esc(tr('mini.defaultDurTitle'))}</strong>
      </div>
      <div class="rate-chips">
        ${DEFAULT_DURATIONS.map(d => `<button type="button" class="chip ${state.duration === d ? 'active' : ''}" data-default-duration="${d}">${esc(formatAudioLengthLabel(d, lang))}</button>`).join('')}
      </div>
    </div>
  </section>`;
}

export function wireMiniPlayer(ctx, root = document) {
  const {state, byId, audio} = ctx;
  const player = audio.player;

  root.querySelectorAll('[data-mini-play]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.miniPlay;
      audio.toggleAudio(id, ctx.preferredLengthFor(byId[id]));
    };
  });
  root.querySelector('[data-mini-prev]')?.addEventListener('click', () => audio.stepMiniPlayer(-1));
  root.querySelector('[data-mini-next]')?.addEventListener('click', () => audio.stepMiniPlayer(1));
  root.querySelector('[data-mini-close]')?.addEventListener('click', audio.closeMiniPlayer);
  root.querySelectorAll('[data-seek]').forEach(input => {
    const updateVisual = val => {
      const ratio = Number(val) / 1000;
      input.style.setProperty('--seek-pct', `${(ratio * 100).toFixed(1)}%`);
      const workId = input.dataset.seekWork || state.player.workId;
      const length = workId && byId[workId] ? ctx.preferredLengthFor(byId[workId]) : state.duration;
      const isLoaded = state.audio === player
        && state.player.workId === workId
        && player.dataset?.audioLength === String(length)
        && Number.isFinite(player.duration) && player.duration > 0;
      const estDur = isLoaded ? player.duration : length;
      document.querySelectorAll('[data-time-current]').forEach(el => {
        if (!workId || el.dataset.timeWork === workId) el.textContent = formatClock(estDur * ratio);
      });
    };
    input.addEventListener('input', event => {
      updateVisual(event.target.value);
    });
    input.addEventListener('change', event => {
      const workId = input.dataset.seekWork || state.player.workId;
      const ratio = Number(event.target.value) / 1000;
      audio.seekToRatio(workId, ratio, {autoPlay: true});
    });
  });
}

export function wireAudioSettingsModal(ctx, root = document) {
  const {state, audio} = ctx;

  root.querySelectorAll('[data-open-audio-settings]').forEach(btn => {
    btn.onclick = () => {
      state.audioSettingsOpen = true;
      ctx.render({overlayOnly: true});
    };
  });
  root.querySelectorAll('[data-close-audio-settings]').forEach(el => {
    el.onclick = () => {
      state.audioSettingsOpen = false;
      ctx.render({overlayOnly: true});
    };
  });
  root.querySelector('[data-rate-slider]')?.addEventListener('input', event => {
    audio.setPlaybackRate(Number(event.target.value), {rerender: false});
  });
  root.querySelectorAll('[data-toggle-autoplay]').forEach(btn => {
    btn.onclick = () => {
      state.autoPlayNext = !state.autoPlayNext;
      ctx.persistState();
      ctx.render();
    };
  });
  root.querySelectorAll('[data-set-large-text]').forEach(btn => {
    btn.onclick = () => {
      state.largeText = btn.dataset.setLargeText === 'true';
      ctx.persistState();
      ctx.render();
    };
  });
  root.querySelectorAll('[data-set-rate]').forEach(btn => {
    btn.onclick = () => audio.setPlaybackRate(Number(btn.dataset.setRate));
  });
  root.querySelectorAll('[data-default-duration]').forEach(btn => {
    btn.onclick = () => {
      state.duration = Number(btn.dataset.defaultDuration);
      ctx.persistState();
      ctx.render();
    };
  });
}
