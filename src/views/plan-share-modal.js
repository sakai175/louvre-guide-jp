import {localizeWork, t} from '../i18n.js';
import {buildSharedPlanUrl, parseSharedPlanInput, renderQrSvg, sanitizeSharedTitle, savePendingSharedPlan} from '../app/plan-share.js';
import {esc, thumbMarkup, workStatus} from '../app/ui-helpers.js';

let activeQrStream = null;
let activeQrRaf = null;
let qrScanSession = 0;

export function stopQrScanner() {
  qrScanSession += 1;
  if (activeQrRaf) {
    cancelAnimationFrame(activeQrRaf);
    activeQrRaf = null;
  }
  if (activeQrStream) {
    try { activeQrStream.getTracks().forEach(track => track.stop()); } catch { /* ignore */ }
    activeQrStream = null;
  }
}

export function sharedPlanBannerMarkup(ctx) {
  const {state} = ctx;
  if (state.planMode !== 'shared' || !state.sharedPlan?.ids?.length) return '';
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const title = state.sharedPlan.title || tr('share.defaultPlanTitle');
  return `<div class="shared-plan-banner" role="region" aria-label="${esc(tr('share.activeBannerAria'))}">
    <div class="shared-plan-banner-copy">
      <span class="shared-plan-badge">${esc(tr('share.activeBadge'))}</span>
      <strong>${esc(title)}</strong>
      <small>${esc(tr('course.worksCount', {count: state.sharedPlan.ids.length}))}</small>
    </div>
    <button type="button" class="shared-return-btn" data-return-own-plan>${esc(tr('share.returnOwnBtn'))}</button>
  </div>`;
}

export function incomingSharedPopupMarkup(ctx) {
  const {state, byId, navigationIndex} = ctx;
  const incoming = state.incomingSharedPlan;
  if (!incoming || !incoming.ids?.length) return '';
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const title = incoming.title || tr('share.defaultPlanTitle');
  const works = incoming.ids.map(id => byId[id]).filter(Boolean).map(w => localizeWork(w, lang));
  const routableCount = incoming.ids.filter(id => navigationIndex.nodes.has(`work:${id}`)).length;
  const estMinutes = works.length * 6 + (routableCount ? Math.max(8, routableCount * 5) : 0);
  const previewWorks = works.slice(0, 6);
  const extraCount = Math.max(0, works.length - previewWorks.length);

  return `
    <div class="sheet-backdrop" data-dismiss-shared-popup></div>
    <section class="share-popup-dialog" role="dialog" aria-modal="true" aria-label="${esc(tr('share.incomingTitle'))}">
      <div class="sheet-handle-bar">
        <span class="sheet-grabber" aria-hidden="true"></span>
        <button type="button" class="sheet-close-btn" data-dismiss-shared-popup>${esc(tr('app.closeBtn'))}</button>
      </div>
      <div class="share-popup-head">
        <span class="eyebrow">${esc(tr('share.incomingEyebrow'))}</span>
        <h2>${esc(title)}</h2>
        <p class="share-popup-meta">${esc(tr('share.incomingMeta', {count: works.length, minutes: estMinutes}))}</p>
        <p class="share-safe-note">${esc(tr('share.safeConflictNote'))}</p>
      </div>
      <ul class="share-preview-list" aria-label="${esc(tr('share.previewAria'))}">
        ${previewWorks.map((work, idx) => `<li>
          <span class="share-preview-order">${idx + 1}</span>
          ${thumbMarkup(ctx, work, 'thumb-sm')}
          <div class="share-preview-copy">
            <strong>${esc(work.title)}</strong>
            <small>${esc(workStatus(work, lang))}</small>
          </div>
        </li>`).join('')}
        ${extraCount > 0 ? `<li class="share-preview-more">${esc(tr('share.previewMore', {count: extraCount}))}</li>` : ''}
      </ul>
      <div class="share-popup-actions">
        <button type="button" class="primary share-primary-btn" data-accept-shared-plan>${esc(tr('share.openSharedBtn'))}</button>
        <button type="button" class="secondary share-secondary-btn" data-copy-shared-to-myplan>${esc(tr('share.copyToMyPlanBtn'))}</button>
      </div>
    </section>
  `;
}

