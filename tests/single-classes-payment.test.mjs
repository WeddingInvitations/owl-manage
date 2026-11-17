import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const lists = ['athlete', 'acro', 'acroKids', 'halte', 'telas', 'pilates', 'singleClasses'];
const extractFunction = name => {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} exists`);
  return match[0];
};
const helpers = ['calculateDiscountFromReason', 'updateRowPricePreview', 'setStatusBadge',
  'updatePendingSaveButtons', 'markDirtyRow', 'saveSingleClassesRow'].map(extractFunction).join('\n');
const plans = source.slice(source.indexOf('const singleClassesTariffPlans = ['),
  source.indexOf('// Tarifas específicas para Pilates'));
const handlers = source.slice(source.indexOf('if (ui.singleClassesList) {\n  ui.singleClassesList.addEventListener("change"'),
  source.indexOf('\nupdatePendingSaveButtons();', source.indexOf('if (ui.singleClassesSaveAllBtn) {\n  ui.singleClassesSaveAllBtn.addEventListener')));
assert.match(handlers, /singleClassesList\.addEventListener\("change"/);
assert.match(handlers, /singleClassesSaveAllBtn\.addEventListener\("click"/);

function setup() {
  const fields = Object.fromEntries([
    ['tariff', 'Clase Crossfit'], ['paid', 'NO'], ['discount-reason', ''],
    ['payment-method', 'Tarjeta'], ['price', '15.00'], ['discount-display', '0%'], ['final-price', '15.00'],
  ].map(([role, value]) => [`singleclasses-${role}`, { value, textContent: value }]));
  const classes = new Set();
  const row = {
    dataset: { id: 'athlete-1', name: 'Ana' },
    classList: { add: name => classes.add(name) },
    querySelector(selector) {
      return fields[selector.match(/data-role=['"]([^'"]+)['"]/)[1]] || null;
    },
  };
  const rows = [row];
  const changeHandlers = {};
  const clickHandlers = {};
  const button = { disabled: true, textContent: 'Guardar cambios (0)',
    addEventListener: (event, handler) => { clickHandlers[event] = handler; } };
  const ui = {
    singleClassesList: {
      querySelectorAll: () => rows.filter(item => item.dataset.dirty === 'true'),
      addEventListener: (event, handler) => { changeHandlers[event] = handler; },
    },
    singleClassesSaveAllBtn: button,
  };
  const writes = [];
  const alerts = [];
  const context = vm.createContext({
    ui, currentUser: { uid: 'admin-1' }, selectedSingleClassesListMonth: '2026-11',
    selectedSingleClassesMonth: '2026-10', addMonthsToKey: month => month,
    upsertSingleClassesAthleteMonth: async (...args) => { writes.push(args); },
    refreshSingleClassesMonthly: async () => { rows.length = 0; },
    alert: message => alerts.push(message), console,
  });
  vm.runInContext(`${plans}\n${helpers}\n${handlers}\nupdatePendingSaveButtons();`, context);
  function change(role, value) {
    const field = fields[`singleclasses-${role}`];
    field.value = value;
    changeHandlers.change({ target: {
      value,
      closest: () => row,
      matches: selector => selector.split(',').some(part => part.trim() === `[data-role='singleclasses-${role}']`),
    } });
  }
  return { context, ui, row, fields, classes, button, writes, alerts, change, clickHandlers };
}

test('all seven lists independently enable their save button and reset the pending count', () => {
  const ui = {};
  const pending = {};
  for (const list of lists) {
    pending[list] = [];
    ui[`${list}List`] = { querySelectorAll: () => pending[list] };
    ui[`${list}SaveAllBtn`] = {};
  }
  const context = vm.createContext({ ui });
  vm.runInContext(extractFunction('updatePendingSaveButtons'), context);
  for (const active of lists) {
    pending[active] = [{}, {}];
    context.updatePendingSaveButtons();
    for (const list of lists) {
      assert.equal(ui[`${list}SaveAllBtn`].disabled, list !== active);
      assert.equal(ui[`${list}SaveAllBtn`].textContent, `Guardar cambios (${list === active ? 2 : 0})`);
    }
    pending[active] = [];
  }
  context.updatePendingSaveButtons();
  assert.ok(lists.every(list => ui[`${list}SaveAllBtn`].disabled));
});

const tariffs = vm.runInNewContext(`${plans}\nsingleClassesTariffPlans`);
for (const plan of tariffs) {
  test(`marking paid enables saving and persists payment for ${plan.key}`, async () => {
    const harness = setup();
    harness.fields['singleclasses-tariff'].value = plan.key;
    assert.equal(harness.button.disabled, true);
    harness.change('paid', 'SI');
    assert.equal(harness.row.dataset.dirty, 'true');
    assert.ok(harness.classes.has('row-dirty'));
    assert.equal(harness.button.disabled, false);
    assert.equal(harness.button.textContent, 'Guardar cambios (1)');
    await harness.clickHandlers.click();
    assert.equal(harness.writes.length, 1);
    const [id, month, payment, uid] = harness.writes[0];
    assert.equal(id, 'athlete-1');
    assert.equal(month, '2026-11');
    assert.equal(uid, 'admin-1');
    assert.equal(payment.paid, true);
    assert.equal(payment.active, true);
    assert.equal(payment.tariff, plan.key);
    assert.equal(payment.price, plan.priceTotal);
    assert.equal(payment.paymentMethod, 'Tarjeta');
    assert.equal(harness.button.disabled, true);
    assert.equal(harness.button.textContent, 'Guardar cambios (0)');
    assert.deepEqual(harness.alerts, ['Guardados 1 cambios.']);
  });
}

for (const [role, value] of [['tariff', 'Bono 10 Clases Telas'], ['discount-reason', 'Familiar'], ['payment-method', 'Efectivo'], ['paid', 'NO']]) {
  test(`changing ${role} enables saving without counting the same row twice`, () => {
    const harness = setup();
    harness.change(role, value);
    harness.change(role, value);
    assert.equal(harness.button.disabled, false);
    assert.equal(harness.button.textContent, 'Guardar cambios (1)');
    if (role === 'tariff') assert.equal(harness.fields['singleclasses-final-price'].textContent, '135.00');
    if (role === 'discount-reason') assert.equal(harness.fields['singleclasses-final-price'].textContent, '13.50');
  });
}