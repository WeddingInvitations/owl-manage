import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const portal = new URL('../public-reservas/', import.meta.url);

async function assertPng(path, size) {
  const bytes = await readFile(new URL(path, portal));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
}

test('Android manifest defines The Nest name, standalone launch and valid square icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', portal), 'utf8'));
  assert.equal(manifest.name, 'The Nest Reservas');
  assert.equal(manifest.short_name, 'The Nest');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((icon) => icon.sizes === `${size}x${size}`);
    assert.ok(icon);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.purpose, 'any');
    await assertPng(icon.src, size);
  }
});

test('portal links the manifest, iPhone touch icon and browser favicon', async () => {
  const html = await readFile(new URL('index.html', portal), 'utf8');
  assert.match(html, /rel="manifest" href="manifest.webmanifest\?v=/);
  assert.match(html, /name="apple-mobile-web-app-title" content="The Nest"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="icons\/the-nest-180.png"/);
  assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="icons\/the-nest-32.png"/);
  await assertPng('icons/the-nest-180.png', 180);
  await assertPng('icons/the-nest-32.png', 32);
});

test('website header uses the new The Nest logo', async () => {
  const html = await readFile(new URL('index.html', portal), 'utf8');
  assert.match(html, /class="brand-mark-image" src="icons\/the-nest-192.png"/);
  await assertPng('icons/the-nest-192.png', 192);
});