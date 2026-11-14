import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('actual monthly summary renders detail without CSV and preserves monthly/yearly balances', async () => {
  const source = await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const helper = source.match(/function renderMonthlySummary\([^]*?\n\}/)[0];
  const body = { children: [], appendChild(row) { this.children.push(row); }, prepend(row) { this.children.unshift(row); } };
  const context = vm.createContext({
    ui: { monthlySummaryBody: body }, selectedYear: '2026',
    getCurrentYearMonths: () => ['2026-10', '2026-11'],
    monthlyDetails: new Map([
      ['2026-10', { payments: [{ amount: 200 }], expenses: [{ amount: 50 }] }],
      ['2026-11', { payments: [{ amount: 300 }], expenses: [{ amount: 100 }] }],
    ]),
    getMonthLabel: key => key, formatCurrency: value => `${value} EUR`,
    document: { createElement: () => ({}) },
  });
  vm.runInContext(helper, context);
  context.renderMonthlySummary();
  assert.equal(body.children.length, 3);
  for (const row of body.children) assert.doesNotMatch(row.innerHTML, /data-action="csv"|>CSV</);
  assert.match(body.children[0].innerHTML, /Total 2026[^]*500 EUR[^]*150 EUR[^]*350 EUR/);
  assert.match(body.children[1].innerHTML, /data-action="detail" data-key="2026-11"[^]*300 EUR[^]*100 EUR[^]*200 EUR/);
  assert.match(body.children[2].innerHTML, /data-action="detail" data-key="2026-10"[^]*200 EUR[^]*50 EUR[^]*150 EUR/);
  for (const row of body.children.slice(1)) assert.match(row.innerHTML, />Ver detalle<\/button>/);
});