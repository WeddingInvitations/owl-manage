import { auth, db, functions } from "./firebase.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { showBookingFamily } from "./booking.js?v=20261112picker1";
import { expandAdminSlots, mergeAdminRows } from "./admin-schedule-draft.mjs?v=20261112delete1";
import { showToast } from "./toast.js";

const $ = (id) => document.getElementById(id);
const staffRoles = new Set(["OWNER", "RECEPTION", "COACH", "TEAM_LEADER"]);
const checkNestSignupEmail = httpsCallable(functions, "checkNestSignupEmail");
const registerNestPortalAccount = httpsCallable(functions, "registerNestPortalAccount");
const refreshNestPortalAccess = httpsCallable(functions, "refreshNestPortalAccess");
const getNestAdminSchedule = httpsCallable(functions, "getNestAdminSchedule");
const saveNestAdminSchedule = httpsCallable(functions, "saveNestAdminSchedule");
const ui = {
  welcome: $("welcomePanel"),
  booking: $("bookingPanel"),
  pending: $("pendingPanel"),
  pendingMessage: $("pendingMessage"),
  authMessage: $("authMessage"),
  signupMessage: $("signupMessage"),
  accountAvatar: $("accountAvatar"),
  accountInitials: $("accountInitials"),
  profileSettingsModal: $("profileSettingsModal"),
  profileSettingsForm: $("profileSettingsForm"),
  profileSettingsMessage: $("profileSettingsMessage"),
  profilePhotoFile: $("profilePhotoFile"),
  profilePhotoPreview: $("profilePhotoPreview"),
  profilePhotoInitials: $("profilePhotoInitials"),
  resendVerification: $("resendVerificationBtn"),
  accountBar: $("accountBar"),
  accountName: $("accountName"),
  scheduleAdminOpen: $("scheduleAdminOpen"),
  scheduleAdminModal: $("scheduleAdminModal"),
  scheduleAdminClose: $("scheduleAdminClose"),
  scheduleAdminCancel: $("scheduleAdminCancel"),
  scheduleAdminFamilies: $("scheduleAdminFamilies"),
  scheduleAdminAddForm: $("scheduleAdminAddForm"),
  scheduleAdminAddTime: $("scheduleAdminAddTime"),
  scheduleAdminAddCapacity: $("scheduleAdminAddCapacity"),
  scheduleAdminSlots: $("scheduleAdminSlots"),
  scheduleAdminCount: $("scheduleAdminCount"),
  scheduleAdminSave: $("scheduleAdminSave"),
  scheduleAdminMessage: $("scheduleAdminMessage"),
  familyTabs: $("familyTabs"),
  memberName: $("memberName"),
};
let authActionInProgress = false;
let activeUser = null;
let activeProfile = null;
let pendingPhotoUrl = "";
let adminFamily = "pilates";
let adminSlots = [];
let adminScheduleDirty = false;
let adminScheduleBusy = false;
let adminScheduleLoaded = false;
let adminScheduleVersion = 0;

function showMessage(node, message, isError = false) {
  if (!node) return;
  node.textContent = message || "";
  node.classList.toggle("is-error", Boolean(isError));
}

function getCallableMessage(error) {
  if (["functions/internal", "functions/unavailable", "functions/deadline-exceeded"].includes(error?.code)) {
    return "No se pudo conectar con el servidor. Reintenta; si persiste, comprueba el despliegue y el permiso de invocación de la función.";
  }
  return error?.message?.replace(/^FirebaseError:\s*/i, "") || "No se pudo completar la operación.";
}

function getAuthMessage(error) {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese correo. Entra desde «Entrar en mi cuenta» o usa «Entrar con Google» si la creaste con Google. Si no recuerdas la contraseña, pulsa «He olvidado mi contraseña».";
    case "auth/unauthorized-domain":
      return "Este dominio aún no está autorizado en Firebase Authentication. Contacta con la administración de OwlManage.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "El correo o la contraseña no son correctos. Si accedes con Google, usa el botón «Entrar con Google».";
    case "auth/account-exists-with-different-credential":
      return "Ya existe una cuenta con este correo. Entra primero con el método que utilizaste al crearla.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Se han hecho demasiados intentos. Espera un poco o restablece la contraseña.";
    default:
      return getCallableMessage(error);
  }
}

