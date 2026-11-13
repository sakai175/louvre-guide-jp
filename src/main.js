import {floorMapMarkup, wireFloorMap} from './floor-map.js';
import {buildNavigationView, indexNavigationGraph, navigationStateFromRoute} from './navigation.js';
import {advanceOnRouteAudio, destinationWorkId, playbackModeFor, validStoredProgress} from './route-progress.js';
import {correctLocation, findRoomCandidates} from './location-support.js';

const appBase = new URL('../', import.meta.url);
const [works, routes, sources, navigationGraph] = await Promise.all(['works.json','routes.json','provenance.json','navigation-graph.json'].map(async name => {
  const response = await fetch(new URL(name, import.meta.url));
  if (!response.ok) throw new Error(`${name} を読み込めません`);
  return response.json();
}));

const byId = Object.fromEntries(works.map(work => [work.id, work]));
const floors = [2, 1, 0, -1, -2];
const floorNames = {2:'2階', 1:'1階', 0:'0階', '-1':'−1階', '-2':'−2階'};
const durations = [20, 40, 60, 120];
const SESSION_PROGRESS_KEY = 'louvre-route-progress-v1';
const navigationIndex = indexNavigationGraph(navigationGraph);
const state = {minutes:90, floor:1, selected:null, duration:40, audioDurations:{}, playing:null, tab:'home', audio:null, downloaded:new Set(), navigation:null, player:{workId:null,mode:'standalone',sessionId:0,hasStarted:false,arrivalHandled:false}, notice:null, undo:null, processedArrivalEvents:new Set(), support:{open:false,editing:false,room:'',candidates:[],selectedCandidateId:null,error:''}};
const app = document.querySelector('#app');
const player = new Audio();
player.preload = 'none';
let playbackSerial = 0;
let noticeTimer = null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const route = () => routes.find(item => item.minutes === state.minutes) || routes[1];
const restoredProgress = restoreSessionProgress();
if (restoredProgress) {
  state.minutes = restoredProgress.minutes;
  state.navigation = restoredProgress.navigation;
  state.selected = restoredProgress.selected;
  state.floor = Number.isFinite(restoredProgress.floor) ? restoredProgress.floor : navigationIndex.nodes.get(state.navigation.currentNodeId)?.floor ?? 1;
} else {
  state.navigation = navigationStateFromRoute(navigationIndex, route().ids);
}
const navigationView = () => buildNavigationView(navigationIndex, state.navigation);
const audioPath = (id, length) => new URL(`audio/${id}-${length}.wav`, appBase).href;
const audioDuration = () => Math.ceil(route().ids.length * state.duration / 60);
const planned = () => { const item = route(); return item.ids.length * (item.visit ?? 6) + item.walk + audioDuration() + item.buffer; };
const order = () => route().ids.map(id => byId[id]).filter(Boolean);
const workStatus = work => work.locationPrecision === 'room' ? `${floorNames[work.floor]} · ${work.wing}翼 · ${work.room}室` : '位置：要確認';

function restoreSessionProgress() {
  // Reload restores route progress only; audio playback, toast, and undo history intentionally start fresh.
  try { return validStoredProgress(navigationIndex, routes, JSON.parse(sessionStorage.getItem(SESSION_PROGRESS_KEY))); }
  catch { return null; }
}

function persistSessionProgress() {
  try {
    sessionStorage.setItem(SESSION_PROGRESS_KEY, JSON.stringify({version:1, minutes:state.minutes, routeSignature:route().ids.join('|'), navigation:state.navigation, selected:state.selected, floor:state.floor}));
  } catch { /* Session persistence is optional when storage is unavailable. */ }
}

