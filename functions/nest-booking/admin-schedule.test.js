const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real callable handlers with an in-memory Firestore substitute.
// No Firebase account, network requests or production writes are involved.
function setup(role = 'OWNER', entries = {}, { now, beforeTransaction } = {}) {
  let currentTime = now ? new Date(now).getTime() : Date.now();
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [currentTime])); }
    static now() { return currentTime; }
  }
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
          if (operator === '<') return actual < value;
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
      beforeTransaction?.((value) => { currentTime = new Date(value).getTime(); }, records);
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
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
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
    Intl, Date: TestDate, console,
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

for (const role of ['OWNER', 'RECEPTION', 'COACH', 'TEAM_LEADER']) {
  test(`${role} can search students and reserve by ID without an email`, async () => {
    const entries = studentEntries(1);
    delete entries['athletes_pilates/athlete0'].email;
    const { handlers, records } = setup(role, entries);
    const list = await handlers.getNestBookingAthletes({ family: 'pilates' }, context);
    assert.equal(list.athletes[0].id, 'athlete0');
    const result = await handlers.bookNestClass({ ...bookingInput, athleteId: 'athlete0' }, context);
    assert.equal(result.attendee.athleteId, 'athlete0');
    assert.equal(result.attendee.isCurrentUser, false);
    assert.equal(records.get('nest_monthly_usage/athlete0__pilates__2099-01').bookedCount, 1);
  });
}

for (const role of ['NEST_STUDENT', 'NEST_INSTRUCTOR', 'PENDING']) {
  test(`${role} cannot read the staff student directory`, async () => {
    const { handlers, reads } = setup(role, studentEntries(1));
    await assert.rejects(handlers.getNestBookingAthletes({ family: 'pilates' }, context), { code: 'permission-denied' });
    assert.ok(!reads.includes('athletes_pilates'));
  });
}

test('student directory requires auth, filters disciplines and returns only minimal fields', async () => {
  const entries = studentEntries(1);
  entries['athletes_pilates/athlete0'].privateNotes = 'Must not leave backend';
  entries['athletes_pilates/barre-only'] = { name: 'Ana', email: 'ANA@example.com', nestFamilies: ['barre'] };
  entries['athletes_pilates/both'] = { name: 'Bea', nestFamilies: ['pilates', 'barre'] };
  const { handlers } = setup('OWNER', entries);
  await assert.rejects(handlers.getNestBookingAthletes({ family: 'pilates' }, {}), { code: 'unauthenticated' });
  await assert.rejects(handlers.getNestBookingAthletes({ family: 'other' }, context), { code: 'invalid-argument' });
  const pilates = await handlers.getNestBookingAthletes({ family: 'pilates' }, context);
  assert.equal(pilates.athletes.length, 2);
  assert.ok(!pilates.athletes.some((athlete) => athlete.id === 'barre-only'));
  assert.deepEqual(Object.keys(pilates.athletes[0]).sort(), ['email', 'id', 'name']);
  const barre = await handlers.getNestBookingAthletes({ family: 'barre' }, context);
  assert.equal(barre.athletes[0].email, 'ana@example.com');
});

test('staff reservation by ID distinguishes identical names and preserves old email flow', async () => {
  const entries = studentEntries(2);
  entries['athletes_pilates/athlete0'].name = 'Ana';
  entries['athletes_pilates/athlete1'].name = 'Ana';
  const { handlers } = setup('OWNER', entries);
  assert.equal((await handlers.bookNestClass({ ...bookingInput, athleteId: 'athlete1' }, context)).attendee.athleteId, 'athlete1');
  assert.equal((await handlers.bookNestClass({ ...bookingInput, athleteEmail: 'user0@example.com' }, context)).attendee.athleteId, 'athlete0');
  await assert.rejects(handlers.bookNestClass({ ...bookingInput, athleteId: 'athlete1' }, context), { code: 'already-exists' });
});

test('students cannot use another athlete ID to impersonate a classmate', async () => {
  const { handlers } = setup('OWNER', studentEntries(2));
  const result = await handlers.bookNestClass({ ...bookingInput, athleteId: 'athlete1' }, { auth: { uid: 'user0' } });
  assert.equal(result.attendee.athleteId, 'athlete0');
});

