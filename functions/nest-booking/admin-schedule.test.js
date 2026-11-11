const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real callable handlers with an in-memory Firestore substitute.
// No Firebase account, network requests or production writes are involved.
function setup(role = 'OWNER', entries = {}) {
  const records = new Map(Object.entries({ 'users/staff': { role }, ...entries }));
  const reads = [];
  function snapshot(key) {
    return { id: key.split('/').pop(), exists: records.has(key), data: () => records.get(key) };
  }
  const db = {
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return { key, get: async () => snapshot(key) };
        },
        where(field, operator, value) {
          assert.equal(operator, '==');
          return { name, field, value };
        },
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const result = await callback({
        async get(ref) {
          reads.push(ref.key || ref.name);
          if (ref.key) return snapshot(ref.key);
          return { docs: [...records.keys()]
            .filter((key) => key.startsWith(`${ref.name}/`) && records.get(key)[ref.field] === ref.value)
            .map(snapshot) };
        },
        set(ref, value) { writes.push([ref.key, value]); },
      });
      writes.forEach(([key, value]) => records.set(key, value));
      return result;
    },
  };
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const exported = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8'), {
    exports: exported,
    require(name) {
      if (name === 'firebase-functions') return { https: { onCall: (handler) => handler, HttpsError } };
      if (name === 'firebase-admin') {
        const firestore = () => db;
        firestore.FieldValue = { serverTimestamp: () => 'timestamp' };
        return { firestore };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
    Intl, Date, console,
  });
  return { handlers: exported, records, reads };
}

const context = { auth: { uid: 'staff' } };
const slot = { id: 'managed-slot', daysOfWeek: [1, 3], startTime: '18:00', capacity: 6 };
const configKey = 'nest_calendar/pilates__booking-slots';
const futureMonday = '2099-01-05';
assert.equal(new Date(`${futureMonday}T12:00:00Z`).getUTCDay(), 1);

function withReservation(reservedCount = 2) {
  return {
    [configKey]: { slots: [slot], version: 3 },
    'nest_class_sessions/session': {
      family: 'pilates', dateKey: futureMonday, slotId: slot.id, startTime: slot.startTime, reservedCount,
    },
    'nest_bookings/booking-1': { family: 'pilates', dateKey: futureMonday, sessionId: 'session', status: 'BOOKED' },
    'nest_bookings/booking-2': { family: 'pilates', dateKey: futureMonday, sessionId: 'session', status: 'BOOKED' },
  };
}

for (const role of ['OWNER', 'RECEPTION', 'COACH', 'TEAM_LEADER']) {
  test(`${role} can load the weekly schedule`, async () => {
    const { handlers } = setup(role);
    const result = await handlers.getNestAdminSchedule({ family: 'pilates' }, context);
    assert.equal(result.version, 0);
    assert.ok(result.slots.length > 0);
  });
}

for (const role of ['NEST_STUDENT', 'NEST_INSTRUCTOR', 'PENDING']) {
  test(`${role} cannot administer classes`, async () => {
    const { handlers } = setup(role);
    await assert.rejects(handlers.getNestAdminSchedule({ family: 'pilates' }, context), { code: 'permission-denied' });
    await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots: [], version: 0 }, context), { code: 'permission-denied' });
  });
}

test('anonymous users cannot administer classes', async () => {
  const { handlers } = setup();
  await assert.rejects(handlers.getNestAdminSchedule({ family: 'pilates' }, {}), { code: 'unauthenticated' });
});

test('creates classes with configurable capacity and version', async () => {
  const { handlers, records } = setup();
  const result = await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, capacity: 10 }], version: 0 }, context);
  assert.equal(result.version, 1);
  assert.equal(records.get(configKey).slots[0].capacity, 10);
});

test('explicitly empty configuration does not restore default classes', async () => {
  const { handlers } = setup();
  await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [], version: 0 }, context);
  assert.equal((await handlers.getNestAdminSchedule({ family: 'pilates' }, context)).slots.length, 0);
});

for (const [name, slots, code] of [
  ['overlapping classes', [slot, { ...slot, id: 'other' }], 'already-exists'],
  ['invalid capacity', [{ ...slot, capacity: 0 }], 'invalid-argument'],
  ['fractional capacity', [{ ...slot, capacity: 2.5 }], 'invalid-argument'],
  ['invalid time', [{ ...slot, startTime: '18:30' }], 'invalid-argument'],
  ['weekend', [{ ...slot, daysOfWeek: [6] }], 'invalid-argument'],
  ['duplicate identifier', [slot, { ...slot, startTime: '19:00' }], 'invalid-argument'],
]) {
  test(`rejects ${name} without writing`, async () => {
    const { handlers, records } = setup();
    await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots, version: 0 }, context), { code });
    assert.equal(records.has(configKey), false);
  });
}

for (const [name, slots] of [
  ['delete a reserved class', []],
  ['move a reserved class', [{ ...slot, startTime: '19:00' }]],
  ['remove a reserved weekday', [{ ...slot, daysOfWeek: [3] }]],
  ['reduce below confirmed reservations', [{ ...slot, capacity: 1 }]],
]) {
  test(`cannot ${name}`, async () => {
    const { handlers, records } = setup('OWNER', withReservation());
    await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots, version: 3 }, context), { code: 'failed-precondition' });
    assert.equal(records.get(configKey).version, 3);
  });
}

test('uses actual bookings even when reservedCount is stale', async () => {
  const { handlers } = setup('OWNER', withReservation(0));
  await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, capacity: 1 }], version: 3 }, context), { code: 'failed-precondition' });
});

test('increases capacity without altering reservations; checks inside transaction', async () => {
  const { handlers, records, reads } = setup('OWNER', withReservation());
  const result = await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, capacity: 8 }], version: 3 }, context);
  assert.equal(result.version, 4);
  assert.equal(records.get('nest_class_sessions/session').reservedCount, 2);
  assert.equal(records.get('nest_bookings/booking-1').status, 'BOOKED');
  assert.ok(reads.includes('nest_class_sessions'));
  assert.ok(reads.includes('nest_bookings'));
});

test('rejects stale schedule version rather than overwriting another manager', async () => {
  const { handlers, records } = setup('OWNER', withReservation());
  await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots: [slot], version: 2 }, context), { code: 'aborted' });
  assert.equal(records.get(configKey).version, 3);
});