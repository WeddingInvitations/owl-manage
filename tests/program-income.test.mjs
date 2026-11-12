import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { programIncomeTotals } from '../public/js/program-income.mjs';

const kids = [
  { month: '2026-11', paid: true, price: 40 },
  { month: '2026-11', paid: false, price: 90 },
  { month: '2026-11', paid: true, price: 120, durationMonths: 3, isPaymentMonth: true },
  { month: '2026-12', paid: true, price: 120, durationMonths: 3, isPaymentMonth: false },
  { month: '2026-11', paid: true, price: 'invalid' },
];
const nest = [
  { athleteId: 'same', month: '2026-11', paid: true, price: 75, tariff: 'Reformer 4' },
  { athleteId: 'same', month: '2026-11', paid: true, price: 60, family: 'barre' },
  { month: '2026-11', paid: false, price: 80, tariff: 'Barre 8' },
  { month: '2026-12', paid: true, price: 100, tarifa: 'Barre 12' },
];

test('paid Acrokids and both Nest disciplines count independently, once per payment month', () => {
  assert.deepEqual(programIncomeTotals(kids, nest), [
    { concept: 'Cuotas Acrokids (total)', month: '2026-11', amount: 160 },
    { concept: 'Cuotas The Nest Pilates (total)', month: '2026-11', amount: 75 },
    { concept: 'Cuotas The Nest Barre (total)', month: '2026-11', amount: 60 },
    { concept: 'Cuotas The Nest Barre (total)', month: '2026-12', amount: 100 },
  ]);
});

test('missing month and legacy Nest records are retained; stored discounted prices are not discounted again', () => {
  const records = [{ paid: true, price: 45, discount: 50 }];
  assert.deepEqual(programIncomeTotals([], records), [{ concept: 'Cuotas The Nest (total)', month: 'sin-fecha', amount: 45 }]);
  assert.equal(records[0].price, 45);
});

async function loadDataWithMocks() {
  const fixtures = {
    payments: [{ date: '2026-11-01', concept: 'Otro ingreso', amount: 20 }],
    expenses: [{ date: '2026-11-01', concept: 'Gasto', amount: 10 }],
    athlete_months: [{ month: '2026-11', paid: true, price: 50 }],
    athlete_acrokids_months: kids,
    athlete_pilates_months: nest,
  };
  const original = await readFile(new URL('../public/js/data.js', import.meta.url), 'utf8');
  const source = original.replace(/import\s+[\s\S]*?\s+from\s+"[^"]+";/g, '');
  const prelude = `
    const db = {}, functions = {};
    const fixtures = ${JSON.stringify(fixtures)};
    const collection = (_, name) => name;
    const getDocs = async name => {
      const docs = (fixtures[name] || []).map((record, id) => ({id: String(id), data: () => record}));
      return { docs, forEach: fn => docs.forEach(fn) };
    };
    const httpsCallable = () => () => {};
    const programIncomeTotals = ${programIncomeTotals.toString()};
  `;
  return import(`data:text/javascript;base64,${Buffer.from(prelude + source).toString('base64')}`);
}

test('actual summary includes new income in monthly, totals, years and detail without double counting', async () => {
  const data = await loadDataWithMocks();
  const summary = await data.loadSummary({}, String);
  assert.equal(summary.monthly.get('2026-11').income, 365);
  assert.equal(summary.monthly.get('2026-12').income, 100);
  assert.equal(summary.totals.income, 465);
  assert.equal(summary.totals.expenses, 10);
  const november = summary.details.get('2026-11').payments;
  assert.equal(november.reduce((sum, item) => sum + item.amount, 0), 365);
  assert.equal(november.filter((item) => item.concept.includes('The Nest')).length, 2);
  assert.deepEqual(await data.getPaymentMonthsWithAthletes(), ['2026-12', '2026-11']);
});

test('actual income list shows monthly category totals, excluding unpaid and continuation months', async () => {
  const data = await loadDataWithMocks();
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ children: [], appendChild(child) { this.children.push(child); } }) };
  try {
    const target = { children: [], appendChild(child) { this.children.push(child); } };
    await data.loadPaymentsWithAthleteTotals(target, (amount) => `${amount} EUR`, '2026-11');
    const texts = target.children.flatMap((node) => node.children.map((child) => child.textContent || ''));
    assert.ok(texts.some((text) => text.includes('Acrokids') && text.includes('160 EUR')));
    assert.ok(texts.some((text) => text.includes('The Nest Pilates') && text.includes('75 EUR')));
    assert.ok(texts.some((text) => text.includes('The Nest Barre') && text.includes('60 EUR')));
    assert.ok(!texts.some((text) => text.includes('100 EUR')));
  } finally { globalThis.document = previous; }
});