test('staff ID booking rejects invalid IDs, absent records and unpaid memberships', async () => {
  const entries = studentEntries(1);
  entries['athlete_pilates_months/month0'].paid = false;
  const { handlers } = setup('OWNER', entries, { now: '2099-01-06T12:00:00Z' });
  for (const athleteId of ['', '../athlete0', 123]) {
    await assert.rejects(handlers.bookNestClass({ ...bookingInput, athleteId }, context), { code: 'invalid-argument' });
  }
  await assert.rejects(handlers.bookNestClass({ ...bookingInput, athleteId: 'missing' }, context), { code: 'not-found' });
  await assert.rejects(handlers.bookNestClass({ ...bookingInput, athleteId: 'athlete0' }, context), { code: 'failed-precondition' });
});

test('staff ID booking rechecks the student still exists inside the transaction', async () => {
  const { handlers } = setup('OWNER', studentEntries(1), {
    beforeTransaction: (_, records) => records.delete('athletes_pilates/athlete0'),
  });
  await assert.rejects(handlers.bookNestClass({ ...bookingInput, athleteId: 'athlete0' }, context), { code: 'permission-denied' });
});

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

const studentContext = { auth: { uid: 'user0' } };
const graceBooking = { ...bookingInput, dateKey: '2099-01-12' };
const januarySchedule = { family: 'pilates', startDate: '2099-01-01', endDate: '2099-01-31' };

for (const family of ['pilates', 'barre']) {
  for (const now of ['2099-01-01T09:00:00Z', '2099-01-05T22:59:59.999Z']) {
    test(`${family}: unpaid registered month can book through Madrid day 5 (${now})`, async () => {
      const entries = studentEntries(1);
      entries[`nest_calendar/${family}__booking-slots`] = { slots: [slot], version: 1 };
      entries['users/user0'].nestFamilies = [family];
      entries['athlete_pilates_months/month0'] = { athleteId: 'athlete0', month: '2099-01', paid: false,
        tariff: family === 'barre' ? 'Barre 4' : 'Reformer 4' };
      const { handlers, records } = setup('OWNER', entries, { now });
      const schedule = await handlers.getNestBookingSchedule({ ...januarySchedule, family }, studentContext);
      const session = schedule.sessions.find((item) => item.dateKey === graceBooking.dateKey);
      assert.equal(session.canBook, true);
      assert.equal(session.paymentGrace, true);
      assert.equal(session.bookingAccessExpiresAt, '2099-01-05T23:00:00.000Z');
      const result = await handlers.bookNestClass({ ...graceBooking, family }, studentContext);
      assert.equal(result.monthlyUsed, 1);
      assert.equal(records.get('athlete_pilates_months/month0').paid, false);
    });
  }
  test(`${family}: unpaid month is blocked from Madrid day 6, paid month still works`, async () => {
    const entries = studentEntries(1);
    entries[`nest_calendar/${family}__booking-slots`] = { slots: [slot], version: 1 };
    entries['users/user0'].nestFamilies = [family];
    entries['athlete_pilates_months/month0'].tariff = family === 'barre' ? 'Barre 4' : 'Reformer 4';
    entries['athlete_pilates_months/month0'].paid = false;
    const { handlers, records } = setup('OWNER', entries, { now: '2099-01-05T23:00:00Z' });
    const schedule = await handlers.getNestBookingSchedule({ ...januarySchedule, family }, studentContext);
    assert.ok(schedule.sessions.every((session) => !session.canBook && !session.activeForMonth));
    await assert.rejects(handlers.bookNestClass({ ...graceBooking, family }, studentContext), { code: 'failed-precondition' });
    assert.equal(records.has(`nest_monthly_usage/athlete0__${family}__2099-01`), false);
    records.get('athlete_pilates_months/month0').paid = true;
    const paidSchedule = await handlers.getNestBookingSchedule({ ...januarySchedule, family }, studentContext);
    assert.ok(paidSchedule.sessions.some((session) => session.canBook));
    assert.ok(paidSchedule.sessions.every((session) => !session.paymentGrace && !session.bookingAccessExpiresAt));
    assert.equal((await handlers.bookNestClass({ ...graceBooking, family }, studentContext)).monthlyUsed, 1);
  });
}

for (const [name, change] of [
  ['missing tariff', (entries) => { delete entries['athlete_pilates_months/month0'].tariff; }],
  ['missing month record', (entries) => { delete entries['athlete_pilates_months/month0']; }],
  ['different discipline', (entries) => { entries['athlete_pilates_months/month0'].tariff = 'Barre 4'; }],
  ['future unpaid month', (entries) => {}],
]) {
  test(`grace does not authorize ${name}`, async () => {
    const entries = studentEntries(1);
    entries['athlete_pilates_months/month0'].paid = false;
    change(entries);
    const now = name === 'future unpaid month' ? '2098-12-05T12:00:00Z' : '2099-01-05T12:00:00Z';
    const { handlers } = setup('OWNER', entries, { now });
    await assert.rejects(handlers.bookNestClass(graceBooking, studentContext), { code: 'failed-precondition' });
  });
}

