// Local diff guard for visual-only work. Compares against the committed UI;
// requires git, performs no network calls and never executes application code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const previous = execFileSync('git', ['show', 'HEAD:public/index.html'], { encoding: 'utf8' });
const current = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const functionalAttributes = new Set(['id', 'type', 'name', 'min', 'max', 'step', 'minlength', 'maxlength', 'value', 'action', 'method', 'pattern', 'disabled', 'checked', 'selected', 'multiple', 'required']);
const previousMoreViews = new Set([...previous.matchAll(/<button[^>]*data-view="([^"]+)"[^>]*data-close-more/g)].map(match => match[1]));
function contract(html) {
  return [...html.matchAll(/<[a-z][\w-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)]
    .filter(([tag]) => !/^<(?:meta|link)\b/i.test(tag))
    .filter(([tag]) => !tag.includes('id="expenseMonthTitle"'))
    // Adding shortcuts to existing views is allowed; changing old controls is not.
    .filter(([tag]) => !tag.includes('data-close-more') || previousMoreViews.has(tag.match(/data-view="([^"]+)"/)?.[1]))
    .map(([tag]) => {
      const attributes = [...tag.matchAll(/\b([\w-]+)="([^"]*)"/g)]
        .filter(([, name]) => functionalAttributes.has(name) || name.startsWith('data-'))
        .map(([, name, value]) => [name, value]);
      const flags = [...tag.matchAll(/\s(required|disabled|checked|selected|multiple)(?=\s|\/?>)/g)].map(match => match[1]);
      return { tag: tag.match(/^<([\w-]+)/)[1], attributes, flags };
    }).filter(tag => tag.attributes.length || tag.flags.length);
}
assert.deepEqual(contract(current), contract(previous), 'Functional DOM attributes changed');
function scripts(html) { return [...html.replace(/\r\n/g, '\n').matchAll(/<script\b[\s\S]*?<\/script>/g)].map(match => match[0].replace(/src="js\/main\.js\?v=[^"]+"/, 'src="js/main.js"')); }
assert.deepEqual(scripts(current), scripts(previous), 'Script content or loading changed');
// Only the named presentation/navigation helpers are allowed to change.
for (const [path, helpers] of [['public/js/main.js', ['updateMobileNavActive', 'refreshPaymentList', 'refreshExpenseList', 'updateSummaryMonthLabel']], ['public/js/ui.js', ['updateMenuVisibility']]]) {
  const before = execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' });
  const after = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const strip = source => helpers.reduce((text, helper) => text.replace(new RegExp(`(?:export )?(?:async )?function ${helper}\\([^]*?\\n\\}`, 'g'), `/* ${helper}: navigation presentation */`), source.replace(/\r\n/g, '\n').replace(/from "\.\/(data|ui)\.js\?v=[^"]+"/g, 'from "./$1.js"').replace(/from "\.\/discount-filter\.mjs(?:\?v=[^"]+)?"/, 'from "./discount-filter.mjs"').replace(/  expenseMonthTitle: \$\("expenseMonthTitle"\),\n/, ''));
  assert.deepEqual(strip(after), strip(before), `Non-navigation logic changed in ${path}`);
}
// Verify the aggregation/filtering/sorting code is unchanged while permitting
// the requested row presentation and an optional navigation callback.
const normalizeData = source => source.replace(/\r\n/g, '\n')
  .replace(/import \{ incomeRowPresentation \} from "\.\/income-presentation\.mjs";\n/, '')
  .replace(/export async function loadPaymentsWithAthleteTotals\([^]*?\n\}/, fn => fn
    .replace(/onDelete = null,\n  onNavigate = null/, 'onDelete = null')
    .replace(/  target.innerHTML = "";[^]*?  return total;/, '  /* Income row presentation */\n  return total;'))
  .replace(/export async function loadExpensesForMonth\([^]*?\n\}/, fn => fn.replace(/    textSpan.textContent = [^\n]+;/, '    /* Expense row text */'));
assert.equal(normalizeData(readFileSync(new URL('../public/js/data.js', import.meta.url), 'utf8')),
  normalizeData(execFileSync('git', ['show', 'HEAD:public/js/data.js'], { encoding: 'utf8' })), 'Income aggregation or other data logic changed');
const normalizeDiscount = source => source.replace(/\r\n/g, '\n').replace(/\['ALL', '[^']+'\]/, "['ALL', 'Todos']").replace(/    select.value = 'ALL';\n/, '');
assert.equal(normalizeDiscount(readFileSync(new URL('../public/js/discount-filter.mjs', import.meta.url), 'utf8')),
  normalizeDiscount(execFileSync('git', ['show', 'HEAD:public/js/discount-filter.mjs'], { encoding: 'utf8' })), 'Discount matching logic changed');
const businessChanges = execFileSync('git', ['diff', 'HEAD', '--', 'public/js', ':!public/js/main.js', ':!public/js/ui.js', ':!public/js/data.js', ':!public/js/income-presentation.mjs', ':!public/js/discount-filter.mjs', 'functions', 'public-reservas', 'firestore.rules', 'firestore.indexes.json', 'firebase.json'], { encoding: 'utf8' });
assert.equal(businessChanges, '', 'Changes outside the OwlManage presentation layer');
console.log('Verified: existing IDs, forms, option values and actions unchanged; only added navigation shortcuts/cache versions are allowed.');
console.log('Verified: only presentation/navigation changed; income aggregation, data logic, Firebase, functions and reservations remain intact.');