import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const sites = [
  { directory: 'public', origin: 'https://owl-manage.web.app' },
  { directory: 'public-reservas', origin: 'https://the-nest-reservas.web.app' },
];

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'firebase.json') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (entry.isFile()) yield path;
  }
}

function digest(data) {
  return createHash('sha256').update(data).digest('hex');
}

// Verify every deployed static file, not merely the existence of the Admin button.
// A cache-busting query avoids mistaking a previously cached release for this build.
for (const site of sites) {
  const root = resolve(site.directory);
  let count = 0;
  for await (const path of files(root)) {
    const asset = relative(root, path).split(sep).map(encodeURIComponent).join('/');
    const url = new URL(asset, `${site.origin}/`);
    url.searchParams.set('buildVerification', process.env.BUILD_ID || String(Date.now()));
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Hosting verification failed: ${site.origin}/${asset} HTTP ${response.status}`);
    const published = Buffer.from(await response.arrayBuffer());
    const local = await readFile(path);
    if (digest(published) !== digest(local)) {
      throw new Error(`Hosting still serves different content: ${site.origin}/${asset}`);
    }
    count += 1;
  }
  console.log(`Verified ${count} published files: ${site.origin}`);
}