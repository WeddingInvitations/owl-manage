import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";
import { showToast } from "./toast.js";
import { createScheduleCache, applyBookingConfirmation, hasBookingAccess } from "./schedule-cache.mjs?v=20261126staff2";
import { saveBookingSelection } from "./booking-selection.mjs?v=20261126multi1";

const views = { pilates: "pilates", barre: "barre" };
const WEEKDAY_COUNT = 5;
const callables = {
  schedule: httpsCallable(functions, "getNestBookingSchedule"),
  athletes: httpsCallable(functions, "getNestBookingAthletes"),
  book: httpsCallable(functions, "bookNestClass"),
  cancel: httpsCallable(functions, "cancelNestBooking"),
  roster: httpsCallable(functions, "getNestClassRoster"),
  attendance: httpsCallable(functions, "setNestAttendance"),
};
let initialized = false;
let activeFamily = "pilates";
const selectedDateKey = { pilates: dateKey(normalizeWorkday(dayAtNoon(0))), barre: dateKey(normalizeWorkday(dayAtNoon(0))) };
const requestNumber = { pilates: 0, barre: 0 };
const monthScheduleCache = createScheduleCache();
const pendingActions = new Set();

function cacheKey(family, month) {
  return `${family}__${auth.currentUser?.uid || "guest"}__${month}`;
}

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

function normalizeWorkday(date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  if (normalized.getDay() === 6) normalized.setDate(normalized.getDate() - 1);
  if (normalized.getDay() === 0) normalized.setDate(normalized.getDate() + 1);
  return normalized;
}

function invalidateMonthCache(family, key) {
  if (key) {
    monthScheduleCache.invalidate(cacheKey(family, key.slice(0, 7)));
    return;
  }
  monthScheduleCache.invalidate(cacheKey(family, ""));
}

async function getMonthSessions(family, date) {
  const key = cacheKey(family, monthKey(date));
  return monthScheduleCache.get(key, () => {
    const { start, end } = monthBounds(date);
    return callables.schedule({
      family,
      startDate: dateKey(start),
      endDate: dateKey(end),
    }).then((result) => {
      const photos = result.data.memberPhotos || {};
      return (result.data.sessions || []).map((session) => ({
        ...session,
        attendees: (session.attendees || []).map((attendee) => ({
          ...attendee,
          paymentPending: Boolean((session.canBookForOthers || attendee.isCurrentUser) && attendee.paymentPending),
          photoUrl: photos[attendee.userId] || attendee.photoUrl || "",
        })),
      }));
    });
  });
}

