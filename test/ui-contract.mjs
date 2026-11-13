import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/update.css', import.meta.url), 'utf8');
const support = await readFile(new URL('../src/location-support.js', import.meta.url), 'utf8');

assert.match(main, /<details class="movement-support"/, 'movement support must be collapsible below the map');
assert.match(main, /現在地を修正する/);
assert.match(main, /道に迷ったとき/);
assert.match(main, /部屋番号を確認してください/);
assert.match(support, /この地点から経路を作成できません。別の部屋番号を入力してください/);
assert.match(main, /情報更新日：\$\{esc\(sources\.checkedAt\)\}/);
assert.match(main, /ご利用前の確認・情報について/);
assert.match(main, /sources\.officialMap/);
assert.match(main, /sources\.availability/);
assert.match(main, /公認サービスではありません/);
assert.doesNotMatch(main, /map-caution|route-data-note|GPS現在地|GPS不使用/);
assert.match(css, /\.room-input-row input \{[^}]*min-height:44px/s, 'room input needs a mobile tap target');

console.log('support and information UI contract: passed');
