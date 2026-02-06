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
  getMonthLabel,
  loadUsers,
  updateUserRole,
} from "./data.js";
import { createUserWithRole } from "./admin.js";

let currentUser = null;
let currentRole = "RECEPTION";
let monthlyDetails = new Map();
let monthlyTotals = { income: 0, expenses: 0 };
let availableYears = [];
let selectedYear = "";

async function refreshAll() {
  const summaryData = await loadSummary(ui, formatCurrency);
  monthlyDetails = summaryData.details;
  monthlyTotals = summaryData.totals;
  availableYears = summaryData.years;
  if (!selectedYear || !availableYears.includes(selectedYear)) {
    selectedYear = availableYears[0] || "";
  }
  renderYearOptions();
  renderMonthlySummary();
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

function renderYearOptions() {
  if (!ui.monthlyYearSelect) return;
  ui.monthlyYearSelect.innerHTML = "";
  const fallback = document.createElement("option");
  fallback.value = "";
  fallback.textContent = "Sin datos";
  if (availableYears.length === 0) {
    ui.monthlyYearSelect.appendChild(fallback);
    ui.monthlyYearSelect.disabled = true;
    return;
  }
  ui.monthlyYearSelect.disabled = false;
  availableYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    ui.monthlyYearSelect.appendChild(option);
  });
  ui.monthlyYearSelect.value = selectedYear;
}

function renderMonthlySummary() {
  if (!ui.monthlySummaryBody) return;
  const rows = [];
  const monthKeys = Array.from(monthlyDetails.keys()).filter((key) => {
    return selectedYear && key.startsWith(`${selectedYear}-`);
  });

  monthKeys.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  ui.monthlySummaryBody.innerHTML = "";

  let yearIncome = 0;
  let yearExpenses = 0;

  monthKeys.forEach((key) => {
    const details = monthlyDetails.get(key);
    const income = details.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = details.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const balance = income - expenses;
    yearIncome += income;
    yearExpenses += expenses;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${getMonthLabel(key)}</td>
      <td>${formatCurrency(income)}</td>
      <td>${formatCurrency(expenses)}</td>
      <td>${formatCurrency(balance)}</td>
      <td>
        <div class="table-actions">
          <button class="btn small ghost" data-action="detail" data-key="${key}">Ver detalle</button>
          <button class="btn small" data-action="csv" data-key="${key}">CSV</button>
        </div>
      </td>
    `;
    ui.monthlySummaryBody.appendChild(row);
  });

  if (monthKeys.length > 0) {
    const totalRow = document.createElement("tr");
    totalRow.className = "table-total";
    totalRow.innerHTML = `
      <td>Total ${selectedYear}</td>
      <td>${formatCurrency(yearIncome)}</td>
      <td>${formatCurrency(yearExpenses)}</td>
      <td>${formatCurrency(yearIncome - yearExpenses)}</td>
      <td></td>
    `;
    ui.monthlySummaryBody.appendChild(totalRow);
  }
}

function renderMonthlyDetail(key) {
  const details = monthlyDetails.get(key);
  if (!details) {
    ui.monthlyDetailCard.classList.add("hidden");
    return;
  }

  ui.monthlyDetailTitle.textContent = `Detalle mensual · ${getMonthLabel(key)}`;
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

  const totalIncome = details.payments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const totalExpenses = details.expenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const balance = totalIncome - totalExpenses;
  ui.monthlyDetailBalance.textContent = `Balance total: ${formatCurrency(balance)}`;

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

ui.monthlyYearSelect.addEventListener("change", (event) => {
  selectedYear = event.target.value;
  renderMonthlySummary();
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