function playbackModeBadge(workId) {
  const active = state.player.workId === workId && state.player.hasStarted;
  const mode = active ? state.player.mode : playbackModeFor(navigationIndex, state.navigation, workId);
  const label = mode === 'route' ? (active ? 'ルート再生' : 'ルート再生対象') : '単独再生 · 現在地更新なし';
  return `<span class="playback-mode mode-${mode}">${label}</span>`;
}
function workDetail(work) {
  const index = route().ids.indexOf(work.id) + 1;
  return `<article class="work-detail"><div class="eyebrow">${index ? `訪問 ${index} / ${route().ids.length}` : '作品音声'} · ${esc(workStatus(work))}</div><h2>${esc(work.title)}</h2><p class="artist">${esc(work.author || '作家名：要確認')}</p><h3>作品の背景</h3><p>${esc(work.background)}</p><h3>鑑賞時に見るポイント</h3><p>${esc(work.look)}</p><div class="audio-panel"><div class="audio-panel-heading"><h3>音声解説</h3>${playbackModeBadge(work.id)}</div><div class="durations">${durations.map(length => `<button class="chip ${state.duration===length?'active':''}" data-duration="${length}">${length<60?`${length}秒`:`${length/60}分`}</button>`).join('')}</div><div class="audio-actions"><button class="primary" data-play="${esc(work.id)}">${state.playing===work.id?'一時停止':'▶ 再生'}</button><button class="secondary" data-download="${esc(work.id)}">${state.downloaded.has(`${work.id}-${state.duration}`)?'保存済み ✓':'端末に保存'}</button></div><p class="minor" id="audio-status">保存した音声はオフラインでも再生できます。</p><audio id="player" preload="none" src="${audioPath(work.id,state.duration)}"></audio></div><p class="source">展示室情報：<a href="${esc(work.source)}" target="_blank" rel="noreferrer">公式情報 ↗</a> · 確認日 ${esc(work.verifiedAt || sources.checkedAt)}</p></article>`;
}
function routeList() {
  const destinationId = navigationIndex.nodes.get(state.navigation?.destinationNodeId)?.workId;
  return `<ol class="stops">${route().ids.map((id,index) => { const work=byId[id]; return `<li><button class="stop ${work.id===destinationId?'current':''}" data-select="${esc(id)}" aria-pressed="${work.id===destinationId}"><span class="stop-num">${index+1}</span><span><b>${esc(work.title)}</b><small>${esc(work.wing)}翼 · ${floorNames[work.floor]} · ${esc(work.room)}室</small></span><span class="arrow">›</span></button></li>`; }).join('')}</ol>`;
}

function navigationPanel(view) {
  if (!view.available) return `<section class="route-guidance route-unavailable" role="status"><div><span class="guidance-label">経路を表示できません</span><strong>${esc(view.reason)}</strong></div><p>壁を横断する推測線は表示しません。接続データの追加後に再計算できます。</p></section>`;
  const locationLabel = ['audio','manual'].includes(view.locationMethod) ? '推定現在地' : '最後に確認した地点';
  if (view.complete) return `<section class="route-guidance route-complete" aria-label="ルート完了"><div class="guidance-points"><div><span class="guidance-label">${locationLabel}</span><strong><i class="current-symbol"></i>${esc(view.currentNode.label)}</strong></div><span class="guidance-arrow" aria-hidden="true">✓</span><div><span class="guidance-label">進行状況</span><strong class="destination-name">ルート完了</strong></div></div><p class="next-action"><span>次にすること</span>館内表示を確認し、次の予定へ進んでください</p></section>`;
  const destinationWork = byId[view.destinationNode.workId];
  const transition = view.transitions[0];
  return `<section class="route-guidance" aria-label="現在地から次の作品まで"><div class="guidance-points"><div><span class="guidance-label">${locationLabel}</span><strong><i class="current-symbol"></i>${esc(view.currentNode.label)}</strong></div><span class="guidance-arrow" aria-hidden="true">→</span><div><span class="guidance-label">次の作品</span><strong class="destination-name">${esc(destinationWork?.title ?? view.destinationNode.label)}</strong><small>${destinationWork ? esc(workStatus(destinationWork)) : ''}</small></div></div><p class="next-action"><span>次にすること</span>${esc(view.nextAction)}</p>${transition ? `<p class="transition-summary">${transition.to.floor > transition.from.floor ? '↑' : '↓'} ${esc(transition.message)}。別階の続きは階ボタンで確認できます。</p>` : ''}</section>`;
}
function nextDestination() {
  if(!state.playing || state.player.mode !== 'route') return '';
  const nextId = destinationWorkId(navigationIndex, state.navigation);
  const next = nextId ? byId[nextId] : null;
  if(!next) return `<section class="next-destination complete"><div><span class="eyebrow">ROUTE COMPLETE</span><h2>このルートの最後の作品です</h2><strong>${esc(byId[state.playing]?.title||'')}</strong></div></section>`;
  const nextIndex=route().ids.indexOf(next.id);
  return `<section class="next-destination"><div><span class="eyebrow">NEXT STOP · ${nextIndex+1}/${route().ids.length}</span><h2>次の目的地</h2><strong>${esc(next.title)}</strong><p>${esc(workStatus(next))}</p></div><button data-show-map="${esc(next.id)}">マップで位置を確認</button></section>`;
}

