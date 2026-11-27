import {DEFAULT_DURATIONS, PLAYBACK_RATES} from '../app-config.js';
import {navigationStateFromRoute} from '../navigation.js';
import {SUPPORTED_LANGS, t} from '../i18n.js';
import {esc, formatAudioLengthLabel, formatRate} from '../app/ui-helpers.js';
import {startOnboardingTour} from './onboarding-tour.js';

export function settingsTabView(ctx, hasMini) {
  const {state, sources, imageCredits} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const plan = ctx.currentPlan();
  const items = ctx.planWorks();
  const allSaved = items.length > 0 && items.every(w => state.downloaded.has(`${w.id}-${ctx.preferredLengthFor(w)}`));
  const saveBtnText = state.bulkDownload.active
    ? tr('plan.savingBulk', {done: state.bulkDownload.done, total: state.bulkDownload.total})
    : allSaved
      ? tr('settings.allSaved')
      : tr('settings.bulkSaveBtn', {label: plan.label, count: items.length});

  const auth = state.auth;
  const authStatusText = auth.status === 'syncing'
    ? tr('auth.syncSyncing')
    : auth.status === 'error'
      ? tr('auth.syncError')
      : auth.pending
        ? tr('auth.syncPending')
        : tr('auth.syncIdle');
  const accountCard = `<section class="settings-card account-sync-card" aria-label="${esc(tr('auth.sectionTitle'))}">
      <h2>${esc(tr('auth.sectionTitle'))}</h2>
      <p class="account-note">${esc(tr('auth.guestNote'))}</p>
      ${!auth.configured
        ? `<p class="account-status-muted">${esc(tr('auth.notConfigured'))}</p>`
        : auth.user
          ? `<div class="setting-row">
              <div>
                <strong>${esc(tr('auth.signedInAs', {email: auth.user.email || auth.user.id}))}</strong>
                <small>${esc(authStatusText)}</small>
              </div>
              <div class="setting-actions">
                <button type="button" class="primary compact-btn" data-sync-now ${auth.status === 'syncing' || state.offline ? 'disabled' : ''}>${esc(tr('auth.syncNowBtn'))}</button>
                <button type="button" class="secondary compact-btn" data-sign-out>${esc(tr('auth.signOutBtn'))}</button>
              </div>
            </div>`
          : `<div class="account-login-box">
              <button type="button" class="primary compact-btn" data-signin-google>${esc(tr('auth.googleBtn'))}</button>
              <form class="auth-email-form" data-signin-email novalidate>
                <label for="auth-email">${esc(tr('auth.emailLabel'))}</label>
                <div class="room-input-row">
                  <input id="auth-email" name="email" type="email" autocomplete="email" value="${esc(auth.emailDraft)}" placeholder="${esc(tr('auth.emailPlaceholder'))}">
                  <button type="submit" class="secondary compact-btn" ${auth.status === 'sending' ? 'disabled' : ''}>${esc(auth.status === 'sending' ? tr('auth.sendingLink') : tr('auth.sendLinkBtn'))}</button>
                </div>
              </form>
              ${auth.message ? `<p class="auth-msg-ok" role="status">${esc(auth.message)}</p>` : ''}
              ${auth.error ? `<p class="room-error" role="alert">${esc(auth.error)}</p>` : ''}
            </div>`}
    </section>`;

  return `<main class="tab-screen other-page ${hasMini ? 'has-mini-player' : ''}">
    <div class="eyebrow">${esc(tr('settings.eyebrow'))}</div>
    <h1>${esc(tr('settings.title'))}</h1>
    <p class="information-lead">${esc(tr('settings.lead'))}</p>

    ${accountCard}

    <section class="settings-card">
      <h2>${esc(tr('settings.cardTitle'))}</h2>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('app.language'))}</strong>
          <small>${esc(tr('app.languageDesc'))}</small>
        </div>
        <div class="rate-chips" role="group" aria-label="${esc(tr('app.language'))}">
          ${SUPPORTED_LANGS.map(item => `<button type="button" class="chip ${lang === item.code ? 'active' : ''}" data-set-lang="${item.code}" aria-pressed="${lang === item.code}">${esc(item.label)}</button>`).join('')}
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('settings.cacheTitle'))}</strong>
          <small>${esc(tr('settings.cacheCount', {count: state.downloaded.size}))}</small>
        </div>
        <div class="setting-actions">
          <button type="button" class="primary compact-btn" data-bulk-download ${!items.length || state.bulkDownload.active || allSaved ? 'disabled' : ''}>${esc(saveBtnText)}</button>
          ${state.downloaded.size ? `<button type="button" class="secondary compact-btn" data-clear-cache>${esc(tr('settings.clearCacheBtn'))}</button>` : ''}
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('course.routePrefLabel'))}</strong>
          <small>${esc(tr('settings.routePrefSub'))}</small>
        </div>
        <div class="route-mode-subtoggle">
          <button type="button" class="${!state.preferElevator ? 'active' : ''}" data-prefer-elevator="false">${esc(tr('course.shortest'))}</button>
          <button type="button" class="${state.preferElevator ? 'active' : ''}" data-prefer-elevator="true">${esc(tr('course.elevatorShort'))}</button>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('settings.speedTitlePrefix'))}<span data-rate-readout>${formatRate(state.playbackRate)}</span>${esc(tr('settings.speedTitleSuffix'))}</strong>
          <small>${esc(tr('settings.speedSub'))}</small>
        </div>
        <div class="rate-chips">
          ${PLAYBACK_RATES.map(r => `<button type="button" class="chip ${Math.abs(state.playbackRate - r) < 0.01 ? 'active' : ''}" data-set-rate="${r}">${r}x</button>`).join('')}
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('mini.autoPlayTitle'))}</strong>
          <small>${esc(tr('settings.autoPlaySub'))}</small>
        </div>
        <button type="button" class="chip ${state.autoPlayNext ? 'active' : ''}" data-toggle-autoplay aria-pressed="${state.autoPlayNext}">${state.autoPlayNext ? 'ON' : 'OFF'}</button>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('mini.textSizeTitle'))}</strong>
          <small>${esc(tr('settings.textSizeSub'))}</small>
        </div>
        <div class="rate-chips">
          <button type="button" class="chip ${!state.largeText ? 'active' : ''}" data-set-large-text="false">${esc(tr('mini.textNormal'))}</button>
          <button type="button" class="chip ${state.largeText ? 'active' : ''}" data-set-large-text="true">${esc(tr('mini.textLarge'))}</button>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('settings.defaultDurTitle'))}</strong>
          <small>${esc(tr('settings.defaultDurSub'))}</small>
        </div>
        <div class="rate-chips">
          ${DEFAULT_DURATIONS.map(d => `<button type="button" class="chip ${state.duration === d ? 'active' : ''}" data-default-duration="${d}">${esc(formatAudioLengthLabel(d, lang))}</button>`).join('')}
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('tour.replayTitle'))}</strong>
          <small>${esc(tr('tour.replaySub'))}</small>
        </div>
        <button type="button" class="secondary compact-btn" data-replay-onboarding>${esc(tr('tour.replayBtn'))}</button>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('settings.resetTitle'))}</strong>
          <small>${esc(tr('settings.resetSub'))}</small>
        </div>
        <button type="button" class="secondary compact-btn" data-reset-progress>${esc(tr('settings.resetBtn'))}</button>
      </div>
      <div class="setting-row">
        <div>
          <strong>${esc(tr('settings.refreshCacheTitle'))}</strong>
          <small>${esc(tr('settings.refreshCacheSub'))}</small>
        </div>
        <button type="button" class="secondary compact-btn" data-force-refresh-app>${esc(tr('settings.refreshCacheBtn'))}</button>
      </div>
    </section>

    <section class="visit-note">
      <h2>${esc(tr('settings.infoTitle'))}</h2>
      <ul class="information-list">
        <li><strong>${esc(tr('settings.infoLocLabel'))}</strong><span>${esc(tr('settings.infoLocBody'))}</span></li>
        <li><strong>${esc(tr('settings.infoDateLabel'))}</strong><span>${esc(tr('settings.infoDateBody', {date: sources.checkedAt}))}</span></li>
        <li><strong>${esc(tr('settings.infoMapLabel'))}</strong><a href="${esc(sources.officialMap)}" target="_blank" rel="noreferrer">${esc(tr('settings.infoMapLink'))}</a></li>
        <li><strong>${esc(tr('settings.infoPlanLabel'))}</strong><a href="${esc(sources.collectionsPlan || 'https://collections.louvre.fr/en/plan')}" target="_blank" rel="noreferrer">${esc(tr('settings.infoPlanLink'))}</a></li>
        <li><strong>${esc(tr('settings.infoDbLabel'))}</strong><a href="${esc(sources.collections || 'https://collections.louvre.fr/')}" target="_blank" rel="noreferrer">${esc(tr('settings.infoDbLink'))}</a></li>
        <li><strong>${esc(tr('settings.infoAvailLabel'))}</strong><a href="${esc(sources.availability)}" target="_blank" rel="noreferrer">${esc(tr('settings.infoAvailLink'))}</a></li>
        <li><strong>${esc(tr('settings.infoServiceLabel'))}</strong><span>${esc(tr('settings.infoServiceBody'))}</span></li>
      </ul>
    </section>

    <section class="data-scope">
      <h2>${esc(tr('settings.scopeTitle'))}</h2>
      <p>${esc(tr('settings.scopeBody'))}</p>
      <details class="image-credits">
        <summary>${esc(tr('settings.creditsSummary', {count: imageCredits.length}))}</summary>
        ${imageCredits.map(c => `<p>${esc(c.file)} · ${esc(c.artist.replace(/<[^>]*>/g, ''))} · ${esc(c.license)} <a target="_blank" rel="noreferrer" href="https://commons.wikimedia.org/wiki/${encodeURIComponent(c.file)}">${esc(tr('settings.creditSource'))}</a></p>`).join('')}
      </details>
    </section>
  </main>`;
}

