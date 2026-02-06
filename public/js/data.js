import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  doc,
  updateDoc,
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

export async function addExpense(concept, amount, date, userId) {
  await addDoc(collection(db, "expenses"), {
    concept,
    amount,
    date,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function addCheckin(name, type, userId) {
  await addDoc(collection(db, "checkins"), {
    name,
    type,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
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

export async function loadSummary(ui, formatCurrency) {
  const paymentSnap = await getDocs(collection(db, "payments"));
  const expenseSnap = await getDocs(collection(db, "expenses"));
  const athleteSnap = await getDocs(collection(db, "athlete_months"));

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
    const amount = Number(data.price || 0);
    if (!amount) return;
    const key = data.month || "sin-fecha";
    income += amount;
    const current = monthly.get(key) || { income: 0, expenses: 0 };
    current.income += amount;
    monthly.set(key, current);

    const bucket = details.get(key) || { payments: [], expenses: [] };
    bucket.payments.push({
      date: data.month ? `${data.month}-01` : "",
      concept: "Cuota atleta",
      amount,
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
