import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { initializeDiscountFilters, matchesListDiscountReason } from '../public/js/discount-filter.mjs';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/css/owl-brand.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8');

test('Atletas, Acrobacias and AcroKids use income-style headings without replacing their month IDs', () => {
  for (const [prefix, title] of [['athlete', 'Atletas'], ['acro', 'Acrobacias'], ['acroKids', 'AcroKids']]) {
    assert.match(html, new RegExp(`class="accounting-heading"[^]*?<h2>${title}<\\/h2>\\s*<span id="${prefix}SummaryMonthLabel" class="accounting-month-title"`));
    assert.equal((html.match(new RegExp(`id="${prefix}SummaryMonthLabel"`, 'g')) || []).length, 1);
  }
});

test('actual month title helper uppercases new headings, preserving legacy titles elsewhere', () => {
  const helper = main.match(/function updateSummaryMonthLabel\([^]*?\n\}/)[0];
  const context = vm.createContext({ getMonthLabel: key => key === '2026-10' ? 'octubre de 2026' : 'noviembre de 2026' });
  vm.runInContext(helper, context);
  const heading = { classList: { contains: value => value === 'accounting-month-title' } };
  context.updateSummaryMonthLabel(heading, '2026-11');
  assert.equal(heading.textContent, 'NOVIEMBRE DE 2026');
  context.updateSummaryMonthLabel(heading, '2026-10');
  assert.equal(heading.textContent, 'OCTUBRE DE 2026');
  context.updateSummaryMonthLabel(heading, '');
  assert.equal(heading.textContent, '');
  const legacy = { classList: { contains: () => false } };
  context.updateSummaryMonthLabel(legacy, '2026-11');
  assert.equal(legacy.textContent, '· noviembre de 2026');
});

test('mobile field placement groups tariff/paid, price/discount/final and reason/payment method', () => {
  const group = ':is(#athletesView, #acroView, #acroKidsView)';
  const expected = [[1, '1 / -1', 1], [2, '1 / 4', 2], [7, '4 / 7', 2], [3, '1 / 3', 3], [4, '3 / 5', 3], [6, '5 / 7', 3], [5, '1 / 4', 4], [8, '4 / 7', 4]];
  for (const [column, grid, row] of expected) {
    assert.ok(css.includes(`${group} .athlete-table-mobile td:nth-child(${column}) { grid-column: ${grid}; grid-row: ${row}; }`));
  }
  assert.ok(css.indexOf(group + ' .athlete-table-mobile tr') > css.indexOf('@media (max-width: 767px)'));
});

test('all three reason filters start at Todos and still rerender the selected reason', async () => {
  const previousDocument = globalThis.document, previousOption = globalThis.Option;
  const selectors = new Map(), calls = [];
  for (const list of ['athlete', 'acro', 'acroKids']) selectors.set(`${list}DiscountReasonFilter`, {
    value: 'Ninguno', options: [],
    replaceChildren(...options) { this.options = options; },
    addEventListener(_, callback) { this.change = callback; },
  });
  globalThis.document = { getElementById: id => selectors.get(id) };
  globalThis.Option = class { constructor(label, value) { this.textContent = label; this.value = value; } };
  try {
    initializeDiscountFilters(Object.fromEntries(['athlete', 'acro', 'acroKids'].map(list => [list, () => calls.push(list)])));
    for (const list of ['athlete', 'acro', 'acroKids']) {
      const select = selectors.get(`${list}DiscountReasonFilter`);
      assert.equal(select.value, 'ALL');
      assert.equal(select.options[0].textContent, 'Todos');
      assert.equal(matchesListDiscountReason(list, 'Familiar'), true);
      select.value = 'Familiar';
      select.change();
      await Promise.resolve();
      assert.ok(calls.includes(list));
      assert.equal(matchesListDiscountReason(list, 'Ninguno'), false);
    }
  } finally { globalThis.document = previousDocument; globalThis.Option = previousOption; }
});

test('mobile price cells keep their numeric span and euro text on the same line', () => {
  assert.match(css, /td:nth-child\(6\) \{ display: block !important; font-size: clamp\(11px, 3vw, 13px\);[^}]*white-space: nowrap/);
  assert.match(css, /td:nth-child\(6\) > span \{ display: inline; font-size: inherit; \}/);
  assert.match(css, /td:nth-child\(6\)::before \{ display: block; white-space: normal; \}/);
  for (const role of ['price', 'final-price', 'acro-price', 'acro-final-price', 'acroKids-price', 'acroKids-final-price']) {
    assert.ok(main.includes(`data-role="${role}"`), `The editable numeric span must remain: ${role}`);
  }
});