// Per-browser/per-user cache. Never used to authorize a reservation.
export function createScheduleCache({ ttl = 30_000, maxEntries = 6, now = Date.now } = {}) {
  const entries = new Map();
  function invalidate(prefix) {
    for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
  }
  function get(key, load) {
    const current = entries.get(key);
    if (current && (!current.settled || now() - current.loadedAt < ttl)) return current.promise;
    const entry = { settled: false, loadedAt: 0, promise: null };
    entry.promise = Promise.resolve().then(load).then((value) => {
      entry.settled = true;
      entry.loadedAt = now();
      return value;
    }).catch((error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    return entry.promise;
  }
  function update(key, transform) {
    const entry = entries.get(key);
    if (!entry?.settled) return false;
    entry.promise = entry.promise.then(transform);
    // Do not extend freshness: other users may have changed occupancy meanwhile.
    return true;
  }
  return { get, invalidate, update, size: () => entries.size };
}

export function hasBookingAccess(session, now = Date.now()) {
  return Boolean(session.activeForMonth && (!session.bookingAccessExpiresAt ||
    new Date(session.bookingAccessExpiresAt).getTime() > now));
}

export function applyBookingConfirmation(sessions, sessionId, result, { cancelled = false, own = true, photoUrl = '' } = {}) {
  const target = sessions.find((session) => session.id === sessionId);
  if (!target) return sessions;
  const month = target.dateKey.slice(0, 7);
  return sessions.map((session) => {
    const updated = { ...session };
    if (own && session.dateKey.slice(0, 7) === month) {
      updated.monthlyUsed = result.monthlyUsed;
      if (result.monthlyLimit) updated.monthlyLimit = result.monthlyLimit;
      updated.canBook = Boolean(hasBookingAccess(updated) && !updated.past && updated.monthlyUsed < updated.monthlyLimit);
    }
    if (session.id !== sessionId) return updated;
    updated.reservedCount = result.reservedCount;
    if (result.capacity) updated.capacity = result.capacity;
    if (own) {
      updated.isBooked = !cancelled;
      updated.myBookingStatus = cancelled ? 'CANCELLED' : 'BOOKED';
    }
    const attendees = session.attendees || [];
    updated.attendees = cancelled
      ? attendees.filter((attendee) => attendee.athleteId !== result.athleteId && !attendee.isCurrentUser)
      : [...attendees.filter((attendee) => attendee.athleteId !== result.attendee?.athleteId), { ...result.attendee, photoUrl }];
    return updated;
  });
}