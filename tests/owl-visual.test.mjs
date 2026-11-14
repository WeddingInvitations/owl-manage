import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/css/owl-brand.css', import.meta.url), 'utf8');

test('OWL uses the supplied logo from the published directory, including the favicon', async () => {
  const source = await readFile(new URL('../logo_owl.jpeg', import.meta.url));
  const published = await readFile(new URL('../public/css/images/logo_owl.jpeg', import.meta.url));
  assert.deepEqual(published, source);
  assert.match(html, /rel="icon"[^>]*href="css\/images\/logo_owl\.jpeg"/);
  assert.match(html, /src="css\/images\/logo_owl\.jpeg"[^>]*class="logo-img"/);
  assert.doesNotMatch(html, /src="css\/images\/owl\.png"/);
});

test('the visual layer is loaded last and preserves the existing main entry point', () => {
  const sheets = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match => match[1]);
  assert.match(sheets.at(-1), /^css\/owl-brand\.css\?v=/);
  assert.match(html, /<script type="module" src="js\/main\.js\?v=20261111discount1" defer><\/script>/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\.hidden\b/);
  assert.doesNotMatch(css, /\.menu-section-content[^{}]*\{[^}]*display\s*:/);
});

test('authentication forms and initial visibility remain available to existing handlers', () => {
  for (const id of ['loginForm', 'nestSignupForm', 'profileForm', 'paymentForm', 'expenseForm', 'passwordChangeForm']) {
    assert.match(html, new RegExp(`<form[^>]*id="${id}"`));
  }
  assert.match(html, /id="loginEmail" type="email"[^>]*required/);
  assert.match(html, /id="loginPassword" type="password"[^>]*required/);
  assert.match(html, /id="nestSignupPassword" type="password" minlength="6"[^>]*required/);
  assert.match(html, /id="mainShell" class="main-shell hidden"/);
  assert.match(html, /id="summaryView" class="view hidden"/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'DOM IDs must stay unique');
});

test('desktop and mobile navigation still target existing views', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const [, view] of html.matchAll(/\bdata-view="([^"]+)"/g)) {
    assert.ok(view === 'moreView' || ids.has(view), `Missing view: ${view}`);
  }
  for (const section of ['contabilidad', 'usuarios', 'equipo', 'admin']) {
    assert.match(html, new RegExp(`data-toggle="${section}"`));
    assert.match(html, new RegExp(`data-content="${section}"`));
  }
});

test('both themes, readable primary actions and reduced-motion preferences are supported', () => {
  assert.match(css, /body\.light\s*\{/);
  assert.match(css, /--owl-yellow:\s*#f5cf24/);
  assert.match(css, /\.btn\s*\{[^}]*color:\s*var\(--owl-ink\)/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});