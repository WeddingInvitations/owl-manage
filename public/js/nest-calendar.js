import { auth } from "./firebase.js";
import { showToast } from "./toast.js";
import { ui, setActiveView } from "./ui.js";
import { getActivePilatesFamilyAthletes, getPilatesFamily } from "./pilates.js";
import {
  getNestCalendarEntry,
  updateNestCalendarEntry,
  getNestCalendarDateRangeData,
} from "./data.js";

const schedules = {
  pilates: [
    { id: "mw-18-19", daysOfWeek: [1, 3], startTime: "18:00", endTime: "19:00", label: "Lunes y miércoles 18:00-19:00" },
    { id: "mw-19-20", daysOfWeek: [1, 3], startTime: "19:00", endTime: "20:00", label: "Lunes y miércoles 19:00-20:00" },
    { id: "tt-10-11", daysOfWeek: [2, 4], startTime: "10:00", endTime: "11:00", label: "Martes y jueves 10:00-11:00" },
    { id: "tt-19-20", daysOfWeek: [2, 4], startTime: "19:00", endTime: "20:00", label: "Martes y jueves 19:00-20:00" },
  ],
  barre: [
    { id: "mw-11-12", daysOfWeek: [1, 3], startTime: "11:00", endTime: "12:00", label: "Lunes y miércoles 11:00-12:00" },
    { id: "mw-17-18", daysOfWeek: [1, 3], startTime: "17:00", endTime: "18:00", label: "Lunes y miércoles 17:00-18:00" },
    { id: "tt-09-10", daysOfWeek: [2, 4], startTime: "09:00", endTime: "10:00", label: "Martes y jueves 09:00-10:00" },
  ],
};

let initialized = false;
let activeFamily = "pilates";
let selectedSlotKey = "";
let eligibleAthletes = [];
let calendar = null;

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function familyLabel(family = activeFamily) {
  return family === "barre" ? "The Nest Barre" : "The Nest Pilates";
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

async function loadEligibleAthletes() {
  eligibleAthletes = getActivePilatesFamilyAthletes();
}

async function buildEvents(rangeStart, rangeEnd) {
  const startDate = new Date(rangeStart);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(rangeEnd);
  endDate.setHours(0, 0, 0, 0);
  endDate.setDate(endDate.getDate() - 1);
  const records = await getNestCalendarDateRangeData(
    activeFamily,
    formatDateKey(startDate),
    formatDateKey(endDate)
  );
  const events = [];

  for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateKey = formatDateKey(date);
    const dayOfWeek = date.getDay();
    schedules[activeFamily].forEach((slot) => {
      if (!slot.daysOfWeek.includes(dayOfWeek)) return;
      const entry = records[`${dateKey}__${slot.id}`] || { attendees: [] };
      const attendees = Array.isArray(entry.attendees) ? entry.attendees : [];
      const attendedCount = attendees.filter((attendee) => attendee.attended).length;
      const count = attendees.length;
      events.push({
        id: `${dateKey}__${slot.id}`,
        title: count ? `${count} usuarios · ${attendedCount} asistencias` : "Clase",
        start: `${dateKey}T${slot.startTime}:00`,
        end: `${dateKey}T${slot.endTime}:00`,
        backgroundColor: count ? "#4f46e5" : "#9ca3af",
        borderColor: count ? "#4f46e5" : "#9ca3af",
        textColor: "#fff",
        extendedProps: { dateKey, slotId: slot.id },
      });
    });
  }
  return events;
}

async function refreshVisibleRange() {
  if (!calendar) return;
  const requestedFamily = activeFamily;
  const events = await buildEvents(calendar.view.activeStart, calendar.view.activeEnd);
  if (requestedFamily !== activeFamily) return;
  calendar.removeAllEvents();
  events.forEach((event) => calendar.addEvent(event));
}

function populateAthleteSelect(attendees) {
  const assignedIds = new Set(attendees.map((attendee) => attendee.athleteId).filter(Boolean));
  const assignedNames = new Set(attendees.map((attendee) => normalizeName(attendee.name)));
  const available = eligibleAthletes.filter(
    (athlete) => !assignedIds.has(athlete.id) && !assignedNames.has(normalizeName(athlete.name))
  );
  ui.nestCalendarAthlete.innerHTML = '<option value="">Selecciona un usuario</option>';
  available.forEach((athlete) => {
    const option = document.createElement("option");
    option.value = athlete.id;
    option.textContent = athlete.name || "Sin nombre";
    ui.nestCalendarAthlete.appendChild(option);
  });
  ui.nestCalendarAddAthlete.disabled = available.length === 0;
  return available.length;
}

