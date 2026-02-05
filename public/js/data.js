import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function addPayment(concept, amount, userId) {
  await addDoc(collection(db, "payments"), {
    concept,
    amount,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function addExpense(concept, amount, userId) {
  await addDoc(collection(db, "expenses"), {
    concept,
    amount,
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
    status,
    lastPaymentAt: null,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

export async function loadList(collectionName, target, formatter) {
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

export async function loadSummary(ui, formatCurrency) {
  const paymentSnap = await getDocs(collection(db, "payments"));
  const expenseSnap = await getDocs(collection(db, "expenses"));

  let income = 0;
  let expenses = 0;

  paymentSnap.forEach((docSnap) => {
    income += Number(docSnap.data().amount || 0);
  });

  expenseSnap.forEach((docSnap) => {
    expenses += Number(docSnap.data().amount || 0);
  });

  ui.summaryIncome.textContent = formatCurrency(income);
  ui.summaryExpenses.textContent = formatCurrency(expenses);
  ui.summaryProfit.textContent = formatCurrency(income - expenses);
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
