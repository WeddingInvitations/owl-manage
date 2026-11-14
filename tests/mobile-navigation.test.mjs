import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../public/js/main.js', import.meta.url), 'utf8');
const uiSource = await readFile(new URL('../public/js/ui.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/css/owl-brand.css', import.meta.url), 'utf8');
const buttons = fragment => [...fragment.matchAll(/<button\b[^>]*data-view="([^"]+)"[^>]*>/g)].map(match => match[1]);
const desktop = buttons(html.split('<nav class="side-menu"')[1].split('</nav>')[0]);
const bottom = buttons(html.split('<nav id="mobileNav"')[1].split('</nav>')[0]);
const more = buttons(html.split('<div id="moreMenu"')[1].split('<!-- Password change modal -->')[0]);

function node(view) {
  const classes = new Set();
  return { id: view, dataset: { view }, classList: {
    add: value => classes.add(value), remove: value => classes.delete(value),
    contains: value => classes.has(value),
    toggle(value, force) { const enabled = force ?? !classes.has(value); if (enabled) classes.add(value); else classes.delete(value); return enabled; }
  } };
}
function setup() {
  const menuButtons = desktop.map(node), mobileNavButtons = bottom.map(node), moreButtons = more.map(node);
  const views = [...new Set([...desktop, ...more])].map(node);
  const sections = ['contabilidad', 'usuarios', 'equipo', 'admin'].map(section => ({ ...node(section), dataset: { section } }));
  const document = { querySelector: () => null, querySelectorAll: selector => {
    if (selector === '.menu-section') return sections;
    if (selector === '#moreMenu [data-view]') return moreButtons;
    return [];
  } };
  const ui = { menuButtons, mobileNavButtons, views };
  const context = vm.createContext({ document, ui });
  const visibility = uiSource.match(/export function updateMenuVisibility\([^]*?\n\}/)[0].replace('export ', '');
  const active = source.match(/function updateMobileNavActive\([^]*?\n\}/)[0];
  vm.runInContext(visibility + '\n' + active, context);
  return { context, ui, moreButtons };
}

test('every desktop tab is reachable from mobile, including Nest, inventory and WodBuster', () => {
  const mobile = new Set([...bottom, ...more]);
  for (const view of desktop) assert.ok(mobile.has(view), `Missing mobile tab: ${view}`);
  for (const view of ['checkinsView', 'employeePaymentsView']) assert.ok(mobile.has(view));
  assert.equal(new Set(more).size, more.length);
});

test('all extra shortcuts keep the existing view/initialization/close handlers', () => {
  for (const view of more) assert.match(html, new RegExp(`<button[^>]*data-view="${view}"[^>]*data-close-more`));
  for (const view of ['inventoryView', 'employeePaymentsView', 'checkinsView', 'pilatesView', 'wodBusterView']) {
    assert.match(source, new RegExp(`case "${view}"`));
  }
  assert.match(source, /document\.querySelectorAll\('\[data-close-more\]'\)[^]*?setActiveView\(viewId, ui\);[^]*?await initializeViewIfNeeded\(viewId\);[^]*?ui\.moreMenu\.classList\.add\("hidden"\)/);
});

for (const role of ['OWNER', 'RECEPTION', 'COACH', 'TEAM_LEADER', 'NEST_STUDENT', 'NEST_INSTRUCTOR', 'UNKNOWN']) {
  test(`mobile navigation honors existing role restrictions: ${role}`, () => {
    const { context, ui, moreButtons } = setup();
    context.updateMenuVisibility(ui, role, {});
    const all = [...ui.mobileNavButtons, ...moreButtons];
    for (const view of ['summaryView', 'paymentsView', 'expensesView', 'employeePaymentsView']) {
      assert.equal(all.find(button => button.dataset.view === view).classList.contains('hidden'), role !== 'OWNER', view);
    }
    assert.equal(all.find(button => button.dataset.view === 'rolesView').classList.contains('hidden'), role !== 'OWNER');
    assert.equal(all.find(button => button.dataset.view === 'classesView').classList.contains('hidden'), !['OWNER', 'TEAM_LEADER'].includes(role));
    for (const view of ['pilatesView', 'wodBusterView', 'inventoryView', 'checkinsView']) {
      assert.equal(all.find(button => button.dataset.view === view).classList.contains('hidden'), !['OWNER', 'RECEPTION', 'COACH', 'TEAM_LEADER'].includes(role));
    }
    assert.equal(all.find(button => button.dataset.view === 'moreView').classList.contains('hidden'), false);
  });
}

test('switching accounts restores the correct mobile shortcuts instead of leaving stale hidden tabs', () => {
  const { context, ui, moreButtons } = setup();
  context.updateMenuVisibility(ui, 'NEST_STUDENT', {});
  context.updateMenuVisibility(ui, 'OWNER', {});
  for (const button of [...ui.mobileNavButtons, ...moreButtons]) assert.equal(button.classList.contains('hidden'), false, button.dataset.view);
});

test('More remains active for every view in its actual menu', () => {
  const { context, ui } = setup();
  for (const view of more) {
    context.updateMobileNavActive(view);
    assert.equal(ui.mobileNavButtons.find(button => button.dataset.view === 'moreView').classList.contains('active'), true, view);
  }
  context.updateMobileNavActive('athletesView');
  assert.equal(ui.mobileNavButtons.find(button => button.dataset.view === 'moreView').classList.contains('active'), false);
});

test('monthly CSV/detail actions and teacher information override legacy mobile hiding', () => {
  assert.match(css, /\.summary-table-mobile th:nth-child\(5\),\s*\.summary-table-mobile td:nth-child\(5\)\s*\{\s*display: table-cell !important/);
  assert.match(css, /\.teacher-table th:nth-child\(4\), \.teacher-table td:nth-child\(4\)\s*\{ display: table-cell/);
  assert.match(css, /padding-bottom: calc\(154px \+ env\(safe-area-inset-bottom\)\)/);
});

test('clicking each actual More handler activates and initializes its view, then closes the menu', async () => {
  const { context, ui, moreButtons } = setup();
  const calls = [];
  ui.moreMenu = node('moreMenu');
  moreButtons.forEach(button => { button.addEventListener = (_, handler) => { button.click = handler; }; });
  context.document.querySelectorAll = selector => selector === '[data-close-more]' || selector === '#moreMenu [data-view]' ? moreButtons : [];
  context.setActiveView = view => calls.push(['activate', view]);
  context.initializeViewIfNeeded = async view => calls.push(['initialize', view]);
  const handlers = source.slice(source.indexOf("document.querySelectorAll('[data-close-more]')"), source.indexOf('// Event listener para el botón de cambio de tema'));
  vm.runInContext(handlers, context);
  for (const button of moreButtons) {
    calls.length = 0;
    ui.moreMenu.classList.remove('hidden');
    await button.click();
    assert.deepEqual(calls, [['activate', button.dataset.view], ['initialize', button.dataset.view]]);
    assert.equal(ui.moreMenu.classList.contains('hidden'), true);
  }
});