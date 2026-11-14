import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { incomeRowPresentation } from '../public/js/income-presentation.mjs';

test('display labels are cleaned without changing the stored record', () => {
  const record = { concept: 'Cuotas atletas (total)', amount: 75, date: '2026-11-01' };
  assert.deepEqual(incomeRowPresentation(record.concept), { label: 'Cuotas atletas', viewId: 'athletesView' });
  assert.equal(record.concept, 'Cuotas atletas (total)');
  assert.deepEqual(incomeRowPresentation('Otro ingreso'), { label: 'Otro ingreso', viewId: null });
  assert.deepEqual(incomeRowPresentation(), { label: '', viewId: null });
});

test('the actual income refresh uppercases its title and delegates clicks to existing navigation', async () => {
  const main = await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const helper = main.match(/async function refreshPaymentList\([^]*?\n\}/)[0];
  const calls = [];
  const ui = { paymentList: {}, paymentMonthTitle: {}, paymentMonthTotal: {} };
  let navigate;
  const context = vm.createContext({
    ui, selectedPaymentMonth: '2026-11', availablePaymentMonths: [],
    getCurrentYearMonths: () => ['2026-11'], getMonthKey: () => '2026-11',
    getMonthLabel: () => 'noviembre de 2026', renderPaymentMonthOptions: () => {},
    formatCurrency: amount => `${amount} €`, handleEditPayment: () => {}, handleDeletePayment: () => {},
    loadPaymentsWithAthleteTotals: async (...args) => { navigate = args[5]; return 100; },
    setActiveView: view => calls.push(['active', view]),
    updateMobileNavActive: view => calls.push(['mobile', view]),
    initializeViewIfNeeded: async view => calls.push(['init', view]),
  });
  vm.runInContext(helper, context);
  await context.refreshPaymentList();
  assert.equal(ui.paymentMonthTitle.textContent, 'NOVIEMBRE DE 2026');
  assert.equal(ui.paymentMonthTotal.textContent, '100 €');
  await navigate('athletesView');
  assert.deepEqual(calls, [['active', 'athletesView'], ['mobile', 'athletesView'], ['init', 'athletesView']]);
});

test('OwlManage installation uses OWL icons on Android and iPhone, not the reservations logo', async () => {
  const root = new URL('../public/', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.name, 'OwlManage');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.match(html, /rel="manifest" href="manifest.webmanifest\?v=/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="icons\/owl-180.png\?v=/);
  assert.match(html, /name="apple-mobile-web-app-title" content="OwlManage"/);
  for (const size of [180, 192, 512]) {
    const bytes = await readFile(new URL(`icons/owl-${size}.png`, root));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
    if (size !== 180) assert.ok(manifest.icons.some(icon => icon.src === `icons/owl-${size}.png` && icon.sizes === `${size}x${size}`));
  }
});