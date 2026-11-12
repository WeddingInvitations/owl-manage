import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const guidePath = 'public-reservas/docs/guia_the_nest_estilo_web.pdf';

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
    const button = panel.match(/<button\b[^>]*data-guide-open[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(button, 'Each panel needs a guide button');
    assert.ok(button.includes('type="button"'));
    assert.ok(button.includes('aria-haspopup="dialog"'));
    assert.ok(button.includes('aria-controls="bookingGuideDialog"'));
    assert.ok(button.includes('Guía de uso'));
    assert.equal(button.includes('target="_blank"'), false);
  }
  assert.match(html, /<dialog id="bookingGuideDialog"[^>]*aria-labelledby="bookingGuideTitle"/);
  assert.match(html, /id="bookingGuideClose"[^>]*>Cerrar guía ×<\/button>/);
  assert.match(html, /data-guide-src="docs\/guia_the_nest_estilo_web.pdf"/);
  assert.match(html, /src="js\/guide.js\?v=/);
  assert.match(html, /<h1>Reserva tu <em>clase\.<\/em><\/h1>/);
});

test('Firebase hosts the guide as a static file from the reservations directory', async () => {
  const config = JSON.parse(await readFile(new URL('firebase.json', root), 'utf8'));
  const hosting = config.hosting.find((site) => site.target === 'nest-reservas');
  assert.equal(hosting.public, 'public-reservas');
  assert.ok(!hosting.ignore.some((pattern) => /pdf|docs/.test(pattern)));
});