export function sharePlanModalMarkup(ctx) {
  const {state} = ctx;
  const modal = state.shareModal;
  if (!modal?.open) return '';
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);
  const plan = ctx.currentPlan();
  const shareIds = plan.ids || [];
  const defaultTitle = plan.mode === 'shared'
    ? (state.sharedPlan?.title || tr('share.defaultPlanTitle'))
    : plan.label;
  const currentTitle = modal.titleDraft ?? defaultTitle;
  const baseHref = typeof location !== 'undefined'
    ? `${location.origin}${location.pathname}`
    : 'https://sakai175.github.io/louvre-guide-jp/';
  const shareUrl = shareIds.length ? buildSharedPlanUrl(baseHref, {ids: shareIds, title: currentTitle}) : '';
  const qrSvg = shareUrl ? renderQrSvg(shareUrl, {label: tr('share.qrAria')}) : '';
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const canScanQr = typeof window !== 'undefined'
    && 'BarcodeDetector' in window
    && Boolean(navigator.mediaDevices?.getUserMedia);

  return `
    <div class="sheet-backdrop" data-close-share-modal></div>
    <section class="share-modal-sheet" role="dialog" aria-modal="true" aria-label="${esc(tr('share.modalTitle'))}">
      <div class="sheet-handle-bar">
        <h2>${esc(tr('share.modalTitle'))}</h2>
        <button type="button" class="sheet-close-btn" data-close-share-modal>${esc(tr('app.closeBtn'))}</button>
      </div>
      <div class="share-modal-tabs" role="tablist">
        <button type="button" class="share-tab-btn ${modal.mode === 'export' ? 'active' : ''}" data-share-modal-tab="export" role="tab" aria-selected="${modal.mode === 'export'}">${esc(tr('share.tabExport'))}</button>
        <button type="button" class="share-tab-btn ${modal.mode === 'import' ? 'active' : ''}" data-share-modal-tab="import" role="tab" aria-selected="${modal.mode === 'import'}">${esc(tr('share.tabImport'))}</button>
      </div>

      ${modal.mode === 'export' ? `
        ${!shareIds.length ? `<p class="share-empty-note">${esc(tr('share.emptyExport'))}</p>` : `
          <div class="share-export-body">
            <p class="share-lead">${esc(tr('share.exportLead', {count: shareIds.length}))}</p>
            <label class="share-field-label" for="share-plan-title">${esc(tr('share.titleInputLabel'))}</label>
            <input id="share-plan-title" class="share-text-input" type="text" maxlength="40" value="${esc(currentTitle)}" placeholder="${esc(tr('share.titleInputPlaceholder'))}" data-share-title-input>
            <div class="share-qr-box" data-share-qr-box>
              ${qrSvg || `<p class="share-empty-note">${esc(tr('share.qrTooLong'))}</p>`}
            </div>
            <p class="share-qr-caption">${esc(tr('share.qrCaption'))}</p>
            <div class="share-url-row">
              <input type="text" readonly class="share-url-input" value="${esc(shareUrl)}" aria-label="${esc(tr('share.urlFieldAria'))}" data-share-url-output>
              <button type="button" class="primary compact-btn" data-copy-share-url>${esc(tr('share.copyUrlBtn'))}</button>
            </div>
            ${canNativeShare ? `<button type="button" class="secondary share-native-btn" data-native-share-url>${esc(tr('share.nativeShareBtn'))}</button>` : ''}
          </div>
        `}
      ` : `
        <div class="share-import-body">
          <p class="share-lead">${esc(tr('share.importLead'))}</p>
          <form class="share-import-form" data-import-share-form novalidate>
            <label class="share-field-label" for="share-import-input">${esc(tr('share.importInputLabel'))}</label>
            <div class="room-input-row">
              <input id="share-import-input" name="shareUrl" type="url" autocomplete="off" value="${esc(modal.importDraft || '')}" placeholder="${esc(tr('share.importPlaceholder'))}">
              <button type="submit" class="primary compact-btn">${esc(tr('share.importOpenBtn'))}</button>
            </div>
            ${modal.error ? `<p class="room-error" role="alert">${esc(modal.error)}</p>` : ''}
          </form>
          <div class="share-scanner-block">
            ${canScanQr
              ? `<button type="button" class="secondary compact-btn" data-toggle-qr-scan>${esc(modal.scanning ? tr('share.stopScanBtn') : tr('share.startScanBtn'))}</button>`
              : `<p class="share-camera-tip">${esc(tr('share.cameraFallbackTip'))}</p>`}
            ${modal.scanning ? `<div class="share-scanner-viewport"><video playsinline muted data-qr-video></video><span class="share-scanner-hint">${esc(tr('share.scanningHint'))}</span></div>` : ''}
          </div>
        </div>
      `}
    </section>
  `;
}