function safePhotoUrl(value) {
  return value.startsWith("https://") || /^data:image\/(?:jpeg|png|webp);base64,/i.test(value);
}

function setAvatar(container, initials, photoUrl, imageClass = "") {
  if (!container) return;
  container.replaceChildren();
  if (photoUrl && safePhotoUrl(photoUrl)) {
    const image = document.createElement("img");
    image.className = imageClass;
    image.src = photoUrl;
    image.alt = "";
    image.addEventListener("error", () => {
      const fallback = document.createElement("span");
      fallback.textContent = initials || "?";
      container.replaceChildren(fallback);
    }, { once: true });
    container.append(image);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = initials || "?";
    container.append(fallback);
  }
}

function initialsFor(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1
    ? parts[0].slice(0, 1).toLocaleUpperCase("es")
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase("es");
}

function updateAccountAvatar(user, profile) {
  const name = profile?.displayName || user?.displayName || user?.email || "";
  const initials = initialsFor(name);
  const photoUrl = profile?.photoUrl || user?.photoURL || "";
  setAvatar(ui.accountAvatar, initials, photoUrl, "account-avatar-image");
}

function showProfilePhotoPreview(photoUrl) {
  const name = activeProfile?.displayName || activeUser?.displayName || activeUser?.email || "";
  const initials = initialsFor(name);
  ui.profilePhotoInitials.textContent = initials;
  if (photoUrl && safePhotoUrl(photoUrl)) {
    setAvatar(ui.profilePhotoPreview, initials, photoUrl, "profile-photo-image");
  } else {
    setAvatar(ui.profilePhotoPreview, initials, "");
  }
}

async function compressProfilePhoto(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Selecciona un archivo de imagen.");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen no puede superar 8 MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const maxSide = 160;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.58);
    if (dataUrl.length > 40_000) dataUrl = canvas.toDataURL("image/jpeg", 0.38);
    if (dataUrl.length > 48_000) throw new Error("No se pudo reducir la foto a un tamaño adecuado. Prueba con otra imagen.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getSignupEligibilityMessage(reason) {
  switch (reason) {
    case "already-linked":
      return "Esta ficha ya tiene una cuenta vinculada. Entra con esa cuenta o recupera su contraseña.";
    case "missing-family":
      return "La ficha todavía no tiene una tarifa de Pilates o Barre. Contacta con recepción.";
    case "duplicate":
      return "Ese correo aparece en varias fichas. Contacta con recepción para corregirlas antes de crear la cuenta.";
    default:
      return "No encontramos ese correo en una ficha activa de alumna o profesora de The Nest. Pide a recepción que lo añada a tu ficha y vuelve a intentarlo.";
  }
}

async function getProfile(user) {
  const profileRef = doc(db, "users", user.uid);
  let snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      email: user.email || "",
      displayName: user.displayName || "",
      firstName: "",
      lastName: "",
      role: "PENDING",
      mustChangePassword: false,
      photoUrl: user.photoURL || "",
      createdAt: serverTimestamp(),
    });
    snapshot = await getDoc(profileRef);
  }
  const profileData = snapshot.data() || {};
  if (!profileData.photoUrl && user.photoURL) {
    await updateDoc(profileRef, { photoUrl: user.photoURL, updatedAt: serverTimestamp() });
    profileData.photoUrl = user.photoURL;
  }
  return { ref: profileRef, data: profileData };
}

async function resolveAccess(user) {
  let profile = await getProfile(user);
  if (!staffRoles.has(profile.data.role) && profile.data.role === "PENDING") {
    try {
      await registerNestPortalAccount({});
      profile = await getProfile(user);
    } catch (error) {
      return { ...profile, message: getCallableMessage(error) };
    }
  }
  if (["NEST_STUDENT", "NEST_INSTRUCTOR"].includes(profile.data.role)) {
    try {
      const result = await refreshNestPortalAccess({});
      profile = result.data.profile ? { ...profile, data: result.data.profile } : await getProfile(user);
    } catch (error) {
      return { ...profile, message: getCallableMessage(error) };
    }
  }
  return profile;
}

