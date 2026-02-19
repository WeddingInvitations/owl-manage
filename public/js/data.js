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
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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

export async function openCheckin(userId, userEmail, userName = "") {
  const docRef = await addDoc(collection(db, "checkins"), {
    userId,
    userEmail,
    userName,
    checkInTime: serverTimestamp(),
    checkOutTime: null,
    status: "open",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function closeCheckin(checkinId) {
  const ref = doc(db, "checkins", checkinId);
  await updateDoc(ref, {
    checkOutTime: serverTimestamp(),
    status: "closed",
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

export async function loadSummary(ui, formatCurrency) {
  const paymentSnap = await getDocs(collection(db, "payments"));
  const expenseSnap = await getDocs(collection(db, "expenses"));
  const athleteSnap = await getDocs(collection(db, "athlete_months"));
  const acroSnap = await getDocs(collection(db, "athlete_acrobacias_months"));

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
