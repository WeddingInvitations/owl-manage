import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('push pipeline preserves App Engine and deploys only reservations Hosting in parallel', async () => {
  const config = await readFile(new URL('../cloudbuild.yaml', import.meta.url), 'utf8');
  assert.match(config, /args: \["app", "deploy", "app.yaml", "--quiet"\]/);
  assert.match(config, /id: deploy-nest-reservas[\s\S]*?entrypoint: bash[\s\S]*?args: \["scripts\/deploy-firebase.sh", "hosting:nest-reservas"\][\s\S]*?waitFor: \["-"\]/);
  assert.equal((config.match(/waitFor: \["-"\]/g) || []).length, 2);
  assert.match(config, /id: verify-nest-reservas[\s\S]*?args: \["scripts\/verify-hosting.mjs", "nest-reservas"\][\s\S]*?waitFor: \["deploy-nest-reservas"\]/);
  assert.match(config, /name: node:22-bookworm/);
  assert.doesNotMatch(config, /FIREBASE_TOKEN|functions:|firestore:|hosting:owlmanage/);
});

test('Firebase deployment uses the explicit project, pinned CLI and success checks', async () => {
  const script = await readFile(new URL('../scripts/deploy-firebase.sh', import.meta.url), 'utf8');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /firebase-tools@14\.22\.0 deploy/);
  assert.match(script, /--project owl-manage/);
  assert.match(script, /--only "\$target"/);
  assert.match(script, /--non-interactive/);
  assert.match(script, /Deploy complete!/);
  assert.match(script, /failed to \(create\|update\|delete\|deploy\) function/);
});

// Run the real verifier with an offline fetch stub; no deployment or production reads.
function runVerifier(args = [], { mismatch = false } = {}) {
  const preload = `
    import { readFile } from 'node:fs/promises';
    globalThis.fetch = async (url) => {
      const directory = url.hostname === 'the-nest-reservas.web.app' ? 'public-reservas' : 'public';
      const data = await readFile(directory + decodeURIComponent(url.pathname));
      const bytes = ${mismatch ? "Buffer.from('not the deployed file')" : 'data'};
      return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    };
  `;
  return spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`,
    'scripts/verify-hosting.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 30_000 });
}

test('scoped verification checks reservations including PDF, without checking OwlManage', () => {
  const result = runVerifier(['nest-reservas']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified \d+ published files: https:\/\/the-nest-reservas.web.app/);
  assert.doesNotMatch(result.stdout, /https:\/\/owl-manage.web.app/);
});

test('verification without a target preserves both-site checks', () => {
  const result = runVerifier();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /https:\/\/owl-manage.web.app/);
  assert.match(result.stdout, /https:\/\/the-nest-reservas.web.app/);
});

test('verification fails on mismatched files and rejects unknown targets', () => {
  const mismatch = runVerifier(['nest-reservas'], { mismatch: true });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /Hosting still serves different content/);
  const invalid = runVerifier(['unknown']);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Usage:/);
});