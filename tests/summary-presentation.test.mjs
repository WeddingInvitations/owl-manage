import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { initializeNewAthleteModal, setNewAthleteNames } from '../public/js/new-athlete-modal.mjs';

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

test('all program new-summary counters open the shared accessible names modal', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const expectedKeys = ['athletes', 'acro', 'acroKids', 'halte', 'telas', 'singleClasses', 'pilates'];
  for (const key of expectedKeys) {
    assert.match(html, new RegExp(`<button[^>]*class="value summary-new-count"[^>]*data-new-athletes-key="${key}"`, 's'));
  }
  assert.match(html, /id="newAthletesModal"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /id="newAthletesModalClose"/);
  assert.match(html, /id="newAthletesList"/);
});

test('shared new-athletes modal renders matching names safely and handles empty data', () => {
  const listeners = new Map();
  const button = {
    dataset: { newAthletesKey: 'acro' },
    addEventListener(type, handler) { listeners.set(`button:${type}`, handler); },
    focus() { this.focused = true; },
  };
  const modalListeners = new Map();
  const modal = {
    classList: {
      hidden: true,
      add() { this.hidden = true; },
      remove() { this.hidden = false; },
      contains() { return this.hidden; },
    },
    addEventListener(type, handler) { modalListeners.set(type, handler); },
  };
  const list = {
    children: [],
    replaceChildren() { this.children = []; },
    appendChild(item) { this.children.push(item); },
  };
  const title = { textContent: '' };
  const closeButton = {
    addEventListener(type, handler) { listeners.set(`close:${type}`, handler); },
    focus() { this.focused = true; },
  };
  const documentListeners = new Map();
  const fakeDocument = {
    getElementById(id) {
      return {
        newAthletesModal: modal,
        newAthletesModalTitle: title,
        newAthletesList: list,
        newAthletesModalClose: closeButton,
      }[id] || null;
    },
    querySelectorAll() { return [button]; },
    createElement() { return { textContent: '' }; },
    addEventListener(type, handler) { documentListeners.set(type, handler); },
  };
  const originalDocument = globalThis.document;
  globalThis.document = fakeDocument;
  try {
    setNewAthleteNames('acro', 'Acrobacias', 'noviembre 2026', [
    { id: 'new-2', name: 'Zoé' },
    { id: 'old', name: 'No debe salir' },
    { id: 'new-1', name: '<img src=x>' },
    ], new Set(['new-1', 'new-2']));
    initializeNewAthleteModal();
    listeners.get('button:click')();

    assert.equal(title.textContent, 'Acrobacias · noviembre 2026');
    assert.deepEqual(list.children.map((item) => item.textContent), ['<img src=x>', 'Zoé']);
    assert.equal(modal.classList.hidden, false);

    setNewAthleteNames('acro', 'Acrobacias', 'diciembre 2026', [{ id: 'old', name: 'Anterior' }], new Set());
    listeners.get('button:click')();
    assert.equal(title.textContent, 'Acrobacias · diciembre 2026');
    assert.deepEqual(list.children.map((item) => item.textContent), ['No hay altas nuevas para este mes.']);

    documentListeners.get('keydown')({ key: 'Escape' });
    assert.equal(modal.classList.hidden, true);
    assert.equal(button.focused, true);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});