import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";
import { showToast } from "./toast.js";

const views = { pilates: "pilates", barre: "barre" };
const callables = {
  schedule: httpsCallable(functions, "getNestBookingSchedule"),
  book: httpsCallable(functions, "bookNestClass"),
  cancel: httpsCallable(functions, "cancelNestBooking"),
  roster: httpsCallable(functions, "getNestClassRoster"),
  attendance: httpsCallable(functions, "setNestAttendance"),
};
let initialized = false;
let activeFamily = "pilates";
const selectedDateKey = { pilates: dateKey(dayAtNoon(0)), barre: dateKey(dayAtNoon(0)) };
const requestNumber = { pilates: 0, barre: 0 };
const monthScheduleCache = new Map();

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayAtNoon(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function dateFromKey(key) {
  return new Date(`${key}T12:00:00`);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
}

function monthBounds(date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1, 12),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 12),
  };
}

function invalidateMonthCache(family, key) {
  if (key) {
    monthScheduleCache.delete(`${family}__${auth.currentUser?.uid || "guest"}__${key.slice(0, 7)}`);
    return;
  }
  for (const cacheKey of monthScheduleCache.keys()) {
    if (cacheKey.startsWith(`${family}__${auth.currentUser?.uid || "guest"}__`)) monthScheduleCache.delete(cacheKey);
  }
}

async function getMonthSessions(family, date) {
  const key = `${family}__${auth.currentUser?.uid || "guest"}__${monthKey(date)}`;
  if (!monthScheduleCache.has(key)) {
    const { start, end } = monthBounds(date);
    monthScheduleCache.set(key, callables.schedule({
      family,
      startDate: dateKey(start),
      endDate: dateKey(end),
    }).then((result) => {
      const photos = result.data.memberPhotos || {};
      return (result.data.sessions || []).map((session) => ({
        ...session,
        attendees: (session.attendees || []).map((attendee) => ({
          ...attendee,
          photoUrl: photos[attendee.userId] || attendee.photoUrl || "",
        })),
      }));
    }).catch((error) => {
      monthScheduleCache.delete(key);
      throw error;
    }));
  }
  return monthScheduleCache.get(key);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function weekdayLabel(date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short" })
    .format(date).replace(".", "").toUpperCase();
}

function rangeLabel(start, end) {
  const from = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(start);
  const to = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(end);
  return `${from} – ${to}`;
}

function memberInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1
    ? parts[0].slice(0, 1).toLocaleUpperCase("es")
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase("es");
}

function createSeatAvatar(attendee, index) {
  const name = attendee?.name || "Alumna";
  const avatar = element("span", attendee ? "nest-booking-avatar is-occupied" : "nest-booking-avatar is-available");
  avatar.setAttribute("role", "img");
  avatar.setAttribute("aria-label", attendee ? `Plaza ocupada por ${name}` : `Plaza ${index + 1} disponible`);
  avatar.title = attendee ? name : `Plaza ${index + 1} disponible`;

  const photoUrl = String(attendee?.photoUrl || "");
  if (attendee && (photoUrl.startsWith("https://") || /^data:image\/(?:jpeg|png|webp);base64,/i.test(photoUrl))) {
    const image = document.createElement("img");
    image.src = photoUrl;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      avatar.replaceChildren(element("span", "nest-booking-avatar-initials", memberInitials(name)));
    }, { once: true });
    avatar.append(image);
  } else if (attendee) {
    avatar.append(element("span", "nest-booking-avatar-initials", memberInitials(name)));
  } else {
    avatar.append(element("span", "nest-booking-avatar-plus", "+"));
  }
  return avatar;
}