test('grace expires inside the booking transaction even if lookup was on day 5', async () => {
  const entries = studentEntries(1);
  entries['athlete_pilates_months/month0'].paid = false;
  const { handlers, records } = setup('OWNER', entries, { now: '2099-01-05T22:59:59Z',
    beforeTransaction: (setTime) => setTime('2099-01-05T23:00:00Z') });
  await assert.rejects(handlers.bookNestClass(graceBooking, studentContext), { code: 'failed-precondition' });
  assert.equal(records.has('nest_monthly_usage/athlete0__pilates__2099-01'), false);
});

test('unpaid grace bookings still consume the registered monthly quota', async () => {
  const entries = studentEntries(1);
  entries['athlete_pilates_months/month0'].paid = false;
  entries['nest_monthly_usage/athlete0__pilates__2099-01'] = { bookedCount: 4 };
  const { handlers } = setup('OWNER', entries, { now: '2099-01-05T12:00:00Z' });
  const schedule = await handlers.getNestBookingSchedule(januarySchedule, studentContext);
  assert.ok(schedule.sessions.every((session) => session.activeForMonth && !session.canBook && session.monthlyUsed === 4));
  await assert.rejects(handlers.bookNestClass(graceBooking, studentContext), { code: 'resource-exhausted' });
});

test('summer grace cutoff uses Madrid daylight-saving time', async () => {
  const entries = studentEntries(1);
  entries['athlete_pilates_months/month0'].month = '2099-07';
  entries['athlete_pilates_months/month0'].paid = false;
  const { handlers } = setup('OWNER', entries, { now: '2099-07-05T21:59:59Z' });
  const summerSchedule = { ...januarySchedule, startDate: '2099-07-01', endDate: '2099-07-31' };
  const schedule = await handlers.getNestBookingSchedule(summerSchedule, studentContext);
  assert.ok(schedule.sessions.some((session) => session.canBook));
  assert.ok(schedule.sessions.every((session) => session.bookingAccessExpiresAt === '2099-07-05T22:00:00.000Z'));
  const expired = setup('OWNER', entries, { now: '2099-07-05T22:00:00Z' });
  const blocked = await expired.handlers.getNestBookingSchedule(summerSchedule, studentContext);
  assert.ok(blocked.sessions.every((session) => !session.activeForMonth));
});

test('missing current month carries forward the last tariff, not its payment or usage', async () => {
  const entries = studentEntries(1);
  entries['athlete_pilates_months/month0'].month = '2098-12';
  entries['athlete_pilates_months/month0'].tariff = 'Reformer 8';
  entries['athlete_pilates_months/older'] = { athleteId: 'athlete0', month: '2098-11', paid: true, tariff: 'Reformer 12' };
  entries['athlete_pilates_months/barre'] = { athleteId: 'athlete0', month: '2098-12', paid: true, tariff: 'Barre 4' };
  entries['nest_monthly_usage/athlete0__pilates__2098-12'] = { bookedCount: 8 };
  const { handlers, records } = setup('OWNER', entries, { now: '2099-01-05T12:00:00Z' });
  const schedule = await handlers.getNestBookingSchedule(januarySchedule, studentContext);
  const session = schedule.sessions.find((item) => item.dateKey === graceBooking.dateKey);
  assert.equal(session.monthlyLimit, 8);
  assert.equal(session.monthlyUsed, 0);
  assert.equal(session.paymentGrace, true);
  const result = await handlers.bookNestClass(graceBooking, studentContext);
  assert.equal(result.monthlyUsed, 1);
  assert.equal(result.monthlyLimit, 8);
  assert.equal(records.get('athlete_pilates_months/month0').month, '2098-12');
  assert.equal([...records.values()].filter((record) => record.athleteId === 'athlete0' && record.month === '2099-01' && record.paid === true).length, 0);
  const expired = setup('OWNER', entries, { now: '2099-01-06T12:00:00Z' });
  await assert.rejects(expired.handlers.bookNestClass(graceBooking, studentContext), { code: 'failed-precondition' });
});

