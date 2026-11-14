import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('expenses have the same heading layout as income, with CSV and template removed visually', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const expense = html.split('<section id="expensesView"')[1].split('<div id="expenseModal"')[0];
  assert.match(expense, /class="accounting-heading"[^]*?<h2>Contabilidad · Gastos<\/h2>[^]*?id="expenseMonthTitle" class="accounting-month-title"/);
  for (const id of ['expenseCsvOpen', 'expenseTemplateDownload']) {
    assert.match(expense, new RegExp(`id="${id}" class="[^"]*\\bhidden\\b`));
  }
  for (const id of ['expenseModalOpen', 'processInvoicesBtn']) {
    assert.doesNotMatch(expense.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))[0], /\bhidden\b/);
  }
});

test('expense title follows the selected month in uppercase while preserving totals and callbacks', async () => {
  const main = await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const helper = main.match(/async function refreshExpenseList\([^]*?\n\}/)[0];
  const ui = { expenseList: {}, expenseMonthTitle: {}, expenseMonthTotal: {} };
  const edit = () => {}, remove = () => {};
  const context = vm.createContext({ ui, selectedExpenseMonth: '2026-10', availableExpenseMonths: [],
    getCurrentYearMonths: () => ['2026-11', '2026-10'], getMonthKey: () => '2026-11',
    getMonthLabel: key => key === '2026-10' ? 'octubre de 2026' : 'noviembre de 2026',
    renderExpenseMonthOptions: () => {}, formatCurrency: value => `${value} €`,
    handleEditExpense: edit, handleDeleteExpense: remove,
    loadExpensesForMonth: async (target, format, month, onEdit, onDelete) => {
      assert.equal(month, context.selectedExpenseMonth);
      assert.equal(onEdit, edit); assert.equal(onDelete, remove);
      return 250;
    },
  });
  vm.runInContext(helper, context);
  await context.refreshExpenseList();
  assert.equal(ui.expenseMonthTitle.textContent, 'OCTUBRE DE 2026');
  context.selectedExpenseMonth = '2026-11';
  await context.refreshExpenseList();
  assert.equal(ui.expenseMonthTitle.textContent, 'NOVIEMBRE DE 2026');
  assert.equal(ui.expenseMonthTotal.textContent, '250 €');
});

test('expense rows omit dates but keep filtering, ordering, totals and original edit/delete records', async () => {
  const data = await readFile(new URL('../public/js/data.js', import.meta.url), 'utf8');
  const helper = data.match(/export async function loadExpensesForMonth\([^]*?\n\}/)[0].replace('export ', '');
  const records = [
    { id: 'older', concept: 'Alquiler', date: '2026-11-01', amount: 200 },
    { id: 'newer', concept: 'Material', date: '2026-11-12', amount: 50 },
    { id: 'other-month', concept: 'Otro mes', date: '2026-10-01', amount: 80 },
  ];
  const edits = [], deletes = [];
  const context = vm.createContext({ db: {}, collection: (_, name) => name,
    getDocs: async () => ({ forEach: fn => records.forEach(record => fn({ id: record.id, data: () => record })) }),
    parseRecordDate: record => new Date(record.date + 'T00:00:00'),
    getMonthKey: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, getMonthLabel: () => 'noviembre de 2026',
    document: { createElement: tag => ({ tag, children: [], appendChild(child) { this.children.push(child); } }) },
  });
  vm.runInContext(helper, context);
  const target = { children: [], appendChild(child) { this.children.push(child); } };
  const total = await context.loadExpensesForMonth(target, value => `${value} €`, '2026-11', (id, record) => edits.push([id, record]), (id, record) => deletes.push([id, record]));
  assert.equal(total, 250);
  const rows = target.children.filter(row => row.className !== 'list-header');
  assert.deepEqual(rows.map(row => row.children[0].textContent), ['Material · 50 €', 'Alquiler · 200 €']);
  rows[0].children[1].children[0].onclick();
  rows[0].children[1].children[1].onclick();
  assert.equal(edits[0][0], 'newer');
  assert.equal(edits[0][1].date, '2026-11-12');
  assert.equal(deletes[0][1], records[1]);
});