function createClassCard(session, family) {
  const card = element("article", "nest-booking-session");
  card.classList.toggle("is-full", session.reservedCount >= session.capacity);
  card.classList.toggle("is-booked", session.isBooked);
  card.append(element("strong", "nest-booking-session-time", `${session.startTime}–${session.endTime}`));

  const capacity = element("div", "nest-booking-capacity");
  const seats = element("div", "nest-booking-seats");
  const attendees = Array.isArray(session.attendees) ? session.attendees : [];
  for (let index = 0; index < session.capacity; index += 1) {
    seats.append(createSeatAvatar(attendees[index] || (index < session.reservedCount ? { name: "Plaza reservada" } : null), index));
  }
  capacity.append(seats, element("span", "nest-booking-capacity-label", `${attendees.length || session.reservedCount}/${session.capacity} plazas ocupadas`));
  card.append(capacity);

  const full = session.reservedCount >= session.capacity;
  const isInstructor = session.canManageRoster;
  if (session.isBooked) {
    card.append(element("p", "nest-booking-message", "Tu plaza está reservada"));
    const cancel = element("button", "button button-secondary nest-booking-action", "Cancelar");
    cancel.type = "button";
    cancel.disabled = session.past;
    cancel.addEventListener("click", async () => {
      cancel.disabled = true;
      try {
        await callables.cancel({ family, dateKey: session.dateKey, slotId: session.slotId });
        invalidateMonthCache(family, session.dateKey);
        showToast("Reserva cancelada", "success");
        await refreshFamily(family);
      } catch (error) {
        showToast(error.message || "No se pudo cancelar la reserva", "error");
        cancel.disabled = false;
      }
    });
    card.append(cancel);
  } else if (session.canBook && !full && !session.past && !isInstructor) {
    const remaining = Math.max(0, session.monthlyLimit - (session.monthlyUsed || 0));
    card.append(element("p", "nest-booking-message", `${remaining} sesiones disponibles este mes`));
    const book = element("button", "button button-primary nest-booking-action", "Reservar plaza");
    book.type = "button";
    book.addEventListener("click", async () => {
      book.disabled = true;
      try {
        await callables.book({ family, dateKey: session.dateKey, slotId: session.slotId, startTime: session.startTime });
        invalidateMonthCache(family, session.dateKey);
        showToast("Plaza reservada", "success");
        await refreshFamily(family);
      } catch (error) {
        showToast(error.message || "No se pudo reservar la plaza", "error");
        book.disabled = false;
      }
    });
    card.append(book);
  } else if (session.canBookForOthers && !full && !session.past) {
    const book = element("button", "button button-primary nest-booking-action", "Reservar para alumna");
    book.type = "button";
    book.addEventListener("click", async () => {
      const email = prompt("Correo de la ficha de la alumna:");
      if (!email) return;
      book.disabled = true;
      try {
        await callables.book({ family, dateKey: session.dateKey, slotId: session.slotId, startTime: session.startTime, athleteEmail: email.trim().toLowerCase() });
        invalidateMonthCache(family, session.dateKey);
        showToast("Plaza reservada para la alumna", "success");
        await refreshFamily(family);
      } catch (error) {
        showToast(error.message || "No se pudo reservar la plaza", "error");
        book.disabled = false;
      }
    });
    card.append(book);
  } else if (!session.activeForMonth && !session.canManageRoster) {
    card.append(element("p", "nest-booking-message", "Necesitas una mensualidad pagada este mes."));
  } else if (full) {
    card.append(element("p", "nest-booking-message", "Clase completa"));
  }

  if (isInstructor) {
    const rosterButton = element("button", "button button-secondary nest-booking-action", "Lista y asistencia");
    rosterButton.type = "button";
    const roster = element("div", "nest-booking-roster hidden");
    rosterButton.addEventListener("click", async () => {
      if (!roster.classList.contains("hidden")) {
        roster.classList.add("hidden");
        return;
      }
      rosterButton.disabled = true;
      try {
        const result = await callables.roster({ family, dateKey: session.dateKey, slotId: session.slotId });
        roster.replaceChildren();
        if (!result.data.attendees.length) roster.append(element("p", "nest-booking-message", "Todavía no hay reservas."));
        result.data.attendees.forEach((attendee) => {
          const label = element("label", "nest-booking-attendee");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = Boolean(attendee.attended);
          checkbox.addEventListener("change", async () => {
            checkbox.disabled = true;
            try {
              await callables.attendance({ family, bookingId: attendee.id, attended: checkbox.checked });
            } catch (error) {
              checkbox.checked = !checkbox.checked;
              showToast(error.message || "No se pudo guardar la asistencia", "error");
            } finally {
              checkbox.disabled = false;
            }
          });
          const avatar = createSeatAvatar(attendee, 0);
          avatar.classList.add("nest-booking-roster-avatar");
          label.append(checkbox, avatar, document.createTextNode(attendee.name || "Alumna"));
          roster.append(label);
        });
        roster.classList.remove("hidden");
      } catch (error) {
        showToast(error.message || "No se pudo cargar la lista", "error");
      } finally {
        rosterButton.disabled = false;
      }
    });
    card.append(rosterButton, roster);
  }
  return card;
}

