const appBase = new URL('../', import.meta.url);
const [works,routes,sources] = await Promise.all(['works.json','routes.json','provenance.json'].map(async name => { const r=await fetch(new URL(name,import.meta.url)); if(!r.ok) throw Error(`${name} を読み込めません`); return r.json() }));

const verified = works.filter(w => w.verified);
const byId = Object.fromEntries(verified.map(w => [w.id, w]));
const floors = [2, 1, 0, -1];
const floorNames = {2:'2階',1:'1階',0:'地上階','-1':'地下1階'};
const durations = [20,40,60,120];
const state = { minutes:90, floor:1, selected:null, duration:40, playing:null, drag:null, zoom:1 };
const app = document.querySelector('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route = () => routes.find(r => r.minutes === state.minutes);
const audioPath = (id,d) => new URL(`audio/${id}-${d}.wav`,appBase).href;
const heard = () => route().ids.length * state.duration / 60;
const total = () => Math.ceil(route().walk + route().buffer + route().ids.length * 4 + heard());
function detail(w) {
  const n = route().ids.indexOf(w.id)+1;
  return `<section class="detail"><div class="eyebrow">${n ? `立ち寄り ${n} / ${route().ids.length}` : '作品' } · ${esc(w.wing)} · ${floorNames[w.floor]} · ${esc(w.room)}室</div><h2>${esc(w.title)}</h2><h3>作品の背景</h3><p>${esc(w.background)}</p><h3>鑑賞時に見るポイント</h3><p>${esc(w.look)}</p><div class="audio-panel"><strong>音声解説</strong><div class="durations">${durations.map(d=>`<button class="chip ${state.duration===d?'active':''}" data-duration="${d}">${d<60?`${d}秒`:`${d/60}分`}</button>`).join('')}</div><div class="audio-actions"><button class="primary" data-play="${w.id}">${state.playing===w.id?'一時停止':'▶ 再生'}</button><button class="secondary" data-download="${w.id}">端末に保存</button></div><p class="minor" id="audio-status">保存した音声はオフラインでも再生できます。</p><audio id="player" preload="none" src="${audioPath(w.id,state.duration)}"></audio></div><p class="source">展示室の出典：<a href="${esc(w.source)}" target="_blank" rel="noreferrer">ルーブル公式資料 ↗</a> · 確認日 ${sources.checkedAt}</p></section>`;
}
function mapSvg() {
  const stops = route().ids.map((id,i)=>({w:byId[id],n:i+1})).filter(x=>x.w.floor===state.floor);
  const wingX={Denon:70,Sully:332,Richelieu:594};
  const counts={Denon:0,Sully:0,Richelieu:0};
  const position = x => { const j=counts[x.w.wing]++; return {x:wingX[x.w.wing]+70+(j%2)*75,y:170+Math.floor(j/2)*82}; };
  return `<svg id="map" viewBox="0 0 860 520" role="img" aria-label="${floorNames[state.floor]}の模式図"><rect width="860" height="520" fill="#f8f3eb"/><path d="M20 90H840M20 440H840" stroke="#ddd1c0" stroke-width="2"/>${Object.entries(wingX).map(([name,x])=>`<g><rect x="${x}" y="110" width="232" height="315" rx="23" fill="#eee4d5" stroke="#d4c3ab" stroke-width="2"/><text x="${x+116}" y="145" text-anchor="middle" class="wing-name">${name}</text></g>`).join('')}<path d="M302 280h30M564 280h30" stroke="#9f9587" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 12"/>${stops.map(x=>{const p=position(x);return `<g class="pin" data-id="${x.w.id}" tabindex="0" role="button" aria-label="${x.n} ${esc(x.w.title)} ${esc(x.w.room)}室"><circle cx="${p.x}" cy="${p.y}" r="23" fill="#a33728"/><text x="${p.x}" y="${p.y+7}" text-anchor="middle" class="pin-num">${x.n}</text><text x="${p.x}" y="${p.y+39}" text-anchor="middle" class="room-num">${esc(x.w.room)}室</text></g>`}).join('')}</svg>`;
}
function render(){
  const r=route(); const selected=byId[state.selected] || byId[r.ids[0]];
  app.innerHTML=`<header><div class="brand"><span class="mark">L</span><div><b>ルーブル、はじめての一日</b><small>非公式・日本語ガイド</small></div></div><a class="official" href="${sources.availability}" target="_blank" rel="noreferrer">本日の開室情報 ↗</a></header><main><section class="hero"><div class="eyebrow">PARIS / SELF-GUIDED VISIT</div><h1>時間に合わせて、<br>名作と出会う。</h1><p>作品の背景を知り、見るポイントを見つける。初めてのルーブルを、自分のペースで。</p><div class="route-picker"><label for="time">見学時間</label><select id="time">${routes.map(x=>`<option value="${x.minutes}" ${x.minutes===state.minutes?'selected':''}>${x.minutes}分</option>`).join('')}</select><span>${r.ids.length}作品 · ${new Set(r.ids.map(id=>byId[id].floor)).size}階層</span></div></section><section class="note"><b>このルートの目安：${total()}分</b><span>移動 ${r.walk}分 ＋ 鑑賞 ${r.ids.length*4}分 ＋ 音声 ${Math.ceil(heard())}分 ＋ 余裕 ${r.buffer}分。混雑・待機時間で変わります。</span></section><section class="layout"><div class="main-column"><div class="section-head"><div><div class="eyebrow">THE MAP</div><h2>館内の見取り図</h2></div><span class="badge">模式図 / GPS不使用</span></div><div class="floor-tabs">${floors.map(f=>`<button data-floor="${f}" class="${f===state.floor?'active':''}">${floorNames[f]}</button>`).join('')}</div><div class="map-wrap"><div class="map-scroll">${mapSvg()}</div><div class="map-controls"><button data-zoom="in" aria-label="拡大">＋</button><button data-zoom="out" aria-label="縮小">−</button><button data-zoom="reset">元に戻す</button></div></div><p class="map-caution">${esc(sources.disclaimer)}</p><div class="section-head stops-head"><div><div class="eyebrow">YOUR ROUTE</div><h2>${state.minutes}分の立ち寄り順</h2></div></div><ol class="stops">${r.ids.map((id,i)=>{const w=byId[id];return `<li><button data-select="${id}" class="stop ${w.id===selected.id?'current':''}"><span class="stop-num">${i+1}</span><span><b>${esc(w.title)}</b><small>${esc(w.wing)} · ${floorNames[w.floor]} · ${esc(w.room)}室</small></span><span class="arrow">→</span></button></li>`}).join('')}</ol></div><aside>${detail(selected)}</aside></section><section class="footer-note"><h2>訪問前に確認</h2><p>展示位置や開室状況は変わります。${sources.checkedAt}に確認した公式資料に基づく案内です。<a href="${sources.officialMap}" target="_blank" rel="noreferrer">公式館内案内</a>と<a href="${sources.availability}" target="_blank" rel="noreferrer">開室状況</a>を当日確認してください。</p><p>このアプリはルーブル美術館の公認サービスではありません。初期版は無料です。</p></section></main>`;
  document.querySelector('#map').style.transform=`scale(${state.zoom})`;
  wire();
}
function wire(){
  document.querySelector('#time').onchange=e=>{state.minutes=+e.target.value;state.selected=null;state.floor=byId[route().ids[0]].floor;render()};
  document.querySelectorAll('[data-floor]').forEach(b=>b.onclick=()=>{state.floor=+b.dataset.floor;render()});
  document.querySelectorAll('[data-select],[data-id]').forEach(b=>{const go=()=>{state.selected=b.dataset.select||b.dataset.id;state.floor=byId[state.selected].floor;render();document.querySelector('.detail').scrollIntoView({behavior:'smooth',block:'nearest'})}; b.onclick=go;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
  document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{state.duration=+b.dataset.duration;state.playing=null;render()});
  document.querySelector('[data-play]').onclick=async e=>{const a=document.querySelector('#player');if(!a.paused){a.pause();state.playing=null;e.target.textContent='▶ 再生';return}try{await a.play();state.playing=e.target.dataset.play;e.target.textContent='一時停止';a.onended=()=>{state.playing=null;e.target.textContent='▶ 再生'}}catch{document.querySelector('#audio-status').textContent='音声を開けません。通信状態を確認するか、先に端末へ保存してください。'}};
  document.querySelector('[data-download]').onclick=async e=>{const b=e.target;b.disabled=true;try{const url=audioPath(b.dataset.download,state.duration);const res=await fetch(url);if(!res.ok)throw Error('missing');const cache=await caches.open('louvre-audio-v1');await cache.put(url,res.clone());b.textContent='保存済み ✓';document.querySelector('#audio-status').textContent='音声ファイルを保存しました。オフラインでも再生できます。'}catch{b.textContent='音声未提供';document.querySelector('#audio-status').textContent='事前収録音声はまだありません。端末の日本語読み上げ機能をご利用ください。'}finally{b.disabled=false}};
  document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{state.zoom=b.dataset.zoom==='in'?Math.min(2.4,state.zoom*1.25):b.dataset.zoom==='out'?Math.max(1,state.zoom/1.25):1;document.querySelector('#map').style.transform=`scale(${state.zoom})`});
}
if('serviceWorker' in navigator)navigator.serviceWorker.register(new URL('sw.js',appBase)).catch(()=>{});
render();