function movementSupportMarkup() {
  const support = state.support;
  const candidates = support.candidates.length ? `<fieldset class="room-candidates"><legend>${support.candidates.length > 1 ? '翼と階を確認して選択してください' : '入力した部屋を確認してください'}</legend>${support.candidates.map(candidate => `<label><input type="radio" name="room-candidate" value="${esc(candidate.nodeId)}" ${support.selectedCandidateId===candidate.nodeId?'checked':''}><span><strong>${esc(candidate.room)}室</strong><small>${esc(candidate.wing)}翼 · ${esc(candidate.floorLabel)}</small></span></label>`).join('')}</fieldset><button class="primary confirm-location" type="button" data-confirm-location>この部屋を推定現在地にする</button>` : '';
  const editor = support.editing ? `<form class="room-correction-form" data-room-search novalidate><label for="room-number">部屋番号</label><div class="room-input-row"><input id="room-number" name="room" inputmode="numeric" autocomplete="off" value="${esc(support.room)}" placeholder="例：711" aria-describedby="room-help room-error"><button class="secondary" type="submit">候補を確認</button></div><small id="room-help">入口付近や壁面に表示された番号を入力してください。</small>${support.error?`<p class="room-error" id="room-error" role="alert">${esc(support.error)}</p>`:''}${candidates}</form>` : '';
  return `<details class="movement-support" ${support.open?'open':''}><summary>移動サポート</summary><div class="movement-support-body"><button class="location-correction-trigger" type="button" data-edit-location><span>現在地を修正する</span><small>道に迷ったとき</small></button>${editor}</div></details>`;
}

function lookupRoom(room) {
  state.support.room = room;
  state.support.candidates = findRoomCandidates(navigationIndex, works, room);
  state.support.selectedCandidateId = state.support.candidates.length === 1 ? state.support.candidates[0].nodeId : null;
  state.support.error = state.support.candidates.length ? '' : '部屋番号を確認してください';
  state.support.open = true;
  state.support.editing = true;
  render();
}

function confirmLocationCorrection() {
  const candidateId = state.support.selectedCandidateId;
  if (!candidateId) {
    state.support.error = state.support.candidates.length > 1 ? '翼と階を確認して候補を選択してください' : '部屋番号を確認してください';
    render();
    return;
  }
  const result = correctLocation(navigationIndex, state.navigation, candidateId);
  if (!result.updated) {
    state.support.error = result.message;
    render();
    return;
  }
  const candidate = state.support.candidates.find(item => item.nodeId === candidateId);
  clearProgressNotice();
  state.navigation = result.navigation;
  state.floor = candidate?.floor ?? state.floor;
  state.support = {open:true,editing:false,room:'',candidates:[],selectedCandidateId:null,error:''};
  persistSessionProgress();
  setNotice(`推定現在地を${candidate?.label ?? '入力した部屋'}として更新しました`, false, 4200);
  render();
}