test('a current registered tariff overrides the historical tariff during grace', async () => {
  const entries = studentEntries(1);
  entries['athlete_pilates_months/month0'].paid = false;
  entries['athlete_pilates_months/older'] = { athleteId: 'athlete0', month: '2098-12', paid: true, tariff: 'Reformer 12' };
  const { handlers } = setup('OWNER', entries, { now: '2099-01-05T12:00:00Z' });
  assert.equal((await handlers.bookNestClass(graceBooking, studentContext)).monthlyLimit, 4);
});

test('transaction rechecks tariff when a current month is registered during historical lookup', async () => {
  const entries = studentEntries(1);
  entries['athlete_pilates_months/month0'].month = '2098-12';
  entries['athlete_pilates_months/month0'].tariff = 'Reformer 12';
  const { handlers } = setup('OWNER', entries, { now: '2099-01-05T12:00:00Z', beforeTransaction: (_, records) => {
    records.set('athlete_pilates_months/current', { athleteId: 'athlete0', month: '2099-01', paid: false, tariff: 'Reformer 4' });
  } });
  assert.equal((await handlers.bookNestClass(graceBooking, studentContext)).monthlyLimit, 4);
});

function removableSchedule() {
  const entries = { [configKey]: { slots: [slot], version: 1 } };
  for (const [id, dateKey] of [['monday', '2099-01-05'], ['wednesday', '2099-01-07'], ['past', '2098-12-29']]) {
    entries[`nest_class_sessions/${id}`] = { family: 'pilates', slotId: slot.id, dateKey, startTime: '18:00', reservedCount: 1 };
    entries[`nest_bookings/${id}`] = { family: 'pilates', slotId: slot.id, sessionId: id, athleteId: 'student', dateKey,
      startTime: '18:00', status: 'BOOKED' };
  }
  entries['nest_monthly_usage/student__pilates__2099-01'] = { bookedCount: 2 };
  return entries;
}

test('individual weekday deletion requires explicit confirmation with reserved classes', async () => {
  const { handlers, records } = setup('OWNER', removableSchedule(), { now: '2099-01-01T10:00:00Z' });
  let warning;
  await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [3] }], version: 1 }, context), (error) => {
    warning = error.details;
    return error.code === 'failed-precondition' && warning.requiresDeletionConfirmation;
  });
  assert.equal(warning.affectedClasses.length, 1);
  assert.equal(warning.affectedClasses[0].dayOfWeek, 1);
  assert.equal(warning.affectedClasses[0].reservationCount, 1);
  assert.equal(records.get(configKey).version, 1);
  assert.equal(records.get('nest_bookings/monday').status, 'BOOKED');
  const result = await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [3] }], version: 1,
    confirmDeletedClasses: warning.affectedClasses }, context);
  assert.equal(result.cancelledBookings, 1);
  assert.equal(result.version, 2);
  assert.equal(records.get(configKey).slots[0].daysOfWeek[0], 3);
  assert.equal(records.get('nest_bookings/monday').status, 'CANCELLED');
  assert.equal(records.get('nest_bookings/monday').cancellationReason, 'CLASS_REMOVED');
  assert.equal(records.get('nest_bookings/wednesday').status, 'BOOKED');
  assert.equal(records.get('nest_bookings/past').status, 'BOOKED');
  assert.equal(records.get('nest_class_sessions/monday').reservedCount, 0);
  assert.equal(records.get('nest_class_sessions/wednesday').reservedCount, 1);
  assert.equal(records.get('nest_monthly_usage/student__pilates__2099-01').bookedCount, 1);
});

test('confirmed complete removal cancels future bookings, preserves past and refunds once', async () => {
  const { handlers, records } = setup('OWNER', removableSchedule(), { now: '2099-01-01T10:00:00Z' });
  const result = await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [], version: 1, confirmDeletedClasses: [
    { slotId: slot.id, dayOfWeek: 1, reservationCount: 1 }, { slotId: slot.id, dayOfWeek: 3, reservationCount: 1 },
  ] }, context);
  assert.equal(result.cancelledBookings, 2);
  assert.equal(records.get('nest_monthly_usage/student__pilates__2099-01').bookedCount, 0);
  assert.equal(records.get('nest_bookings/past').status, 'BOOKED');
  await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [], version: 2 }, context);
  assert.equal(records.get('nest_monthly_usage/student__pilates__2099-01').bookedCount, 0);
});

test('confirmation for another day or too few reservations cannot authorize deletion', async () => {
  for (const confirmation of [{ slotId: slot.id, dayOfWeek: 3, reservationCount: 10 },
    { slotId: slot.id, dayOfWeek: 1, reservationCount: 0 }]) {
    const { handlers, records } = setup('OWNER', removableSchedule(), { now: '2099-01-01T10:00:00Z' });
    await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [3] }], version: 1,
      confirmDeletedClasses: [confirmation] }, context), { code: 'failed-precondition' });
    assert.equal(records.get('nest_bookings/monday').status, 'BOOKED');
  }
});

