import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {mapTabView} from '../src/views/map-tab.js';
import {languageSelectView} from '../src/views/course-select.js';

async function loadSplitUiSources() {
  const appFiles = (await readdir(new URL('../src/app/', import.meta.url))).filter(f => f.endsWith('.js')).sort();
  const viewFiles = (await readdir(new URL('../src/views/', import.meta.url))).filter(f => f.endsWith('.js')).sort();
  const localeFiles = (await readdir(new URL('../src/locales/', import.meta.url))).filter(f => f.endsWith('.js')).sort();
  const parts = [
    await readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8')
  ];
  for (const f of appFiles) parts.push(await readFile(new URL(`../src/app/${f}`, import.meta.url), 'utf8'));
  for (const f of viewFiles) parts.push(await readFile(new URL(`../src/views/${f}`, import.meta.url), 'utf8'));
  for (const f of localeFiles) parts.push(await readFile(new URL(`../src/locales/${f}`, import.meta.url), 'utf8'));
  return {
    combined: parts.join('\n'),
    mapTabFile: await readFile(new URL('../src/views/map-tab.js', import.meta.url), 'utf8'),
    splitPaths: [
      './src/i18n.js',
      './src/supabase-config.js',
      ...localeFiles.map(f => `./src/locales/${f}`),
      ...appFiles.map(f => `./src/app/${f}`),
      ...viewFiles.map(f => `./src/views/${f}`)
    ]
  };
}

