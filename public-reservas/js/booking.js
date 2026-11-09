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
const weekOffset = { pilates: 0, barre: 0 };
const requestNumber = { pilates: 0, barre: 0 };

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

function weekStart(offset) {
  const date = dayAtNoon(0);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1 + offset * 7);
  return date;
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

function createClassCard(session, family) {
  const card = element("article", "nest-booking-session");
  card.classList.toggle("is-full", session.reservedCount >= session.capacity);
  card.classList.toggle("is-booked", session.isBooked);
  card.append(element("strong", "nest-booking-session-time", `${session.startTime}–${session.endTime}`));

  const capacity = element("div", "nest-booking-capacity");
  const seats = element("div", "nest-booking-seats");
  for (let index = 0; index < session.capacity; index += 1) {
    seats.append(element("span", index < session.reservedCount ? "nest-booking-seat is-taken" : "nest-booking-seat"));
  }
  capacity.append(seats, element("span", "nest-booking-capacity-label", `${session.reservedCount}/${session.capacity} plazas`));
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
  const grid = document.querySelector(`[data-nest-booking-sessions="${family}"]`);
  const status = document.querySelector(`[data-nest-booking-status="${family}"]`);
  const label = document.querySelector(`[data-nest-booking-week="${family}"]`);
  if (!grid || !auth.currentUser) return;
  const currentRequest = ++requestNumber[family];
  if (status) status.textContent = "Cargando horario…";
  const start = weekStart(weekOffset[family]);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  if (label) label.textContent = rangeLabel(start, end);
  try {
    const result = await callables.schedule({ family, startDate: dateKey(start), endDate: dateKey(end) });
    if (currentRequest !== requestNumber[family]) return;
    const sessions = (result.data.sessions || []).filter((item) => item.isBooked || !item.past || item.canManageRoster);
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
    if (status) status.textContent = `${sessions.length} clases esta semana`;
  } catch (error) {
    console.error(`Error loading ${family} reservations:`, error);
    if (status) status.textContent = error.message || "No se pudo cargar el horario.";
    grid.replaceChildren(element("p", "nest-booking-error", error.message || "No se pudo cargar el horario."));
  }
}

export function initializeBookingSchedule() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("click", (event) => {
    const refresh = event.target.closest("[data-nest-booking-refresh]");
    if (refresh) {
      refreshFamily(refresh.dataset.nestBookingRefresh);
      return;
    }
    const shift = event.target.closest("[data-nest-week-shift]");
    if (shift) {
      const family = shift.dataset.nestWeekFamily;
      weekOffset[family] += Number(shift.dataset.nestWeekShift || 0);
      refreshFamily(family);
      return;
    }
    const today = event.target.closest("[data-nest-week-today]");
    if (today) {
      const family = today.dataset.nestWeekToday;
      weekOffset[family] = 0;
      refreshFamily(family);
    }
  });
}

export async function showBookingFamily(family) {
  if (!views[family]) return;
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
    <div class="nest-booking-sessions" data-nest-booking-sessions="${family}"></div>`;
  panel.append(title, section);
  initializeBookingSchedule();
  await refreshFamily(family);
}
