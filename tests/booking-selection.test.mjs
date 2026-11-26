import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { saveBookingSelection } from '../public-reservas/js/booking-selection.mjs';

test('one save reserves all distinct selected athletes sequentially and reports each confirmation', async () => {
  const calls = [];
  const confirmed = [];
  let active = 0;
  const outcomes = await saveBookingSelection(['ana', 'bea', 'ana', 'carla'], {
    book: async (id) => {
      assert.equal(active, 0);
      active++;
      calls.push(id);
      await Promise.resolve();
      active--;
      return { data: { attendee: { athleteId: id } } };
    },
    onResult: ({ athleteId, result }, completed) => {
      confirmed.push(athleteId);
      assert.equal(result.data.attendee.athleteId, athleteId);
      assert.equal(completed, confirmed.length);
    },
  });
  assert.deepEqual(calls, ['ana', 'bea', 'carla']);
  assert.deepEqual(confirmed, calls);
  assert.equal(outcomes.length, 3);
});

test('a failed athlete does not hide confirmed bookings or prevent saving the rest', async () => {
  const failure = new Error('Bono agotado');
  const outcomes = await saveBookingSelection(['ana', 'bea', 'carla'], {
    book: async (id) => { if (id === 'bea') throw failure; return { athleteId: id }; },
  });
  assert.deepEqual(outcomes.filter((item) => !item.error).map((item) => item.athleteId), ['ana', 'carla']);
  assert.equal(outcomes[1].error, failure);
  const retries = [];
  await saveBookingSelection(outcomes.filter((item) => item.error).map((item) => item.athleteId), {
    book: async (id) => { retries.push(id); },
  });
  assert.deepEqual(retries, ['bea']);
});

test('changing accounts stops the remaining reservations', async () => {
  let currentUser = 'staff';
  const calls = [];
  const outcomes = await saveBookingSelection(['ana', 'bea'], {
    shouldContinue: () => currentUser === 'staff',
    book: async (id) => { calls.push(id); currentUser = 'other'; return {}; },
  });
  assert.deepEqual(calls, ['ana']);
  assert.equal(outcomes.length, 1);
});

test('saving an empty selection makes no requests', async () => {
  assert.deepEqual(await saveBookingSelection([], { book: () => assert.fail('Unexpected reservation') }), []);
});

test('unpaid presentation uses red styling without exclamation or warning symbols', async () => {
  const js = await readFile(new URL('../public-reservas/js/booking.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public-reservas/css/booking.css', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /⚠/u);
  assert.doesNotMatch(css, /is-payment-pending::after/);
  assert.match(css, /is-payment-pending\s*\{[^}]*#e5484d/);
  assert.match(js, /checkbox\.type = 'checkbox'/);
  assert.match(js, /footer\.append\(summary, message, save\)/);
});