// Local diff guard for visual-only work. Compares against the committed UI;
// requires git, performs no network calls and never executes application code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const previous = execFileSync('git', ['show', 'HEAD:public/index.html'], { encoding: 'utf8' });
const current = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const functionalAttributes = new Set(['id', 'type', 'name', 'min', 'max', 'step', 'minlength', 'maxlength', 'value', 'action', 'method', 'pattern', 'disabled', 'checked', 'selected', 'multiple', 'required']);
function contract(html) {
  return [...html.matchAll(/<[a-z][\w-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)]
    .filter(([tag]) => !/^<(?:meta|link)\b/i.test(tag))
    .map(([tag]) => {
      const attributes = [...tag.matchAll(/\b([\w-]+)="([^"]*)"/g)]
        .filter(([, name]) => functionalAttributes.has(name) || name.startsWith('data-'))
        .map(([, name, value]) => [name, value]);
      const flags = [...tag.matchAll(/\s(required|disabled|checked|selected|multiple)(?=\s|\/?>)/g)].map(match => match[1]);
      return { tag: tag.match(/^<([\w-]+)/)[1], attributes, flags };
    }).filter(tag => tag.attributes.length || tag.flags.length);
}
assert.deepEqual(contract(current), contract(previous), 'Functional DOM attributes changed');
function scripts(html) { return [...html.replace(/\r\n/g, '\n').matchAll(/<script\b[\s\S]*?<\/script>/g)].map(match => match[0]); }
assert.deepEqual(scripts(current), scripts(previous), 'Script content or loading changed');
const businessChanges = execFileSync('git', ['diff', 'HEAD', '--', 'public/js', 'functions', 'public-reservas', 'firestore.rules', 'firestore.indexes.json', 'firebase.json'], { encoding: 'utf8' });
assert.equal(businessChanges, '', 'Changes outside the OwlManage presentation layer');
console.log('Verified: all IDs, form attributes, option values, data attributes and scripts unchanged.');
console.log('Verified: no changes to business logic, Firebase, functions or the separate reservations app.');