export function wireSharedPlanUI(ctx, root = document) {
  const {state, byId, planActions} = ctx;
  const lang = state.lang;
  const tr = (key, params) => t(key, params, lang);

  root.querySelector('[data-return-own-plan]')?.addEventListener('click', () => {
    planActions.returnToOwnPlan();
  });

  root.querySelectorAll('[data-dismiss-shared-popup]').forEach(el => {
    el.onclick = () => {
      state.incomingSharedPlan = null;
      savePendingSharedPlan(null);
      ctx.render({overlayOnly: true});
    };
  });

  root.querySelector('[data-accept-shared-plan]')?.addEventListener('click', () => {
    const incoming = state.incomingSharedPlan;
    if (!incoming) return;
    planActions.activateSharedPlan(incoming);
  });

  root.querySelector('[data-copy-shared-to-myplan]')?.addEventListener('click', () => {
    const incoming = state.incomingSharedPlan;
    if (!incoming) return;
    planActions.copySharedToMyPlan(incoming);
  });

  root.querySelectorAll('[data-open-share-modal]').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.openShareModal === 'import' ? 'import' : 'export';
      const plan = ctx.currentPlan();
      state.shareModal = {
        open: true,
        mode,
        titleDraft: plan.mode === 'shared' ? (state.sharedPlan?.title || '') : plan.label,
        importDraft: '',
        error: '',
        scanning: false
      };
      ctx.render({overlayOnly: true});
    };
  });

  root.querySelectorAll('[data-close-share-modal]').forEach(el => {
    el.onclick = () => {
      stopQrScanner();
      state.shareModal.open = false;
      state.shareModal.scanning = false;
      state.shareModal.error = '';
      ctx.render({overlayOnly: true});
    };
  });

  root.querySelectorAll('[data-share-modal-tab]').forEach(btn => {
    btn.onclick = () => {
      stopQrScanner();
      state.shareModal.mode = btn.dataset.shareModalTab === 'import' ? 'import' : 'export';
      state.shareModal.scanning = false;
      state.shareModal.error = '';
      ctx.render({overlayOnly: true, skipTransition: true});
    };
  });

  const titleInput = document.querySelector('[data-share-title-input]');
  if (titleInput) {
    titleInput.addEventListener('input', event => {
      const nextTitle = sanitizeSharedTitle(event.target.value);
      state.shareModal.titleDraft = nextTitle;
      const plan = ctx.currentPlan();
      const baseHref = `${location.origin}${location.pathname}`;
      const nextUrl = buildSharedPlanUrl(baseHref, {ids: plan.ids, title: nextTitle});
      const urlOut = document.querySelector('[data-share-url-output]');
      if (urlOut) urlOut.value = nextUrl;
      const qrBox = document.querySelector('[data-share-qr-box]');
      if (qrBox) {
        qrBox.innerHTML = renderQrSvg(nextUrl, {label: tr('share.qrAria')})
          || `<p class="share-empty-note">${esc(tr('share.qrTooLong'))}</p>`;
      }
    });
  }

  document.querySelector('[data-copy-share-url]')?.addEventListener('click', async () => {
    const urlOut = document.querySelector('[data-share-url-output]');
    const text = urlOut?.value || '';
    if (!text) return;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch { /* fallback below */ }
    if (!copied && urlOut) {
      urlOut.focus();
      urlOut.select();
      try { copied = Boolean(document.execCommand?.('copy')); } catch { copied = false; }
    }
    if (copied) {
      ctx.setNotice(tr('share.copiedNotice'), false, 2800);
      ctx.render();
    }
  });

  document.querySelector('[data-native-share-url]')?.addEventListener('click', async () => {
    const urlOut = document.querySelector('[data-share-url-output]');
    const url = urlOut?.value || '';
    if (!url || !navigator.share) return;
    try {
      await navigator.share({
        title: state.shareModal.titleDraft || ctx.currentPlan().label,
        text: tr('share.nativeShareText'),
        url
      });
    } catch { /* user cancelled */ }
  });

  document.querySelector('[data-import-share-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get('shareUrl') || '');
    state.shareModal.importDraft = raw;
    const parsed = parseSharedPlanInput(raw, byId);
    if (!parsed) {
      state.shareModal.error = tr('share.importInvalidError');
      ctx.render();
      return;
    }
    stopQrScanner();
    state.shareModal.open = false;
    state.shareModal.scanning = false;
    state.shareModal.error = '';
    state.incomingSharedPlan = parsed;
    ctx.render();
  });

  document.querySelector('[data-toggle-qr-scan]')?.addEventListener('click', () => {
    if (state.shareModal.scanning) {
      stopQrScanner();
      state.shareModal.scanning = false;
      ctx.render();
      return;
    }
    state.shareModal.scanning = true;
    state.shareModal.error = '';
    ctx.render();
  });

  if (state.shareModal.open && state.shareModal.mode === 'import' && state.shareModal.scanning) {
    startQrCameraLoop(ctx);
  }
}

