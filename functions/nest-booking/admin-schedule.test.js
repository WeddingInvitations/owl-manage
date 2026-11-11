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
  let transactionQueue = Promise.resolve();
  function snapshot(key) {
    return { id: key.split('/').pop(), ref: reference(key), exists: records.has(key), data: () => records.get(key) };
  }
  function reference(key) {
    return { key, id: key.split('/').pop(), get: async () => snapshot(key) };
  }
  function query(name, filters = []) {
    return {
      name, filters,
      doc(id) { return reference(`${name}/${id}`); },
      where(field, operator, value) { return query(name, [...filters, { field, operator, value }]); },
      async get() {
        reads.push(name);
        return { docs: [...records.keys()].filter((key) => key.startsWith(`${name}/`) && filters.every(({ field, operator, value }) => {
          const actual = records.get(key)[field];
          if (operator === '==') return actual === value;
          if (operator === '>=') return actual >= value;
          if (operator === '<=') return actual <= value;
          if (operator === 'in') return value.includes(actual);
          throw new Error(`Unexpected operator: ${operator}`);
        })).map(snapshot) };
      },
    };
  }
  const db = {
    collection: query,
    async getAll(...refs) { return refs.filter((ref) => ref.key).map((ref) => snapshot(ref.key)); },
    async runTransaction(callback) {
      // Model Firestore's serializable transaction isolation, not real network latency.
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
      const writes = [];
      const result = await callback({
        async get(ref) {
          reads.push(ref.key || ref.name);
          if (ref.key) return snapshot(ref.key);
          return ref.get();
        },
        set(ref, value, options) { writes.push([ref.key, options?.merge ? { ...records.get(ref.key), ...value } : value]); },
        update(ref, value) { writes.push([ref.key, { ...records.get(ref.key), ...value }]); },
      });
      writes.forEach(([key, value]) => records.set(key, value));
      return result;
      } finally { release(); }
    },
  };
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const exported = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8'), {
    exports: exported,
    require(name) {
      if (name === 'firebase-functions') {
        const https = { onCall: (handler) => handler, HttpsError };
        return { https, runWith: (options) => { assert.equal(options.invoker, 'public'); return { https }; } };
      }
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

test('protects active bookings even if their session document is missing', async () => {
  const entries = withReservation();
  delete entries['nest_class_sessions/session'];
  const { handlers } = setup('OWNER', entries);
  await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots: [], version: 3 }, context), { code: 'failed-precondition' });
});

test('edits time, weekdays and capacity of an unreserved class', async () => {
  const { handlers, records } = setup('OWNER', { [configKey]: { slots: [slot], version: 1 } });
  await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [5], startTime: '21:00', capacity: 12 }], version: 1 }, context);
  const saved = records.get(configKey).slots[0];
  assert.equal(saved.startTime, '21:00');
  assert.equal(saved.daysOfWeek[0], 5);
  assert.equal(saved.capacity, 12);
});

test('deletes an unreserved class and reloads the remaining schedule', async () => {
  const { handlers } = setup('OWNER', { [configKey]: { slots: [slot], version: 1 } });
  await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [], version: 1 }, context);
  const result = await handlers.getNestAdminSchedule({ family: 'pilates' }, context);
  assert.equal(result.slots.length, 0);
  assert.equal(result.version, 2);
});

test('editing Barre leaves Pilates configuration unchanged', async () => {
  const { handlers, records } = setup('OWNER', { [configKey]: { slots: [slot], version: 1 } });
  await handlers.saveNestAdminSchedule({ family: 'barre', slots: [slot], version: 0 }, context);
  assert.equal(records.get(configKey).version, 1);
  assert.equal(records.get('nest_calendar/barre__booking-slots').version, 1);
});

function studentEntries(count) {
  const entries = { [configKey]: { slots: [slot], version: 1 } };
  for (let i = 0; i < count; i += 1) {
    entries[`users/user${i}`] = { role: 'NEST_STUDENT', athleteId: `athlete${i}`, email: `user${i}@example.com`, nestFamilies: ['pilates'] };
    entries[`athletes_pilates/athlete${i}`] = { authUid: `user${i}`, email: `user${i}@example.com`, name: `Student ${i}` };
    entries[`athlete_pilates_months/month${i}`] = { athleteId: `athlete${i}`, month: '2099-01', paid: true, tariff: 'Reformer 4' };
  }
  return entries;
}
const bookingInput = { family: 'pilates', dateKey: futureMonday, slotId: slot.id, startTime: slot.startTime };

test('20 simultaneous students compete for 6 seats without overbooking (transaction simulator)', async () => {
  const { handlers, records } = setup('OWNER', studentEntries(20));
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) =>
    handlers.bookNestClass(bookingInput, { auth: { uid: `user${i}` } })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 6);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'resource-exhausted').length, 14);
  const id = `pilates__${futureMonday}__${slot.id}`;
  assert.equal(records.get(`nest_class_sessions/${id}`).reservedCount, 6);
  assert.equal([...records.keys()].filter((key) => key.startsWith('nest_bookings/')).length, 6);
});

test('20 duplicate requests book exactly one seat and use one session', async () => {
  const { handlers, records } = setup('OWNER', studentEntries(1));
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => handlers.bookNestClass(bookingInput, { auth: { uid: 'user0' } })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(records.get('nest_monthly_usage/athlete0__pilates__2099-01').bookedCount, 1);
});

test('20 simultaneous schedule loads preserve booked status and counters', async () => {
  const { handlers } = setup('OWNER', studentEntries(20));
  await handlers.bookNestClass(bookingInput, { auth: { uid: 'user0' } });
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => handlers.getNestBookingSchedule({
    family: 'pilates', startDate: '2099-01-01', endDate: '2099-01-31',
  }, { auth: { uid: `user${i}` } })));
  for (let i = 0; i < 20; i += 1) {
    const session = results[i].sessions.find((item) => item.dateKey === futureMonday);
    assert.equal(session.reservedCount, 1);
    assert.equal(session.isBooked, i === 0);
    assert.equal(session.monthlyUsed, i === 0 ? 1 : 0);
  }
});

test('confirmed cancellation returns counters and frees a seat', async () => {
  const { handlers, records } = setup('OWNER', studentEntries(1));
  const context = { auth: { uid: 'user0' } };
  const booked = await handlers.bookNestClass(bookingInput, context);
  assert.equal(booked.monthlyUsed, 1);
  assert.equal(booked.reservedCount, 1);
  const cancelled = await handlers.cancelNestBooking(bookingInput, context);
  assert.equal(cancelled.monthlyUsed, 0);
  assert.equal(cancelled.reservedCount, 0);
  assert.equal(records.get('nest_monthly_usage/athlete0__pilates__2099-01').bookedCount, 0);
});

test('simultaneous bookings for different dates cannot exceed the monthly four-session quota', async () => {
  const { handlers, records } = setup('OWNER', studentEntries(1));
  const dates = ['2099-01-05', '2099-01-07', '2099-01-12', '2099-01-14', '2099-01-19', '2099-01-21'];
  const results = await Promise.allSettled(dates.map((dateKey) => handlers.bookNestClass({ ...bookingInput, dateKey }, { auth: { uid: 'user0' } })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 4);
  assert.equal(records.get('nest_monthly_usage/athlete0__pilates__2099-01').bookedCount, 4);
});