function authorizedFamilies(profile) {
  const role = profile.role;
  if (staffRoles.has(role)) return ["pilates", "barre"];
  if (["NEST_STUDENT", "NEST_INSTRUCTOR"].includes(role)) {
    return (Array.isArray(profile.nestFamilies) ? profile.nestFamilies : [])
      .filter((family) => ["pilates", "barre"].includes(family));
  }
  return [];
}

function renderAuthorizedPortal(user, profile) {
  activeUser = user;
  activeProfile = profile;
  const families = authorizedFamilies(profile);
  ui.welcome.classList.add("hidden");
  ui.pending.classList.add("hidden");
  ui.booking.classList.remove("hidden");
  ui.accountBar.classList.remove("hidden");
  ui.scheduleAdminOpen.classList.toggle("hidden", !staffRoles.has(profile.role));
  const name = profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || user.email;
  ui.accountName.textContent = name;
  ui.memberName.textContent = name.split(/[\s@]/)[0].toLocaleUpperCase("es");
  updateAccountAvatar(user, profile);
  ui.familyTabs.replaceChildren();
  const tabs = families.length ? families : ["pilates", "barre"];
  tabs.forEach((family) => {
    const button = document.createElement("button");
    button.className = "family-tab";
    button.type = "button";
    button.dataset.family = family;
    button.setAttribute("role", "tab");
    button.textContent = family === "barre" ? "The Nest Barre" : "The Nest Pilates";
    button.addEventListener("click", () => showBookingFamily(family));
    ui.familyTabs.appendChild(button);
  });
  const initialFamily = tabs.includes("pilates") ? "pilates" : "barre";
  showBookingFamily(initialFamily);
}

const adminWeekdays = [
  { value: 1, short: "Lun", long: "Lunes" },
  { value: 2, short: "Mar", long: "Martes" },
  { value: 3, short: "Mié", long: "Miércoles" },
  { value: 4, short: "Jue", long: "Jueves" },
  { value: 5, short: "Vie", long: "Viernes" },
];

function readAdminDraft() {
  return mergeAdminRows(Array.from(ui.scheduleAdminSlots.querySelectorAll(".schedule-admin-slot")).map((card) => ({
    id: card.dataset.slotId,
    daysOfWeek: [Number(card.querySelector("[data-slot-day]").value)],
    startTime: card.querySelector("[data-slot-time]").value,
    capacity: Number(card.querySelector("[data-slot-capacity]").value),
    active: true,
  })));
}

function validateAdminDraft(slots) {
  if (slots.length > 40) throw new Error("El horario admite como máximo 40 clases semanales.");
  const occupied = new Set();
  for (const slot of slots) {
    if (!slot.daysOfWeek.length) throw new Error(`Selecciona al menos un día para la clase de las ${slot.startTime}.`);
    if (!Number.isInteger(slot.capacity) || slot.capacity < 1 || slot.capacity > 30) {
      throw new Error(`El aforo de la clase de las ${slot.startTime} debe ser un entero entre 1 y 30.`);
    }
    for (const day of slot.daysOfWeek) {
      const key = `${day}__${slot.startTime}`;
      if (occupied.has(key)) throw new Error(`Hay dos clases el mismo día a las ${slot.startTime}. Corrige el horario.`);
      occupied.add(key);
    }
  }
}

function setAdminBusy(busy) {
  adminScheduleBusy = busy;
  ui.scheduleAdminModal.querySelectorAll("button, input, select").forEach((control) => {
    control.disabled = busy;
  });
  if (!busy) {
    ui.scheduleAdminSave.disabled = !adminScheduleLoaded;
    ui.scheduleAdminAddForm.querySelectorAll("button, input, select").forEach((control) => {
      control.disabled = !adminScheduleLoaded;
    });
  }
  ui.scheduleAdminModal.setAttribute("aria-busy", String(busy));
}