async function startQrCameraLoop(ctx) {
  const {state, byId} = ctx;
  const video = document.querySelector('[data-qr-video]');
  if (!video || !navigator.mediaDevices?.getUserMedia || !('BarcodeDetector' in window)) return;
  const mySession = ++qrScanSession;
  if (activeQrRaf) {
    cancelAnimationFrame(activeQrRaf);
    activeQrRaf = null;
  }
  try {
    const detector = new window.BarcodeDetector({formats: ['qr_code']});
    let stream = activeQrStream;
    const hasLiveTrack = stream?.getVideoTracks?.().some(track => track.readyState === 'live');
    if (!hasLiveTrack) {
      if (stream) {
        try { stream.getTracks().forEach(track => track.stop()); } catch { /* ignore */ }
        activeQrStream = null;
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: 'environment'}},
        audio: false
      });
      if (mySession !== qrScanSession || !video.isConnected || !state.shareModal.open || !state.shareModal.scanning) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      activeQrStream = stream;
    }
    video.srcObject = stream;
    await video.play();
    if (mySession !== qrScanSession || !video.isConnected || !state.shareModal.open || !state.shareModal.scanning) {
      return;
    }

    const scanFrame = async () => {
      if (mySession !== qrScanSession || !activeQrStream || !video.isConnected || !state.shareModal.scanning) return;
      try {
        const codes = await detector.detect(video);
        if (mySession !== qrScanSession || !state.shareModal.scanning) return;
        for (const code of codes) {
          const parsed = parseSharedPlanInput(code.rawValue, byId);
          if (parsed) {
            stopQrScanner();
            state.shareModal.open = false;
            state.shareModal.scanning = false;
            state.shareModal.error = '';
            state.incomingSharedPlan = parsed;
            ctx.render();
            return;
          }
        }
      } catch { /* retry next frame */ }
      if (mySession === qrScanSession && state.shareModal.scanning) {
        activeQrRaf = requestAnimationFrame(scanFrame);
      }
    };
    activeQrRaf = requestAnimationFrame(scanFrame);
  } catch {
    if (mySession !== qrScanSession) return;
    stopQrScanner();
    state.shareModal.scanning = false;
    state.shareModal.error = t('share.cameraError', null, state.lang);
    ctx.render();
  }
}
