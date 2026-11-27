import {APP_NAME} from '../app-config.js';
import {SUPPORTED_LANGS, t} from '../i18n.js';
import {esc} from '../app/ui-helpers.js';

export function authGateView(ctx) {
  const {state, iconUrl} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const auth = state.auth;
  const configured = Boolean(auth.configured);
  const hasIncomingShare = Boolean(state.incomingSharedPlan?.ids?.length);

  return `<main class="auth-gate-screen">
    <div class="auth-gate-top">
      <div class="course-brand-left">
        <img class="course-brand-icon" src="${iconUrl}" alt="${esc(APP_NAME)}">
        <div class="eyebrow">${esc(tr('authGate.eyebrow'))}</div>
      </div>
      <div class="lang-switch-pills" role="group" aria-label="${esc(tr('app.language'))}">
        ${SUPPORTED_LANGS.map(item => `<button type="button" class="lang-pill ${lang === item.code ? 'active' : ''}" data-set-lang="${item.code}" aria-pressed="${lang === item.code}">${esc(item.shortLabel)}</button>`).join('')}
      </div>
    </div>

    <section class="auth-gate-card" aria-label="${esc(tr('authGate.cardAria'))}">
      <div class="auth-gate-hero">
        <h1>${esc(tr('authGate.title', {appName: APP_NAME}))}</h1>
        <p class="auth-gate-lead">${esc(tr('authGate.lead'))}</p>
        ${hasIncomingShare ? `<p class="auth-gate-share-hint">${esc(tr('authGate.sharedHint'))}</p>` : ''}
      </div>

      <ul class="auth-gate-benefits">
        <li><strong>${esc(tr('authGate.benefit1Title'))}</strong><span>${esc(tr('authGate.benefit1Sub'))}</span></li>
        <li><strong>${esc(tr('authGate.benefit2Title'))}</strong><span>${esc(tr('authGate.benefit2Sub'))}</span></li>
        <li><strong>${esc(tr('authGate.benefit3Title'))}</strong><span>${esc(tr('authGate.benefit3Sub'))}</span></li>
      </ul>

      <div class="auth-gate-actions">
        <button type="button" class="primary auth-google-btn" data-signin-google ${!configured ? 'disabled' : ''}>
          ${esc(tr('auth.googleBtn'))}
        </button>

        <form class="auth-email-form" data-signin-email novalidate>
          <label for="gate-auth-email">${esc(tr('auth.emailLabel'))}</label>
          <div class="room-input-row">
            <input id="gate-auth-email" name="email" type="email" autocomplete="email" value="${esc(auth.emailDraft)}" placeholder="${esc(tr('auth.emailPlaceholder'))}" ${!configured ? 'disabled' : ''}>
            <button type="submit" class="secondary compact-btn" ${!configured || auth.status === 'sending' ? 'disabled' : ''}>${esc(auth.status === 'sending' ? tr('auth.sendingLink') : tr('auth.sendLinkBtn'))}</button>
          </div>
        </form>

        ${!configured ? `<p class="account-status-muted">${esc(tr('authGate.devModeNote'))}</p>` : ''}
        ${auth.message ? `<p class="auth-msg-ok" role="status">${esc(auth.message)}</p>` : ''}
        ${auth.error ? `<p class="room-error" role="alert">${esc(auth.error)}</p>` : ''}
      </div>

      <div class="auth-gate-divider"><span>${esc(tr('authGate.orDivider'))}</span></div>

      <button type="button" class="auth-guest-btn" data-continue-guest>
        <strong>${esc(tr('authGate.guestBtn'))}</strong>
        <small>${esc(tr('authGate.guestSub'))}</small>
      </button>
    </section>
  </main>`;
}

export function wireAuthGate(ctx) {
  const {state, cloudSync} = ctx;

  document.querySelector('[data-signin-google]')?.addEventListener('click', event => {
    const btn = event.currentTarget;
    if (btn) btn.disabled = true;
    cloudSync?.signInWithGoogle();
  });

  document.querySelector('#gate-auth-email')?.addEventListener('input', event => {
    state.auth.emailDraft = event.target.value;
  });

  document.querySelector('[data-signin-email]')?.addEventListener('submit', event => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    cloudSync?.signInWithEmail(email);
  });

  document.querySelector('[data-continue-guest]')?.addEventListener('click', () => {
    state.hasCompletedAuthGate = true;
    state.courseEntry = 'language';
    state.appPhase = state.hasChosenCourse ? 'main' : 'select_time';
    ctx.persistState();
    ctx.render();
    window.scrollTo({top: 0});
  });
}
