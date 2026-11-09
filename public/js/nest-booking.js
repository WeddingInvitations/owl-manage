import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";
import { showToast } from "./toast.js";

const views = {
  pilates: "nestPilatesBookingView",
  barre: "nestBarreBookingView",
};
const labels = { pilates: "Pilates", barre: "Barre" };
const callables = {
  schedule: httpsCallable(functions, "getNestBookingSchedule"),
  book: httpsCallable(functions, "bookNestClass"),
  cancel: httpsCallable(functions, "cancelNestBooking"),
  roster: httpsCallable(functions, "getNestClassRoster"),
  attendance: httpsCallable(functions, "setNestAttendance"),
};
let initialized = false;
let rangeOffset = { pilates: 0, barre: 0 };
const refreshGeneration = { pilates: 0, barre: 0 };

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeDate(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function makeWeekStart(weekOffset) {
  const date = makeDate(0);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1 + weekOffset * 7);
  return date;
}

function formatWeekRange(start, end) {
  const startLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function createSessionCard(session, family) {
  const card = el("article", "nest-booking-session");
  const time = el("strong", "nest-booking-session-time", `${session.startTime}–${session.endTime}`);
  const capacity = el("div", "nest-booking-capacity");
  const seats = el("div", "nest-booking-seats");
  for (let index = 0; index < session.capacity; index += 1) {
    seats.append(el("span", index < session.reservedCount ? "nest-booking-seat is-taken" : "nest-booking-seat"));
  }
  capacity.append(
    seats,
    el("span", "nest-booking-capacity-label", `${session.reservedCount}/${session.capacity} plazas`)
  );
  card.append(time, capacity);

  const isFull = session.reservedCount >= session.capacity;
  const isInstructor = session.canManageRoster;
  if (isFull) card.classList.add("is-full");
  if (session.isBooked) card.classList.add("is-booked");
  if (session.isBooked) {
    card.append(el("p", "nest-booking-message", "Tu plaza está reservada"));
    const cancelButton = el("button", "btn ghost small nest-booking-action", "Cancelar");
    cancelButton.type = "button";
    cancelButton.disabled = session.past;
    cancelButton.addEventListener("click", async () => {
      cancelButton.disabled = true;
      try {
        await callables.cancel({ family, dateKey: session.dateKey, slotId: session.slotId });
        showToast("Reserva cancelada", "success");
        await refreshFamily(family);
      } catch (error) {
        showToast(error.message || "No se pudo cancelar la reserva", "error");
        cancelButton.disabled = false;
      }
    });
    card.append(cancelButton);
  } else if (session.canBook && !isFull && !session.past && !isInstructor) {
    const remaining = Math.max(0, session.monthlyLimit - (session.monthlyUsed || 0));
    const quota = el("p", "nest-booking-message", `${remaining} sesiones disponibles este mes`);
    const bookButton = el("button", "btn nest-booking-action", "Reservar");
    bookButton.type = "button";
    bookButton.addEventListener("click", async () => {
      bookButton.disabled = true;
      try {
        await callables.book({
          family,
          dateKey: session.dateKey,
          slotId: session.slotId,
          startTime: session.startTime,
        });
        showToast("Plaza reservada", "success");
        await refreshFamily(family);
      } catch (error) {
        showToast(error.message || "No se pudo reservar la plaza", "error");
        bookButton.disabled = false;
      }
    });
    card.append(quota, bookButton);
  } else if (session.canBookForOthers && !isFull && !session.past) {
    const bookForAthleteButton = el("button", "btn nest-booking-action", "Reservar para alumna");
    bookForAthleteButton.type = "button";
    bookForAthleteButton.addEventListener("click", async () => {
      const athleteEmail = prompt("Correo de la ficha de la alumna:");
      if (!athleteEmail) return;
      bookForAthleteButton.disabled = true;
      try {
        await callables.book({
          family,
          dateKey: session.dateKey,
          slotId: session.slotId,
          startTime: session.startTime,
          athleteEmail: athleteEmail.trim().toLowerCase(),
        });
        showToast("Plaza reservada para la alumna", "success");
        await refreshFamily(family);
      } catch (error) {
        showToast(error.message || "No se pudo reservar la plaza", "error");
        bookForAthleteButton.disabled = false;
      }
    });
    card.append(bookForAthleteButton);
  } else if (!session.activeForMonth && !isInstructor && !session.canManageRoster) {
    card.append(el("p", "nest-booking-message", "No tienes una mensualidad pagada para este mes y disciplina."));
  } else if (isFull) {
    card.append(el("p", "nest-booking-message", "Clase completa."));
  }

  if (isInstructor && session.canManageRoster) {
    const rosterButton = el("button", "btn ghost small nest-booking-action", "Lista y asistencia");
    rosterButton.type = "button";
    const roster = el("div", "nest-booking-roster hidden");
    rosterButton.addEventListener("click", async () => {
      if (!roster.classList.contains("hidden")) {
        roster.classList.add("hidden");
        return;
      }
      rosterButton.disabled = true;
      try {
        const result = await callables.roster({ family, dateKey: session.dateKey, slotId: session.slotId });
        roster.replaceChildren();
        if (!result.data.attendees.length) {
          roster.append(el("p", "muted", "Todavía no hay reservas."));
        }
        result.data.attendees.forEach((attendee) => {
          const label = el("label", "nest-booking-attendee");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = attendee.attended;
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
          label.append(checkbox, document.createTextNode(` ${attendee.name || "Alumna"}`));
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

async function refreshFamily(family) {
  const status = document.querySelector(`[data-nest-booking-status="${family}"]`);
  const weekLabel = document.querySelector(`[data-nest-booking-week="${family}"]`);
  const container = document.querySelector(`[data-nest-booking-sessions="${family}"]`);
  if (!container || !auth.currentUser) return;
  const request = ++refreshGeneration[family];
  if (status) status.textContent = "Cargando clases…";
  const start = makeWeekStart(rangeOffset[family]);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  if (weekLabel) weekLabel.textContent = formatWeekRange(start, end);
  try {
    const result = await callables.schedule({ family, startDate: dateKey(start), endDate: dateKey(end) });
    if (request !== refreshGeneration[family]) return;
    const sessions = result.data.sessions || [];
    const visibleSessions = sessions.filter((session) => session.isBooked || !session.past || session.canManageRoster);
    const days = [];
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateKey(date);
      const day = el("section", "nest-booking-day");
      day.dataset.date = key;
      if (key === dateKey(makeDate(0))) day.classList.add("is-today");
      const heading = el("div", "nest-booking-day-heading");
      heading.append(
        el("span", "nest-booking-day-name", formatWeekday(date)),
        el("strong", "nest-booking-day-number", String(date.getDate()))
      );
      day.append(heading);
      const daySessions = visibleSessions
        .filter((session) => session.dateKey === key)
        .sort((first, second) => first.startTime.localeCompare(second.startTime));
      if (!daySessions.length) {
        day.append(el("p", "nest-booking-empty-day", "Sin clases"));
      } else {
        daySessions.forEach((session) => day.append(createSessionCard(session, family)));
      }
      days.push(day);
    }
    container.replaceChildren(...days);
    if (status) {
      status.textContent = `${labels[family]} · ${visibleSessions.length} clases esta semana`;
    }
  } catch (error) {
    console.error(`Error loading ${family} bookings:`, error);
    if (status) status.textContent = error.message || "No se pudo cargar el calendario.";
    container.replaceChildren(el("p", "muted", error.message || "No se pudo cargar el calendario."));
  }
}

export function initializeNestBookings() {
  if (initialized) return;
  initialized = true;
  document.querySelectorAll("[data-nest-booking-refresh]").forEach((button) => {
    button.addEventListener("click", () => refreshFamily(button.dataset.nestBookingRefresh));
  });
  document.querySelectorAll("[data-nest-week-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      const family = button.dataset.nestWeekFamily;
      rangeOffset[family] += Number(button.dataset.nestWeekShift || 0);
      refreshFamily(family);
    });
  });
  document.querySelectorAll("[data-nest-week-today]").forEach((button) => {
    button.addEventListener("click", () => {
      const family = button.dataset.nestWeekToday;
      rangeOffset[family] = 0;
      refreshFamily(family);
    });
  });
}

export async function refreshNestBookings(viewId) {
  const family = viewId === views.barre ? "barre" : "pilates";
  await refreshFamily(family);
}
