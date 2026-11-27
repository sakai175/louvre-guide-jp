import {formatWorkCreatorMeta, formatWorkLocation} from '../app-config.js';
import {priorityTierFor} from '../catalog.js';
import {getLang, localizeWork, t} from '../i18n.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const workStatus = (work, lang = getLang()) => formatWorkLocation(localizeWork(work, lang), lang);
export const creatorMeta = (work, lang = getLang()) => formatWorkCreatorMeta(localizeWork(work, lang), lang);
export const formatAudioLengthLabel = (length, lang = getLang()) => (
  length === 60
    ? t('audio.length60', null, lang)
    : length === 120
      ? t('audio.length120', null, lang)
      : length < 60
        ? t('audio.lengthSec', {sec: length}, lang)
        : t('audio.lengthMin', {min: length / 60}, lang)
);

export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatRate(rate) {
  return `${Number(rate.toFixed(2))}x`;
}

export function wingClass(wing) {
  return wing ? `wing-tint-${String(wing).toLowerCase()}` : 'wing-tint-unknown';
}

export function thumbMarkup(ctx, work, sizeClass = '') {
  const image = ctx.artworkImages[work.id];
  const fallbackText = esc((work.title || '?').slice(0, 1));
  if (image?.src) {
    const src = new URL(image.src, ctx.appBase).href;
    return `<span class="work-thumb ${sizeClass} ${wingClass(work.wing)}"><img src="${src}" alt="${esc(work.title)}" loading="lazy" decoding="async" onerror="this.remove()"><em>${fallbackText}</em></span>`;
  }
  return `<span class="work-thumb ${sizeClass} ${wingClass(work.wing)}" aria-hidden="true"><em>${fallbackText}</em></span>`;
}

export function priorityBadgeMarkup(work, lang = getLang()) {
  const tier = priorityTierFor(work, lang);
  return `<span class="tier-badge tier-${tier.key}">${esc(tier.label)}</span>`;
}

export function createNoticeController(state) {
  let noticeTimer = null;

  function setNotice(message, canUndo = false, duration = 5200, action = null) {
    if (noticeTimer) clearTimeout(noticeTimer);
    state.notice = {message, canUndo, action};
    noticeTimer = setTimeout(() => {
      state.notice = null;
      if (canUndo) state.undo = null;
      document.querySelector('.arrival-toast')?.remove();
      noticeTimer = null;
    }, duration);
  }

  function clearProgressNotice() {
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = null;
    state.notice = null;
    state.undo = null;
  }

  return {setNotice, clearProgressNotice};
}

export function noticeMarkup(ctx, hasMini) {
  if (!ctx.state.notice) return '';
  const lang = ctx.state.lang;
  const action = ctx.state.notice.action;
  const hasDock = ctx.state.tab === 'audio' && ctx.state.myPlanIds?.length > 0;
  return `<aside class="arrival-toast ${hasMini ? 'with-mini-player' : ''} ${hasDock ? 'with-myplan-dock' : ''}" role="status" aria-live="polite">
    <span>${esc(ctx.state.notice.message)}</span>
    ${ctx.state.notice.canUndo ? `<button type="button" data-undo-arrival>${esc(t('app.undo', null, lang))}</button>` : ''}
    ${action?.label && action?.id ? `<button type="button" data-notice-action="${esc(action.id)}">${esc(action.label)}</button>` : ''}
  </aside>`;
}

export function bottomTabsMarkup(ctx) {
  const lang = ctx.state.lang;
  const tabs = [
    {id: 'map', label: t('tabs.map', null, lang), icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 7v13l6-3 6 3 6-3V4l-6 3-6-3Zm0 0v13m6-10v13"/></svg>'},
    {id: 'plan', label: t('tabs.plan', null, lang), icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>'},
    {id: 'audio', label: t('tabs.audio', null, lang), icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Zm16 0a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z"/></svg>'},
    {id: 'settings', label: t('tabs.settings', null, lang), icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z"/></svg>'}
  ];
  return `<nav class="bottom-tabs" aria-label="${esc(t('app.mainMenuAria', null, lang))}">
    ${tabs.map(tab => `<button type="button" data-tab="${tab.id}" class="${ctx.state.tab === tab.id ? 'active' : ''}" aria-current="${ctx.state.tab === tab.id ? 'page' : 'false'}">${ctx.state.tab === tab.id ? '<i class="bottom-tabs-marker" aria-hidden="true"></i>' : ''}${tab.icon}<span>${esc(tab.label)}</span></button>`).join('')}
  </nav>`;
}