function renderMiniMonth(family, sessions, selectedDate) {
  const root = document.querySelector(`[data-nest-mini-month="${family}"]`);
  if (!root) return;
  const monthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
  const { start, end } = monthBounds(selectedDate);
  const title = root.querySelector("[data-mini-month-label]");
  if (title) title.textContent = monthLabel(monthDate);

  const counts = new Map();
  sessions.filter((session) => session.isBooked).forEach((session) => {
    counts.set(session.dateKey, (counts.get(session.dateKey) || 0) + 1);
  });
  const grid = root.querySelector("[data-mini-month-grid]");
  if (!grid) return;
  grid.replaceChildren();
  ["L", "M", "X", "J", "V", "S", "D"].forEach((day) => {
    grid.append(element("span", "nest-mini-weekday", day));
  });

  const firstDayOffset = (start.getDay() + 6) % 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstDayOffset);
  const todayKey = dateKey(dayAtNoon(0));
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dateKey(date);
    const sameMonth = date.getMonth() === monthDate.getMonth();
    const count = counts.get(key) || 0;
    const button = element("button", "nest-mini-date", String(date.getDate()));
    button.type = "button";
    button.dataset.nestSelectDate = key;
    button.dataset.nestSelectFamily = family;
    button.classList.toggle("is-outside-month", !sameMonth);
    button.classList.toggle("is-selected", key === dateKey(selectedDate));
    button.classList.toggle("is-today", key === todayKey);
    button.classList.toggle("has-booking", count > 0);
    button.setAttribute("aria-label", `${date.toLocaleDateString("es-ES")}${count ? `, ${count} reservada(s)` : ""}`);
    if (count) button.append(element("i", "nest-mini-booking-dot"));
    grid.append(button);
  }
  root.dataset.monthStart = dateKey(start);
  root.dataset.monthEnd = dateKey(end);
}

function renderWeekDaySelector(family, selectedDate, weekSessions) {
  const root = document.querySelector(`[data-nest-week-days="${family}"]`);
  if (!root) return;
  const weekday = selectedDate.getDay() || 7;
  const monday = new Date(selectedDate);
  monday.setDate(selectedDate.getDate() - weekday + 1);
  root.replaceChildren();
  const bookedDates = new Set(weekSessions.filter((session) => session.isBooked).map((session) => session.dateKey));
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = dateKey(date);
    const button = element("button", "nest-week-day");
    button.type = "button";
    button.dataset.nestSelectDate = key;
    button.dataset.nestSelectFamily = family;
    button.classList.toggle("is-selected", key === dateKey(selectedDate));
    button.classList.toggle("is-today", key === dateKey(dayAtNoon(0)));
    button.append(
      element("span", "nest-week-day-name", weekdayLabel(date)),
      element("strong", "nest-week-day-number", String(date.getDate()))
    );
    if (bookedDates.has(key)) button.append(element("i", "nest-week-booking-dot"));
    root.append(button);
  }
}

