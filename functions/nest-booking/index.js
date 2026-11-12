const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const CAPACITY = 6;
const CANCELLATION_CUTOFF_HOURS = 2;
const TIME_ZONE = 'Europe/Madrid';
const STAFF_ROLES = new Set(['OWNER', 'RECEPTION', 'COACH', 'TEAM_LEADER']);
const SCHEDULES = {
  pilates: [
    { id: 'mw-18-19', daysOfWeek: [1, 3], startTime: '18:00' },
    { id: 'mw-19-20', daysOfWeek: [1, 3], startTime: '19:00' },
    { id: 'tt-10-11', daysOfWeek: [2, 4], startTime: '10:00' },
    { id: 'tt-19-20', daysOfWeek: [2, 4], startTime: '19:00' },
  ],
  barre: [
    { id: 'mw-11-12', daysOfWeek: [1, 3], startTime: '11:00' },
    { id: 'mw-17-18', daysOfWeek: [1, 3], startTime: '17:00' },
    { id: 'tt-09-10', daysOfWeek: [2, 4], startTime: '09:00' },
  ],
};

function fail(code, message, details) {
  throw new functions.https.HttpsError(code, message, details);
}

function requireAuth(context) {
  if (!context.auth) fail('unauthenticated', 'Inicia sesión para continuar.');
  return context.auth.uid;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function monthKey(dateKey) {
  return dateKey.slice(0, 7);
}

function validateFamily(family) {
  if (!['pilates', 'barre'].includes(family)) fail('invalid-argument', 'Disciplina no válida.');
  return family;
}

async function getProfile(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) fail('permission-denied', 'Tu cuenta todavía no tiene acceso autorizado a The Nest.');
  return snap.data() || {};
}

function hasFamily(profile, family) {
  const families = Array.isArray(profile.nestFamilies) ? profile.nestFamilies : [];
  return families.includes(family) || profile.nestFamily === family;
}

