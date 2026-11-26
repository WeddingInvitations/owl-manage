import test from 'node:test';
import assert from 'node:assert/strict';
import repeat from '../functions/nest-booking/monthly-repeat.js';

test('first week includes November 30 for December and keeps weekdays distinct', () => {
  assert.equal(repeat.firstWeekMonth('2026-11-30'), '2026-12');
  assert.equal(repeat.firstWeekMonth('2026-12-04'), '2026-12');
  assert.equal(repeat.firstWeekMonth('2026-12-07'), null);
  assert.equal(repeat.firstWeekMonth('2026-12-05'), null);
  assert.deepEqual(repeat.remainingDates('2026-12-01', '2026-12'), ['2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29']);
  assert.deepEqual(repeat.remainingDates('2026-12-04', '2026-12'), ['2026-12-11', '2026-12-18', '2026-12-25']);
});

test('first full workweek is used when the month starts on a weekend', () => {
  assert.equal(repeat.firstWeekMonth('2026-08-03'), '2026-08');
  assert.equal(repeat.firstWeekMonth('2026-08-07'), '2026-08');
  assert.equal(repeat.firstWeekMonth('2026-08-10'), null);
});