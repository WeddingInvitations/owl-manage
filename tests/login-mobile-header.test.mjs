import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/css/owl-brand.css', import.meta.url), 'utf8');

test('OwlManage login contains only login controls, not Nest reservation signup', () => {
  const login = html.split('<section class="card" id="loginView">')[1].split('<section class="card hidden" id="pendingAccessView">')[0];
  assert.match(login, /id="loginForm"/);
  assert.match(login, /id="googleLoginBtn"/);
  assert.doesNotMatch(login, /nestSignup|Crear cuenta|Alumnas y profes|<hr/);
  assert.match(login, /El acceso de OwlManage se gestiona por invitación\./);
});

test('mobile header is fixed, safe-area-aware and has a matching content offset', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 767px)'));
  assert.match(mobile, /--owl-mobile-header-height: calc\(76px \+ env\(safe-area-inset-top, 0px\)\)/);
  assert.match(mobile, /body \{ padding-top: var\(--owl-mobile-header-height\); \}/);
  assert.match(mobile, /\.app-header \{ position: fixed; top: 0; left: 0; right: 0; z-index: 10000;/);
  assert.match(mobile, /\.modal \{ top: var\(--owl-mobile-header-height\); \}/);
  assert.match(mobile, /100dvh - var\(--owl-mobile-header-height\) - 8px/);
  assert.match(mobile, /scroll-padding-top: calc\(var\(--owl-mobile-header-height\) \+ 12px\)/);
});