function renderAdminSlots() {
  ui.scheduleAdminSlots.replaceChildren();
  ui.scheduleAdminCount.textContent = `${expandAdminSlots(adminSlots).length} clase(s)`;
  if (!adminSlots.length) {
    const empty = document.createElement("p");
    empty.className = "schedule-admin-empty";
    empty.textContent = "No hay clases semanales. Añade una arriba.";
    ui.scheduleAdminSlots.append(empty);
    return;
  }

  expandAdminSlots(adminSlots).forEach((slot) => {
    const card = document.createElement("article");
    card.className = "schedule-admin-slot";
    card.dataset.slotId = slot.id;
    card.dataset.slotDay = String(slot.daysOfWeek[0]);

    const heading = document.createElement("div");
    heading.className = "schedule-admin-slot-heading";
    const title = document.createElement("strong");
    title.textContent = `${slot.startTime} · ${adminWeekdays
      .filter((day) => slot.daysOfWeek.includes(day.value))
      .map((day) => day.short)
      .join(", ")}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-danger-quiet";
    remove.dataset.removeSlot = slot.id;
    remove.dataset.removeDay = String(slot.daysOfWeek[0]);
    remove.textContent = "Eliminar";
    heading.append(title, remove);
    card.append(heading);

    const settings = document.createElement("div");
    settings.className = "schedule-admin-slot-settings";
    const days = document.createElement("label");
    days.textContent = "Día";
    const daySelect = document.createElement("select");
    daySelect.dataset.slotDay = "true";
    adminWeekdays.forEach((weekday) => {
      daySelect.add(new Option(weekday.long, String(weekday.value)));
    });
    daySelect.value = String(slot.daysOfWeek[0]);
    days.append(daySelect);

    const timeLabel = document.createElement("label");
    timeLabel.textContent = "Hora";
    const time = document.createElement("select");
    time.dataset.slotTime = "true";
    for (let hour = 7; hour <= 22; hour += 1) {
      const value = `${String(hour).padStart(2, "0")}:00`;
      time.add(new Option(value, value));
    }
    if (![...time.options].some((option) => option.value === slot.startTime)) {
      time.add(new Option(slot.startTime, slot.startTime));
    }
    time.value = slot.startTime;
    timeLabel.append(time);

    const capacityLabel = document.createElement("label");
    capacityLabel.textContent = "Aforo";
    const capacity = document.createElement("input");
    capacity.type = "number";
    capacity.min = "1";
    capacity.max = "30";
    capacity.step = "1";
    capacity.required = true;
    capacity.value = String(slot.capacity || 6);
    capacity.dataset.slotCapacity = "true";
    capacityLabel.append(capacity);

    settings.append(days, timeLabel, capacityLabel);
    card.append(settings);
    ui.scheduleAdminSlots.append(card);
  });
}

async function loadAdminSchedule(family) {
  if (adminScheduleBusy) return;
  adminFamily = family;
  adminScheduleDirty = false;
  adminScheduleLoaded = false;
  adminSlots = [];
  ui.scheduleAdminAddForm.reset();
  ui.scheduleAdminFamilies.querySelectorAll("[data-admin-family]").forEach((button) => {
    const selected = button.dataset.adminFamily === family;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  renderAdminSlots();
  ui.scheduleAdminMessage.textContent = "Cargando horario…";
  ui.scheduleAdminMessage.classList.remove("is-error");
  setAdminBusy(true);
  try {
    const result = await getNestAdminSchedule({ family });
    if (!Array.isArray(result.data?.slots) || !Number.isInteger(result.data.version)) {
      throw new Error("La función de administración no devuelve un horario válido. Comprueba que está desplegada la versión actual.");
    }
    adminScheduleVersion = result.data.version;
    adminScheduleLoaded = true;
    adminSlots = (result.data.slots || []).map((slot) => ({
      ...slot,
      daysOfWeek: Array.from(new Set((slot.daysOfWeek || []).map(Number))).filter((day) => day >= 1 && day <= 5),
      capacity: Number(slot.capacity) || 6,
    }));
    renderAdminSlots();
    ui.scheduleAdminMessage.textContent = "Puedes cambiar días, hora y aforo. Guarda para aplicar el horario.";
    ui.scheduleAdminFamilies.querySelectorAll("[data-admin-family]").forEach((button) => {
      const selected = button.dataset.adminFamily === family;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  } catch (error) {
    console.error("Error loading The Nest admin schedule:", error);
    ui.scheduleAdminSlots.replaceChildren();
    ui.scheduleAdminMessage.textContent = getCallableMessage(error);
    ui.scheduleAdminMessage.classList.add("is-error");
  } finally {
    setAdminBusy(false);
    ui.scheduleAdminClose.focus();
  }
}

function openAdminSchedule() {
  if (!activeUser || !staffRoles.has(activeProfile?.role)) return;
  const selectedTab = document.querySelector(".family-tab.is-active[data-family]");
  adminFamily = selectedTab?.dataset.family || "pilates";
  ui.scheduleAdminModal.classList.remove("hidden");
  loadAdminSchedule(adminFamily);
}

function closeAdminSchedule() {
  if (adminScheduleBusy) return;
  if (adminScheduleDirty && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos?")) return;
  ui.scheduleAdminModal.classList.add("hidden");
  adminScheduleDirty = false;
  ui.scheduleAdminOpen.focus();
}

ui.scheduleAdminOpen.addEventListener("click", openAdminSchedule);
ui.scheduleAdminClose.addEventListener("click", closeAdminSchedule);
ui.scheduleAdminCancel.addEventListener("click", closeAdminSchedule);
$("scheduleAdminReload").addEventListener("click", () => {
  if (adminScheduleDirty && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos y recargar?")) return;
  loadAdminSchedule(adminFamily);
});
ui.scheduleAdminModal.addEventListener("click", (event) => {
  if (event.target === ui.scheduleAdminModal) closeAdminSchedule();
});
ui.scheduleAdminFamilies.addEventListener("click", (event) => {
  if (adminScheduleBusy) return;
  const tab = event.target.closest("[data-admin-family]");
  if (!tab || tab.dataset.adminFamily === adminFamily) return;
  if (adminScheduleDirty && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos y cambiar de disciplina?")) return;
  loadAdminSchedule(tab.dataset.adminFamily);
});
ui.scheduleAdminSlots.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-slot]");
  if (!remove || adminScheduleBusy || !adminScheduleLoaded) return;
  const card = remove.closest(".schedule-admin-slot");
  card.remove();
  adminSlots = readAdminDraft();
  adminScheduleDirty = true;
  renderAdminSlots();
  ui.scheduleAdminMessage.textContent = "Clase marcada para eliminar. Guarda los cambios para aplicar.";
});
ui.scheduleAdminAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (adminScheduleBusy || !adminScheduleLoaded) return;
  const daysOfWeek = Array.from(ui.scheduleAdminAddForm.querySelectorAll('[name="dayOfWeek"]:checked'))
    .map((checkbox) => Number(checkbox.value));
  if (!daysOfWeek.length) {
    ui.scheduleAdminMessage.textContent = "Selecciona al menos un día laborable.";
    ui.scheduleAdminMessage.classList.add("is-error");
    return;
  }
  const startTime = ui.scheduleAdminAddTime.value;
  const capacity = Number(ui.scheduleAdminAddCapacity.value);
  adminSlots = readAdminDraft();
  try {
    validateAdminDraft([...adminSlots, { daysOfWeek, startTime, capacity }]);
  } catch (error) {
    showMessage(ui.scheduleAdminMessage, error.message, true);
    return;
  }
  if (adminSlots.length >= 40 || adminSlots.some((slot) => slot.startTime === startTime &&
      daysOfWeek.some((day) => slot.daysOfWeek.includes(day)))) {
    showMessage(ui.scheduleAdminMessage, "Máximo 40 clases y una sola clase por día y hora.", true);
    return;
  }
  const createId = globalThis.crypto?.randomUUID
    ? `managed-${crypto.randomUUID()}`
    : `managed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  adminSlots.push({ id: createId, daysOfWeek, startTime, capacity, active: true });
  adminScheduleDirty = true;
  renderAdminSlots();
  ui.scheduleAdminAddForm.reset();
  ui.scheduleAdminMessage.textContent = "Clase añadida al borrador. Pulsa «Guardar cambios» para aplicar.";
  ui.scheduleAdminMessage.classList.remove("is-error");
});
ui.scheduleAdminSlots.addEventListener("input", () => { adminScheduleDirty = true; });
ui.scheduleAdminSlots.addEventListener("change", () => { adminScheduleDirty = true; });
ui.scheduleAdminSave.addEventListener("click", async () => {
  if (adminScheduleBusy || !adminScheduleLoaded) return;
  const slots = readAdminDraft();
  try {
    validateAdminDraft(slots);
  } catch (error) {
    showMessage(ui.scheduleAdminMessage, error.message, true);
    return;
  }
  if (!slots.length && !window.confirm("Vas a eliminar todas las clases semanales de esta disciplina. ¿Guardar el horario vacío?")) return;
  const saveButton = ui.scheduleAdminSave;
  const oldText = saveButton.textContent;
  setAdminBusy(true);
  ui.scheduleAdminMessage.textContent = "Guardando horario…";
  ui.scheduleAdminMessage.classList.remove("is-error");
  try {
    const request = { family: adminFamily, slots, version: adminScheduleVersion };
    let result;
    try {
      result = await saveNestAdminSchedule(request);
    } catch (error) {
      if (!error.details?.requiresDeletionConfirmation) throw error;
      const affected = error.details.affectedClasses;
      const descriptions = affected.map((entry) => `${adminWeekdays.find((day) => day.value === entry.dayOfWeek)?.long} ${entry.startTime}: ${entry.reservationCount} reserva(s)`);
      if (!window.confirm(`ATENCIÓN: estas clases tienen reservas futuras:\n\n${descriptions.join("\n")}\n\nSe eliminarán de todas las semanas y se cancelarán sus reservas, devolviendo las sesiones al bono. El resto de días y el historial pasado se conservarán.\n\n¿Aceptar y eliminar?`)) {
        ui.scheduleAdminMessage.textContent = "Eliminación no confirmada. No se ha guardado ningún cambio.";
        return;
      }
      result = await saveNestAdminSchedule({ ...request, confirmDeletedClasses: affected });
    }
    adminScheduleVersion = result.data.version;
    adminSlots = result.data.slots;
    adminScheduleDirty = false;
    renderAdminSlots();
    ui.scheduleAdminMessage.textContent = result.data.cancelledBookings
      ? `Horario guardado. ${result.data.cancelledBookings} reserva(s) cancelada(s) y sesiones devueltas al bono.`
      : "Horario guardado. Las reservas existentes se han conservado.";
    showToast("Horario actualizado", "success");
    await showBookingFamily(adminFamily, { forceRefresh: true });
  } catch (error) {
    console.error("Error saving The Nest admin schedule:", error);
    ui.scheduleAdminMessage.textContent = getCallableMessage(error);
    ui.scheduleAdminMessage.classList.add("is-error");
  } finally {
    setAdminBusy(false);
    saveButton.textContent = oldText;
  }
});
document.addEventListener("keydown", (event) => {
  if (ui.scheduleAdminModal.classList.contains("hidden")) return;
  if (event.key === "Escape") closeAdminSchedule();
  if (event.key !== "Tab") return;
  const controls = Array.from(ui.scheduleAdminModal.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)"));
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});

for (let hour = 7; hour <= 22; hour += 1) {
  const value = `${String(hour).padStart(2, "0")}:00`;
  ui.scheduleAdminAddTime.add(new Option(value, value));
}

function openProfileSettings() {
  if (!activeUser) return;
  pendingPhotoUrl = activeProfile?.photoUrl || activeUser.photoURL || "";
  ui.profilePhotoFile.value = "";
  ui.profileSettingsMessage.textContent = "";
  ui.profileSettingsMessage.classList.remove("is-error");
  showProfilePhotoPreview(pendingPhotoUrl);
  ui.profileSettingsModal.classList.remove("hidden");
}

function closeProfileSettings() {
  ui.profileSettingsModal.classList.add("hidden");
  ui.profilePhotoFile.value = "";
}

document.querySelectorAll("#profileSettingsBtn, #profileSettingsTextBtn").forEach((button) => {
  button.addEventListener("click", openProfileSettings);
});
$("profileSettingsClose")?.addEventListener("click", closeProfileSettings);
$("profileSettingsCancel")?.addEventListener("click", closeProfileSettings);
ui.profileSettingsModal?.addEventListener("click", (event) => {
  if (event.target === ui.profileSettingsModal) closeProfileSettings();
});
$("profilePhotoRemove")?.addEventListener("click", () => {
  pendingPhotoUrl = "";
  ui.profilePhotoFile.value = "";
  showProfilePhotoPreview("");
});
ui.profilePhotoFile?.addEventListener("change", async () => {
  const file = ui.profilePhotoFile.files?.[0];
  if (!file) return;
  ui.profileSettingsMessage.textContent = "Preparando la foto…";
  ui.profileSettingsMessage.classList.remove("is-error");
  try {
    pendingPhotoUrl = await compressProfilePhoto(file);
    showProfilePhotoPreview(pendingPhotoUrl);
    ui.profileSettingsMessage.textContent = "Vista previa lista. Pulsa «Guardar foto» para aplicarla.";
  } catch (error) {
    ui.profileSettingsMessage.textContent = error.message || "No se pudo procesar la imagen.";
    ui.profileSettingsMessage.classList.add("is-error");
    ui.profilePhotoFile.value = "";
  }
});
ui.profileSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeUser) return;
  const saveButton = ui.profileSettingsForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  ui.profileSettingsMessage.textContent = "Guardando…";
  ui.profileSettingsMessage.classList.remove("is-error");
  try {
    await updateDoc(doc(db, "users", activeUser.uid), {
      photoUrl: pendingPhotoUrl,
      updatedAt: serverTimestamp(),
    });
    activeProfile = { ...activeProfile, photoUrl: pendingPhotoUrl };
    updateAccountAvatar(activeUser, activeProfile);
    closeProfileSettings();
    showToast("Foto de perfil actualizada", "success");
    document.dispatchEvent(new CustomEvent("nest-profile-photo-updated", {
      detail: { photoUrl: pendingPhotoUrl },
    }));
  } catch (error) {
    console.error("Error saving The Nest profile photo:", error);
    ui.profileSettingsMessage.textContent = getCallableMessage(error);
    ui.profileSettingsMessage.classList.add("is-error");
  } finally {
    saveButton.disabled = false;
  }
});

