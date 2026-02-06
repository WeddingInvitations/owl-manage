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
  createAthlete,
  getAthletes,
  getAthleteMonthsForMonth,
  upsertAthleteMonth,
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
let selectedAthleteMonth = "";

const tariffPricing = {
  "8/mes": 70,
  "12/mes": 80,
  Ilimitado: 105,
};

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
  await loadUsers(ui, currentRole);
}

function getMonthKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function getPreviousMonthKey(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return getMonthKey(date);
}

function renderAthleteMonthOptions() {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  ui.athleteMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.athleteMonthSelect.appendChild(option);
  });
  selectedAthleteMonth = options[0];
  ui.athleteMonthSelect.value = selectedAthleteMonth;
}

function setAthletePriceFromTariff() {
  const tariff = ui.athleteTariff.value;
  ui.athletePrice.value = tariffPricing[tariff] || 0;
}

async function refreshAthleteMonthly() {
  if (!selectedAthleteMonth) {
    renderAthleteMonthOptions();
  }
  const athletes = await getAthletes();
  const monthRecords = await getAthleteMonthsForMonth(selectedAthleteMonth);
  const previousMonth = getPreviousMonthKey(selectedAthleteMonth);
  const previousRecords = previousMonth
    ? await getAthleteMonthsForMonth(previousMonth)
    : [];

  const monthMap = new Map();
  monthRecords.forEach((record) => monthMap.set(record.athleteId, record));
  const previousMap = new Map();
  previousRecords.forEach((record) => previousMap.set(record.athleteId, record));

  ui.athleteList.innerHTML = "";

  athletes.forEach((athlete) => {
    const current = monthMap.get(athlete.id);
    const previous = previousMap.get(athlete.id);
    const tariff = current?.tariff || previous?.tariff || "8/mes";
    const price = current?.price ?? previous?.price ?? tariffPricing[tariff];
    const paid = current?.paid ?? false;
    const active = Boolean(paid);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${athlete.name}</td>
      <td>
        <select data-role="tariff" data-id="${athlete.id}">
          ${Object.keys(tariffPricing)
            .map(
              (option) =>
                `<option value="${option}" ${option === tariff ? "selected" : ""}>${option}</option>`
            )
            .join("")}
        </select>
      </td>
      <td><span data-role="price" data-id="${athlete.id}">${price.toFixed(2)}</span> €</td>
      <td>
        <select data-role="paid" data-id="${athlete.id}">
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>${active ? "Activo" : "Inactivo"}</td>
      <td>
        <button class="btn small" data-role="save" data-id="${athlete.id}">
          Guardar
        </button>
      </td>
    `;
    ui.athleteList.appendChild(row);
  });

  const activeNow = new Set(
    monthRecords.filter((record) => record.paid).map((record) => record.athleteId)
  );
  const activePrev = new Set(
    previousRecords.filter((record) => record.paid).map((record) => record.athleteId)
  );
  const totalActive = activeNow.size;
  const totalIncome = monthRecords
    .filter((record) => record.paid)
    .reduce((sum, record) => sum + Number(record.price || 0), 0);
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;

  ui.athleteSummaryActive.textContent = String(totalActive);
  ui.athleteSummaryAverage.textContent = formatCurrency(averageTariff);
  ui.athleteSummaryNew.textContent = String(totalNew);
  ui.athleteSummaryDrop.textContent = String(totalDrop);
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
      row.classList.add("row-income");
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
      row.classList.add("row-expense");
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
renderAthleteMonthOptions();
setAthletePriceFromTariff();

bindAuth(
  ui,
  async (user, profile) => {
    currentUser = user;
    currentRole = profile.role;
    if (user) {
      await refreshAll();
      await refreshAthleteMonthly();
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
  const athleteId = await createAthlete(ui.athleteName.value, currentUser?.uid);
  const tariff = ui.athleteTariff.value;
  const price = tariffPricing[tariff] || 0;
  const paid = ui.athletePaid.value === "SI";
  await upsertAthleteMonth(
    athleteId,
    selectedAthleteMonth,
    {
      tariff,
      price,
      paid,
      active: paid,
    },
    currentUser?.uid
  );
  ui.athleteForm.reset();
  setAthletePriceFromTariff();
  await refreshAll();
  await refreshAthleteMonthly();
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

ui.athleteTariff.addEventListener("change", () => {
  setAthletePriceFromTariff();
});

ui.athleteMonthSelect.addEventListener("change", async (event) => {
  selectedAthleteMonth = event.target.value;
  await refreshAthleteMonthly();
});

ui.athleteList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.role !== "tariff") return;
  const athleteId = target.dataset.id;
  const priceSpan = ui.athleteList.querySelector(
    `[data-role="price"][data-id="${athleteId}"]`
  );
  if (priceSpan) {
    const newPrice = tariffPricing[target.value] || 0;
    priceSpan.textContent = newPrice.toFixed(2);
  }
});

ui.athleteList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-role='save']");
  if (!button) return;
  const athleteId = button.dataset.id;
  const tariffSelect = ui.athleteList.querySelector(
    `select[data-role="tariff"][data-id="${athleteId}"]`
  );
  const paidSelect = ui.athleteList.querySelector(
    `select[data-role="paid"][data-id="${athleteId}"]`
  );
  if (!tariffSelect || !paidSelect) return;
  const tariff = tariffSelect.value;
  const price = tariffPricing[tariff] || 0;
  const paid = paidSelect.value === "SI";
  await upsertAthleteMonth(
    athleteId,
    selectedAthleteMonth,
    {
      tariff,
      price,
      paid,
      active: paid,
    },
    currentUser?.uid
  );
  await refreshAthleteMonthly();
});


ui.refreshSummary.addEventListener("click", async () => {
  await refreshAll();
});

ui.monthlyYearSelect.addEventListener("change", (event) => {
  selectedYear = event.target.value;
  renderMonthlySummary();
  ui.monthlyDetailCard.classList.add("hidden");
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
