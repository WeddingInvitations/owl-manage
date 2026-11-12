import test from 'node:test';
import assert from 'node:assert/strict';
import { expandAdminSlots, mergeAdminRows } from '../public-reservas/js/admin-schedule-draft.mjs';

const slot = { id: 'mw-19', daysOfWeek: [1, 3], startTime: '19:00', capacity: 6 };

test('Monday and Wednesday appear separately without changing existing booking IDs', () => {
  const rows = expandAdminSlots([slot]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.daysOfWeek), [[1], [3]]);
  assert.deepEqual(mergeAdminRows(rows), [slot]);
  assert.deepEqual(mergeAdminRows(rows.filter((row) => row.daysOfWeek[0] !== 1)), [{ ...slot, daysOfWeek: [3] }]);
});

test('individual rows with changed settings are stored as separate slots', () => {
  const rows = expandAdminSlots([slot]);
  rows[1].capacity = 8;
  const merged = mergeAdminRows(rows);
  assert.equal(merged.length, 2);
  assert.equal(new Set(merged.map((slot) => slot.id)).size, 2);
  assert.deepEqual(merged.map((slot) => slot.daysOfWeek), [[1], [3]]);
});

test('new row IDs cannot collide with already stored classes', () => {
  const rows = expandAdminSlots([slot, { id: 'mw-19-day-3', daysOfWeek: [4], startTime: '20:00', capacity: 6 }]);
  rows[1].capacity = 8;
  const merged = mergeAdminRows(rows);
  assert.equal(new Set(merged.map((slot) => slot.id)).size, merged.length);
});