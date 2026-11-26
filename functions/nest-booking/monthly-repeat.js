function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// First working week is the Monday-Friday week containing the first of the month.
// A Monday such as Nov 30 can therefore seed December's Monday classes.
function firstWeekMonth(dateKey) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  if (weekday < 1 || weekday > 5) return null;
  const monday = addDays(dateKey, 1 - weekday);
  for (let offset = 0; offset < 5; offset++) {
    const day = addDays(monday, offset);
    if (day.endsWith('-01')) return day.slice(0, 7);
  }
  // If the 1st is a weekend, use the first full working week instead.
  const first = `${dateKey.slice(0, 7)}-01`;
  const firstWeekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  return (firstWeekday === 0 || firstWeekday === 6) && monday === addDays(first, firstWeekday === 0 ? 1 : 2)
    ? dateKey.slice(0, 7) : null;
}

function remainingDates(dateKey, month) {
  const dates = [];
  for (let next = addDays(dateKey, 7); next.slice(0, 7) <= month; next = addDays(next, 7)) {
    if (next.slice(0, 7) === month) dates.push(next);
  }
  return dates;
}

module.exports = { addDays, firstWeekMonth, remainingDates };