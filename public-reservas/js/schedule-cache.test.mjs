import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduleCache, applyBookingConfirmation } from './schedule-cache.mjs';

test('20 simultaneous reads of one month use a single request', async () => {
  const cache = createScheduleCache();
  let calls = 0;
  const loader = async () => { calls += 1; return [{ id: 'class' }]; };
  const results = await Promise.all(Array.from({ length: 20 }, () => cache.get('pilates__user__2099-01', loader)));
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result === results[0]));
});

test('20 separate browsers can navigate repeatedly without additional requests', async () => {
  let requests = 0;
  const browsers = Array.from({ length: 20 }, () => createScheduleCache());
  const load = async () => { requests += 1; return []; };
  await Promise.all(browsers.map((cache, user) => cache.get(`pilates__${user}__2099-01`, load)));
  for (let navigation = 0; navigation < 20; navigation += 1) {
    await Promise.all(browsers.map((cache, user) => cache.get(`pilates__${user}__2099-01`, load)));
  }
  assert.equal(requests, 20); // Initial calls only, not 420 calls.
});

test('cache expires after 30 seconds and manual refresh invalidates immediately', async () => {
  let time = 0;
  let calls = 0;
  const cache = createScheduleCache({ now: () => time });
  const load = async () => ++calls;
  assert.equal(await cache.get('user__month', load), 1);
  time = 29_999;
  assert.equal(await cache.get('user__month', load), 1);
  time = 30_000;
  assert.equal(await cache.get('user__month', load), 2);
  cache.invalidate('user__');
  assert.equal(await cache.get('user__month', load), 3);
});

test('separates families, users and months and bounds cache memory', async () => {
  const cache = createScheduleCache({ maxEntries: 6 });
  for (let i = 0; i < 20; i += 1) assert.equal(await cache.get(`family__user${i}__month`, async () => i), i);
  assert.equal(cache.size(), 6);
  assert.equal(await cache.get('pilates__one__month', async () => 'one'), 'one');
  assert.equal(await cache.get('barre__one__month', async () => 'barre'), 'barre');
  assert.equal(await cache.get('pilates__two__month', async () => 'two'), 'two');
});

test('failed requests are retried; old failures cannot remove newer data', async () => {
  const cache = createScheduleCache();
  let rejectOld;
  const old = cache.get('key', () => new Promise((_, reject) => { rejectOld = reject; }));
  await Promise.resolve();
  cache.invalidate('key');
  await cache.get('key', async () => 'new');
  rejectOld(new Error('old request failed'));
  await assert.rejects(old);
  assert.equal(await cache.get('key', async () => 'wrong'), 'new');
  cache.invalidate('key');
  await assert.rejects(cache.get('key', async () => { throw new Error('offline'); }));
  assert.equal(await cache.get('key', async () => 'recovered'), 'recovered');
});

const sessions = [
  { id: 'one', dateKey: '2099-01-05', capacity: 6, reservedCount: 0, attendees: [],
    monthlyUsed: 3, monthlyLimit: 4, activeForMonth: true, past: false, canBook: true },
  { id: 'two', dateKey: '2099-01-06', monthlyUsed: 3, monthlyLimit: 4, activeForMonth: true, past: false, canBook: true },
  { id: 'otherMonth', dateKey: '2099-02-05', monthlyUsed: 0, monthlyLimit: 4, activeForMonth: true, past: false, canBook: true },
];

test('booking confirmation updates occupancy, own status and whole-month quota without a fetch', async () => {
  const cache = createScheduleCache();
  let requests = 0;
  await cache.get('key', async () => { requests += 1; return sessions; });
  cache.update('key', (value) => applyBookingConfirmation(value, 'one', {
    reservedCount: 1, monthlyUsed: 4, monthlyLimit: 4,
    attendee: { athleteId: 'athlete', name: 'Student', isCurrentUser: true },
  }));
  const result = await cache.get('key', async () => { requests += 1; });
  assert.equal(requests, 1);
  assert.equal(result[0].isBooked, true);
  assert.equal(result[0].reservedCount, 1);
  assert.equal(result[1].canBook, false);
  assert.equal(result[2].monthlyUsed, 0);
  assert.equal(sessions[0].reservedCount, 0); // Original response remains immutable.
});

test('cancellation frees quota and seat; staff booking does not alter staff quota', () => {
  const booked = applyBookingConfirmation(sessions, 'one', { reservedCount: 1, monthlyUsed: 4,
    attendee: { athleteId: 'athlete', isCurrentUser: true } });
  const cancelled = applyBookingConfirmation(booked, 'one', { reservedCount: 0, monthlyUsed: 3, athleteId: 'athlete' }, { cancelled: true });
  assert.equal(cancelled[0].myBookingStatus, 'CANCELLED');
  assert.equal(cancelled[0].attendees.length, 0);
  assert.equal(cancelled[1].canBook, true);
  const staff = applyBookingConfirmation(sessions, 'one', { reservedCount: 1, monthlyUsed: 4,
    attendee: { athleteId: 'other' } }, { own: false });
  assert.equal(staff[0].monthlyUsed, 3);
  assert.equal(staff[0].isBooked, undefined);
});