function renderMobileDay(family, selectedDate, sessions) {
  const root = document.querySelector(`[data-nest-day-view="${family}"]`);
  if (!root) return;
  const key = dateKey(selectedDate);
  const daySessions = sessions
    .filter((session) => session.dateKey === key)
    .sort((first, second) => first.startTime.localeCompare(second.startTime));
  const title = root.querySelector("[data-nest-day-title]");
  if (title) {
    title.textContent = new Intl.DateTimeFormat("es-ES", {
      weekday: "long", day: "numeric", month: "long",
    }).format(selectedDate);
  }
  const cards = root.querySelector("[data-nest-day-classes]");
  if (!cards) return;
  cards.replaceChildren();
  if (!daySessions.length) {
    cards.append(element("p", "nest-booking-empty-day-detail", "No hay clases programadas para este día."));
    return;
  }
  daySessions.forEach((session) => cards.append(createClassCard(session, family)));
}

async function refreshFamily(family) {
  const grid = document.querySelector(`[data-nest-booking-sessions="${family}"]`);
  const status = document.querySelector(`[data-nest-booking-status="${family}"]`);
  const label = document.querySelector(`[data-nest-booking-week="${family}"]`);
  if (!grid || !auth.currentUser) return;
  const currentRequest = ++requestNumber[family];
  if (status) status.textContent = "Cargando horario…";
  const selectedDate = dateFromKey(selectedDateKey[family]);
  const selectedWeekday = selectedDate.getDay() || 7;
  const start = new Date(selectedDate);
  start.setDate(selectedDate.getDate() - selectedWeekday + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (label) label.textContent = rangeLabel(start, end);
  try {
    const monthSessions = await getMonthSessions(family, selectedDate);
    const weekMonthKeys = new Set(Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return monthKey(date);
    }));
    const weekSessionsByMonth = await Promise.all(Array.from(weekMonthKeys, async (key) => {
      const [year, month] = key.split("-").map(Number);
      return getMonthSessions(family, new Date(year, month - 1, 1, 12));
    }));
    if (currentRequest !== requestNumber[family]) return;
    const sessions = weekSessionsByMonth.flat().filter((item) => item.isBooked || !item.past || item.canManageRoster);
    renderMiniMonth(family, monthSessions, selectedDate);
    renderWeekDaySelector(family, selectedDate, sessions);
    renderMobileDay(family, selectedDate, sessions);
    const todayKey = dateKey(dayAtNoon(0));
    const days = [];
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateKey(date);
      const day = element("section", `nest-booking-day${key === todayKey ? " is-today" : ""}`);
      const heading = element("div", "nest-booking-day-heading");
      heading.append(element("span", "nest-booking-day-name", weekdayLabel(date)), element("strong", "nest-booking-day-number", String(date.getDate())));
      day.append(heading);
      const daySessions = sessions.filter((item) => item.dateKey === key).sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (daySessions.length) daySessions.forEach((item) => day.append(createClassCard(item, family)));
      else day.append(element("p", "nest-booking-empty-day", "Sin clases"));
      days.push(day);
    }
    grid.replaceChildren(...days);
    if (status) {
      const bookedCount = monthSessions.filter((session) => session.isBooked).length;
      status.textContent = `${sessions.length} clases esta semana · ${bookedCount} reservas este mes`;
    }
  } catch (error) {
    console.error(`Error loading ${family} reservations:`, error);
    if (status) status.textContent = error.message || "No se pudo cargar el horario.";
    grid.replaceChildren(element("p", "nest-booking-error", error.message || "No se pudo cargar el horario."));
  }
}

