// Keep the stored slot ID when removing one weekday: existing bookings use that ID.
export function expandAdminSlots(slots) {
  return slots.flatMap((slot) => slot.daysOfWeek.map((day) => ({ ...slot, daysOfWeek: [day] })))
    .sort((first, second) => first.daysOfWeek[0] - second.daysOfWeek[0] || first.startTime.localeCompare(second.startTime));
}

export function mergeAdminRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.id}__${row.startTime}__${row.capacity}`;
    if (!groups.has(key)) groups.set(key, { ...row, daysOfWeek: [] });
    groups.get(key).daysOfWeek.push(...row.daysOfWeek);
  }
  const usedIds = new Set();
  const reservedIds = new Set(rows.map((row) => row.id));
  return Array.from(groups.values(), (slot) => {
    if (usedIds.has(slot.id)) {
      const base = `${slot.id.slice(0, 60)}-day-${slot.daysOfWeek[0]}`;
      let candidate = base;
      let suffix = 1;
      while (usedIds.has(candidate) || reservedIds.has(candidate)) candidate = `${base}-${suffix++}`;
      slot.id = candidate;
    }
    usedIds.add(slot.id);
    return slot;
  });
}