function homeView() {
  const nav = navigationView();
  const destinationId = nav.destinationNode?.workId;
  const first = byId[state.selected] || byId[destinationId] || order()[0];
  return `<main><div class="update-meta"><small>情報更新日：${esc(sources.checkedAt)}</small><button type="button" data-open-info>詳細</button></div><section class="route-intro"><div class="eyebrow">はじめてのルーブル · 名作巡回</div><h1>時間に合わせた<br>名作ルート</h1><p>作品・音声・移動を含む固定ルートです。時間を選ぶと訪問順が表示されます。</p></section><section class="route-options" aria-label="所要時間"><div class="section-heading"><div><div class="eyebrow">ROUTE</div><h2>見学時間を選ぶ</h2></div></div><div class="route-cards">${routes.map(item => {const minutes=item.ids.length*(item.visit??6)+item.walk+Math.ceil(item.ids.length*state.duration/60)+item.buffer; return `<button class="route-card ${state.minutes===item.minutes?'active':''}" data-route="${item.minutes}"><strong>${item.minutes}<small>分</small></strong><span>${item.ids.length}作品 · 約${minutes}分</span></button>`}).join('')}</div></section><section class="time-estimate"><b>約${planned()}分 · ${route().ids.length}作品</b><span>鑑賞 ${route().ids.length*(route().visit??6)}分 + 移動 ${route().walk}分 + 音声 ${audioDuration()}分 + 余裕 ${route().buffer}分</span></section>${nextDestination()}<section class="map-section"><div class="section-heading"><div><div class="eyebrow">FLOOR PLAN</div><h2>現在地から次の作品へ</h2></div><span class="map-tag">階別2Dマップ</span></div>${navigationPanel(nav)}<div class="map-mode-tabs" aria-label="地図表示"><span class="active">フロアマップ</span><span aria-disabled="true">全館俯瞰（準備中）</span></div><div class="floor-tabs" aria-label="表示する階">${floors.map(floor => `<button data-floor="${floor}" class="${floor===state.floor?'active':''} ${nav.routeFloors?.includes(floor)?'has-route':''}" aria-pressed="${floor===state.floor}">${floorNames[floor]}${nav.routeFloors?.includes(floor)?'<i aria-hidden="true"></i>':''}</button>`).join('')}</div><div class="map-frame"><div class="map-scroll">${floorMapMarkup({floor:state.floor,floorLabel:floorNames[state.floor],works,selectedId:destinationId,navigation:nav,roomNotices:navigationGraph.roomNotices})}</div><div class="map-controls" aria-label="地図の拡大縮小"><button data-map-action="in" aria-label="地図を拡大">＋</button><output data-map-status aria-live="polite">100%</output><button data-map-action="out" aria-label="地図を縮小">−</button><button data-map-action="reset">全体表示</button></div></div>${movementSupportMarkup()}</section><section class="route-stops"><div class="section-heading"><div><div class="eyebrow">VISIT ORDER</div><h2>${state.minutes}分 · 次の作品を選ぶ</h2></div></div>${routeList()}</section><section class="selected-work">${workDetail(first)}</section></main>`;
}
function audioView() {
  const grouped = new Map();
  works.forEach(work => { const room=work.locationPrecision==='room'?`${floorNames[work.floor]} · ${work.wing}翼 · ${work.room}室`:'展示室：要確認'; if(!grouped.has(room))grouped.set(room,[]);grouped.get(room).push(work); });
  return `<main><section class="audio-header"><div class="eyebrow">AUDIO GUIDE</div><h1>オーディオ</h1><p>展示室ごとに作品音声をまとめています。保存済みの音声は通信なしでも再生できます。</p></section>${nextDestination()}<div class="audio-groups">${[...grouped.entries()].map(([room,items]) => `<section class="audio-group"><h2>${esc(room)}</h2>${items.map(work => {const length=state.audioDurations[work.id]??state.duration;const saved=state.downloaded.has(`${work.id}-${length}`);return `<article class="audio-row ${state.selected===work.id?'selected':''}" id="audio-row-${esc(work.id)}"><div class="audio-row-copy"><strong>${esc(work.title)}</strong><small>${esc(work.author||'作家名：要確認')} · ${work.locationPrecision==='room'?`展示室 ${esc(work.room)}`:'位置：要確認'}</small>${playbackModeBadge(work.id)}</div><span class="download-state ${saved?'saved':''}">${saved?'保存済み':'未保存'}</span><div class="audio-row-controls"><select data-audio-length="${esc(work.id)}" aria-label="${esc(work.title)} 音声の長さ">${durations.map(option=>`<option value="${option}" ${length===option?'selected':''}>${option<60?`${option}秒`:`${option/60}分`}</option>`).join('')}</select><button class="secondary" data-audio-play="${esc(work.id)}">${state.playing===work.id?'一時停止':'▶ 再生'}</button><button class="secondary" data-audio-download="${esc(work.id)}">保存</button><audio id="audio-${esc(work.id)}" preload="none" src="${audioPath(work.id,length)}"></audio></div></article>`;}).join('')}</section>`).join('')}</div></main>`;
}
function otherView() {
  return `<main><section class="other-page"><div class="eyebrow">INFORMATION</div><h1>ご利用前の確認・情報について</h1><p class="information-lead">移動前に、最新の公式情報と本サービスの案内範囲をご確認ください。</p><section class="visit-note"><ul class="information-list"><li><strong>展示位置・開室状況</strong><span>展示室や作品位置、開室状況は変更される可能性があります。当日は館内表示を優先してください。</span></li><li><strong>情報更新日</strong><span>${esc(sources.checkedAt)}</span></li><li><strong>公式館内案内</strong><a href="${esc(sources.officialMap)}" target="_blank" rel="noreferrer">地図・入口・アクセスを確認 ↗</a></li><li><strong>公式開室状況</strong><a href="${esc(sources.availability)}" target="_blank" rel="noreferrer">利用可能な展示室を確認 ↗</a></li><li><strong>サービスについて</strong><span>本サービスはルーブル美術館の公認サービスではありません。</span></li></ul></section><section class="data-scope"><h2>地図・経路データについて</h2><p>階別地図の建物輪郭、部屋番号、通路、扉、移動設備、主要施設、作品位置は添付の公式館内マップを基準に再構成しています。展示室の開室状況は当日の館内表示を優先してください。</p></section></section></main>`;
}
function noticeMarkup() {
  if (!state.notice) return '';
  return `<aside class="arrival-toast" role="status" aria-live="polite"><span>${esc(state.notice.message)}</span>${state.notice.canUndo?'<button data-undo-arrival>元に戻す</button>':''}</aside>`;
}