export function initializeBookingSchedule() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("nest-profile-photo-updated", () => {
    invalidateMonthCache("pilates");
    invalidateMonthCache("barre");
    refreshFamily(activeFamily);
  });
  document.addEventListener("click", (event) => {
    const refresh = event.target.closest("[data-nest-booking-refresh]");
    if (refresh) {
      refreshFamily(refresh.dataset.nestBookingRefresh);
      return;
    }
    const shift = event.target.closest("[data-nest-week-shift]");
    if (shift) {
      const family = shift.dataset.nestWeekFamily;
      const selected = dateFromKey(selectedDateKey[family]);
      selected.setDate(selected.getDate() + Number(shift.dataset.nestWeekShift || 0) * 7);
      selectedDateKey[family] = dateKey(selected);
      refreshFamily(family);
      return;
    }
    const today = event.target.closest("[data-nest-week-today]");
    if (today) {
      const family = today.dataset.nestWeekToday;
      selectedDateKey[family] = dateKey(dayAtNoon(0));
      refreshFamily(family);
      return;
    }
    const selectDate = event.target.closest("[data-nest-select-date]");
    if (selectDate) {
      const family = selectDate.dataset.nestSelectFamily;
      selectedDateKey[family] = selectDate.dataset.nestSelectDate;
      refreshFamily(family);
      return;
    }
    const monthShift = event.target.closest("[data-nest-month-shift]");
    if (monthShift) {
      const family = monthShift.dataset.nestMonthFamily;
      const selected = dateFromKey(selectedDateKey[family]);
      const desiredDay = selected.getDate();
      selected.setDate(1);
      selected.setMonth(selected.getMonth() + Number(monthShift.dataset.nestMonthShift || 0));
      const lastDay = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
      selected.setDate(Math.min(desiredDay, lastDay));
      selectedDateKey[family] = dateKey(selected);
      refreshFamily(family);
    }
  });
}

export async function showBookingFamily(family) {
  if (!views[family]) return;
  activeFamily = family;
  document.querySelectorAll(".family-tab").forEach((button) => {
    const selected = button.dataset.family === family;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  const panel = document.getElementById("bookingContent");
  panel.replaceChildren();
  const title = document.createElement("h2");
  title.className = "sr-only";
  title.textContent = family === "barre" ? "Reservas de Barre" : "Reservas de Pilates";
  const section = document.createElement("section");
  section.className = "booking-content";
  section.innerHTML = `
    <div class="booking-week-toolbar">
      <div class="nest-booking-toolbar">
        <button class="button button-secondary" type="button" data-nest-week-shift="-1" data-nest-week-family="${family}" aria-label="Semana anterior">‹</button>
        <button class="button button-secondary" type="button" data-nest-week-today="${family}">Esta semana</button>
        <button class="button button-secondary" type="button" data-nest-week-shift="1" data-nest-week-family="${family}" aria-label="Semana siguiente">›</button>
        <button class="button button-secondary" type="button" data-nest-booking-refresh="${family}" aria-label="Actualizar horario">↻</button>
      </div>
      <strong class="nest-booking-week-label" data-nest-booking-week="${family}"></strong>
      <span class="nest-booking-status" data-nest-booking-status="${family}"></span>
    </div>
    <div class="nest-mobile-calendar" data-nest-mini-month="${family}">
      <div class="nest-mini-month-header">
        <button class="button button-secondary" type="button" data-nest-month-shift="-1" data-nest-month-family="${family}" aria-label="Mes anterior">‹</button>
        <strong data-mini-month-label></strong>
        <button class="button button-secondary" type="button" data-nest-month-shift="1" data-nest-month-family="${family}" aria-label="Mes siguiente">›</button>
      </div>
      <div class="nest-mini-month-grid" data-mini-month-grid></div>
      <p class="nest-mini-month-legend"><i></i> Tienes una clase reservada</p>
    </div>
    <div class="nest-mobile-day-selector" data-nest-week-days="${family}" aria-label="Seleccionar día de la semana"></div>
    <div class="nest-mobile-day-view" data-nest-day-view="${family}">
      <h2 data-nest-day-title></h2>
      <div data-nest-day-classes></div>
    </div>
    <div class="nest-booking-sessions" data-nest-booking-sessions="${family}"></div>`;
  panel.append(title, section);
  initializeBookingSchedule();
  await refreshFamily(family);
}