function showPending(user, message) {
  ui.welcome.classList.add("hidden");
  ui.booking.classList.add("hidden");
  ui.pending.classList.remove("hidden");
  ui.accountBar.classList.remove("hidden");
  ui.accountName.textContent = user.displayName || user.email || "Cuenta";
  ui.pendingMessage.textContent = message || "No encontramos una ficha de Pilates o Barre asociada a este correo. Contacta con recepción para completar tu alta.";
  ui.resendVerification.classList.toggle("hidden", Boolean(user.emailVerified));
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("emailLoginBtn");
  button.disabled = true;
  showMessage(ui.authMessage, "Entrando…");
  try {
    await signInWithEmailAndPassword(auth, $("emailInput").value.trim(), $("passwordInput").value);
    $("loginForm").reset();
    showMessage(ui.authMessage, "");
  } catch (error) {
    showMessage(ui.authMessage, getAuthMessage(error), true);
  } finally {
    button.disabled = false;
  }
});

$("googleLoginBtn").addEventListener("click", async () => {
  showMessage(ui.authMessage, "Conectando con Google…");
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    showMessage(ui.authMessage, "");
  } catch (error) {
    showMessage(ui.authMessage, getAuthMessage(error), true);
  }
});

$("passwordResetBtn").addEventListener("click", async () => {
  const email = $("emailInput").value.trim().toLowerCase();
  if (!email) {
    showMessage(ui.authMessage, "Escribe tu correo en el campo de acceso y vuelve a pulsar «He olvidado mi contraseña».", true);
    $("emailInput").focus();
    return;
  }
  const button = $("passwordResetBtn");
  button.disabled = true;
  showMessage(ui.authMessage, "Enviando enlace de recuperación…");
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage(ui.authMessage, "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.");
  } catch (error) {
    showMessage(ui.authMessage, getAuthMessage(error), true);
  } finally {
    button.disabled = false;
  }
});