export function wireSettingsTab(ctx) {
  const {state, navigationIndex, audio, cloudSync} = ctx;

  document.querySelector('[data-signin-google]')?.addEventListener('click', () => cloudSync?.signInWithGoogle());
  document.querySelector('[data-signin-email]')?.addEventListener('submit', event => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    cloudSync?.signInWithEmail(email);
  });
  document.querySelector('[data-sync-now]')?.addEventListener('click', () => cloudSync?.syncNow({silent: false}));
  document.querySelector('[data-sign-out]')?.addEventListener('click', () => cloudSync?.signOut());
  document.querySelector('[data-clear-cache]')?.addEventListener('click', audio.clearAudioCache);
  document.querySelector('[data-replay-onboarding]')?.addEventListener('click', () => startOnboardingTour(ctx));
  document.querySelector('[data-reset-progress]')?.addEventListener('click', () => {
    if (!window.confirm(t('settings.resetConfirm', null, state.lang))) return;
    ctx.clearProgressNotice();
    state.viewed.clear();
    state.audioPositions = {};
    state.navigation = navigationStateFromRoute(navigationIndex, ctx.routableIds());
    state.selected = ctx.currentPlan().ids[0] ?? null;
    ctx.persistState();
    ctx.setNotice(t('notice.progressReset', null, state.lang), false, 3500);
    ctx.render();
  });
  document.querySelector('[data-force-refresh-app]')?.addEventListener('click', () => {
    ctx.forceRefreshApp?.({resetState: false});
  });
}