test('deletion checks new reservations inside transaction and requests a fresh confirmation', async () => {
  const { handlers, records } = setup('OWNER', removableSchedule(), { now: '2099-01-01T10:00:00Z', beforeTransaction: (_, records) => {
    records.set('nest_bookings/new', { ...records.get('nest_bookings/monday'), athleteId: 'another' });
  } });
  await assert.rejects(handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [3] }], version: 1,
    confirmDeletedClasses: [{ slotId: slot.id, dayOfWeek: 1, reservationCount: 1 }] }, context), (error) =>
    error.details.affectedClasses[0].reservationCount === 2);
  assert.equal(records.get(configKey).version, 1);
});

test('confirmed deletion cancels bookings with missing sessions and clamps stale usage', async () => {
  const entries = removableSchedule();
  delete entries['nest_class_sessions/monday'];
  entries['nest_monthly_usage/student__pilates__2099-01'].bookedCount = 0;
  const { handlers, records } = setup('OWNER', entries, { now: '2099-01-01T10:00:00Z' });
  await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [3] }], version: 1,
    confirmDeletedClasses: [{ slotId: slot.id, dayOfWeek: 1, reservationCount: 1 }] }, context);
  assert.equal(records.get('nest_bookings/monday').status, 'CANCELLED');
  assert.equal(records.get('nest_monthly_usage/student__pilates__2099-01').bookedCount, 0);
});

test('deletion keeps earlier classes on the current date in the history', async () => {
  const entries = removableSchedule();
  const { handlers, records } = setup('OWNER', entries, { now: '2099-01-05T18:00:00Z' });
  await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [3] }], version: 1 }, context);
  assert.equal(records.get('nest_bookings/monday').status, 'BOOKED');
  assert.equal(records.get('nest_class_sessions/monday').reservedCount, 1);
});

test('removed future classes do not reappear in the student schedule from cancelled bookings', async () => {
  const entries = studentEntries(1);
  const { handlers } = setup('OWNER', entries, { now: '2099-01-01T10:00:00Z' });
  await handlers.bookNestClass(bookingInput, { auth: { uid: 'user0' } });
  await handlers.saveNestAdminSchedule({ family: 'pilates', slots: [{ ...slot, daysOfWeek: [3] }], version: 1,
    confirmDeletedClasses: [{ slotId: slot.id, dayOfWeek: 1, reservationCount: 1 }] }, context);
  const schedule = await handlers.getNestBookingSchedule({ family: 'pilates', startDate: '2099-01-01', endDate: '2099-01-31' }, { auth: { uid: 'user0' } });
  assert.ok(!schedule.sessions.some((session) => session.dateKey === futureMonday));
  assert.ok(schedule.sessions.some((session) => session.dateKey === '2099-01-07'));
});

test('Barre weekday removal cancels all matching weeks and leaves Pilates untouched', async () => {
  const entries = removableSchedule();
  entries['nest_calendar/barre__booking-slots'] = { slots: [slot], version: 1 };
  for (const [id, dateKey] of [['barre-1', '2099-01-05'], ['barre-2', '2099-01-12']]) {
    entries[`nest_bookings/${id}`] = { family: 'barre', slotId: slot.id, dateKey, startTime: '18:00', athleteId: 'student', status: 'BOOKED' };
  }
  entries['nest_monthly_usage/student__barre__2099-01'] = { bookedCount: 2 };
  const { handlers, records } = setup('OWNER', entries, { now: '2099-01-01T10:00:00Z' });
  const result = await handlers.saveNestAdminSchedule({ family: 'barre', slots: [{ ...slot, daysOfWeek: [3] }], version: 1,
    confirmDeletedClasses: [{ slotId: slot.id, dayOfWeek: 1, reservationCount: 2 }] }, context);
  assert.equal(result.cancelledBookings, 2);
  assert.equal(records.get('nest_bookings/barre-1').status, 'CANCELLED');
  assert.equal(records.get('nest_bookings/barre-2').status, 'CANCELLED');
  assert.equal(records.get('nest_bookings/monday').status, 'BOOKED');
  assert.equal(records.get('nest_monthly_usage/student__barre__2099-01').bookedCount, 0);
  assert.equal(records.get(configKey).version, 1);
});