async function assertFamilyAccess(profile, family) {
  if (STAFF_ROLES.has(profile.role)) return;
  if (profile.role === 'NEST_INSTRUCTOR' && hasFamily(profile, family)) {
    const teacherSnap = profile.teacherId
      ? await db.collection('teachers').doc(profile.teacherId).get()
      : null;
    const teacher = teacherSnap?.exists ? teacherSnap.data() || {} : {};
    if (teacherSnap?.exists && normalizeEmail(teacher.email) === normalizeEmail(profile.email) &&
        String(teacher.status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
        (Array.isArray(teacher.nestFamilies) ? teacher.nestFamilies : []).includes(family)) return;
    fail('permission-denied', 'Tu acceso de profesora está desactivado o ya no incluye esta disciplina.');
  }
  if (profile.role === 'NEST_STUDENT' && hasFamily(profile, family)) return;
  fail('permission-denied', 'No tienes permiso para acceder a esta disciplina.');
}

function tariffValue(record) {
  if (typeof record === 'string') return record;
  return record?.tariff || record?.tarifa || record?.plan || record?.idTarifa || record?.family || '';
}

function tariffFamily(record) {
  const value = String(tariffValue(record) || '').toLowerCase();
  if (value.includes('barre')) return 'barre';
  if (value.includes('reformer')) return 'pilates';
  return null;
}

function tariffMonthlyLimit(record) {
  const match = String(tariffValue(record) || '').match(/(?:reformer|barre)\s+(4|8|12)/i);
  return match ? Number(match[1]) : null;
}

function familiesFromHistory(records, athlete = {}) {
  const families = new Set((records || []).map((record) => tariffFamily(record)).filter(Boolean));
  (Array.isArray(athlete.nestFamilies) ? athlete.nestFamilies : []).forEach((family) => {
    if (['pilates', 'barre'].includes(family)) families.add(family);
  });
  const athleteFamily = tariffFamily(athlete);
  if (athleteFamily) families.add(athleteFamily);
  return Array.from(families);
}

function sessionId(family, dateKey, slotId) {
  return `${family}__${dateKey}__${slotId}`;
}

function validDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const madridTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function localTimeToDate(dateKey, time) {
  // Convert a Europe/Madrid wall-clock time to a UTC Date, including DST changes.
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(targetAsUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = madridTimeFormatter.formatToParts(guess);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const renderedAsUtc = Date.UTC(
      Number(values.year), Number(values.month) - 1, Number(values.day),
      Number(values.hour), Number(values.minute)
    );
    guess = new Date(guess.getTime() + targetAsUtc - renderedAsUtc);
  }
  return guess;
}

function isPaymentGraceOpen(month, now = new Date()) {
  const parts = Object.fromEntries(madridTimeFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}` === month && Number(parts.day) <= 5;
}

function membershipBookingAccess(record, family, month, now = new Date()) {
  const monthlyLimit = tariffMonthlyLimit(record);
  if (record?.month !== month || tariffFamily(record) !== family || !monthlyLimit) return null;
  const paymentGrace = record.paid !== true && isPaymentGraceOpen(month, now);
  if (record.paid !== true && !paymentGrace) return null;
  return {
    monthlyLimit,
    paymentGrace,
    bookingAccessExpiresAt: paymentGrace ? localTimeToDate(`${month}-06`, '00:00').toISOString() : null,
  };
}

async function findMonthlyMembership(athleteId, family, month, transaction = null) {
  const query = db.collection('athlete_pilates_months')
    .where('athleteId', '==', athleteId)
    .where('month', '==', month);
  const snap = await (transaction ? transaction.get(query) : query.get());
  const currentMemberships = snap.docs
    .map((doc) => ({ ref: doc.ref, data: doc.data() }))
    .filter(({ data }) => tariffFamily(data) === family);
  // The staff payment list carries forward the latest tariff when no month record exists.
  // Mirror that behavior during grace only; never carry forward the paid flag.
  let candidates = currentMemberships;
  if (!candidates.length && isPaymentGraceOpen(month)) {
    const historyQuery = db.collection('athlete_pilates_months')
      .where('athleteId', '==', athleteId).where('month', '<', month);
    const history = await (transaction ? transaction.get(historyQuery) : historyQuery.get());
    candidates = history.docs.map((doc) => ({ ref: doc.ref, data: doc.data() }))
      .filter(({ data }) => tariffFamily(data) === family)
      .sort((first, second) => second.data.month.localeCompare(first.data.month) ||
        (second.data.updatedAt?.toMillis?.() || second.data.createdAt?.toMillis?.() || 0) -
        (first.data.updatedAt?.toMillis?.() || first.data.createdAt?.toMillis?.() || 0))
      .slice(0, 1)
      .map((membership) => ({ ...membership, data: { ...membership.data, month, paid: false } }));
  }
  const memberships = candidates
    .map((membership) => ({ ...membership, access: membershipBookingAccess(membership.data, family, month) }))
    .filter((membership) => membership.access)
    .map(({ access, ...membership }) => ({ ...membership, ...access }))
    .sort((first, second) => {
      if (first.data.paid !== second.data.paid) return Number(second.data.paid === true) - Number(first.data.paid === true);
      const firstUpdated = first.data.updatedAt?.toMillis?.() || first.data.createdAt?.toMillis?.() || 0;
      const secondUpdated = second.data.updatedAt?.toMillis?.() || second.data.createdAt?.toMillis?.() || 0;
      return secondUpdated - firstUpdated;
    });
  return memberships[0] || null;
}

function scheduledSlots(family, customSlots) {
  const slots = SCHEDULES[family].map((slot) => ({ ...slot, capacity: CAPACITY, active: true }));
  (Array.isArray(customSlots) ? customSlots : []).forEach((slot) => {
    slots.push({
      id: slot.id,
      daysOfWeek: [slot.dayOfWeek],
      startTime: slot.startTime,
      capacity: CAPACITY,
      active: true,
    });
  });
  return slots;
}

async function getEffectiveSlots(family, transaction = null) {
  const configRef = db.collection('nest_calendar').doc(`${family}__booking-slots`);
  const configuredSnap = await (transaction ? transaction.get(configRef) : configRef.get());
  if (configuredSnap.exists && Array.isArray(configuredSnap.data().slots)) {
    return configuredSnap.data().slots
      .filter((slot) => slot.active !== false)
      .map((slot) => ({ ...slot, capacity: Number(slot.capacity) || CAPACITY }));
  }
  const legacyRef = db.collection('nest_calendar').doc(`${family}__weekly-slots`);
  const legacySnap = await (transaction ? transaction.get(legacyRef) : legacyRef.get());
  const legacyCustomSlots = legacySnap.exists ? legacySnap.data().slots || [] : [];
  return scheduledSlots(family, legacyCustomSlots);
}

async function requireNestStaff(uid) {
  const profile = await getProfile(uid);
  if (!STAFF_ROLES.has(profile.role)) {
    fail('permission-denied', 'Solo el personal de OwlManage puede administrar los horarios de The Nest.');
  }
  return profile;
}

// HTTP must accept browser preflight; Firebase Auth and staff roles are checked below.
exports.getNestAdminSchedule = functions.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const family = validateFamily(data.family);
  await requireNestStaff(uid);
  return db.runTransaction(async (transaction) => {
    const config = await transaction.get(db.collection('nest_calendar').doc(`${family}__booking-slots`));
    return { family, slots: await getEffectiveSlots(family, transaction), version: Number(config.data()?.version || 0) };
  });
});

exports.saveNestAdminSchedule = functions.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const family = validateFamily(data.family);
  await requireNestStaff(uid);
  const nextSlots = validateAdminSlots(data.slots);
  const nextById = new Map(nextSlots.map((slot) => [slot.id, slot]));
  if (!Number.isInteger(data.version) || data.version < 0) {
    fail('invalid-argument', 'Recarga el horario antes de guardar los cambios.');
  }
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const isFutureClass = (record) => record.dateKey >= todayKey &&
    (!/^(?:0\d|1\d|2[0-3]):[0-5]\d$/.test(record.startTime || '') ||
      localTimeToDate(record.dateKey, record.startTime).getTime() > Date.now());
  const configRef = db.collection('nest_calendar').doc(`${family}__booking-slots`);
  const version = await db.runTransaction(async (transaction) => {
    const currentConfig = await transaction.get(configRef);
    const previousVersion = Number(currentConfig.data()?.version || 0);
    if (previousVersion !== data.version) {
      fail('aborted', 'Otro gestor ha modificado el horario. Cierra y vuelve a abrir Administración para cargar sus cambios.');
    }
    const [allSessions, allBookings] = await Promise.all([
      transaction.get(db.collection('nest_class_sessions').where('family', '==', family)),
      transaction.get(db.collection('nest_bookings').where('family', '==', family)),
    ]);
    const currentSlots = await getEffectiveSlots(family, transaction);
    const removedClasses = currentSlots.flatMap((slot) => slot.daysOfWeek
      .filter((day) => !nextById.get(slot.id)?.daysOfWeek.includes(day))
      .map((dayOfWeek) => ({ slotId: slot.id, dayOfWeek, startTime: slot.startTime, reservationCount: 0 })));
    const removedByKey = new Map(removedClasses.map((entry) => [`${entry.slotId}__${entry.dayOfWeek}`, entry]));
    const activeBookingCounts = new Map();
    const protectedSessions = new Map(allSessions.docs.map((sessionDoc) => [sessionDoc.id, sessionDoc.data()]));
    allBookings.docs.forEach((bookingDoc) => {
      const booking = bookingDoc.data();
      if (booking.family !== family || booking.status !== 'BOOKED' || !isFutureClass(booking)) return;
      const id = booking.sessionId || sessionId(family, booking.dateKey, booking.slotId);
      activeBookingCounts.set(id, (activeBookingCounts.get(id) || 0) + 1);
      if (!protectedSessions.has(id)) protectedSessions.set(id, { ...booking, reservedCount: 0 });
    });

    for (const [id, session] of protectedSessions) {
      if (session.family !== family || !isFutureClass(session)) continue;
      const reservedCount = Math.max(
        Number(session.reservedCount || 0),
        activeBookingCounts.get(id) || 0
      );
      if (!reservedCount) continue;
      const replacement = nextById.get(session.slotId);
      const weekday = new Date(`${session.dateKey}T12:00:00Z`).getUTCDay();
      const removed = removedByKey.get(`${session.slotId}__${weekday}`);
      if (removed) {
        if (nextSlots.some((slot) => slot.daysOfWeek.includes(weekday) && slot.startTime === session.startTime)) {
          fail('failed-precondition', `No se puede sustituir el identificador de la clase del ${session.dateKey} mientras tenga reservas. Conserva su día, hora y configuración antes de guardar.`);
        }
        removed.reservationCount += reservedCount;
        continue;
      }
      if (!replacement) {
        fail('failed-precondition', `La clase del ${session.dateKey} tiene reservas y no pertenece al horario que estás eliminando. Recarga el horario.`);
      }
      if (replacement.startTime !== session.startTime || !replacement.daysOfWeek.includes(weekday)) {
        fail('failed-precondition', `No se puede mover «${session.dateKey} ${session.startTime}»: tiene ${reservedCount} reserva(s) activa(s). Cambia el horario cuando ya no queden reservas futuras.`);
      }
      if (replacement.capacity < reservedCount) {
        fail('failed-precondition', `El aforo no puede ser menor que las ${reservedCount} plazas ya reservadas para el ${session.dateKey}.`);
      }
    }

    const affectedClasses = removedClasses.filter((entry) => entry.reservationCount > 0);
    const confirmations = Array.isArray(data.confirmDeletedClasses) ? data.confirmDeletedClasses : [];
    if (affectedClasses.some((entry) => !confirmations.some((confirmation) =>
      confirmation.slotId === entry.slotId && confirmation.dayOfWeek === entry.dayOfWeek &&
      Number.isInteger(confirmation.reservationCount) && confirmation.reservationCount >= entry.reservationCount))) {
      fail('failed-precondition', 'Las clases que vas a eliminar tienen reservas. Confirma su cancelación para continuar.', {
        requiresDeletionConfirmation: true, affectedClasses,
      });
    }
    const cancelledBookings = allBookings.docs.filter((doc) => {
      const booking = doc.data();
      return booking.status === 'BOOKED' && isFutureClass(booking) &&
        removedByKey.has(`${booking.slotId}__${new Date(`${booking.dateKey}T12:00:00Z`).getUTCDay()}`);
    });
    const refunds = new Map();
    cancelledBookings.forEach((doc) => {
      const booking = doc.data();
      const key = `${booking.athleteId}__${family}__${monthKey(booking.dateKey)}`;
      refunds.set(key, (refunds.get(key) || 0) + 1);
    });
    const usageSnapshots = await Promise.all(Array.from(refunds.keys(), (key) =>
      transaction.get(db.collection('nest_monthly_usage').doc(key))));
    cancelledBookings.forEach((doc) => transaction.update(doc.ref, {
      status: 'CANCELLED', cancellationReason: 'CLASS_REMOVED', cancelledBy: uid,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
    allSessions.docs.forEach((doc) => {
      const session = doc.data();
      if (isFutureClass(session) && removedByKey.has(
        `${session.slotId}__${new Date(`${session.dateKey}T12:00:00Z`).getUTCDay()}`)) {
        transaction.update(doc.ref, { reservedCount: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    });
    usageSnapshots.forEach((snap) => {
      if (snap.exists) transaction.update(snap.ref, {
        bookedCount: Math.max(0, Number(snap.data().bookedCount || 0) - refunds.get(snap.id)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    transaction.set(configRef, {
      family,
      slots: nextSlots,
      version: previousVersion + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    });
    return { version: previousVersion + 1, cancelledBookings: cancelledBookings.length };
  });
  return { success: true, slots: nextSlots, ...version };
});

function validateAdminSlots(slots) {
  if (!Array.isArray(slots) || slots.length > 40) {
    fail('invalid-argument', 'El horario debe contener como máximo 40 clases semanales.');
  }
  const ids = new Set();
  const occupiedTimes = new Set();
  return slots.map((slot) => {
    const id = String(slot?.id || '').trim();
    const startTime = String(slot?.startTime || '').trim();
    const daysOfWeek = Array.isArray(slot?.daysOfWeek)
      ? Array.from(new Set(slot.daysOfWeek.map(Number)))
      : [];
    const capacity = Number(slot?.capacity);
    if (!id || id.length > 80 || id.includes('__') || ids.has(id)) {
      fail('invalid-argument', 'Cada clase necesita un identificador único válido.');
    }
    if (!/^(?:0\d|1\d|2[0-3]):00$/.test(startTime)) {
      fail('invalid-argument', 'La hora debe estar en formato HH:00.');
    }
    if (!daysOfWeek.length || daysOfWeek.some((day) => !Number.isInteger(day) || day < 1 || day > 5)) {
      fail('invalid-argument', 'Selecciona uno o varios días de lunes a viernes.');
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
      fail('invalid-argument', 'El aforo debe estar entre 1 y 30 plazas.');
    }
    daysOfWeek.forEach((day) => {
      const key = `${day}__${startTime}`;
      if (occupiedTimes.has(key)) fail('already-exists', 'Ya existe una clase ese día y a esa hora.');
      occupiedTimes.add(key);
    });
    ids.add(id);
    return { id, daysOfWeek, startTime, capacity, active: true };
  });
}

async function findScheduledSlot(family, dateKey, slotId) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return (await getEffectiveSlots(family)).find((slot) =>
    slot.id === slotId && slot.daysOfWeek.includes(weekday)
  ) || null;
}

async function getStudentAthlete(profile, uid) {
  if (!profile.athleteId) fail('failed-precondition', 'Tu cuenta no está vinculada a una ficha de alumna. Contacta con recepción.');
  const snap = await db.collection('athletes_pilates').doc(profile.athleteId).get();
  if (!snap.exists) fail('failed-precondition', 'No se encuentra tu ficha de alumna. Contacta con recepción.');
  const data = snap.data() || {};
  if (!normalizeEmail(profile.email) || normalizeEmail(profile.email) !== normalizeEmail(data.email)) {
    fail('permission-denied', 'El correo de tu cuenta ya no coincide con la ficha. Contacta con recepción.');
  }
  if (data.authUid !== uid) {
    fail('permission-denied', 'La ficha ya está vinculada a otra cuenta. Contacta con recepción.');
  }
  return { ref: snap.ref, data };
}

exports.checkNestSignupEmail = functions.https.onCall(async (data) => {
  const email = normalizeEmail(data?.email);
  if (!validEmail(email)) fail('invalid-argument', 'Introduce un correo electrónico válido.');

  const [athletesSnap, teachersSnap] = await Promise.all([
    db.collection('athletes_pilates').get(),
    db.collection('teachers').get(),
  ]);
  const athleteMatches = athletesSnap.docs.filter((doc) => normalizeEmail(doc.data().email) === email);
  const teacherMatches = teachersSnap.docs.filter((doc) =>
    normalizeEmail(doc.data().email) === email &&
    String(doc.data().status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
    Array.isArray(doc.data().nestFamilies) &&
    doc.data().nestFamilies.some((family) => ['pilates', 'barre'].includes(family))
  );

  if (athleteMatches.length === 1 && teacherMatches.length === 0) {
    const athlete = athleteMatches[0];
    if (athlete.data().authUid) {
      return { eligible: false, reason: 'already-linked' };
    }
    const history = await db.collection('athlete_pilates_months')
      .where('athleteId', '==', athlete.id)
      .get();
    const hasNestTariff = familiesFromHistory(history.docs.map((doc) => doc.data()), athlete.data()).length > 0;
    return hasNestTariff
      ? { eligible: true }
      : { eligible: false, reason: 'missing-family' };
  }

  if (athleteMatches.length === 0 && teacherMatches.length === 1) {
    return teacherMatches[0].data().authUid
      ? { eligible: false, reason: 'already-linked' }
      : { eligible: true };
  }

  if (athleteMatches.length > 1 || teacherMatches.length > 1 || (athleteMatches.length && teacherMatches.length)) {
    return { eligible: false, reason: 'duplicate' };
  }
  return { eligible: false, reason: 'not-found' };
});

exports.registerNestPortalAccount = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const authUser = await admin.auth().getUser(uid);
  const email = normalizeEmail(authUser.email);
  if (!email) fail('failed-precondition', 'La cuenta debe tener un correo electrónico.');
  if (!authUser.emailVerified) fail('failed-precondition', 'Verifica tu correo antes de activar el acceso a The Nest.');

  const profileRef = db.collection('users').doc(uid);
  const profileSnap = await profileRef.get();
  if (profileSnap.exists && STAFF_ROLES.has((profileSnap.data() || {}).role)) {
    return { role: (profileSnap.data() || {}).role, alreadyAuthorized: true };
  }
  if (profileSnap.exists && ['NEST_STUDENT', 'NEST_INSTRUCTOR'].includes((profileSnap.data() || {}).role)) {
    return { role: (profileSnap.data() || {}).role, alreadyAuthorized: true };
  }

  const [athleteSnap, teacherSnap] = await Promise.all([
    db.collection('athletes_pilates').get(),
    db.collection('teachers').get(),
  ]);
  const athletes = athleteSnap.docs.filter((doc) => normalizeEmail(doc.data().email) === email);
  const teachers = teacherSnap.docs.filter((doc) =>
    normalizeEmail(doc.data().email) === email && String(doc.data().status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );

  if (teachers.length === 1 && athletes.length === 0) {
    const teacher = teachers[0].data();
    const families = Array.isArray(teacher.nestFamilies)
      ? teacher.nestFamilies.filter((family) => ['pilates', 'barre'].includes(family))
      : [];
    if (!families.length) fail('failed-precondition', 'Recepción debe habilitar tu acceso a Pilates o Barre.');
    await db.runTransaction(async (transaction) => {
      const [currentProfile, currentTeacher] = await Promise.all([
        transaction.get(profileRef), transaction.get(teachers[0].ref),
      ]);
      const currentTeacherData = currentTeacher.exists ? currentTeacher.data() || {} : {};
      if (!currentTeacher.exists || normalizeEmail(currentTeacherData.email) !== email ||
          String(currentTeacherData.status || 'ACTIVE').toUpperCase() !== 'ACTIVE' ||
          (currentTeacherData.authUid && currentTeacherData.authUid !== uid)) {
        fail('already-exists', 'El acceso de esta profesora ya está vinculado a otra cuenta o ha cambiado.');
      }
      const currentRole = currentProfile.exists ? (currentProfile.data() || {}).role : null;
      if (currentRole && currentRole !== 'PENDING') {
        fail('permission-denied', 'La cuenta ya tiene otro tipo de acceso.');
      }
      transaction.set(profileRef, {
        email,
        displayName: currentTeacherData.name || '',
        role: 'NEST_INSTRUCTOR',
        nestFamilies: families,
        teacherId: teachers[0].id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.update(teachers[0].ref, { authUid: uid });
    });
    return { role: 'NEST_INSTRUCTOR', nestFamilies: families };
  }

  if (athletes.length !== 1 || teachers.length > 0) {
    fail('failed-precondition', athletes.length > 1 || teachers.length > 1
      ? 'El correo está asociado a varias fichas. Contacta con recepción para corregirlas.'
      : 'No encontramos una ficha con ese correo. Pide a recepción que lo añada a tu ficha de Pilates o Barre.');
  }

  const athleteRef = athletes[0].ref;
  const athlete = athletes[0].data();
  if (athlete.authUid && athlete.authUid !== uid) {
    fail('already-exists', 'Ese correo ya está vinculado a otra cuenta. Contacta con recepción.');
  }
  const monthHistory = await db.collection('athlete_pilates_months')
    .where('athleteId', '==', athletes[0].id)
    .get();
  const nestFamilies = familiesFromHistory(monthHistory.docs.map((doc) => doc.data()), athlete);
  if (!nestFamilies.length) {
    fail('failed-precondition', 'La ficha todavía no tiene una tarifa de Pilates o Barre. Contacta con recepción.');
  }
  await db.runTransaction(async (transaction) => {
    const [currentProfile, currentAthlete] = await Promise.all([
      transaction.get(profileRef), transaction.get(athleteRef),
    ]);
    const currentRole = currentProfile.exists ? (currentProfile.data() || {}).role : null;
    if (currentRole && currentRole !== 'PENDING') {
      fail('permission-denied', 'La cuenta ya tiene otro tipo de acceso.');
    }
    if (!currentAthlete.exists || normalizeEmail(currentAthlete.data().email) !== email ||
        (currentAthlete.data().authUid && currentAthlete.data().authUid !== uid)) {
      fail('already-exists', 'La ficha ya está vinculada a otra cuenta o el correo ha cambiado.');
    }
    transaction.update(athleteRef, { authUid: uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(profileRef, {
      email,
      displayName: athlete.name || '',
      role: 'NEST_STUDENT',
      athleteId: athletes[0].id,
      nestFamilies,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { role: 'NEST_STUDENT' };
});

exports.refreshNestPortalAccess = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const profileRef = db.collection('users').doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) fail('permission-denied', 'Tu cuenta todavía no tiene acceso autorizado a The Nest.');
  const profile = profileSnap.data() || {};
  const email = normalizeEmail(context.auth.token?.email || (await admin.auth().getUser(uid)).email);

  if (profile.role === 'NEST_STUDENT') {
    const athleteRef = profile.athleteId
      ? db.collection('athletes_pilates').doc(profile.athleteId)
      : null;
    const athleteSnap = athleteRef ? await athleteRef.get() : null;
    const athlete = athleteSnap?.exists ? athleteSnap.data() || {} : {};
    if (!athleteSnap?.exists || athlete.authUid !== uid || normalizeEmail(athlete.email) !== email) {
      await profileRef.update({ role: 'PENDING', nestFamilies: [] });
      return { role: 'PENDING', nestFamilies: [] };
    }
    const history = await db.collection('athlete_pilates_months')
      .where('athleteId', '==', profile.athleteId)
      .get();
    const families = familiesFromHistory(history.docs.map((doc) => doc.data()), athlete);
    if (!families.length) {
      await profileRef.update({ role: 'PENDING', nestFamilies: [] });
      return { role: 'PENDING', nestFamilies: [] };
    }
    const changes = { email, displayName: athlete.name || '', nestFamilies: families };
    if (profile.email !== email || profile.displayName !== changes.displayName ||
      JSON.stringify(profile.nestFamilies) !== JSON.stringify(families)) await profileRef.update(changes);
    return { role: 'NEST_STUDENT', nestFamilies: families, profile: { ...profile, ...changes } };
  }

  if (profile.role === 'NEST_INSTRUCTOR') {
    const teacherRef = profile.teacherId ? db.collection('teachers').doc(profile.teacherId) : null;
    const teacherSnap = teacherRef ? await teacherRef.get() : null;
    const teacher = teacherSnap?.exists ? teacherSnap.data() || {} : {};
    const families = Array.isArray(teacher.nestFamilies)
      ? Array.from(new Set(teacher.nestFamilies.filter((family) => ['pilates', 'barre'].includes(family))))
      : [];
    if (!teacherSnap?.exists || teacher.authUid !== uid || normalizeEmail(teacher.email) !== email ||
        String(teacher.status || 'ACTIVE').toUpperCase() !== 'ACTIVE' || !families.length) {
      await profileRef.update({ role: 'PENDING', nestFamilies: [] });
      return { role: 'PENDING', nestFamilies: [] };
    }
    const changes = { email, displayName: teacher.name || '', nestFamilies: families };
    if (profile.email !== email || profile.displayName !== changes.displayName ||
      JSON.stringify(profile.nestFamilies) !== JSON.stringify(families)) await profileRef.update(changes);
    return { role: 'NEST_INSTRUCTOR', nestFamilies: families, profile: { ...profile, ...changes } };
  }

  fail('permission-denied', 'Esta cuenta no es un perfil del portal The Nest.');
});

exports.getNestBookingSchedule = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const family = validateFamily(data.family);
  const startDate = data.startDate;
  const endDate = data.endDate;
  if (!validDateKey(startDate) || !validDateKey(endDate) || startDate > endDate) {
    fail('invalid-argument', 'Rango de fechas no válido.');
  }
  const diffDays = (new Date(`${endDate}T12:00:00Z`) - new Date(`${startDate}T12:00:00Z`)) / 86400000;
  if (diffDays > 35) fail('invalid-argument', 'Consulta un máximo de cinco semanas cada vez.');

  const profile = await getProfile(uid);
  await assertFamilyAccess(profile, family);
  const isStaff = STAFF_ROLES.has(profile.role);
  const isInstructor = profile.role === 'NEST_INSTRUCTOR';
  const [athlete, slots] = await Promise.all([
    profile.role === 'NEST_STUDENT' ? getStudentAthlete(profile, uid) : null,
    getEffectiveSlots(family),
  ]);
  const sessionInputs = [];
  const ownBookingsBySession = new Map();
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateKey = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    for (const slot of slots) {
      if (!slot.daysOfWeek.includes(weekday)) continue;
      const id = sessionId(family, dateKey, slot.id);
      sessionInputs.push({
        id,
        dateKey,
        slotId: slot.id,
        startTime: slot.startTime,
        capacity: Number(slot.capacity) || CAPACITY,
        month: monthKey(dateKey),
      });
    }
  }
  if (athlete) {
    const ownBookings = await db.collection('nest_bookings')
      .where('athleteId', '==', athlete.ref.id)
      .where('family', '==', family)
      .where('dateKey', '>=', startDate)
      .where('dateKey', '<=', endDate)
      .get();
    const sessionInputIds = new Set(sessionInputs.map((session) => session.id));
    ownBookings.docs.forEach((booking) => {
      const record = booking.data();
      if (record.family !== family || !validDateKey(record.dateKey) ||
          record.dateKey < startDate || record.dateKey > endDate ||
          !['BOOKED', 'CANCELLED'].includes(record.status)) return;
      const id = record.sessionId || sessionId(family, record.dateKey, record.slotId);
        if (record.cancellationReason === 'CLASS_REMOVED' && record.startTime &&
          localTimeToDate(record.dateKey, record.startTime).getTime() > Date.now()) return;
      ownBookingsBySession.set(id, booking);
      if (sessionInputIds.has(id) || !record.slotId || !record.startTime) return;
      sessionInputs.push({
        id,
        dateKey: record.dateKey,
        slotId: record.slotId,
        startTime: record.startTime,
        month: monthKey(record.dateKey),
      });
      sessionInputIds.add(id);
    });
  }
  const refs = sessionInputs.map((session) => db.collection('nest_class_sessions').doc(session.id));
  const snapshotsPromise = refs.length ? db.getAll(...refs) : Promise.resolve([]);
  const monthKeys = athlete ? Array.from(new Set(sessionInputs.map((session) => session.month))) : [];
  const membershipsPromise = athlete ? Promise.all(monthKeys.map(async (month) =>
    [month, await findMonthlyMembership(athlete.ref.id, family, month)])) : Promise.resolve([]);
  const usagePromise = athlete ? Promise.all(monthKeys.map(async (month) => {
    const snap = await db.collection('nest_monthly_usage').doc(`${athlete.ref.id}__${family}__${month}`).get();
    return [month, snap.exists ? Number(snap.data().bookedCount || 0) : 0];
  })) : Promise.resolve([]);
  const sessionIds = sessionInputs.map((session) => session.id);
  const bookingQueries = [];
  for (let index = 0; index < sessionIds.length; index += 30) {
    const chunk = sessionIds.slice(index, index + 30);
    if (!chunk.length) continue;
    bookingQueries.push(db.collection('nest_bookings')
      .where('sessionId', 'in', chunk)
      .where('status', '==', 'BOOKED')
      .get());
  }
  const [snapshots, membershipPairs, usagePairs, bookingSnapshots] = await Promise.all([
    snapshotsPromise, membershipsPromise, usagePromise, Promise.all(bookingQueries),
  ]);
  const activeBookingDocs = bookingSnapshots.flatMap((snap) => snap.docs);
  const attendeeUids = Array.from(new Set(activeBookingDocs
    .map((booking) => booking.data().userId)
    .filter(Boolean)));
  const attendeeProfiles = attendeeUids.length
    ? await db.getAll(...attendeeUids.map((attendeeUid) => db.collection('users').doc(attendeeUid)), { fieldMask: ['photoUrl'] })
    : [];
  const profileByUid = new Map(attendeeProfiles.map((profile) => [profile.id, profile.exists ? profile.data() || {} : {}]));
  const attendeesBySession = new Map();
  activeBookingDocs.forEach((booking) => {
    const bookingData = booking.data();
    const attendees = attendeesBySession.get(bookingData.sessionId) || [];
    attendees.push({
      id: booking.id,
      athleteId: bookingData.athleteId,
      name: bookingData.athleteName || '',
      userId: bookingData.userId || null,
      attended: Boolean(bookingData.attended),
      isCurrentUser: Boolean(athlete && bookingData.athleteId === athlete.ref.id),
    });
    attendeesBySession.set(bookingData.sessionId, attendees);
  });
  const memberships = new Map(membershipPairs);
  const usageCounts = new Map(usagePairs);
  const sessions = sessionInputs.map((session, index) => {
    const sessionSnap = snapshots[index];
    const bookingSnap = ownBookingsBySession.get(session.id) || null;
    const membership = memberships.get(session.month) || null;
    const monthlyUsed = membership ? usageCounts.get(session.month) || 0 : 0;
    const startAt = localTimeToDate(session.dateKey, session.startTime);
    return {
      id: session.id, family, dateKey: session.dateKey, slotId: session.slotId,
      startTime: session.startTime,
      endTime: `${String((Number(session.startTime.slice(0, 2)) + 1) % 24).padStart(2, '0')}:00`,
      capacity: session.capacity || (sessionSnap.exists ? Number(sessionSnap.data().capacity || CAPACITY) : CAPACITY),
      reservedCount: Math.max(
        sessionSnap.exists ? Number(sessionSnap.data().reservedCount || 0) : 0,
        (attendeesBySession.get(session.id) || []).length
      ),
      isBooked: Boolean(bookingSnap?.exists && bookingSnap.data().status === 'BOOKED'),
      myBookingStatus: bookingSnap?.exists ? bookingSnap.data().status || null : null,
      myAttended: Boolean(bookingSnap?.exists && bookingSnap.data().attended),
      myAttendanceMarked: Boolean(bookingSnap?.exists &&
        (bookingSnap.data().attended === true || bookingSnap.data().attendedAt)),
      attendees: (attendeesBySession.get(session.id) || [])
        .sort((first, second) => first.name.localeCompare(second.name, 'es')),
      canBook: Boolean(membership && startAt.getTime() > Date.now() && monthlyUsed < membership.monthlyLimit),
      activeForMonth: Boolean(membership),
      paymentGrace: Boolean(membership?.paymentGrace),
      bookingAccessExpiresAt: membership?.bookingAccessExpiresAt || null,
      monthlyLimit: membership?.monthlyLimit || 0,
      monthlyUsed,
      startTimestamp: startAt.toISOString(),
      past: startAt.getTime() <= Date.now(),
      canManageRoster: isStaff || (isInstructor && hasFamily(profile, family)),
      canBookForOthers: isStaff,
    };
  });
  const memberPhotos = Object.fromEntries(attendeeUids
    .map((attendeeUid) => [attendeeUid, profileByUid.get(attendeeUid)?.photoUrl || ''])
    .filter(([, photoUrl]) => Boolean(photoUrl)));
  return { family, sessions, memberPhotos };
});

// Allow browser preflight at the HTTP layer; requireAuth/requireNestStaff protect the directory.
exports.getNestBookingAthletes = functions.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const family = validateFamily(data.family);
  await requireNestStaff(uid);
  const [athletes, history] = await Promise.all([
    db.collection('athletes_pilates').get(), db.collection('athlete_pilates_months').get(),
  ]);
  const familyIds = new Set(history.docs.filter((doc) => tariffFamily(doc.data()) === family)
    .map((doc) => doc.data().athleteId));
  return {
    athletes: athletes.docs.filter((doc) => familyIds.has(doc.id) ||
      familiesFromHistory([], doc.data()).includes(family))
      .map((doc) => ({ id: doc.id, name: String(doc.data().name || 'Sin nombre'),
        email: normalizeEmail(doc.data().email) }))
      .sort((first, second) => first.name.localeCompare(second.name, 'es')),
  };
});

exports.bookNestClass = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const family = validateFamily(data.family);
  const { dateKey, slotId } = data;
  if (!validDateKey(dateKey) || typeof slotId !== 'string' || !slotId || slotId.includes('__')) {
    fail('invalid-argument', 'Clase no válida.');
  }
  const [scheduledSlot, profile] = await Promise.all([
    findScheduledSlot(family, dateKey, slotId), getProfile(uid),
  ]);
  if (!scheduledSlot || scheduledSlot.startTime !== data.startTime) {
    fail('invalid-argument', 'El horario solicitado no está programado.');
  }
  const staffBooking = STAFF_ROLES.has(profile.role);
  let athlete;
  if (profile.role === 'NEST_STUDENT') {
    athlete = await getStudentAthlete(profile, uid);
  } else if (staffBooking) {
    if (data.athleteId !== undefined) {
      if (typeof data.athleteId !== 'string' || !data.athleteId || data.athleteId.includes('/') || data.athleteId.length > 1500) {
        fail('invalid-argument', 'Selecciona una ficha válida.');
      }
      const snap = await db.collection('athletes_pilates').doc(data.athleteId).get();
      if (!snap.exists) fail('not-found', 'La ficha seleccionada ya no existe.');
      athlete = { ref: snap.ref, data: snap.data() };
    } else {
      // Preserve compatibility with the older staff portal.
      const athleteEmail = normalizeEmail(data.athleteEmail);
      if (!athleteEmail) fail('invalid-argument', 'Selecciona una alumna.');
      const athletesSnap = await db.collection('athletes_pilates').get();
      const matches = athletesSnap.docs.filter((doc) => normalizeEmail(doc.data().email) === athleteEmail);
      if (matches.length !== 1) fail('not-found', 'No se encontró una única ficha con ese correo.');
      athlete = { ref: matches[0].ref, data: matches[0].data() };
    }
  } else {
    fail('permission-denied', 'No tienes permiso para reservar clases.');
  }
  const month = monthKey(dateKey);
  const membership = await findMonthlyMembership(athlete.ref.id, family, month);
  if (!membership) fail('failed-precondition', `Necesitas una mensualidad pagada de ${family === 'barre' ? 'Barre' : 'Pilates'} para ${month}. Solo se permite reservar sin pagar del día 1 al 5 del mes en curso, con una tarifa registrada.`);
  const startAt = localTimeToDate(dateKey, scheduledSlot.startTime);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime || '') || startAt.getTime() <= Date.now()) {
    fail('failed-precondition', 'No se pueden reservar clases pasadas o con un horario no válido.');
  }
  const id = sessionId(family, dateKey, slotId);
  const sessionRef = db.collection('nest_class_sessions').doc(id);
  const bookingRef = db.collection('nest_bookings').doc(`${id}__${athlete.ref.id}`);
  const usageRef = db.collection('nest_monthly_usage').doc(`${athlete.ref.id}__${family}__${month}`);
  const confirmed = await db.runTransaction(async (transaction) => {
    const [sessionSnap, bookingSnap, usageSnap, currentMembership, athleteSnap] = await Promise.all([
      transaction.get(sessionRef), transaction.get(bookingRef), transaction.get(usageRef),
      findMonthlyMembership(athlete.ref.id, family, month, transaction), transaction.get(athlete.ref),
    ]);
    const currentSlot = (await getEffectiveSlots(family, transaction)).find((slot) =>
      slot.id === slotId && slot.daysOfWeek.includes(new Date(`${dateKey}T12:00:00Z`).getUTCDay())
    );
    if (!currentSlot || currentSlot.startTime !== data.startTime) {
      fail('failed-precondition', 'El horario de la clase ha cambiado. Actualiza la agenda antes de reservar.');
    }
    if (!currentMembership || currentMembership.data.athleteId !== athlete.ref.id) {
      fail('failed-precondition', 'La mensualidad ya no está activa para este mes.');
    }
    const activeMonthlyLimit = currentMembership.monthlyLimit;
    if (!athleteSnap.exists || (staffBooking
      ? (data.athleteId !== undefined ? athleteSnap.id !== data.athleteId :
        normalizeEmail(athleteSnap.data().email) !== normalizeEmail(data.athleteEmail))
      : athleteSnap.data().authUid !== uid || normalizeEmail(athleteSnap.data().email) !== normalizeEmail(profile.email))) {
      fail('permission-denied', 'La ficha de alumna no está vinculada a tu cuenta.');
    }
    if (bookingSnap.exists && bookingSnap.data().status === 'BOOKED') {
      fail('already-exists', 'Ya tienes una plaza reservada en esta clase.');
    }
    const activeCapacity = Number(currentSlot.capacity || CAPACITY);
    const reservedCount = sessionSnap.exists ? Number(sessionSnap.data().reservedCount || 0) : 0;
    if (reservedCount >= activeCapacity) fail('resource-exhausted', 'La clase está completa.');
    const bookedCount = usageSnap.exists ? Number(usageSnap.data().bookedCount || 0) : 0;
    if (bookedCount >= activeMonthlyLimit) {
      fail('resource-exhausted', `Ya has usado las ${activeMonthlyLimit} reservas de tu tarifa este mes.`);
    }
    transaction.set(sessionRef, {
      family, dateKey, slotId, startTime: data.startTime,
      capacity: activeCapacity, reservedCount: reservedCount + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(bookingRef, {
      sessionId: id, family, dateKey, slotId, startTime: data.startTime,
      athleteId: athlete.ref.id, userId: athleteSnap.data().authUid || null,
      bookedBy: uid,
      athleteName: athlete.data.name || profile.displayName || '',
      status: 'BOOKED', attended: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(usageRef, {
      athleteId: athlete.ref.id, family, month,
      bookedCount: bookedCount + 1, monthlyLimit: activeMonthlyLimit,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
      reservedCount: reservedCount + 1, capacity: activeCapacity,
      monthlyUsed: bookedCount + 1, monthlyLimit: activeMonthlyLimit,
      attendee: { id: bookingRef.id, athleteId: athlete.ref.id, userId: athleteSnap.data().authUid || null,
        name: athlete.data.name || profile.displayName || '', isCurrentUser: !staffBooking },
    };
  });
  return { success: true, sessionId: id, ...confirmed };
});

exports.cancelNestBooking = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const profile = await getProfile(uid);
  if (profile.role !== 'NEST_STUDENT') fail('permission-denied', 'Solo puedes cancelar tus propias reservas.');
  const family = validateFamily(data.family);
  const athlete = await getStudentAthlete(profile, uid);
  const dateKey = data.dateKey;
  const slotId = data.slotId;
  if (!validDateKey(dateKey) || typeof slotId !== 'string' || !slotId) fail('invalid-argument', 'Reserva no válida.');
  const id = sessionId(family, dateKey, slotId);
  const bookingRef = db.collection('nest_bookings').doc(`${id}__${athlete.ref.id}`);
  const sessionRef = db.collection('nest_class_sessions').doc(id);
  const usageRef = db.collection('nest_monthly_usage').doc(`${athlete.ref.id}__${family}__${monthKey(dateKey)}`);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) fail('not-found', 'No se encontró la reserva.');
  const startAt = localTimeToDate(dateKey, bookingSnap.data().startTime);
  if (startAt.getTime() - Date.now() < CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000) {
    fail('failed-precondition', 'La cancelación debe realizarse al menos 2 horas antes de la clase.');
  }
  const confirmed = await db.runTransaction(async (transaction) => {
    const [currentBooking, sessionSnap, usageSnap] = await Promise.all([
      transaction.get(bookingRef), transaction.get(sessionRef), transaction.get(usageRef),
    ]);
    if (!currentBooking.exists || currentBooking.data().status !== 'BOOKED') {
      fail('failed-precondition', 'La reserva ya estaba cancelada.');
    }
    transaction.update(bookingRef, { status: 'CANCELLED', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
    if (sessionSnap.exists) {
      transaction.update(sessionRef, { reservedCount: Math.max(0, Number(sessionSnap.data().reservedCount || 0) - 1) });
    }
    if (usageSnap.exists) {
      transaction.update(usageRef, { bookedCount: Math.max(0, Number(usageSnap.data().bookedCount || 0) - 1) });
    }
    return {
      reservedCount: Math.max(0, Number(sessionSnap.data()?.reservedCount || 0) - 1),
      monthlyUsed: Math.max(0, Number(usageSnap.data()?.bookedCount || 0) - 1),
      athleteId: athlete.ref.id,
    };
  });
  return { success: true, sessionId: id, ...confirmed };
});

exports.getNestClassRoster = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const profile = await getProfile(uid);
  const family = validateFamily(data.family);
  await assertFamilyAccess(profile, family);
  if (profile.role === 'NEST_STUDENT') fail('permission-denied', 'No tienes permiso para ver el listado de la clase.');
  const id = sessionId(family, data.dateKey, data.slotId);
  const snap = await db.collection('nest_bookings').where('sessionId', '==', id).where('status', '==', 'BOOKED').get();
  const userIds = Array.from(new Set(snap.docs.map((booking) => booking.data().userId).filter(Boolean)));
  const profiles = userIds.length
    ? await db.getAll(...userIds.map((userId) => db.collection('users').doc(userId)))
    : [];
  const profileByUid = new Map(profiles.map((userProfile) => [
    userProfile.id,
    userProfile.exists ? userProfile.data() || {} : {},
  ]));
  return {
    attendees: snap.docs.map((doc) => ({
      id: doc.id,
      athleteId: doc.data().athleteId,
      name: doc.data().athleteName || '',
      photoUrl: profileByUid.get(doc.data().userId)?.photoUrl || '',
      attended: Boolean(doc.data().attended),
    })),
  };
});

exports.setNestAttendance = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const profile = await getProfile(uid);
  const family = validateFamily(data.family);
  await assertFamilyAccess(profile, family);
  if (profile.role === 'NEST_STUDENT') fail('permission-denied', 'No tienes permiso para modificar asistencias.');
  const bookingId = String(data.bookingId || '');
  if (!bookingId || !bookingId.startsWith(`${family}__`)) fail('invalid-argument', 'Reserva no válida.');
  const bookingRef = db.collection('nest_bookings').doc(bookingId);
  const booking = await bookingRef.get();
  if (!booking.exists || booking.data().status !== 'BOOKED') fail('not-found', 'La reserva ya no está activa.');
  await bookingRef.update({ attended: Boolean(data.attended), attendedBy: uid, attendedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});