const {combined: main, mapTabFile, splitPaths} = await loadSplitUiSources();
const splashSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const courseSource = await readFile(new URL('../src/views/course-select.js', import.meta.url), 'utf8');
const routes = JSON.parse(await readFile(new URL('../src/routes.json', import.meta.url), 'utf8'));
const css = await readFile(new URL('../src/update.css', import.meta.url), 'utf8');
const support = await readFile(new URL('../src/location-support.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const config = await readFile(new URL('../src/app-config.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

assert.match(config, /APP_NAME = 'Louvre Audio Map'/, 'app name must be Louvre Audio Map');
assert.match(indexHtml, /icons\/icon-192\.png/, 'index.html must reference custom app icon');
assert.match(indexHtml, /icons\/apple-touch-icon\.png/, 'index.html must reference apple-touch-icon');
assert.ok(manifest.icons.some(i => i.src.includes('icon-512.png')), 'manifest must include custom 512px PNG icon');
assert.match(sw, /icons\/icon-192\.png/, 'Service Worker must cache custom app icons');
assert.match(main, /class="splash-mona-frame"/, 'Mona Lisa opening popup frame must be rendered on splash');
assert.match(main, /images\/mona\.jpg/, 'Mona Lisa opening popup must reference local mona.jpg');
assert.match(main, /class="theme-courses-disclosure"/, 'theme courses must be collapsible on the initial selection screen');
assert.ok(routes.filter(r => r.kind === 'theme').length >= 3, 'at least 3 themed courses should be available');
assert.match(main, /data-facility-filter="wc"/, 'toilet pickup sub-tab must exist');
assert.match(main, /data-facility-filter="cafe"/, 'cafe pickup sub-tab must exist');
assert.match(main, /data-prefer-elevator/, 'route priority toggle (shortest vs elevator) must exist');
assert.match(main, /data-toggle-autoplay/, 'continuous playback toggle must exist');
assert.match(main, /data-set-large-text/, 'text size toggle must exist');
assert.match(main, /data-clear-search/, 'search clear button must exist');
assert.match(main, /data-pick-minutes/, 'step 1 time picker must exist');
assert.match(main, /data-count-slider/, 'step 2 work count slider must exist');
assert.match(main, /data-count-input/, 'step 2 numeric work count input must exist');
assert.match(main, /この時間の限界目安/, 'limit guidance for chosen duration must be displayed');
assert.match(main, /data-start-timed-route/, 'start button for timed custom-count route must exist');
assert.match(main, /data-optimize-myplan/, 'my-plan shortest-order optimize button must exist');
assert.match(main, /route-loader-overlay/, 'route designing loading overlay must exist');
assert.match(css, /\.route-loader-overlay/, 'route designing loading overlay styles must exist');
const mapTabSection = mapTabFile.slice(mapTabFile.indexOf('export function mapTabView('));
assert.match(mapTabSection, /<main class="tab-screen map-screen[^"]*">\s*<div class="map-frame">/, 'map-frame must appear at the very top of the Map tab');
assert.doesNotMatch(mapTabSection, /navigationPanel\(/, 'bulky route-guidance card must not appear in the Map tab');
assert.match(main, /offline-pill/, 'online/offline status pill must exist');
assert.match(main, /planStopEstimates/, 'cumulative elapsed time estimates must be wired');
assert.doesNotMatch(main, /data-focus-destination/, 'auto-zoom button must not be added per user preference');
assert.doesNotMatch(main, /data-work-note/, 'memo feature must not be added per user preference');

assert.match(main, /<details class="movement-support"/, 'movement support must be collapsible below the map');
assert.match(main, /現在地を修正する/);
assert.match(main, /道に迷ったとき/);
assert.match(main, /部屋番号を確認してください/);
assert.match(main, /この地点から経路を作成できません。別の部屋番号を入力してください/);
assert.match(support, /map\.errRouteFromHere/);
assert.match(main, /情報更新日：\{date\}/);
assert.match(main, /sources\.checkedAt/);
assert.match(main, /ご利用前の確認・情報について/);
assert.match(main, /sources\.officialMap/);
assert.match(main, /sources\.availability/);
assert.match(main, /公認サービスではありません/);
assert.doesNotMatch(main, /map-caution|route-data-note|GPS現在地|GPS不使用/);
assert.doesNotMatch(main, /単独再生/, 'audio rows must show tier badges instead of 単独再生');
assert.doesNotMatch(main, /作品タップで解説を読みながら再生できます/, 'verbose audio catalog intro paragraph must stay removed');
assert.match(main, /'tabs\.map': 'マップ'/);
assert.match(main, /'tabs\.plan': 'プラン一覧'/);
assert.match(main, /'tabs\.audio': '音声一覧'/);
assert.match(main, /'tabs\.settings': '案内・設定'/);
assert.match(main, /data-set-lang/, 'language switcher controls must exist');
assert.doesNotMatch(splashSource, /data-splash-lang|data-splash-start/, 'splash must not ask for language selection');
const languageMarkup = languageSelectView({state: {lang: 'ja'}});
assert.match(languageMarkup, /class="home-language-list"/, 'language page must offer a scrollable list');
assert.ok(languageMarkup.indexOf('data-set-lang="en"') < languageMarkup.indexOf('data-set-lang="fr"')
  && languageMarkup.indexOf('data-set-lang="fr"') < languageMarkup.indexOf('data-set-lang="ja"'), 'language page must show English, French, Japanese first');
assert.match(languageMarkup, /data-language-next/, 'language page must have a next button');
assert.doesNotMatch(courseSource.split('export function courseSelectView')[1].split('export function wireCourseSelect')[0], /home-language-list|data-set-lang/, 'route page must not repeat language selection');
assert.match(splashSource, /appPhase = 'select_language'/, 'splash must lead to the language page');
assert.match(css, /\.home-language-list\s*\{[^}]*overflow-y:\s*auto/s, 'language list must scroll vertically');
assert.match(css, /\.course-brand-icon\s*\{[^}]*width:\s*\d+px/s, 'auth gate brand icon must have explicit dimensions');
assert.match(css, /\.lang-pill\s*\{/, 'auth gate language switcher pills must be styled');
assert.match(main, /data-change-course/);
assert.match(main, /data-replay-onboarding/, 'settings tab must offer replay trigger for onboarding tour');
assert.match(main, /data-tour-overlay/, 'coach-mark onboarding overlay must exist');
assert.match(main, /progress-next-strip/, 'plan tab progress area must surface next-stop quick action strip');
assert.match(sw, /serveAudioWithRange/, 'Service Worker must support HTTP 206 Range responses for offline audio seeking');
assert.match(main, /myplan-dock/, 'audio catalog must render floating My Plan summary dock when items are added');
assert.doesNotMatch(mapTabSection, /floor-jump-banner|data-jump-floor/, 'floor jump banner must not be shown on the Map tab per user preference');
assert.match(mapTabSection, /has-destination/, 'floor tab must highlight the floor containing the next artwork');
assert.match(mapTabSection, /class="floor-next-badge"/, 'floor tab must display a clear next-artwork badge on the destination floor');
assert.match(css, /\.floor-tabs button\.has-destination/, 'destination floor tab highlight style must exist');
assert.match(css, /\.floor-next-badge/, 'destination floor badge style must exist');
assert.match(main, /data-mini-prev/, 'Spotify-style player must provide ⏮ previous control');
assert.match(main, /data-mini-play/, 'Spotify-style player must provide ▶/⏸ toggle');
assert.match(main, /data-mini-next/, 'Spotify-style player must provide ⏭ next/complete control');
assert.match(main, /data-mini-close/, 'mini player must provide ✕ close/dismiss button');
assert.match(main, /data-seek/, 'Spotify-style player must provide interactive seek bar');
assert.match(main, /data-open-audio-settings/, 'top-right audio settings trigger must exist');
assert.match(main, /data-rate-slider/, 'audio settings must include playback speed adjustment');
assert.match(main, /data-bulk-download/, 'offline bulk course download must be provided');
assert.match(main, /mediaSession/, 'Media Session API integration must be wired');
assert.match(sw, /floor-map-geo\.js/, 'Service Worker must cache floor-map-geo.js for offline map support');
for (const assetPath of splitPaths) {
  assert.ok(sw.includes(`'${assetPath}'`), `Service Worker must cache split module ${assetPath}`);
}
assert.equal(routes.some(route => route.minutes === 60), false, 'the 60 minute route must not be offered');
assert.match(css, /\.tier-badge\.tier-gold/, 'gold badge style required for 超有名');
assert.match(css, /\.tier-badge\.tier-silver/, 'silver badge style required for 有名');
assert.match(css, /\.tier-badge\.tier-bronze/, 'bronze badge style required for 傑作');
assert.match(css, /\.room-input-row input \{[^}]*min-height:\s*44px/s, 'room input needs a mobile tap target');
assert.match(css, /\.bottom-tabs \{[^}]*position:\s*fixed;[^}]*bottom:\s*0/s, 'bottom tabs must be fixed at the bottom for one-handed use');

// Dynamic check: destination floor (including floor 0) gets the red highlight + 次の作品 badge; complete route gets none
{
  const works = JSON.parse(await readFile(new URL('../src/works.json', import.meta.url), 'utf8'));
  const byId = Object.fromEntries(works.map(w => [w.id, w]));
  const baseCtx = (nav) => ({
    state: {lang: 'ja', floor: 1, facilityFilter: 'none', preferElevator: false, viewed: new Set(), support: {open: false, editing: false, room: '', error: '', candidates: [], selectedCandidateId: null}},
    works,
    byId,
    navigationGraph: {roomNotices: []},
    currentPlan: () => ({label: 'テスト', ids: ['venus'], routableIds: ['venus']}),
    planWorks: () => [byId.venus].filter(Boolean),
    navigationView: () => nav,
    currentEstimates: () => ({})
  });
  const htmlFloor0Dest = mapTabView(baseCtx({
    available: true,
    complete: false,
    destinationNode: {id: 'work:venus', workId: 'venus', floor: 0, x: 795.7, y: 364.1, label: 'ミロのヴィーナス'},
    routeFloors: [0, 1],
    transitions: [],
    passedSegments: [],
    remainingSegments: [],
    plannedSegments: []
  }), false);
  assert.match(htmlFloor0Dest, /data-floor="0" data-destination-floor="true"[^>]*has-destination[^>]*>\s*<em class="floor-next-badge">次の作品<\/em>/, 'floor 0 destination must show has-destination and 次の作品 badge');
  assert.doesNotMatch(htmlFloor0Dest, /data-floor="1" data-destination-floor="true"/, 'non-destination floor must not be marked as destination');

  const htmlComplete = mapTabView(baseCtx({
    available: true,
    complete: true,
    destinationNode: null,
    routeFloors: [0, 1],
    transitions: [],
    passedSegments: [],
    remainingSegments: [],
    plannedSegments: []
  }), false);
  assert.doesNotMatch(htmlComplete, /floor-next-badge|data-destination-floor="true"/, 'completed route must not show a 次の作品 floor badge');
}

console.log('support and information UI contract: passed');
