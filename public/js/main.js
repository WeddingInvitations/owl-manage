// OwlManage MVP
// TODO: Completa firebaseConfig.js con tu configuración real.
// Estructura modular simple: auth, datos, UI.

import {
  ui,
  formatCurrency,
  setAuthUI,
  setActiveView,
  updateMenuVisibility,
} from "./ui.js";
import { bindAuth } from "./auth.js";
import {
  addPayment,
  addExpense,
  addCheckin,
  addTraining,
  addAthlete,
  loadList,
  loadGroupedList,
  loadSummary,
  loadUsers,
  updateUserRole,
} from "./data.js";
import { createUserWithRole } from "./admin.js";

let currentUser = null;
let currentRole = "RECEPTION";
let monthlyDetails = new Map();

async function refreshAll() {
  monthlyDetails = await loadSummary(ui, formatCurrency);
  await loadGroupedList("payments", ui.paymentList, (data, date) =>
    `${data.concept} · ${data.date || (date ? date.toLocaleDateString("es-ES") : "")} · ${formatCurrency(Number(data.amount || 0))}`
  );
  await loadGroupedList("expenses", ui.expenseList, (data, date) =>
    `${data.concept} · ${data.date || (date ? date.toLocaleDateString("es-ES") : "")} · ${formatCurrency(Number(data.amount || 0))}`
  );
  await loadList("checkins", ui.checkinList, (data) =>
    `${data.name} · ${data.type}`
  );
  await loadList("trainings", ui.trainingList, (data) =>
    `${data.title} · ${data.date} · ${data.coach || ""}`
  );
  await loadList("athletes", ui.athleteList, (data) =>
    `${data.name} · ${data.status}`
  );
  await loadUsers(ui, currentRole);
}

function renderMonthlyDetail(key) {
  const details = monthlyDetails.get(key);
  if (!details) {
    ui.monthlyDetailCard.classList.add("hidden");
    return;
  }

  ui.monthlyDetailTitle.textContent = `Detalle mensual · ${key}`;
  ui.monthlyIncomeBody.innerHTML = "";
  ui.monthlyExpenseBody.innerHTML = "";

  details.payments
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.date}</td>
        <td>${item.concept}</td>
        <td>${formatCurrency(item.amount)}</td>
      `;
      ui.monthlyIncomeBody.appendChild(row);
    });

  details.expenses
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.date}</td>
        <td>${item.concept}</td>
        <td>${formatCurrency(item.amount)}</td>
      `;
      ui.monthlyExpenseBody.appendChild(row);
    });

  ui.monthlyDetailCard.classList.remove("hidden");
}

function downloadMonthlyCSV(key) {
  const details = monthlyDetails.get(key);
  if (!details) return;

  const totalIncome = details.payments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const totalExpenses = details.expenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const totalBalance = totalIncome - totalExpenses;

  const rows = [
    ["Tipo", "Fecha", "Concepto", "Importe"],
    ...details.payments.map((item) => [
      "Ingreso",
      item.date,
      item.concept,
      item.amount,
    ]),
    ...details.expenses.map((item) => [
      "Gasto",
      item.date,
      item.concept,
      item.amount,
    ]),
    ["TOTAL INGRESOS", "", "", totalIncome],
    ["TOTAL GASTOS", "", "", totalExpenses],
    ["BALANCE", "", "", totalBalance],
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) =>
          `"${String(value).replaceAll('"', '""')}"`
        )
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `balance-${key}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

ui.menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view, ui);
  });
});

setActiveView("summaryView", ui);

bindAuth(
  ui,
  async (user, profile) => {
    currentUser = user;
    currentRole = profile.role;
    if (user) {
      await refreshAll();
    }
    setAuthUI(ui, user, currentRole, false);
    updateMenuVisibility(ui, currentRole);
    if (currentRole !== "OWNER") {
      setActiveView("checkinsView", ui);
    }
  },
  setAuthUI
);

// ---------- Formularios ----------
ui.paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addPayment(
    ui.paymentConcept.value,
    Number(ui.paymentAmount.value),
    ui.paymentDate.value,
    currentUser?.uid
  );
  ui.paymentForm.reset();
  await refreshAll();
});

ui.expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addExpense(
    ui.expenseConcept.value,
    Number(ui.expenseAmount.value),
    ui.expenseDate.value,
    currentUser?.uid
  );
  ui.expenseForm.reset();
  await refreshAll();
});

ui.checkinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addCheckin(
    ui.checkinName.value,
    ui.checkinType.value,
    currentUser?.uid
  );
  ui.checkinForm.reset();
  await refreshAll();
});

ui.trainingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addTraining(
    ui.trainingTitle.value,
    ui.trainingDate.value,
    ui.trainingCoach.value,
    currentUser?.uid
  );
  ui.trainingForm.reset();
  await refreshAll();
});

ui.athleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addAthlete(
    ui.athleteName.value,
    ui.athleteStatus.value,
    currentUser?.uid
  );
  ui.athleteForm.reset();
  await refreshAll();
});

ui.roleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await updateUserRole(ui.roleUserId.value.trim(), ui.roleValue.value);
  ui.roleForm.reset();
  await refreshAll();
});

ui.createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  ui.createUserStatus.textContent = "Creando usuario...";
  const email = ui.createUserEmail.value.trim();
  const tempPassword = ui.createUserTempPassword.value;
  const role = ui.createUserRole.value;
  try {
    const result = await createUserWithRole(email, tempPassword, role);
    ui.createUserStatus.textContent = `Usuario creado: ${result.uid}`;
    ui.createUserForm.reset();
    await refreshAll();
  } catch (error) {
    ui.createUserStatus.textContent = `Error: ${error.message || error}`;
  }
});


ui.refreshSummary.addEventListener("click", async () => {
  await refreshAll();
});

ui.monthlySummaryBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const key = button.dataset.key;
  if (button.dataset.action === "detail") {
    renderMonthlyDetail(key);
  }
  if (button.dataset.action === "csv") {
    downloadMonthlyCSV(key);
  }
});

ui.monthlyDetailClose.addEventListener("click", () => {
  ui.monthlyDetailCard.classList.add("hidden");
});
