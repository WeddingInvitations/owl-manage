
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  runTransaction,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

// --- Pagos empleados ---
export async function addEmployeePayment({ name, amount, method, date, userId }) {
  await addDoc(collection(db, "employee_payments"), {
    name,
    amount: Number(amount),
    method,
    date,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function loadEmployeePayments() {
  const snap = await getDocs(collection(db, "employee_payments"));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
});

function parseRecordDate(data) {
  if (data.date) {
    return new Date(`${data.date}T00:00:00`);
  }
  if (data.createdAt && typeof data.createdAt.toDate === "function") {
    return data.createdAt.toDate();
  }
  return null;
}

function getMonthKey(date) {
  if (!date) return "sin-fecha";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function getMonthLabel(key) {
  if (key === "sin-fecha") return "Sin fecha";
  const date = new Date(`${key}-01T00:00:00`);
  return monthFormatter.format(date);
}

export async function addPayment(concept, amount, date, userId) {
  await addDoc(collection(db, "payments"), {
    concept,
    amount,
    date,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function updatePayment(paymentId, concept, amount, date, userId) {
  await updateDoc(doc(db, "payments", paymentId), {
    concept,
    amount,
    date,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function deletePayment(paymentId) {
  await deleteDoc(doc(db, "payments", paymentId));
}

export async function getPayment(paymentId) {
  const docSnap = await getDoc(doc(db, "payments", paymentId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

// Función especial para pagos de caja: busca un pago existente de "Ventas Caja" 
// para la fecha dada y lo actualiza sumando el monto, o crea uno nuevo si no existe
export async function addOrUpdateCajaPayment(amount, date, userId) {
  const concept = "Ventas Caja";
  
  // Buscar si ya existe un pago de "Ventas Caja" para esta fecha
  const q = query(
    collection(db, "payments"),
    where("concept", "==", concept),
    where("date", "==", date)
  );
  
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    // Ya existe un pago de caja para esta fecha, actualizarlo
    const existingDoc = snapshot.docs[0];
    const existingData = existingDoc.data();
    const newAmount = Number(existingData.amount || 0) + Number(amount);
    
    await updateDoc(doc(db, "payments", existingDoc.id), {
      amount: newAmount,
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    });
  } else {
    // No existe, crear uno nuevo
    await addDoc(collection(db, "payments"), {
      concept,
      amount: Number(amount),
      date,
      createdAt: serverTimestamp(),
      createdBy: userId || null,
    });
  }
}

export async function addExpense(concept, amount, date, userId) {
  await addDoc(collection(db, "expenses"), {
    concept,
    amount,
    date,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function updateExpense(expenseId, concept, amount, date, userId) {
  await updateDoc(doc(db, "expenses", expenseId), {
    concept,
    amount,
    date,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function deleteExpense(expenseId) {
  await deleteDoc(doc(db, "expenses", expenseId));
}

export async function getExpense(expenseId) {
  const docSnap = await getDoc(doc(db, "expenses", expenseId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

export async function addOrder(supplier, price, date, document, userId) {
  await addDoc(collection(db, "orders"), {
    supplier,
    price,
    date,
    document: document || "",
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function updateOrder(orderId, supplier, price, date, document, userId) {
  await updateDoc(doc(db, "orders", orderId), {
    supplier,
    price,
    date,
    document: document || "",
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function deleteOrder(orderId) {
  await deleteDoc(doc(db, "orders", orderId));
}

export async function getOrder(orderId) {
  const docSnap = await getDoc(doc(db, "orders", orderId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

function normalizeInventoryItemName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function getInventoryDocId(itemName) {
  return normalizeInventoryItemName(itemName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "ITEM";
}

async function adjustInventoryStock({ itemName, quantityDelta, date, note, movementType, userId }) {
  const normalizedName = normalizeInventoryItemName(itemName);
  const delta = Number(quantityDelta);

  if (!normalizedName) {
    throw new Error("El nombre de producto es obligatorio");
  }
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("El movimiento de stock debe ser distinto de 0");
  }

  const docId = getInventoryDocId(normalizedName);
  const inventoryRef = doc(db, "inventory", docId);
  const movementDate = date || new Date().toISOString().slice(0, 10);

  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(inventoryRef);
    const currentData = snap.exists() ? snap.data() : null;
    const currentStock = Number(currentData?.stock || 0);
    const nextStock = currentStock + delta;

    if (nextStock < 0) {
      throw new Error(`Stock insuficiente para ${normalizedName}. Stock actual: ${currentStock}`);
    }

    const payload = {
      name: currentData?.name || normalizedName,
      nameKey: normalizedName,
      stock: nextStock,
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    };

    if (snap.exists()) {
      transaction.update(inventoryRef, payload);
    } else {
      transaction.set(inventoryRef, {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: userId || null,
      });
    }

    return {
      itemName: payload.name,
      itemKey: normalizedName,
      stockBefore: currentStock,
      stockAfter: nextStock,
      movementDate,
    };
  });

  await addDoc(collection(db, "inventory_movements"), {
    itemName: result.itemName,
    itemKey: result.itemKey,
    quantityChange: delta,
    stockBefore: result.stockBefore,
    stockAfter: result.stockAfter,
    movementType,
    date: result.movementDate,
    note: note || "",
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });

  return result;
}

export async function addInventoryStock({ itemName, units, date, note, userId }) {
  const quantity = Number(units);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Las unidades deben ser mayores que 0");
  }
  return adjustInventoryStock({
    itemName,
    quantityDelta: quantity,
    date,
    note,
    movementType: "RESTOCK",
    userId,
  });
}

export async function consumeInventoryStock({ itemName, units, date, note, userId }) {
  const quantity = Number(units);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Las unidades vendidas deben ser mayores que 0");
  }
  return adjustInventoryStock({
    itemName,
    quantityDelta: -quantity,
    date,
    note,
    movementType: "SALE",
    userId,
  });
}

export async function removeInventoryStock({ itemName, units, date, note, userId }) {
  const quantity = Number(units);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Las unidades a restar deben ser mayores que 0");
  }
  return adjustInventoryStock({
    itemName,
    quantityDelta: -quantity,
    date,
    note,
    movementType: "REMOVAL",
    userId,
  });
}

export async function getInventoryItems() {
  const snap = await getDocs(collection(db, "inventory"));
  const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" }));
  return items;
}

export async function getInventoryMovements(maxItems = 100) {
  const q = query(
    collection(db, "inventory_movements"),
    orderBy("createdAt", "desc"),
    limit(maxItems)
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function deleteInventoryItem(itemId) {
  await deleteDoc(doc(db, "inventory", itemId));
}

export async function openCheckin(userId, userEmail, userName = "", deviceInfo = {}) {
  const docRef = await addDoc(collection(db, "checkins"), {
    userId,
    userEmail,
    userName,
    checkInTime: serverTimestamp(),
    checkOutTime: null,
    status: "open",
    createdAt: serverTimestamp(),
    // Device/IP info
    deviceInfo: {
      userAgent: deviceInfo.userAgent || navigator.userAgent || "",
      platform: deviceInfo.platform || navigator.platform || "",
      language: deviceInfo.language || navigator.language || "",
      screenWidth: deviceInfo.screenWidth || window.screen?.width || 0,
      screenHeight: deviceInfo.screenHeight || window.screen?.height || 0,
    },
    // Audit trail - original values preserved
    originalCheckInTime: null, // Will be set by trigger or stays null if never modified
    modificationHistory: [], // Array of modification records
  });
  return docRef.id;
}

export async function closeCheckin(checkinId, deviceInfo = {}) {
  const ref = doc(db, "checkins", checkinId);
  await updateDoc(ref, {
    checkOutTime: serverTimestamp(),
    status: "closed",
    closeDeviceInfo: {
      userAgent: deviceInfo.userAgent || navigator.userAgent || "",
      platform: deviceInfo.platform || navigator.platform || "",
      language: deviceInfo.language || navigator.language || "",
      screenWidth: deviceInfo.screenWidth || window.screen?.width || 0,
      screenHeight: deviceInfo.screenHeight || window.screen?.height || 0,
    },
  });
}

// Modify a checkin with full audit trail
export async function modifyCheckin(checkinId, updates, modifiedBy, reason) {
  const ref = doc(db, "checkins", checkinId);
  const docSnap = await getDoc(ref);
  
  if (!docSnap.exists()) {
    throw new Error("Fichaje no encontrado");
  }
  
  const currentData = docSnap.data();
  const now = new Date();
  
  // Build modification record
  const modificationRecord = {
    modifiedAt: now.toISOString(),
    modifiedBy: modifiedBy, // userId or email of modifier
    reason: reason || "",
    previousValues: {},
  };
  
  // Store previous values for audit
  if (updates.checkInTime !== undefined) {
    modificationRecord.previousValues.checkInTime = currentData.checkInTime?.toDate?.()?.toISOString() || null;
  }
  if (updates.checkOutTime !== undefined) {
    modificationRecord.previousValues.checkOutTime = currentData.checkOutTime?.toDate?.()?.toISOString() || null;
  }
  if (updates.status !== undefined) {
    modificationRecord.previousValues.status = currentData.status;
  }
  
  // Preserve original checkInTime if this is first modification
  const originalCheckInTime = currentData.originalCheckInTime || 
    (currentData.checkInTime?.toDate?.()?.toISOString() || null);
  
  // Get existing modification history
  const existingHistory = currentData.modificationHistory || [];
  
  // Convert Date objects to Firestore Timestamps
  const firestoreUpdates = { ...updates };
  if (updates.checkInTime instanceof Date) {
    firestoreUpdates.checkInTime = Timestamp.fromDate(updates.checkInTime);
  }
  if (updates.checkOutTime instanceof Date) {
    firestoreUpdates.checkOutTime = Timestamp.fromDate(updates.checkOutTime);
  }
  
  // Prepare update object
  const updateData = {
    ...firestoreUpdates,
    originalCheckInTime,
    modificationHistory: [...existingHistory, modificationRecord],
    lastModifiedAt: serverTimestamp(),
    lastModifiedBy: modifiedBy,
  };
  
  await updateDoc(ref, updateData);
  return { id: checkinId, ...currentData, ...updateData };
}

// Get checkin with full details including modification history
export async function getCheckinWithHistory(checkinId) {
  const docSnap = await getDoc(doc(db, "checkins", checkinId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

// Get checkins for a specific user in a date range (for export)
export async function getCheckinsForUserInRange(userId, startDate, endDate) {
  const q = query(
    collection(db, "checkins"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  const checkins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
  return checkins.filter((c) => {
    const checkInTime = c.checkInTime?.toDate?.();
    if (!checkInTime) return false;
    return checkInTime >= startDate && checkInTime <= endDate;
  });
}

// Get all checkins in a date range (for admin export)
export async function getAllCheckinsInRange(startDate, endDate) {
  const snap = await getDocs(collection(db, "checkins"));
  const checkins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
  return checkins.filter((c) => {
    const checkInTime = c.checkInTime?.toDate?.();
    if (!checkInTime) return false;
    return checkInTime >= startDate && checkInTime <= endDate;
  });
}

export async function getOpenCheckinForUser(userId) {
  const q = query(
    collection(db, "checkins"),
    where("userId", "==", userId),
    where("status", "==", "open")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

export async function getLastCheckinForUser(userId) {
  const q = query(
    collection(db, "checkins"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  
  const checkins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  checkins.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  return checkins[0] || null;
}

export async function getCheckinsForUser(userId) {
  const q = query(
    collection(db, "checkins"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllCheckins() {
  const snap = await getDocs(collection(db, "checkins"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Vacaciones (vacations) ----------
export async function addVacation(userId, userName, startDateISO, endDateISO, reason, createdBy) {
  const docRef = await addDoc(collection(db, "vacations"), {
    userId,
    userName,
    startDate: startDateISO,
    endDate: endDateISO,
    reason: reason || "",
    createdAt: serverTimestamp(),
    createdBy: createdBy || null,
  });
  return docRef.id;
}

export async function getVacationsForUser(userId) {
  const q = query(collection(db, "vacations"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getVacationsForAll() {
  const snap = await getDocs(collection(db, "vacations"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteVacation(vacationId) {
  await deleteDoc(doc(db, "vacations", vacationId));
}

// Función para actualizar vacaciones existentes
export async function updateVacation(vacationId, userId, userName, startDateISO, endDateISO, reason) {
  const vacationRef = doc(db, "vacations", vacationId);
  await updateDoc(vacationRef, {
    userId,
    userName,
    startDate: startDateISO,
    endDate: endDateISO,
    reason: reason || "",
    updatedAt: serverTimestamp(),
  });
}


// Return a list of national + Comunidad de Madrid fixed holidays for a given year
export function getHolidaysForYear(year) {
  const y = Number(year) || new Date().getFullYear();
  // Basic fixed-date Spanish national holidays + Comunidad de Madrid extras
  const list = [
    { date: `${y}-01-01`, name: "Año Nuevo" },
    { date: `${y}-01-06`, name: "Reyes Magos" },
    { date: `${y}-05-01`, name: "Día del Trabajo" },
    { date: `${y}-08-15`, name: "Asunción" },
    { date: `${y}-10-12`, name: "Fiesta Nacional de España" },
    { date: `${y}-11-01`, name: "Todos los Santos" },
    { date: `${y}-12-06`, name: "Día de la Constitución" },
    { date: `${y}-12-08`, name: "Inmaculada Concepción" },
    { date: `${y}-12-25`, name: "Navidad" },
    // Comunidad de Madrid specific
    { date: `${y}-05-02`, name: "Día de la Comunidad de Madrid" },
    { date: `${y}-05-15`, name: "San Isidro (Madrid)" },
  ];
  return list;
}

export async function addTraining(title, date, coach, userId) {
  await addDoc(collection(db, "trainings"), {
    title,
    date,
    coach,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function addAthlete(name, status, userId) {
  await addDoc(collection(db, "athletes"), {
    name,
    lastPaymentAt: null,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function createAthlete(name, userId) {
  const docRef = await addDoc(collection(db, "athletes"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function updateAthlete(athleteId, athleteData, userId) {
  await updateDoc(doc(db, "athletes", athleteId), {
    ...athleteData,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function getAthletes() {
  const snap = await getDocs(collection(db, "athletes"));
  const athletes = [];
  snap.forEach((docSnap) => {
    athletes.push({ id: docSnap.id, ...docSnap.data() });
  });
  return athletes;
}

export async function getAthleteMonth(athleteId, month) {
  const snap = await getDocs(
    query(
      collection(db, "athlete_months"),
      where("athleteId", "==", athleteId),
      where("month", "==", month)
    )
  );
  let record = null;
  snap.forEach((docSnap) => {
    record = { id: docSnap.id, ...docSnap.data() };
  });
  return record;
}

export async function upsertAthleteMonth(athleteId, month, payload, userId) {
  const snap = await getDocs(
    query(
      collection(db, "athlete_months"),
      where("athleteId", "==", athleteId),
      where("month", "==", month)
    )
  );
  let docId = null;
  snap.forEach((docSnap) => {
    docId = docSnap.id;
  });

  if (docId) {
    await updateDoc(doc(db, "athlete_months", docId), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    });
    return docId;
  }

  const docRef = await addDoc(collection(db, "athlete_months"), {
    athleteId,
    month,
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function getAthleteMonthsForMonth(month) {
  const snap = await getDocs(
    query(collection(db, "athlete_months"), where("month", "==", month))
  );
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function getAllAthleteMonths() {
  const snap = await getDocs(collection(db, "athlete_months"));
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function loadList(collectionName, target, formatter) {
  if (!target) return;
  const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  target.innerHTML = "";
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.textContent = formatter(data);
    target.appendChild(li);
  });
}

export async function loadGroupedList(collectionName, target, formatter) {
  if (!target) return;
  const snap = await getDocs(collection(db, collectionName));
  const items = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const date = parseRecordDate(data);
    items.push({ data, date });
  });

  items.sort((a, b) => {
    const aTime = a.date ? a.date.getTime() : 0;
    const bTime = b.date ? b.date.getTime() : 0;
    return bTime - aTime;
  });

  target.innerHTML = "";
  let currentKey = null;

  items.forEach((item) => {
    const key = getMonthKey(item.date);
    if (key !== currentKey) {
      currentKey = key;
      const header = document.createElement("li");
      header.className = "list-header";
      header.textContent = getMonthLabel(key);
      target.appendChild(header);
    }
    const li = document.createElement("li");
    li.textContent = formatter(item.data, item.date);
    target.appendChild(li);
  });
}

export async function getPaymentMonthsWithAthletes() {
  const paymentSnap = await getDocs(collection(db, "payments"));
  const athleteSnap = await getDocs(collection(db, "athlete_months"));
  const months = new Set();

  paymentSnap.forEach((docSnap) => {
    const date = parseRecordDate(docSnap.data());
    const key = getMonthKey(date);
    months.add(key);
  });

  athleteSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    const key = data.month || "sin-fecha";
    months.add(key);
  });

  return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
}

export async function loadPaymentsWithAthleteTotals(
  target,
  formatCurrency,
  monthKey = "",
  onEdit = null,
  onDelete = null
) {
  if (!target) return;
  const paymentSnap = await getDocs(collection(db, "payments"));
  const athleteSnap = await getDocs(collection(db, "athlete_months"));
  const acroSnap = await getDocs(collection(db, "athlete_acrobacias_months"));
  const halteSnap = await getDocs(collection(db, "athlete_halterofilia_months"));
  const telasSnap = await getDocs(collection(db, "athlete_telas_months"));
  const items = [];

  paymentSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const date = parseRecordDate(data);
    items.push({ id: docSnap.id, data, date, editable: true });
  });

  const athleteTotals = new Map();
  athleteSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = athleteTotals.get(key) || 0;
    athleteTotals.set(key, current + amount);
  });

  const acroTotals = new Map();
  acroSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = acroTotals.get(key) || 0;
    acroTotals.set(key, current + amount);
  });

  const halteTotals = new Map();
  halteSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = halteTotals.get(key) || 0;
    halteTotals.set(key, current + amount);
  });

  athleteTotals.forEach((total, key) => {
    const date = key === "sin-fecha" ? null : new Date(`${key}-01T00:00:00`);
    items.push({
      id: null,
      data: {
        concept: "Cuotas atletas (total)",
        date: key === "sin-fecha" ? "" : `${key}-01`,
        amount: total,
      },
      date,
      editable: false,
    });
  });

  acroTotals.forEach((total, key) => {
    const date = key === "sin-fecha" ? null : new Date(`${key}-01T00:00:00`);
    items.push({
      id: null,
      data: {
        concept: "Cuotas acrobacias (total)",
        date: key === "sin-fecha" ? "" : `${key}-01`,
        amount: total,
      },
      date,
      editable: false,
    });
  });

  halteTotals.forEach((total, key) => {
    const date = key === "sin-fecha" ? null : new Date(`${key}-01T00:00:00`);
    items.push({
      id: null,
      data: {
        concept: "Cuotas halterofilia (total)",
        date: key === "sin-fecha" ? "" : `${key}-01`,
        amount: total,
      },
      date,
      editable: false,
    });
  });

  const telasTotals = new Map();
  telasSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = telasTotals.get(key) || 0;
    telasTotals.set(key, current + amount);
  });

  telasTotals.forEach((total, key) => {
    const date = key === "sin-fecha" ? null : new Date(`${key}-01T00:00:00`);
    items.push({
      id: null,
      data: {
        concept: "Cuotas telas (total)",
        date: key === "sin-fecha" ? "" : `${key}-01`,
        amount: total,
      },
      date,
      editable: false,
    });
  });

  const filtered = monthKey
    ? items.filter((item) => getMonthKey(item.date) === monthKey)
    : items;

  filtered.sort((a, b) => {
    const aTime = a.date ? a.date.getTime() : 0;
    const bTime = b.date ? b.date.getTime() : 0;
    return bTime - aTime;
  });

  target.innerHTML = "";
  let currentKey = null;
  filtered.forEach((item) => {
    const key = getMonthKey(item.date);
    if (key !== currentKey) {
      currentKey = key;
      const header = document.createElement("li");
      header.className = "list-header";
      header.textContent = getMonthLabel(key);
      target.appendChild(header);
    }
    const li = document.createElement("li");
    const textSpan = document.createElement("span");
    textSpan.textContent = `${item.data.concept || ""} · ${item.data.date || (item.date ? item.date.toLocaleDateString("es-ES") : "")} · ${formatCurrency(Number(item.data.amount || 0))}`;
    li.appendChild(textSpan);
    
    if (item.editable && item.id) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "record-actions";
      
      const editBtn = document.createElement("button");
      editBtn.className = "btn-icon btn-edit";
      editBtn.innerHTML = "✏️";
      editBtn.title = "Editar";
      editBtn.onclick = () => onEdit && onEdit(item.id, item.data);
      
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-icon btn-delete";
      deleteBtn.innerHTML = "🗑️";
      deleteBtn.title = "Eliminar";
      deleteBtn.onclick = () => onDelete && onDelete(item.id, item.data);
      
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      li.appendChild(actionsDiv);
    }
    
    target.appendChild(li);
  });
}

export async function getExpenseMonths() {
  const expenseSnap = await getDocs(collection(db, "expenses"));
  const months = new Set();

  expenseSnap.forEach((docSnap) => {
    const date = parseRecordDate(docSnap.data());
    const key = getMonthKey(date);
    months.add(key);
  });

  return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
}

export async function loadExpensesForMonth(target, formatCurrency, monthKey = "", onEdit = null, onDelete = null) {
  if (!target) return;
  const expenseSnap = await getDocs(collection(db, "expenses"));
  const items = [];

  expenseSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const date = parseRecordDate(data);
    items.push({ id: docSnap.id, data, date });
  });

  const filtered = monthKey
    ? items.filter((item) => getMonthKey(item.date) === monthKey)
    : items;

  filtered.sort((a, b) => {
    const aTime = a.date ? a.date.getTime() : 0;
    const bTime = b.date ? b.date.getTime() : 0;
    return bTime - aTime;
  });

  target.innerHTML = "";
  let currentKey = null;
  filtered.forEach((item) => {
    const key = getMonthKey(item.date);
    if (key !== currentKey) {
      currentKey = key;
      const header = document.createElement("li");
      header.className = "list-header";
      header.textContent = getMonthLabel(key);
      target.appendChild(header);
    }
    const li = document.createElement("li");
    const textSpan = document.createElement("span");
    textSpan.textContent = `${item.data.concept || ""} · ${item.data.date || (item.date ? item.date.toLocaleDateString("es-ES") : "")} · ${formatCurrency(Number(item.data.amount || 0))}`;
    li.appendChild(textSpan);
    
    if (item.id) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "record-actions";
      
      const editBtn = document.createElement("button");
      editBtn.className = "btn-icon btn-edit";
      editBtn.innerHTML = "✏️";
      editBtn.title = "Editar";
      editBtn.onclick = () => onEdit && onEdit(item.id, item.data);
      
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-icon btn-delete";
      deleteBtn.innerHTML = "🗑️";
      deleteBtn.title = "Eliminar";
      deleteBtn.onclick = () => onDelete && onDelete(item.id, item.data);
      
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      li.appendChild(actionsDiv);
    }
    
    target.appendChild(li);
  });
}

export async function loadOrdersForMonth(target, formatCurrency, monthKey = "", onEdit = null, onDelete = null) {
  if (!target) return;
  const orderSnap = await getDocs(collection(db, "orders"));
  const items = [];

  orderSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const date = parseRecordDate(data);
    items.push({ id: docSnap.id, data, date });
  });

  const filtered = monthKey
    ? items.filter((item) => getMonthKey(item.date) === monthKey)
    : items;

  filtered.sort((a, b) => {
    const aTime = a.date ? a.date.getTime() : 0;
    const bTime = b.date ? b.date.getTime() : 0;
    return bTime - aTime;
  });

  target.innerHTML = "";
  
  filtered.forEach((item) => {
    const tr = document.createElement("tr");
    
    const dateCell = document.createElement("td");
    dateCell.textContent = item.data.date || (item.date ? item.date.toLocaleDateString("es-ES") : "");
    tr.appendChild(dateCell);
    
    const supplierCell = document.createElement("td");
    supplierCell.textContent = item.data.supplier || "";
    tr.appendChild(supplierCell);
    
    const priceCell = document.createElement("td");
    priceCell.textContent = formatCurrency(Number(item.data.price || 0));
    tr.appendChild(priceCell);
    
    const documentCell = document.createElement("td");
    if (item.data.document) {
      const link = document.createElement("a");
      link.href = item.data.document;
      link.target = "_blank";
      link.textContent = "Ver documento";
      link.className = "btn ghost small";
      documentCell.appendChild(link);
    } else {
      documentCell.textContent = "-";
    }
    tr.appendChild(documentCell);
    
    const actionsCell = document.createElement("td");
    if (item.id) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "record-actions";
      
      const editBtn = document.createElement("button");
      editBtn.className = "btn-icon btn-edit";
      editBtn.innerHTML = "✏️";
      editBtn.title = "Editar";
      editBtn.onclick = () => onEdit && onEdit(item.id, item.data);
      
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-icon btn-delete";
      deleteBtn.innerHTML = "🗑️";
      deleteBtn.title = "Eliminar";
      deleteBtn.onclick = () => onDelete && onDelete(item.id, item.data);
      
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      actionsCell.appendChild(actionsDiv);
    }
    tr.appendChild(actionsCell);
    
    target.appendChild(tr);
  });
}

export async function loadSummary(ui, formatCurrency) {
  const paymentSnap = await getDocs(collection(db, "payments"));
  const expenseSnap = await getDocs(collection(db, "expenses"));
  const athleteSnap = await getDocs(collection(db, "athlete_months"));
  const acroSnap = await getDocs(collection(db, "athlete_acrobacias_months"));
  const halteSnap = await getDocs(collection(db, "athlete_halterofilia_months"));
  const telasSnap = await getDocs(collection(db, "athlete_telas_months"));

  let income = 0;
  let expenses = 0;
  const monthly = new Map();
  const details = new Map();

  paymentSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const amount = Number(data.amount || 0);
    const date = parseRecordDate(data);
    const key = getMonthKey(date);
    income += amount;
    const current = monthly.get(key) || { income: 0, expenses: 0 };
    current.income += amount;
    monthly.set(key, current);

    const bucket = details.get(key) || { payments: [], expenses: [] };
    bucket.payments.push({
      date: data.date || (date ? date.toISOString().slice(0, 10) : ""),
      concept: data.concept || "",
      amount,
    });
    details.set(key, bucket);
  });

  expenseSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const amount = Number(data.amount || 0);
    const date = parseRecordDate(data);
    const key = getMonthKey(date);
    expenses += amount;
    const current = monthly.get(key) || { income: 0, expenses: 0 };
    current.expenses += amount;
    monthly.set(key, current);

    const bucket = details.get(key) || { payments: [], expenses: [] };
    bucket.expenses.push({
      date: data.date || (date ? date.toISOString().slice(0, 10) : ""),
      concept: data.concept || "",
      amount,
    });
    details.set(key, bucket);
  });

  athleteSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar el ingreso si es el mes de pago (isPaymentMonth)
    // Para multi-mes: solo contar si isPaymentMonth === true
    // Para mensual o datos antiguos sin durationMonths: contar siempre
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    income += amount;
    const current = monthly.get(key) || { income: 0, expenses: 0 };
    current.income += amount;
    monthly.set(key, current);
  });

  // Acrobacias income
  acroSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar el ingreso si es el mes de pago (isPaymentMonth)
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    income += amount;
    const current = monthly.get(key) || { income: 0, expenses: 0 };
    current.income += amount;
    monthly.set(key, current);
  });

  // Halterofilia income
  halteSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar el ingreso si es el mes de pago (isPaymentMonth)
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    income += amount;
    const current = monthly.get(key) || { income: 0, expenses: 0 };
    current.income += amount;
    monthly.set(key, current);
  });

  // Telas income
  telasSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar el ingreso si es el mes de pago (isPaymentMonth)
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    income += amount;
    const current = monthly.get(key) || { income: 0, expenses: 0 };
    current.income += amount;
    monthly.set(key, current);
  });

  const athleteTotals = new Map();
  athleteSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar para totales si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = athleteTotals.get(key) || 0;
    athleteTotals.set(key, current + amount);
  });

  const acroTotals = new Map();
  acroSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar para totales si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = acroTotals.get(key) || 0;
    acroTotals.set(key, current + amount);
  });

  const halteTotals = new Map();
  halteSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar para totales si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = halteTotals.get(key) || 0;
    halteTotals.set(key, current + amount);
  });

  const telasTotals = new Map();
  telasSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.paid) return;
    // Solo contar para totales si es el mes de pago
    const isMultiMonth = data.durationMonths && data.durationMonths > 1;
    const shouldCountIncome = isMultiMonth ? data.isPaymentMonth === true : true;
    if (!shouldCountIncome) return;
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    const current = telasTotals.get(key) || 0;
    telasTotals.set(key, current + amount);
  });

  athleteTotals.forEach((total, key) => {
    const bucket = details.get(key) || { payments: [], expenses: [] };
    bucket.payments.push({
      date: key === "sin-fecha" ? "" : `${key}-01`,
      concept: "Cuotas atletas (total)",
      amount: total,
    });
    details.set(key, bucket);
  });

  acroTotals.forEach((total, key) => {
    const bucket = details.get(key) || { payments: [], expenses: [] };
    bucket.payments.push({
      date: key === "sin-fecha" ? "" : `${key}-01`,
      concept: "Cuotas acrobacias (total)",
      amount: total,
    });
    details.set(key, bucket);
  });

  halteTotals.forEach((total, key) => {
    const bucket = details.get(key) || { payments: [], expenses: [] };
    bucket.payments.push({
      date: key === "sin-fecha" ? "" : `${key}-01`,
      concept: "Cuotas halterofilia (total)",
      amount: total,
    });
    details.set(key, bucket);
  });

  telasTotals.forEach((total, key) => {
    const bucket = details.get(key) || { payments: [], expenses: [] };
    bucket.payments.push({
      date: key === "sin-fecha" ? "" : `${key}-01`,
      concept: "Cuotas telas (total)",
      amount: total,
    });
    details.set(key, bucket);
  });

  ui.summaryIncome.textContent = formatCurrency(income);
  ui.summaryExpenses.textContent = formatCurrency(expenses);
  ui.summaryProfit.textContent = formatCurrency(income - expenses);

  const years = Array.from(monthly.keys())
    .filter((key) => key !== "sin-fecha")
    .map((key) => key.split("-")[0]);

  return {
    details,
    monthly,
    totals: { income, expenses },
    years: Array.from(new Set(years)).sort((a, b) => (a < b ? 1 : -1)),
  };
}

export async function loadUsers(ui, role) {
  if (role !== "OWNER") {
    ui.userList.innerHTML = "";
    return;
  }

  const snap = await getDocs(collection(db, "users"));
  ui.userList.innerHTML = "";
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.textContent = `${docSnap.id} · ${data.email || ""} · ${data.role || ""}`;
    ui.userList.appendChild(li);
  });
}

export async function getUsersList() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateUserRole(userId, role) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { role });
}

export async function setMustChangePassword(userId, mustChangePassword) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { mustChangePassword });
}

// ========== ATLETAS ACROBACIAS ==========

export async function createAcroAthlete(name, userId) {
  const docRef = await addDoc(collection(db, "athletes_acrobacias"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function updateAcroAthlete(athleteId, athleteData, userId) {
  await updateDoc(doc(db, "athletes_acrobacias", athleteId), {
    ...athleteData,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function getAcroAthletes() {
  const snap = await getDocs(collection(db, "athletes_acrobacias"));
  const athletes = [];
  snap.forEach((docSnap) => {
    athletes.push({ id: docSnap.id, ...docSnap.data() });
  });
  return athletes;
}

export async function upsertAcroAthleteMonth(athleteId, month, payload, userId) {
  const snap = await getDocs(
    query(
      collection(db, "athlete_acrobacias_months"),
      where("athleteId", "==", athleteId),
      where("month", "==", month)
    )
  );
  let docId = null;
  snap.forEach((docSnap) => {
    docId = docSnap.id;
  });

  if (docId) {
    await updateDoc(doc(db, "athlete_acrobacias_months", docId), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    });
    return docId;
  }

  const docRef = await addDoc(collection(db, "athlete_acrobacias_months"), {
    athleteId,
    month,
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function getAcroAthleteMonthsForMonth(month) {
  const snap = await getDocs(
    query(collection(db, "athlete_acrobacias_months"), where("month", "==", month))
  );
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function getAllAcroAthleteMonths() {
  const snap = await getDocs(collection(db, "athlete_acrobacias_months"));
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function createHalteAthlete(name, userId) {
  const docRef = await addDoc(collection(db, "athletes_halterofilia"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function updateHalteAthlete(athleteId, athleteData, userId) {
  await updateDoc(doc(db, "athletes_halterofilia", athleteId), {
    ...athleteData,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function getHalteAthletes() {
  const snap = await getDocs(collection(db, "athletes_halterofilia"));
  const athletes = [];
  snap.forEach((docSnap) => {
    athletes.push({ id: docSnap.id, ...docSnap.data() });
  });
  return athletes;
}

export async function upsertHalteAthleteMonth(athleteId, month, payload, userId) {
  const snap = await getDocs(
    query(
      collection(db, "athlete_halterofilia_months"),
      where("athleteId", "==", athleteId),
      where("month", "==", month)
    )
  );
  let docId = null;
  snap.forEach((docSnap) => {
    docId = docSnap.id;
  });

  if (docId) {
    await updateDoc(doc(db, "athlete_halterofilia_months", docId), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    });
    return docId;
  }

  const docRef = await addDoc(collection(db, "athlete_halterofilia_months"), {
    athleteId,
    month,
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function getHalteAthleteMonthsForMonth(month) {
  const snap = await getDocs(
    query(collection(db, "athlete_halterofilia_months"), where("month", "==", month))
  );
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function getAllHalteAthleteMonths() {
  const snap = await getDocs(collection(db, "athlete_halterofilia_months"));
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function createTelasAthlete(name, userId) {
  const docRef = await addDoc(collection(db, "athletes_telas"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function updateTelasAthlete(athleteId, athleteData, userId) {
  await updateDoc(doc(db, "athletes_telas", athleteId), {
    ...athleteData,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function getTelasAthletes() {
  const snap = await getDocs(collection(db, "athletes_telas"));
  const athletes = [];
  snap.forEach((docSnap) => {
    athletes.push({ id: docSnap.id, ...docSnap.data() });
  });
  return athletes;
}

export async function upsertTelasAthleteMonth(athleteId, month, payload, userId) {
  const snap = await getDocs(
    query(
      collection(db, "athlete_telas_months"),
      where("athleteId", "==", athleteId),
      where("month", "==", month)
    )
  );
  let docId = null;
  snap.forEach((docSnap) => {
    docId = docSnap.id;
  });

  if (docId) {
    await updateDoc(doc(db, "athlete_telas_months", docId), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    });
    return docId;
  }

  const docRef = await addDoc(collection(db, "athlete_telas_months"), {
    athleteId,
    month,
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function getTelasAthleteMonthsForMonth(month) {
  const snap = await getDocs(
    query(collection(db, "athlete_telas_months"), where("month", "==", month))
  );
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function getAllTelasAthleteMonths() {
  const snap = await getDocs(collection(db, "athlete_telas_months"));
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

// ========== CLASES SUELTAS ==========

export async function createSingleClassesAthlete(name, userId) {
  const docRef = await addDoc(collection(db, "athletes_singleclasses"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function updateSingleClassesAthlete(athleteId, athleteData, userId) {
  await updateDoc(doc(db, "athletes_singleclasses", athleteId), {
    ...athleteData,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

export async function getSingleClassesAthletes() {
  const snap = await getDocs(collection(db, "athletes_singleclasses"));
  const athletes = [];
  snap.forEach((docSnap) => {
    athletes.push({ id: docSnap.id, ...docSnap.data() });
  });
  return athletes;
}

export async function upsertSingleClassesAthleteMonth(athleteId, month, payload, userId) {
  const snap = await getDocs(
    query(
      collection(db, "athlete_singleclasses_months"),
      where("athleteId", "==", athleteId),
      where("month", "==", month)
    )
  );
  let docId = null;
  snap.forEach((docSnap) => {
    docId = docSnap.id;
  });

  if (docId) {
    await updateDoc(doc(db, "athlete_singleclasses_months", docId), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    });
    return docId;
  }

  const docRef = await addDoc(collection(db, "athlete_singleclasses_months"), {
    athleteId,
    month,
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

export async function getSingleClassesAthleteMonthsForMonth(month) {
  const snap = await getDocs(
    query(collection(db, "athlete_singleclasses_months"), where("month", "==", month))
  );
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

export async function getAllSingleClassesAthleteMonths() {
  const snap = await getDocs(collection(db, "athlete_singleclasses_months"));
  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

// ========== CLASES Y PROFESORES ==========

export async function getTeachers() {
  const snap = await getDocs(collection(db, "teachers"));
  const teachers = [];
  snap.forEach((docSnap) => {
    teachers.push({ id: docSnap.id, ...docSnap.data() });
  });
  return teachers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function createTeacher(teacherData, userId) {
  const docRef = await addDoc(collection(db, "teachers"), {
    ...teacherData,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
  return docRef.id;
}

export async function updateTeacher(teacherId, teacherData, userId) {
  await updateDoc(doc(db, "teachers", teacherId), {
    ...teacherData,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function deleteTeacher(teacherId) {
  await deleteDoc(doc(db, "teachers", teacherId));
}

export async function getClasses() {
  const snap = await getDocs(collection(db, "classes"));
  const classes = [];
  snap.forEach((docSnap) => {
    classes.push({ id: docSnap.id, ...docSnap.data() });
  });
  return classes;
}

export async function createClass(classData, userId) {
  const docRef = await addDoc(collection(db, "classes"), {
    ...classData,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
  return docRef.id;
}

export async function updateClass(classId, classData, userId) {
  await updateDoc(doc(db, "classes", classId), {
    ...classData,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function deleteClass(classId) {
  await deleteDoc(doc(db, "classes", classId));
}

// Asignaciones de profesores a clases
export async function getClassAssignments(weekStart = null, weekEnd = null) {
  const snap = await getDocs(collection(db, "class_assignments"));
  const assignments = [];
  snap.forEach((docSnap) => {
    assignments.push({ id: docSnap.id, ...docSnap.data() });
  });
  
  // Filtrar en el cliente si se proporcionan fechas
  if (weekStart && weekEnd) {
    return assignments.filter(assignment => 
      assignment.date >= weekStart && assignment.date <= weekEnd
    );
  }
  
  return assignments;
}

export async function createClassAssignment(assignmentData, userId) {
  const docRef = await addDoc(collection(db, "class_assignments"), {
    ...assignmentData,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
  return docRef.id;
}

export async function updateClassAssignment(assignmentId, assignmentData, userId) {
  await updateDoc(doc(db, "class_assignments", assignmentId), {
    ...assignmentData,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function deleteClassAssignment(assignmentId) {
  await deleteDoc(doc(db, "class_assignments", assignmentId));
}

export async function upsertClassAssignment(classId, date, time, teacherId, notes = "", userId) {
  // Buscar si ya existe una asignación para esta clase, fecha y hora
  const snap = await getDocs(collection(db, "class_assignments"));
  let existingAssignment = null;
  
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.classId === classId && data.date === date && data.time === time) {
      existingAssignment = { id: docSnap.id, ...data };
    }
  });
  
  const assignmentData = {
    classId,
    date,
    time,
    teacherId,
    notes,
  };
  
  if (existingAssignment) {
    // Actualizar existente
    await updateClassAssignment(existingAssignment.id, assignmentData, userId);
    return existingAssignment.id;
  } else {
    // Crear nuevo
    return await createClassAssignment(assignmentData, userId);
  }
}

// Función para importar clases desde CSV
export async function importClassesFromCSV(csvContent, userId) {
  const lines = csvContent.split('\n');
  const header = lines[0].split(',');
  
  // Obtener días de la semana (columnas 1-7) y normalizar nombres
  const rawDays = header.slice(1, 8).map(day => day.trim());
  const days = rawDays.map(day => {
    // Normalizar nombres de días
    switch(day.toLowerCase()) {
      case 'sabado': return 'Sábado';
      case 'miércoles': return 'Miércoles';
      case 'miercoles': return 'Miércoles';
      default: return day;
    }
  });
  
  const classes = [];
  let currentTime = null;
  
  console.log('Días detectados:', days);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cells = line.split(',').map(cell => cell.trim());
    const timeSlot = cells[0];
    
    // Si la primera celda tiene un horario (termina en 'h'), es una nueva hora
    if (timeSlot && timeSlot.endsWith('h')) {
      currentTime = timeSlot;
      console.log('Nueva hora:', currentTime);
    }
    
    // Si tenemos un tiempo actual, procesar las clases
    if (currentTime) {
      for (let j = 1; j < Math.min(cells.length, 8); j++) {
        const className = cells[j];
        if (className && className !== '') {
          const classData = {
            name: className,
            day: days[j - 1],
            time: currentTime,
            dayIndex: j - 1, // 0=Lunes, 6=Domingo
          };
          classes.push(classData);
          console.log('Clase añadida:', classData);
        }
      }
    }
  }
  
  // Eliminar clases existentes antes de importar nuevas
  const existingClasses = await getClasses();
  const deletePromises = existingClasses.map(cls => deleteClass(cls.id));
  await Promise.all(deletePromises);
  
  // Guardar nuevas clases en Firestore
  const createPromises = classes.map(classData => createClass(classData, userId));
  const results = await Promise.all(createPromises);
  
  console.log(`Importadas ${results.length} clases:`, classes);
  return results.length;
}

// ========== WODBUSTER API INTEGRATION ==========

// Configuración de la API de WodBuster (usada por Cloud Function)
const WODBUSTER_CONFIG = {
  apiKey: 'abc97d4d-2378-4d97-b39e-90b7ce54522c',
  baseUrl: 'https://owl.wodbuster.com',
};

// Obtener usuarios de WodBuster usando Cloud Function como proxy (solución CORS)
export async function getWodBusterUsers() {
  try {
    console.log('Llamando a Cloud Function wodBusterProxy...');
    
    const wodBusterProxy = httpsCallable(functions, 'wodBusterProxy');
    const result = await wodBusterProxy({ 
      endpoint: '/api/users/Get',
      method: 'GET'
    });
    
    console.log('Respuesta de Cloud Function:', result.data);
    return result.data;
  } catch (error) {
    console.error('Error llamando a Cloud Function WodBuster:', error);
    throw new Error('No se pudieron obtener los usuarios de WodBuster: ' + error.message);
  }
}

// Configurar la URL base de WodBuster (para cambiarla si es necesaria)
export function setWodBusterBaseUrl(newBaseUrl) {
  WODBUSTER_CONFIG.baseUrl = newBaseUrl;
  console.log('NOTA: La URL base debe actualizarse también en la Cloud Function');
}

// Configurar la API Key de WodBuster (para cambiarla si es necesaria)
export function setWodBusterApiKey(newApiKey) {
  WODBUSTER_CONFIG.apiKey = newApiKey;
  console.log('NOTA: La API Key debe actualizarse también en la Cloud Function');
}

// ==================== WodBuster Users - Firestore CRUD ====================

/**
 * Añadir un nuevo usuario de WodBuster a Firestore
 */
export async function addWodBusterUser(userData, userId) {
  const docRef = await addDoc(collection(db, "wodbuster_users"), {
    ...userData,
    source: 'manual', // 'manual' o 'api'
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
  return docRef.id;
}

/**
 * Actualizar un usuario de WodBuster en Firestore
 */
export async function updateWodBusterUser(userDocId, userData, userId) {
  await updateDoc(doc(db, "wodbuster_users", userDocId), {
    ...userData,
    updatedAt: serverTimestamp(),
    updatedBy: userId || null,
  });
}

/**
 * Eliminar un usuario de WodBuster de Firestore
 */
export async function deleteWodBusterUser(userDocId) {
  await deleteDoc(doc(db, "wodbuster_users", userDocId));
}

/**
 * Obtener todos los usuarios de WodBuster desde Firestore
 */
export async function getWodBusterUsersFromDB() {
  const snap = await getDocs(collection(db, "wodbuster_users"));
  const users = [];
  snap.forEach((docSnap) => {
    users.push({ 
      docId: docSnap.id, // ID del documento de Firestore
      ...docSnap.data() 
    });
  });
  return users;
}

/**
 * Sincronizar usuario de la API con Firestore
 * Si existe (por email), actualiza. Si no, crea.
 */
export async function syncWodBusterUserToDB(userData, userId) {
  // Buscar si ya existe un usuario con ese email
  const q = query(
    collection(db, "wodbuster_users"),
    where("email", "==", userData.email)
  );
  
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    // Usuario existe - actualizar
    const existingDoc = snapshot.docs[0];
    await updateDoc(doc(db, "wodbuster_users", existingDoc.id), {
      ...userData,
      source: 'api',
      lastSyncAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId || null,
    });
    return existingDoc.id;
  } else {
    // Usuario no existe - crear
    const docRef = await addDoc(collection(db, "wodbuster_users"), {
      ...userData,
      source: 'api',
      lastSyncAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: userId || null,
    });
    return docRef.id;
  }
}

/**
 * Sincronizar múltiples usuarios de la API con Firestore
 */
export async function syncMultipleWodBusterUsers(usersArray, userId) {
  const results = {
    created: 0,
    updated: 0,
    errors: 0,
    errorDetails: []
  };
  
  for (const userData of usersArray) {
    try {
      const q = query(
        collection(db, "wodbuster_users"),
        where("email", "==", userData.email)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Actualizar solo campos de la API, preservar campos enriquecidos manualmente
        const existingDoc = snapshot.docs[0];
        const existingData = existingDoc.data();
        
        // Solo actualizar campos que vienen de la API, preservar los enriquecidos
        const updateData = {
          id: userData.id,
          esAlumno: userData.esAlumno,
          pagadoHasta: userData.pagadoHasta,
          idTarifa: userData.idTarifa,
          lastSyncAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: userId || null,
        };
        
        // Solo actualizar email si no existe o si ha cambiado
        if (!existingData.email || existingData.source === 'api') {
          updateData.email = userData.email;
        }
        
        await updateDoc(doc(db, "wodbuster_users", existingDoc.id), updateData);
        results.updated++;
      } else {
        // Crear
        await addDoc(collection(db, "wodbuster_users"), {
          ...userData,
          source: 'api',
          lastSyncAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          createdBy: userId || null,
        });
        results.created++;
      }
    } catch (error) {
      console.error(`Error sincronizando usuario ${userData.email}:`, error);
      results.errors++;
      results.errorDetails.push({
        email: userData.email,
        error: error.message
      });
    }
  }
  
  return results;
}