ui.resendVerification.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || user.emailVerified) return;
  ui.resendVerification.disabled = true;
  try {
    await sendEmailVerification(user);
    ui.pendingMessage.textContent = "Te hemos enviado un enlace nuevo. Verifica tu correo y vuelve a iniciar sesión.";
    await signOut(auth);
  } catch (error) {
    ui.pendingMessage.textContent = getAuthMessage(error);
  } finally {
    ui.resendVerification.disabled = false;
  }
});

$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const email = $("signupEmail").value.trim().toLowerCase();
  authActionInProgress = true;
  button.disabled = true;
  showMessage(ui.signupMessage, "Comprobando el correo en la ficha de The Nest…");
  try {
    const eligibility = await checkNestSignupEmail({ email });
    if (!eligibility.data?.eligible) {
      showMessage(ui.signupMessage, getSignupEligibilityMessage(eligibility.data?.reason), true);
      return;
    }

    showMessage(ui.signupMessage, "El correo está registrado. Creando cuenta…");
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      $("signupPassword").value
    );
    await sendEmailVerification(credential.user);
    await signOut(auth);
    form.reset();
    showMessage(ui.signupMessage, "Te enviamos un correo para verificar tu dirección. Después, vuelve e inicia sesión.");
  } catch (error) {
    showMessage(ui.signupMessage, getAuthMessage(error), true);
  } finally {
    authActionInProgress = false;
    button.disabled = false;
    await loginStateChanged(auth.currentUser);
  }
});