function setNotice(message, canUndo, duration=6500) {
  if (noticeTimer) clearTimeout(noticeTimer);
  state.notice = {message, canUndo};
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

function handleRouteArrival(workId, eventId) {
  if (state.processedArrivalEvents.has(eventId)) return false;
  state.processedArrivalEvents.add(eventId);
  const result = advanceOnRouteAudio(navigationIndex, state.navigation, route().ids, workId);
  if (!result.updated) return false;
  state.undo = {minutes:state.minutes, navigation:result.previous, selected:state.selected, floor:state.floor};
  state.navigation = result.navigation;
  state.selected = workId;
  state.floor = byId[workId]?.floor ?? state.floor;
  persistSessionProgress();
  setNotice(`推定現在地を部屋${byId[workId]?.room ?? ''}として更新しました`, true);
  render();
  return true;
}

function undoArrival() {
  if (!state.undo) return;
  const snapshot = state.undo;
  state.minutes = snapshot.minutes;
  state.navigation = snapshot.navigation;
  state.selected = snapshot.selected;
  state.floor = snapshot.floor;
  state.undo = null;
  persistSessionProgress();
  setNotice('推定現在地と経路を元に戻しました', false, 3200);
  render();
}

function render() {
  const body = state.tab==='home'?homeView():state.tab==='audio'?audioView():otherView();
  app.innerHTML = `<header><a class="brand" href="#home" data-tab="home"><span class="mark">L</span><span><b>ルーブル、はじめての一日</b><small>非公式・日本語ガイド</small></span></a></header><nav class="bottom-tabs" aria-label="メインメニュー"><button data-tab="home" class="${state.tab==='home'?'active':''}">ホーム</button><button data-tab="audio" class="${state.tab==='audio'?'active':''}">オーディオ</button><button data-tab="other" class="${state.tab==='other'?'active':''}">ご利用前の確認</button></nav>${body}${noticeMarkup()}`;
  wire();
}

async function toggleAudio(id, length) {
  state.duration = length;
  state.audioDurations[id] = length;
  const samePlayback = state.audio === player && state.player.workId === id;
  if (samePlayback && !player.paused) {
    player.pause();
    state.playing = null;
    render();
    return;
  }
  if (samePlayback && state.player.hasStarted && !player.ended) {
    try {
      await player.play();
      state.playing = id;
      render();
    } catch {
      document.querySelector('#audio-status')?.replaceChildren('音声を再開できません。通信状態または音声ファイルを確認してください。');
    }
    return;
  }

  if (state.audio === player) { player.pause(); player.currentTime = 0; }
  const sessionId = ++playbackSerial;
  const mode = playbackModeFor(navigationIndex, state.navigation, id);
  state.player = {workId:id, mode, sessionId, hasStarted:false, arrivalHandled:false};
  state.audio = player;
  player.src = audioPath(id, length);
  player.onended = () => {
    if (state.player.sessionId !== sessionId) return;
    state.playing = null;
    state.audio = null;
    render();
  };
  try {
    await player.play();
    if (state.player.sessionId !== sessionId) return;
    state.player.hasStarted = true;
    state.playing = id;
    if (mode === 'route' && !state.player.arrivalHandled) {
      state.player.arrivalHandled = true;
      if (handleRouteArrival(id, `playback-${sessionId}:${id}`)) return;
    }
    render();
  } catch {
    if (state.player.sessionId !== sessionId) return;
    state.playing = null;
    state.player.hasStarted = false;
    const status=document.querySelector('#audio-status');
    if(status) status.textContent='音声を再生できません。通信状態または音声ファイルを確認してください。';
  }
}
function wire() {
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=event=>{event.preventDefault();state.tab=button.dataset.tab;render();window.scrollTo({top:0,behavior:'smooth'});});
  document.querySelectorAll('[data-open-info]').forEach(button=>button.onclick=()=>{state.tab='other';render();window.scrollTo({top:0,behavior:'smooth'});});
  const supportDetails = document.querySelector('.movement-support');
  if (supportDetails) supportDetails.ontoggle=()=>{state.support.open=supportDetails.open;};
  document.querySelectorAll('[data-edit-location]').forEach(button=>button.onclick=()=>{state.support.open=true;state.support.editing=true;state.support.error='';render();document.querySelector('#room-number')?.focus();});
  document.querySelectorAll('[data-room-search]').forEach(form=>form.onsubmit=event=>{event.preventDefault();lookupRoom(new FormData(form).get('room'));});
  document.querySelectorAll('[name="room-candidate"]').forEach(input=>input.onchange=()=>{state.support.selectedCandidateId=input.value;state.support.error='';document.querySelector('.room-error')?.remove();});
  document.querySelectorAll('[data-confirm-location]').forEach(button=>button.onclick=confirmLocationCorrection);
  document.querySelectorAll('[data-route]').forEach(button=>button.onclick=()=>{clearProgressNotice();state.minutes=+button.dataset.route;state.selected=null;state.navigation=navigationStateFromRoute(navigationIndex,route().ids);state.floor=navigationView().currentNode?.floor??1;persistSessionProgress();render();});
  document.querySelectorAll('[data-floor]').forEach(button=>button.onclick=()=>{state.floor=+button.dataset.floor;persistSessionProgress();render();});
  document.querySelectorAll('[data-select],[data-id]').forEach(button=>{const choose=()=>{state.selected=button.dataset.select||button.dataset.id;if(button.dataset.id){state.tab='audio';render();document.querySelector(`#audio-row-${state.selected}`)?.scrollIntoView({behavior:'smooth',block:'center'});return;}clearProgressNotice();state.navigation.destinationNodeId=`work:${state.selected}`;state.navigation.routeComplete=false;state.floor=navigationView().currentNode?.floor??state.floor;persistSessionProgress();render();};button.onclick=choose;button.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}};});
  document.querySelectorAll('[data-duration]').forEach(button=>button.onclick=()=>{state.duration=+button.dataset.duration;render();});
  document.querySelectorAll('[data-play]').forEach(button=>button.onclick=()=>toggleAudio(button.dataset.play,state.duration));
  document.querySelectorAll('[data-audio-play]').forEach(button=>button.onclick=()=>{const id=button.dataset.audioPlay;const select=document.querySelector(`[data-audio-length="${id}"]`);toggleAudio(id,+select.value);});
  document.querySelectorAll('[data-audio-length]').forEach(select=>select.onchange=()=>{const id=select.dataset.audioLength;const length=+select.value;state.audioDurations[id]=length;const audio=document.querySelector(`#audio-${id}`);audio.src=audioPath(id,length);const saved=state.downloaded.has(`${id}-${length}`);const badge=select.closest('.audio-row').querySelector('.download-state');badge.textContent=saved?'保存済み':'未保存';badge.classList.toggle('saved',saved);});
  document.querySelectorAll('[data-download],[data-audio-download]').forEach(button=>button.onclick=async()=>{const id=button.dataset.download||button.dataset.audioDownload;const length=button.closest('.audio-row')?+button.closest('.audio-row').querySelector(`[data-audio-length="${id}"]`).value:state.duration;button.disabled=true;try{const url=audioPath(id,length);const response=await fetch(url);if(!response.ok)throw Error('audio unavailable');const cache=await caches.open('louvre-audio-v1');await cache.put(url,response.clone());state.downloaded.add(`${id}-${length}`);state.audioDurations[id]=length;render();}catch{button.textContent='保存できません';button.disabled=false;}});
  document.querySelectorAll('[data-show-map]').forEach(button=>button.onclick=()=>{state.selected=button.dataset.showMap;state.navigation.destinationNodeId=`work:${state.selected}`;state.navigation.routeComplete=false;state.floor=navigationView().currentNode?.floor??state.floor;state.tab='home';persistSessionProgress();render();window.scrollTo({top:0,behavior:'smooth'});});
  document.querySelectorAll('[data-undo-arrival]').forEach(button=>button.onclick=undoArrival);
  wireFloorMap({onWorkSelect:id=>{clearProgressNotice();state.selected=id;state.navigation.destinationNodeId=`work:${id}`;state.navigation.routeComplete=false;state.floor=navigationView().currentNode?.floor??state.floor;persistSessionProgress();render();document.querySelector('.map-section')?.scrollIntoView({behavior:'smooth',block:'start'});}});
  if(state.tab==='audio'&&state.selected) document.querySelector(`#audio-row-${state.selected}`)?.scrollIntoView({block:'center'});
}
async function loadDownloads() {
  if(!('caches' in window)) return;
  try { const cache=await caches.open('louvre-audio-v1'); for(const work of works) for(const length of durations) if(await cache.match(audioPath(work.id,length))) state.downloaded.add(`${work.id}-${length}`); }
  catch { /* offline cache is optional when the browser does not support it */ }
}
if('serviceWorker' in navigator) navigator.serviceWorker.register(new URL('sw.js',appBase)).catch(()=>{});
await loadDownloads();
render();
