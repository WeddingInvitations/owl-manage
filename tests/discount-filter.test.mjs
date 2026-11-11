import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { discountReasonOptions, matchesDiscountReason, matchesListDiscountReason, initializeDiscountFilters } from '../public/js/discount-filter.mjs';

for (const [reason] of discountReasonOptions) {
  test(`matches filter ${reason}`, () => {
    for (const [actual] of discountReasonOptions.filter(([value]) => value !== 'ALL')) {
      assert.equal(matchesDiscountReason(actual, reason), reason === 'ALL' || actual === reason);
    }
  });
}

test('missing and blank monthly reasons are Ninguno, not Otro', () => {
  for (const reason of ['', '  ', null, undefined, 'Ninguno']) {
    assert.equal(matchesDiscountReason(reason, 'Ninguno'), true);
    assert.equal(matchesDiscountReason(reason, 'Otro'), false);
    assert.equal(matchesDiscountReason(reason), true);
  }
  assert.equal(matchesDiscountReason(' Familiar ', 'Familiar'), true);
});

test('discount filter combines with payment, month, tariff and name without mutating data', () => {
  const records = [
    { name: 'Ana', month: '2026-11', tariff: '8/mes', paid: true, discountReason: 'Familiar' },
    { name: 'Ana', month: '2026-10', tariff: '8/mes', paid: true, discountReason: 'Familiar' },
    { name: 'Ana', month: '2026-11', tariff: '8/mes', paid: false, discountReason: 'Familiar' },
    { name: 'Ana', month: '2026-11', tariff: '8/mes', paid: true, discountReason: 'Otro' },
  ];
  const original = JSON.stringify(records);
  const result = records.filter((record) => record.month === '2026-11' && record.paid && record.tariff === '8/mes' && record.name.includes('Ana') && matchesDiscountReason(record.discountReason, 'Familiar'));
  assert.equal(result.length, 1);
  assert.equal(JSON.stringify(records), original);
});

const lists = ['athlete', 'acro', 'acroKids', 'halte', 'telas', 'singleClasses', 'pilates'];

test('all seven selectors initialize and changing them rerenders the correct list', async () => {
  const previousDocument = globalThis.document;
  const previousOption = globalThis.Option;
  const selectors = new Map();
  const calls = Object.fromEntries(lists.map((list) => [list, 0]));
  for (const list of lists) selectors.set(`${list}DiscountReasonFilter`, {
    value: 'ALL', options: [], listeners: {},
    replaceChildren(...options) { this.options = options; },
    addEventListener(event, listener) { this.listeners[event] = listener; },
  });
  globalThis.document = { getElementById: (id) => selectors.get(id) };
  globalThis.Option = class { constructor(label, value) { this.textContent = label; this.value = value; } };
  try {
    initializeDiscountFilters(Object.fromEntries(lists.map((list) => [list, () => { calls[list] += 1; }])));
    for (const list of lists) {
      const select = selectors.get(`${list}DiscountReasonFilter`);
      assert.deepEqual(select.options.map((option) => option.value), discountReasonOptions.map(([value]) => value));
      select.value = 'Funcionario';
      select.listeners.change();
      await Promise.resolve();
      assert.equal(calls[list], 1);
      assert.equal(matchesListDiscountReason(list, 'Funcionario'), true);
      assert.equal(matchesListDiscountReason(list, 'Familiar'), false);
      select.value = 'ALL';
      assert.equal(matchesListDiscountReason(list, ''), true);
    }
    assert.equal(matchesListDiscountReason('missing', 'Familiar'), true);
  } finally {
    globalThis.document = previousDocument;
    globalThis.Option = previousOption;
  }
});

test('HTML and actual row renderers wire every discount filter', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const pilates = await readFile(new URL('../public/js/pilates.js', import.meta.url), 'utf8');
  for (const list of lists) {
    assert.equal((html.match(new RegExp(`id="${list}DiscountReasonFilter"`, 'g')) || []).length, 1);
    assert.match(html, new RegExp(`id="${list}MoreFiltersPanel"[\\s\\S]*?id="${list}DiscountReasonFilter"`));
    assert.ok((list === 'pilates' ? pilates : main).includes(`matchesListDiscountReason("${list}",`));
  }
  assert.match(main, /singleClasses: filterAndRenderSingleClassesList/);
  // Previous request: reservations menu remains removed; management stays available.
  assert.doesNotMatch(html, /<button[^>]+data-view="nest(?:Pilates|Barre)BookingView"/);
  assert.match(html, /data-view="pilatesView"/);
});