async function mutateBooking(session, family, button, { cancelled = false, athleteId } = {}) {
  if (pendingActions.has(session.id)) return;
  const actingUserId = auth.currentUser?.uid;
  const monthCacheKey = cacheKey(family, session.dateKey.slice(0, 7));
  pendingActions.add(session.id);
  document.querySelectorAll(`[data-session-action="${session.id}"]`).forEach((control) => { control.disabled = true; });
  button.textContent = cancelled ? "Cancelando…" : "Reservando…";
  try {
    const result = await (cancelled ? callables.cancel : callables.book)({
      family, dateKey: session.dateKey, slotId: session.slotId, startTime: session.startTime,
      ...(athleteId ? { athleteId } : {}),
    });
    if (auth.currentUser?.uid !== actingUserId) return;
    const own = !athleteId;
    const updated = Number.isInteger(result.data.reservedCount) && monthScheduleCache.update(
      monthCacheKey,
      (sessions) => applyBookingConfirmation(sessions, session.id, result.data, {
        cancelled, own, photoUrl: own ? auth.currentUser?.photoURL || "" : "",
      })
    );
    if (!updated) invalidateMonthCache(family, session.dateKey); // Compatible with older backend.
    showToast(cancelled ? "Reserva cancelada" : "Plaza reservada", "success");
    pendingActions.delete(session.id);
    if (activeFamily === family) await refreshFamily(family);
  } catch (error) {
    if (auth.currentUser?.uid !== actingUserId) return;
    invalidateMonthCache(family, session.dateKey);
    showToast(error.message || "No se pudo completar la reserva", "error");
    if (activeFamily === family) await refreshFamily(family);
  } finally {
    pendingActions.delete(session.id);
    document.querySelectorAll(`[data-session-action="${session.id}"]`).forEach((control) => { control.disabled = false; });
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let athletePicker = null;

async function chooseBookingAthlete(session, family, bookingButton) {
  if (athletePicker?.open || pendingActions.has(session.id)) return;
  const uid = auth.currentUser?.uid;
  const selectedIds = new Set();
  const failures = new Map();
  let saving = false;
  let reservedCount = session.reservedCount;
  const dialog = element('dialog', 'booking-athlete-dialog');
  athletePicker = dialog;
  dialog.setAttribute('aria-labelledby', 'bookingAthleteTitle');
  const heading = element('div', 'booking-athlete-heading');
  const title = element('h2', '', 'Añadir alumnas a la clase');
  title.id = 'bookingAthleteTitle';
  const close = element('button', 'button button-quiet', 'Cerrar ×');
  close.type = 'button';
  close.addEventListener('click', () => { if (!saving) dialog.close(); });
  dialog.addEventListener('cancel', (event) => { if (saving) event.preventDefault(); });
  heading.append(title, close);
  const detail = element('p', 'booking-athlete-detail',
    `${family === 'barre' ? 'Barre' : 'Pilates'} · ${dateFromKey(session.dateKey).toLocaleDateString('es-ES')} · ${session.startTime}`);
  const label = element('label', 'booking-athlete-search', 'Buscar alumna por nombre');
  const search = element('input');
  search.type = 'search';
  search.placeholder = 'Escribe un nombre…';
  label.append(search);
  const list = element('div', 'booking-athlete-results');
  list.setAttribute('aria-live', 'polite');
  list.append(element('p', 'booking-athlete-detail', 'Cargando alumnas…'));
  const footer = element('div', 'booking-athlete-footer');
  const summary = element('p', 'booking-athlete-detail');
  summary.setAttribute('aria-live', 'polite');
  const message = element('p', 'booking-athlete-error');
  message.setAttribute('role', 'status');
  const save = element('button', 'button button-primary', 'Guardar');
  save.type = 'button';
  save.disabled = true;
  footer.append(summary, message, save);
  dialog.append(heading, detail, label, list, footer);
  const previousOverflow = document.body.style.overflow;
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    dialog.remove();
    if (athletePicker === dialog) athletePicker = null;
    bookingButton.focus();
  });
  document.body.append(dialog);
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  search.focus();
  try {
    const result = await callables.athletes({ family, month: session.dateKey.slice(0, 7) });
    if (!dialog.open) return;
    if (auth.currentUser?.uid !== uid) { dialog.close(); return; }
    const athletes = result.data.athletes || [];
    const assignedIds = new Set((session.attendees || []).map((attendee) => attendee.athleteId));
    const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const render = () => {
      const free = Math.max(0, session.capacity - reservedCount);
      summary.textContent = `${selectedIds.size} seleccionadas · ${free} plazas disponibles`;
      save.disabled = saving || !selectedIds.size;
      save.textContent = saving ? 'Guardando…' : 'Guardar';
      close.disabled = saving;
      search.disabled = saving;
      dialog.setAttribute('aria-busy', String(saving));
      list.replaceChildren();
      const matches = athletes.filter((athlete) => normalize(`${athlete.name} ${athlete.email}`).includes(normalize(search.value.trim())));
      if (!matches.length) list.append(element('p', 'booking-athlete-detail', athletes.length ? 'No hay alumnas con ese nombre.' : 'No hay alumnas registradas en esta disciplina.'));
      matches.forEach((athlete) => {
        const row = element('label', 'booking-athlete-row');
        const info = element('div');
        info.append(element('strong', '', athlete.name), element('small', '', athlete.email || 'Sin correo registrado'));
        if (athlete.paymentPending) info.append(element('small', 'nest-payment-warning', 'Cuota pendiente · el personal puede reservar'));
        const assigned = assignedIds.has(athlete.id);
        if (assigned) info.append(element('small', '', 'Ya reservada'));
        if (failures.has(athlete.id)) info.append(element('small', 'booking-athlete-error', failures.get(athlete.id)));
        const checkbox = element('input', 'booking-athlete-checkbox');
        checkbox.type = 'checkbox';
        checkbox.checked = assigned || selectedIds.has(athlete.id);
        checkbox.disabled = saving || assigned || (!checkbox.checked && selectedIds.size >= free);
        checkbox.setAttribute('aria-label', `${assigned ? 'Ya reservada' : 'Seleccionar a'} ${athlete.name}`);
        checkbox.addEventListener('change', () => {
          if (auth.currentUser?.uid !== uid) { dialog.close(); return; }
          if (checkbox.checked) selectedIds.add(athlete.id);
          else selectedIds.delete(athlete.id);
          failures.delete(athlete.id);
          render();
          list.querySelector(`input[aria-label="${CSS.escape(checkbox.getAttribute('aria-label'))}"]`)?.focus();
        });
        row.append(info, checkbox);
        list.append(row);
      });
    };
    save.addEventListener('click', async () => {
      if (saving || !selectedIds.size || pendingActions.has(session.id)) return;
      if (auth.currentUser?.uid !== uid) { dialog.close(); return; }
      const athleteIds = [...selectedIds];
      const monthCacheKey = cacheKey(family, session.dateKey.slice(0, 7));
      saving = true;
      pendingActions.add(session.id);
      failures.clear();
      message.textContent = '';
      render();
      try {
        const outcomes = await saveBookingSelection(athleteIds, {
          shouldContinue: () => auth.currentUser?.uid === uid,
          book: (athleteId) => callables.book({ family, dateKey: session.dateKey,
            slotId: session.slotId, startTime: session.startTime, athleteId }),
          onResult: ({ athleteId, result, error }, completed) => {
            if (auth.currentUser?.uid !== uid) return;
            if (!error || error.code === 'functions/already-exists') {
              selectedIds.delete(athleteId);
              assignedIds.add(athleteId);
              reservedCount = result?.data?.reservedCount ?? reservedCount + 1;
              const updated = result?.data && monthScheduleCache.update(monthCacheKey,
                (sessions) => applyBookingConfirmation(sessions, session.id, result.data, { own: false }));
              if (!updated) invalidateMonthCache(family, session.dateKey);
            } else {
              failures.set(athleteId, error.message || 'No se pudo reservar. Vuelve a intentarlo.');
              invalidateMonthCache(family, session.dateKey);
            }
            render();
            summary.textContent = `Guardando ${completed} de ${athleteIds.length}…`;
          },
        });
        if (auth.currentUser?.uid !== uid) { dialog.close(); return; }
        const added = outcomes.filter((outcome) => !outcome.error).length;
        if (!failures.size) {
          dialog.close();
          showToast(added ? `${added} ${added === 1 ? 'alumna añadida' : 'alumnas añadidas'}` : 'Las alumnas ya tenían plaza', 'success');
        } else {
          search.value = '';
          message.textContent = `${added} ${added === 1 ? 'alumna añadida' : 'alumnas añadidas'}. No se han guardado ${failures.size}. Revisa los errores de cada ficha; puedes reintentar sin repetir las reservas confirmadas.`;
        }
      } finally {
        saving = false;
        pendingActions.delete(session.id);
        if (dialog.open) render();
        if (auth.currentUser?.uid === uid && activeFamily === family) await refreshFamily(family);
      }
    });
    search.addEventListener('input', render);
    render();
  } catch (error) {
    if (!dialog.open) return;
    list.replaceChildren(element('p', 'booking-athlete-detail', error.message || 'No se pudieron cargar las alumnas. Cierra y vuelve a intentarlo.'));
  }
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
  if (attendee?.paymentPending) {
    avatar.classList.add('is-payment-pending');
    avatar.title = `${name} · Cuota pendiente`;
    avatar.setAttribute('aria-label', `Plaza ocupada por ${name}. Cuota pendiente`);
  }

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
  card.classList.toggle("is-past", session.past);
  card.append(element("strong", "nest-booking-session-time", `${session.startTime}–${session.endTime}`));

  const capacity = element("div", "nest-booking-capacity");
  const seats = element("div", "nest-booking-seats");
  const attendees = Array.isArray(session.attendees) ? session.attendees : [];
  for (let index = 0; index < session.capacity; index += 1) {
    seats.append(createSeatAvatar(attendees[index] || (index < session.reservedCount ? { name: "Plaza reservada" } : null), index));
  }
  capacity.append(seats, element("span", "nest-booking-capacity-label", `${attendees.length || session.reservedCount}/${session.capacity} plazas ocupadas`));
  card.append(capacity);
  attendees.filter((attendee) => attendee.paymentPending).forEach((attendee) => {
    card.append(element('p', 'nest-payment-warning', `${attendee.name || 'Alumna'} · Cuota pendiente`));
  });

  const full = session.reservedCount >= session.capacity;
  const isInstructor = session.canManageRoster;
  if (session.actionsBlocked && !isInstructor && !session.past) {
    card.append(element("p", "nest-booking-message nest-payment-warning", "Acciones bloqueadas: la cuota del mes debe figurar como pagada en Owl Manage. Contacta con recepción y pulsa Actualizar horario cuando se registre el pago."));
  } else if (session.past && session.myBookingStatus === "BOOKED") {
    const attendanceMessage = session.myAttendanceMarked
      ? (session.myAttended ? "Asististe a esta clase" : "Asistencia: no asististe")
      : "Asistencia pendiente de confirmar";
    card.append(element("p", "nest-booking-message nest-booking-history-status", attendanceMessage));
  } else if (session.past && session.myBookingStatus === "CANCELLED") {
    card.append(element("p", "nest-booking-message", "Cancelaste esta clase"));
  } else if (session.past && session.myBookingStatus) {
    card.append(element("p", "nest-booking-message nest-booking-history-status", "Esta clase quedó registrada en tu historial"));
  } else if (session.isBooked) {
    card.append(element("p", "nest-booking-message", "Tu plaza está reservada"));
    const cancel = element("button", "button button-secondary nest-booking-action", "Cancelar");
    cancel.type = "button";
    cancel.dataset.sessionAction = session.id;
    cancel.disabled = session.canCancel === false || session.past || pendingActions.has(session.id);
    cancel.addEventListener("click", () => mutateBooking(session, family, cancel, { cancelled: true }));
    card.append(cancel);
  } else if (session.canBook && !full && !session.past && !isInstructor) {
    const remaining = Math.max(0, session.monthlyLimit - (session.monthlyUsed || 0));
    card.append(element("p", "nest-booking-message", `${remaining} sesiones disponibles este mes`));
    const book = element("button", "button button-primary nest-booking-action", "Reservar plaza");
    book.type = "button";
    book.dataset.sessionAction = session.id;
    book.disabled = pendingActions.has(session.id);
    book.addEventListener("click", () => mutateBooking(session, family, book));
    card.append(book);
  } else if (session.canBookForOthers && !full && !session.past) {
    const book = element("button", "button button-primary nest-booking-action", "Reservar para alumna");
    book.type = "button";
    book.dataset.sessionAction = session.id;
    book.disabled = pendingActions.has(session.id);
    book.addEventListener("click", () => chooseBookingAthlete(session, family, book));
    card.append(book);
  } else if (session.past) {
    card.append(element("p", "nest-booking-message nest-booking-history-status", "No tenías una reserva para esta clase"));
  } else if (!session.activeForMonth && !session.canManageRoster) {
    card.append(element("p", "nest-booking-message", "La cuota de este mes debe figurar como pagada en Owl Manage para reservar."));
  } else if (full) {
    card.append(element("p", "nest-booking-message", "Clase completa"));
  }

  if (isInstructor) {
    const rosterButton = element("button", "button button-secondary nest-booking-action",
      session.canRemoveOthers ? "Ver alumnas / Quitar alumna" : "Lista y asistencia");
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
          const row = element('div', 'nest-booking-roster-row');
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
          row.append(label);
          if (attendee.paymentPending) row.append(element('span', 'nest-payment-warning', 'Cuota pendiente'));
          if (session.canRemoveOthers && !session.past) {
            const remove = element('button', 'button button-secondary nest-booking-remove', 'Quitar alumna de esta clase');
            remove.type = 'button';
            remove.dataset.sessionAction = session.id;
            remove.disabled = pendingActions.has(session.id);
            remove.setAttribute('aria-label', `Quitar a ${attendee.name || 'alumna'} de esta clase`);
            remove.addEventListener('click', () => {
              if (!window.confirm(`¿Quitar a ${attendee.name || 'esta alumna'} de la clase del ${dateFromKey(session.dateKey).toLocaleDateString('es-ES')} a las ${session.startTime}? Se liberará su plaza y se devolverá una sesión para poder reservar otra clase.`)) return;
              mutateBooking(session, family, remove, { cancelled: true, athleteId: attendee.athleteId });
            });
            row.append(remove);
          }
          roster.append(row);
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
  ["L", "M", "X", "J", "V"].forEach((day) => {
    grid.append(element("span", "nest-mini-weekday", day));
  });

  const firstDayOffset = (start.getDay() + 6) % 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstDayOffset);
  const todayKey = dateKey(dayAtNoon(0));
  const lastWeekday = new Date(end);
  if (lastWeekday.getDay() === 6) lastWeekday.setDate(lastWeekday.getDate() - 1);
  if (lastWeekday.getDay() === 0) lastWeekday.setDate(lastWeekday.getDate() - 2);
  const rowCount = Math.floor((lastWeekday - gridStart) / (7 * 86400000)) + 1;
  for (let index = 0; index < rowCount * WEEKDAY_COUNT; index += 1) {
    const date = new Date(gridStart);
    const row = Math.floor(index / WEEKDAY_COUNT);
    const weekday = index % WEEKDAY_COUNT;
    date.setDate(gridStart.getDate() + row * 7 + weekday);
    const key = dateKey(date);
    const sameMonth = date.getMonth() === monthDate.getMonth();
    const count = counts.get(key) || 0;
    const button = element("button", "nest-mini-date", String(date.getDate()));
    button.type = "button";
    button.dataset.nestSelectDate = key;
    button.dataset.nestSelectFamily = family;
    button.classList.toggle("is-outside-month", !sameMonth);
    button.disabled = !sameMonth;
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
  for (let index = 0; index < WEEKDAY_COUNT; index += 1) {
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

async function refreshFamily(family, { focusSelectedDay = false } = {}) {
  const grid = document.querySelector(`[data-nest-booking-sessions="${family}"]`);
  const status = document.querySelector(`[data-nest-booking-status="${family}"]`);
  const label = document.querySelector(`[data-nest-booking-week="${family}"]`);
  const dayRoot = document.querySelector(`[data-nest-day-view="${family}"]`);
  const dayClasses = dayRoot?.querySelector("[data-nest-day-classes]");
  if (!grid || !auth.currentUser) return;
  const currentRequest = ++requestNumber[family];
  if (status) status.textContent = "Cargando horario…";
  const selectedDate = dateFromKey(selectedDateKey[family]);
  const selectedWeekday = selectedDate.getDay() || 7;
  const start = new Date(selectedDate);
  start.setDate(selectedDate.getDate() - selectedWeekday + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + WEEKDAY_COUNT - 1);
  if (label) label.textContent = rangeLabel(start, end);
  if (dayClasses) {
    dayRoot.setAttribute("aria-busy", "true");
    dayClasses.replaceChildren(element("p", "nest-booking-empty-day-detail is-loading", "Cargando las clases de este día…"));
  }
  try {
    const weekMonthKeys = new Set(Array.from({ length: WEEKDAY_COUNT }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return monthKey(date);
    }));
    weekMonthKeys.add(monthKey(selectedDate));
    const weekSessionsByMonth = await Promise.all(Array.from(weekMonthKeys, async (key) => {
      const [year, month] = key.split("-").map(Number);
      return getMonthSessions(family, new Date(year, month - 1, 1, 12));
    }));
    if (currentRequest !== requestNumber[family]) return;
    const monthSessions = weekSessionsByMonth[Array.from(weekMonthKeys).indexOf(monthKey(selectedDate))];
    const sessions = weekSessionsByMonth.flat().map((session) => {
      const past = new Date(session.startTimestamp).getTime() <= Date.now();
      const activeForMonth = hasBookingAccess(session);
      const actionsBlocked = session.actionsBlocked || Boolean(session.paymentGrace) || Boolean(session.bookingAccessExpiresAt &&
        new Date(session.bookingAccessExpiresAt).getTime() <= Date.now());
      return { ...session, actionsBlocked, activeForMonth, past, canBook: session.canBook && activeForMonth && !past };
    });
    renderMiniMonth(family, monthSessions, selectedDate);
    renderWeekDaySelector(family, selectedDate, sessions);
    renderMobileDay(family, selectedDate, sessions);
    if (focusSelectedDay && window.matchMedia("(max-width: 760px)").matches) {
      requestAnimationFrame(() => {
        document.querySelector(`[data-nest-day-view="${family}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    const todayKey = dateKey(dayAtNoon(0));
    const days = [];
    for (let index = 0; index < WEEKDAY_COUNT; index += 1) {
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
      status.textContent = `${sessions.filter((session) => session.dateKey >= dateKey(start) && session.dateKey <= dateKey(end)).length} clases esta semana · ${bookedCount} reservas este mes`;
    }
  } catch (error) {
    if (currentRequest !== requestNumber[family]) return;
    console.error(`Error loading ${family} reservations:`, error);
    if (status) status.textContent = error.message || "No se pudo cargar el horario.";
    grid.replaceChildren(element("p", "nest-booking-error", error.message || "No se pudo cargar el horario."));
    if (dayClasses) dayClasses.replaceChildren(element("p", "nest-booking-error", error.message || "No se pudieron cargar las clases de este día."));
  } finally {
    if (currentRequest === requestNumber[family]) dayRoot?.removeAttribute("aria-busy");
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
      invalidateMonthCache(refresh.dataset.nestBookingRefresh);
      refreshFamily(refresh.dataset.nestBookingRefresh);
      return;
    }
    const shift = event.target.closest("[data-nest-week-shift]");
    if (shift) {
      const family = shift.dataset.nestWeekFamily;
      const selected = dateFromKey(selectedDateKey[family]);
      selected.setDate(selected.getDate() + Number(shift.dataset.nestWeekShift || 0) * 7);
      selectedDateKey[family] = dateKey(selected);
      refreshFamily(family, { focusSelectedDay: true });
      return;
    }
    const today = event.target.closest("[data-nest-week-today]");
    if (today) {
      const family = today.dataset.nestWeekToday;
      selectedDateKey[family] = dateKey(normalizeWorkday(dayAtNoon(0)));
      refreshFamily(family, { focusSelectedDay: true });
      return;
    }
    const selectDate = event.target.closest("[data-nest-select-date]");
    if (selectDate) {
      const family = selectDate.dataset.nestSelectFamily;
      selectedDateKey[family] = dateKey(normalizeWorkday(dateFromKey(selectDate.dataset.nestSelectDate)));
      refreshFamily(family, { focusSelectedDay: true });
      return;
    }
    const monthShift = event.target.closest("[data-nest-month-shift]");
    if (monthShift) {
      const family = monthShift.dataset.nestMonthFamily;
      const selected = normalizeWorkday(dateFromKey(selectedDateKey[family]));
      const desiredDay = selected.getDate();
      selected.setDate(1);
      selected.setMonth(selected.getMonth() + Number(monthShift.dataset.nestMonthShift || 0));
      const lastDay = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
      selected.setDate(Math.min(desiredDay, lastDay));
      selectedDateKey[family] = dateKey(normalizeWorkday(selected));
      refreshFamily(family, { focusSelectedDay: true });
    }
  });
}

export async function showBookingFamily(family, { forceRefresh = false } = {}) {
  if (!views[family]) return;
  if (forceRefresh) invalidateMonthCache(family);
  activeFamily = family;
  document.querySelectorAll(".family-tab[data-family]").forEach((button) => {
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
    <div class="nest-mobile-day-selector" data-nest-week-days="${family}" aria-label="Seleccionar día de la semana"></div>
    <details class="nest-mobile-calendar" data-nest-mini-month="${family}">
      <summary class="nest-mini-month-toggle"><span>Calendario mensual</span><strong data-mini-month-label></strong></summary>
      <div class="nest-mini-month-header">
        <button class="button button-secondary" type="button" data-nest-month-shift="-1" data-nest-month-family="${family}" aria-label="Mes anterior">‹</button>
        <button class="button button-secondary" type="button" data-nest-booking-refresh="${family}" aria-label="Actualizar clases">↻</button>
        <button class="button button-secondary" type="button" data-nest-month-shift="1" data-nest-month-family="${family}" aria-label="Mes siguiente">›</button>
      </div>
      <div class="nest-mini-month-grid" data-mini-month-grid></div>
      <p class="nest-mini-month-legend"><i></i> Tienes una clase reservada</p>
    </details>
    <div class="nest-mobile-day-view" data-nest-day-view="${family}">
      <h2 data-nest-day-title></h2>
      <div data-nest-day-classes></div>
    </div>
    <div class="nest-booking-sessions" data-nest-booking-sessions="${family}"></div>`;
  panel.append(title, section);
  initializeBookingSchedule();
  await refreshFamily(family);
}
