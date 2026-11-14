import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { programIncomeTotals } from '../public/js/program-income.mjs';
import { incomeRowPresentation } from '../public/js/income-presentation.mjs';

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

async function loadDataWithMocks(extraFixtures = {}) {
  const fixtures = {
    payments: [{ date: '2026-11-01', concept: 'Otro ingreso', amount: 20 }],
    expenses: [{ date: '2026-11-01', concept: 'Gasto', amount: 10 }],
    athlete_months: [{ month: '2026-11', paid: true, price: 50 }],
    athlete_acrokids_months: kids,
    athlete_pilates_months: nest,
    ...extraFixtures,
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
    const incomeRowPresentation = ${incomeRowPresentation.toString()};
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

test('income rows omit dates, total labels and redundant month headings without changing money', async () => {
  const data = await loadDataWithMocks();
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => ({ tag, children: [], appendChild(child) { this.children.push(child); } }) };
  try {
    const target = { children: [], appendChild(child) { this.children.push(child); } };
    const total = await data.loadPaymentsWithAthleteTotals(target, amount => `${amount} EUR`, '2026-11');
    assert.equal(total, 365);
    assert.equal(target.children.length, 5);
    assert.ok(target.children.every(row => row.className === 'income-row'));
    const text = target.children.flatMap(row => row.children.map(child => child.textContent || '')).join(' ');
    assert.doesNotMatch(text, /\btotal\b|2026-11|noviembre/i);
    assert.match(text, /Otro ingreso · 20 EUR/);
  } finally { globalThis.document = previous; }
});

test('category row clicks navigate to existing sections; manual edit and delete remain separate', async () => {
  const data = await loadDataWithMocks({
    payments: [{ date: '2026-11-05', concept: 'Ventas Caja', amount: 20 }, { date: '2026-11-02', concept: 'Otro ingreso', amount: 10 }],
    athlete_acrobacias_months: [{ month: '2026-11', paid: true, price: 30 }],
    athlete_halterofilia_months: [{ month: '2026-11', paid: true, price: 45 }],
    athlete_telas_months: [{ month: '2026-11', paid: true, price: 50 }],
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => ({ tag, children: [], appendChild(child) { this.children.push(child); } }) };
  try {
    const target = { children: [], appendChild(child) { this.children.push(child); } };
    const navigation = [], edits = [], deletes = [];
    await data.loadPaymentsWithAthleteTotals(target, String, '2026-11', (id, record) => edits.push([id, record]), (id, record) => deletes.push([id, record]), view => navigation.push(view));
    const links = target.children.map(row => row.children[0]).filter(child => child.tag === 'button');
    links.forEach(link => { assert.equal(link.type, 'button'); link.onclick(); });
    assert.deepEqual(new Set(navigation), new Set(['cajaView', 'athletesView', 'acroView', 'acroKidsView', 'halteView', 'telasView', 'pilatesView']));
    assert.equal(navigation.filter(view => view === 'pilatesView').length, 2);
    const manual = target.children.find(row => row.children[0].textContent.startsWith('Otro ingreso'));
    assert.equal(manual.children[0].tag, 'span');
    manual.children[1].children[0].onclick();
    manual.children[1].children[1].onclick();
    assert.equal(edits[0][1].date, '2026-11-02');
    assert.equal(deletes[0][1].concept, 'Otro ingreso');
    assert.equal(navigation.length, links.length);
  } finally { globalThis.document = previous; }
});