async function renderDetail() {
  if (!selectedSlotKey) return;
  const [dateKey, slotId] = selectedSlotKey.split("__");
  const slot = schedules[activeFamily].find((item) => item.id === slotId);
  const entry = await getNestCalendarEntry(activeFamily, dateKey, slotId);
  const attendees = Array.isArray(entry.attendees) ? entry.attendees : [];
  const availableCount = populateAthleteSelect(attendees);

  ui.nestCalendarSelectedDate.textContent = formatDateLabel(dateKey);
  ui.nestCalendarSelectedSlot.textContent = slot?.label || slotId;
  ui.nestCalendarHelp.textContent = `${attendees.length} usuario(s) asignados · ${availableCount} disponibles`;
  ui.nestCalendarAttendees.innerHTML = "";

  if (!attendees.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No hay usuarios asignados todavía.";
    ui.nestCalendarAttendees.appendChild(empty);
  } else {
    attendees.forEach((attendee, index) => {
      const row = document.createElement("div");
      row.className = "nest-attendee-row";
      const name = document.createElement("strong");
      name.textContent = attendee.name || "Sin nombre";
      const attendanceLabel = document.createElement("label");
      attendanceLabel.className = "nest-attendance-toggle";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(attendee.attended);
      checkbox.dataset.action = "attendance";
      checkbox.dataset.index = String(index);
      attendanceLabel.append(checkbox, document.createTextNode(" Asistió"));
      const removeButton = document.createElement("button");
      removeButton.className = "btn ghost small";
      removeButton.type = "button";
      removeButton.dataset.action = "remove";
      removeButton.dataset.index = String(index);
      removeButton.textContent = "Quitar";
      row.append(name, attendanceLabel, removeButton);
      ui.nestCalendarAttendees.appendChild(row);
    });
  }
  ui.nestCalendarModal.classList.remove("hidden");
}

async function saveAttendees(transform) {
  if (!selectedSlotKey) return;
  const [dateKey, slotId] = selectedSlotKey.split("__");
  const entry = await getNestCalendarEntry(activeFamily, dateKey, slotId);
  const attendees = Array.isArray(entry.attendees) ? [...entry.attendees] : [];
  const nextAttendees = transform(attendees);
  await updateNestCalendarEntry(activeFamily, dateKey, slotId, nextAttendees, auth.currentUser?.uid || null);
  await Promise.all([refreshVisibleRange(), renderDetail()]);
}

async function addAthlete() {
  const athlete = eligibleAthletes.find((item) => item.id === ui.nestCalendarAthlete.value);
  if (!athlete) {
    showToast("Selecciona un usuario", "error");
    return;
  }
  await saveAttendees((attendees) => {
    if (attendees.some((attendee) => attendee.athleteId === athlete.id)) return attendees;
    return [...attendees, { athleteId: athlete.id, name: athlete.name, attended: false }];
  });
}

function createCalendar() {
  calendar = new window.FullCalendar.Calendar(ui.nestCalendar, {
    initialView: "timeGridWeek",
    locale: "es",
    firstDay: 1,
    height: 620,
    contentHeight: 590,
    nowIndicator: true,
    allDaySlot: false,
    weekends: false,
    slotMinTime: "08:00:00",
    slotMaxTime: "20:00:00",
    slotDuration: "01:00:00",
    slotLabelInterval: "01:00:00",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "timeGridWeek,dayGridMonth",
    },
    buttonText: { today: "Hoy", week: "Semana", month: "Mes" },
    datesSet: () => {
      refreshVisibleRange().catch((error) => {
        console.error("Error loading The Nest calendar:", error);
        showToast("Error al cargar calendario", "error");
      });
    },
    eventClick: (info) => {
      selectedSlotKey = info.event.id;
      renderDetail().catch((error) => {
        console.error("Error opening The Nest class:", error);
        showToast("Error al abrir la clase", "error");
      });
    },
  });
  calendar.render();
}

async function openCalendar() {
  activeFamily = getPilatesFamily();
  selectedSlotKey = "";
  ui.nestCalendarTitle.textContent = `Calendario · ${familyLabel()}`;
  ui.nestCalendarModal.classList.add("hidden");
  setActiveView("nestCalendarView", ui);
  await loadEligibleAthletes();
  if (!calendar) createCalendar();
  else await refreshVisibleRange();
}

export function initializeNestCalendar() {
  if (initialized || !ui.nestCalendarOpen) return;
  initialized = true;
  ui.nestCalendarOpen.addEventListener("click", () => {
    openCalendar().catch((error) => {
      console.error("Error opening The Nest calendar:", error);
      showToast("Error al abrir calendario", "error");
    });
  });
  ui.nestCalendarBack.addEventListener("click", () => setActiveView("pilatesView", ui));
  ui.nestCalendarToday.addEventListener("click", () => calendar?.today());
  ui.nestCalendarClose.addEventListener("click", () => ui.nestCalendarModal.classList.add("hidden"));
  ui.nestCalendarAddAthlete.addEventListener("click", () => {
    addAthlete().catch((error) => {
      console.error("Error adding The Nest attendee:", error);
      showToast("Error al añadir usuario", "error");
    });
  });
  ui.nestCalendarAttendees.addEventListener("change", (event) => {
    const checkbox = event.target.closest('[data-action="attendance"]');
    if (!checkbox) return;
    const index = Number(checkbox.dataset.index);
    saveAttendees((attendees) => {
      if (attendees[index]) attendees[index] = { ...attendees[index], attended: checkbox.checked };
      return attendees;
    }).catch((error) => {
      console.error("Error updating The Nest attendance:", error);
      showToast("Error al marcar asistencia", "error");
    });
  });
  ui.nestCalendarAttendees.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove"]');
    if (!button) return;
    const index = Number(button.dataset.index);
    saveAttendees((attendees) => attendees.filter((_, attendeeIndex) => attendeeIndex !== index)).catch((error) => {
      console.error("Error removing The Nest attendee:", error);
      showToast("Error al quitar usuario", "error");
    });
  });
}