async function loginStateChanged(user) {
  if (authActionInProgress) return;
  activeUser = null;
  activeProfile = null;
  adminScheduleDirty = false;
  ui.scheduleAdminModal.classList.add("hidden");
  ui.scheduleAdminOpen.classList.add("hidden");
  if (!user) {
    ui.welcome.classList.remove("hidden");
    ui.booking.classList.add("hidden");
    ui.pending.classList.add("hidden");
    ui.accountBar.classList.add("hidden");
    return;
  }
  authActionInProgress = true;
  ui.welcome.classList.add("hidden");
  ui.booking.classList.add("hidden");
  ui.pending.classList.remove("hidden");
  ui.pendingMessage.textContent = "Comprobando tu ficha y tus disciplinas…";
  ui.accountBar.classList.remove("hidden");
  ui.accountName.textContent = user.email || "Cuenta";
  try {
    const { data, message } = await resolveAccess(user);
    const profile = data || {};
    if (staffRoles.has(profile.role) || ["NEST_STUDENT", "NEST_INSTRUCTOR"].includes(profile.role)) {
      if (profile.mustChangePassword) {
        showPending(user, "Por seguridad, primero debes cambiar tu contraseña al entrar en OwlManage. Luego vuelve a esta página.");
      } else {
        renderAuthorizedPortal(user, profile);
      }
    } else {
      showPending(user, message || "No encontramos una ficha de Pilates o Barre asociada a este correo. Contacta con recepción para completar tu alta.");
    }
  } catch (error) {
    console.error("Error checking The Nest access:", error);
    showPending(user, getCallableMessage(error));
  } finally {
    authActionInProgress = false;
  }
}

$("logoutBtn").addEventListener("click", () => signOut(auth));
$("pendingLogoutBtn").addEventListener("click", () => signOut(auth));

await setPersistence(auth, browserLocalPersistence);
onAuthStateChanged(auth, (user) => {
  loginStateChanged(user).catch((error) => {
    console.error("Unexpected reservation portal error:", error);
    showPending(user, "No se pudo cargar el portal. Cierra sesión e inténtalo otra vez.");
  });
});
