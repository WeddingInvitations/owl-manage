import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const guidePath = 'public-reservas/docs/guia_the_nest_estilo_web.pdf';
const guideHref = 'docs/guia_the_nest_estilo_web.pdf';

test('published guide is an unchanged copy of the original PDF', async () => {
  const original = await readFile(new URL('guia_the_nest_estilo_web.pdf', root));
  const published = await readFile(new URL(guidePath, root));
  assert.equal(published.subarray(0, 5).toString(), '%PDF-');
  assert.deepEqual(published, original);
});

test('guide is available before login and inside the shared Pilates/Barre booking panel', async () => {
  const html = await readFile(new URL('public-reservas/index.html', root), 'utf8');
  const welcome = html.slice(html.indexOf('<section id="welcomePanel"'), html.indexOf('<section id="pendingPanel"'));
  const booking = html.slice(html.indexOf('<section id="bookingPanel"'), html.indexOf('<div id="profileSettingsModal"'));
  for (const panel of [welcome, booking]) {
    const link = panel.match(/<a\b[^>]*class="[^"]*booking-guide-link[^"]*"[^>]*>[\s\S]*?<\/a>/)?.[0];
    assert.ok(link, 'Each panel needs a guide link');
    assert.ok(link.includes(`href="${guideHref}"`));
    assert.ok(link.includes('target="_blank"'));
    assert.ok(link.includes('rel="noopener noreferrer"'));
    assert.ok(link.includes('type="application/pdf"'));
    assert.ok(link.includes('Guía de uso'));
    assert.ok(link.includes('se abre en una pestaña nueva'));
    assert.equal(link.includes('download='), false, 'Guide opens for reading rather than forcing a download');
  }
});

test('Firebase hosts the guide as a static file from the reservations directory', async () => {
  const config = JSON.parse(await readFile(new URL('firebase.json', root), 'utf8'));
  const hosting = config.hosting.find((site) => site.target === 'nest-reservas');
  assert.equal(hosting.public, 'public-reservas');
  assert.ok(!hosting.ignore.some((pattern) => /pdf|docs/.test(pattern)));
});