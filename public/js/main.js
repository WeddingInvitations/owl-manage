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
  getAllAthleteMonths,
  getAthleteMonthsForMonth,
  upsertAthleteMonth,
  loadList,
  loadGroupedList,
  loadPaymentsWithAthleteTotals,
  getPaymentMonthsWithAthletes,
  loadExpensesForMonth,
  getExpenseMonths,
  loadSummary,
  getMonthLabel,
  loadUsers,
  updateUserRole,
} from "./data.js?v=20250206g";
import { createUserWithRole } from "./admin.js";

let currentUser = null;
let currentRole = "RECEPTION";
let monthlyDetails = new Map();
let monthlyTotals = { income: 0, expenses: 0 };
let availableYears = [];
let selectedYear = "";
let selectedAthleteMonth = "";
let availablePaymentMonths = [];
let selectedPaymentMonth = "";
let availableExpenseMonths = [];
let selectedExpenseMonth = "";
let athleteSearchTerm = "";
let selectedAthletePaymentMonth = "";

const on = (element, eventName, handler) => {
  if (!element) return;
  element.addEventListener(eventName, handler);
};

const tariffPlans = [
  { key: "8/mes", durationMonths: 1, priceTotal: 70 },
  { key: "12/mes", durationMonths: 1, priceTotal: 80 },
  { key: "Ilimitado", durationMonths: 1, priceTotal: 100 },
  { key: "Trimestre 8/mes", durationMonths: 3, priceTotal: 200 },
  { key: "Trimestre 12/mes", durationMonths: 3, priceTotal: 230 },
  { key: "Trimestre ilimitado", durationMonths: 3, priceTotal: 285 },
  { key: "Semestre 8/mes", durationMonths: 6, priceTotal: 380 },
  { key: "Semestre 12/mes", durationMonths: 6, priceTotal: 430 },
  { key: "Semestre ilimitado", durationMonths: 6, priceTotal: 540 },
  { key: "Anual 8/mes", durationMonths: 12, priceTotal: 715 },
  { key: "Anual 12/mes", durationMonths: 12, priceTotal: 815 },
  { key: "Anual ilimitado", durationMonths: 12, priceTotal: 1020 },
];

const tariffPlanMap = new Map(
  tariffPlans.map((plan) => [plan.key, {
    ...plan,
    priceMonthly: plan.priceTotal / plan.durationMonths,
  }])
);

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
  await refreshPaymentList();
  await refreshExpenseList();
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

function renderPaymentMonthOptions() {
  if (!ui.paymentMonthSelect) return;
  ui.paymentMonthSelect.innerHTML = "";
  availablePaymentMonths.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    if (key === selectedPaymentMonth) {
      option.selected = true;
    }
    ui.paymentMonthSelect.appendChild(option);
  });
}

function renderExpenseMonthOptions() {
  if (!ui.expenseMonthSelect) return;
  ui.expenseMonthSelect.innerHTML = "";
  availableExpenseMonths.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    if (key === selectedExpenseMonth) {
      option.selected = true;
    }
    ui.expenseMonthSelect.appendChild(option);
  });
}

async function refreshPaymentList() {
  availablePaymentMonths = await getPaymentMonthsWithAthletes();
  const currentKey = getMonthKey(new Date());
  if (!selectedPaymentMonth || !availablePaymentMonths.includes(selectedPaymentMonth)) {
    selectedPaymentMonth = availablePaymentMonths.includes(currentKey)
      ? currentKey
      : (availablePaymentMonths[0] || "");
  }
  renderPaymentMonthOptions();
  await loadPaymentsWithAthleteTotals(
    ui.paymentList,
    formatCurrency,
    selectedPaymentMonth
  );
}

async function refreshExpenseList() {
  availableExpenseMonths = await getExpenseMonths();
  const currentKey = getMonthKey(new Date());
  if (!availableExpenseMonths.includes(currentKey)) {
    availableExpenseMonths.unshift(currentKey);
  }
  if (!selectedExpenseMonth || !availableExpenseMonths.includes(selectedExpenseMonth)) {
    selectedExpenseMonth = availableExpenseMonths.includes(currentKey)
      ? currentKey
      : (availableExpenseMonths[0] || "");
  }
  renderExpenseMonthOptions();
  await loadExpensesForMonth(
    ui.expenseList,
    formatCurrency,
    selectedExpenseMonth
  );
}

function getPreviousMonthKey(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return getMonthKey(date);
}

function addMonthsToKey(monthKey, monthsToAdd) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + monthsToAdd, 1);
  return getMonthKey(date);
}

function isMonthInRange(targetKey, startKey, durationMonths) {
  if (!startKey || !targetKey || !durationMonths) return false;
  const endKey = addMonthsToKey(startKey, durationMonths - 1);
  return targetKey >= startKey && targetKey <= endKey;
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

function renderAthletePaymentMonthOptions() {
  if (!ui.athletePaymentMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.athletePaymentMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.athletePaymentMonth.appendChild(option);
  });
  selectedAthletePaymentMonth = options[0];
  ui.athletePaymentMonth.value = selectedAthletePaymentMonth;
}

function setAthletePriceFromTariff() {
  const tariff = ui.athleteTariff.value;
  const plan = tariffPlanMap.get(tariff);
  ui.athletePrice.value = plan ? plan.priceTotal : 0;
}

async function refreshAthleteMonthly() {
  if (!selectedAthleteMonth) {
    renderAthleteMonthOptions();
  }
  const athletes = await getAthletes();
  if (ui.athleteNameList) {
    const names = Array.from(
      new Set(athletes.map((athlete) => athlete.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    ui.athleteNameList.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ui.athleteNameList.appendChild(option);
    });
  }
  const searchValue = athleteSearchTerm.trim().toLowerCase();
  const visibleAthletes = searchValue
    ? athletes.filter((athlete) => athlete.name?.toLowerCase().includes(searchValue))
    : athletes;
  if (ui.athleteSearchList) {
    const names = Array.from(
      new Set(athletes.map((athlete) => athlete.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    ui.athleteSearchList.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ui.athleteSearchList.appendChild(option);
    });
  }
  const allMonthRecords = await getAllAthleteMonths();
  const monthRecords = await getAthleteMonthsForMonth(selectedAthleteMonth);
  const previousMonth = getPreviousMonthKey(selectedAthleteMonth);
  const previousRecords = previousMonth
    ? await getAthleteMonthsForMonth(previousMonth)
    : [];

  const monthMap = new Map();
  monthRecords.forEach((record) => monthMap.set(record.athleteId, record));
  const previousMap = new Map();
  previousRecords.forEach((record) => previousMap.set(record.athleteId, record));
  const athleteHistory = new Map();
  allMonthRecords.forEach((record) => {
    if (!athleteHistory.has(record.athleteId)) {
      athleteHistory.set(record.athleteId, []);
    }
    athleteHistory.get(record.athleteId).push(record);
  });
  athleteHistory.forEach((records) =>
    records.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
  );

  ui.athleteList.innerHTML = "";

  const activeNow = new Set();
  const activePrev = new Set();
  let totalIncome = 0;

  athletes.forEach((athlete) => {
    const current = monthMap.get(athlete.id);
    const previous = previousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const coverage = lastPaid
      ? isMonthInRange(selectedAthleteMonth, lastPaid.month, lastPaid.durationMonths || 1)
      : false;
    const prevCoverage = lastPaid
      ? isMonthInRange(previousMonth, lastPaid.month, lastPaid.durationMonths || 1)
      : false;

    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "8/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const paid = current?.paid ?? coverage ?? false;
    const active = Boolean(paid);
    const planDuration = plan.durationMonths || 1;
    const planLabel = planDuration === 1
      ? "Mensual"
      : planDuration === 3
        ? "Trimestral"
        : planDuration === 6
          ? "Semestral"
          : "Anual";

    if (paid) {
      activeNow.add(athlete.id);
      const divisor = current?.durationMonths || plan.durationMonths || 1;
      totalIncome += Number((current?.price ?? plan.priceTotal) || 0) / divisor;
    }
    if (prevCoverage) {
      activePrev.add(athlete.id);
    }
  });

  visibleAthletes.forEach((athlete) => {
    const current = monthMap.get(athlete.id);
    const previous = previousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const coverage = lastPaid
      ? isMonthInRange(selectedAthleteMonth, lastPaid.month, lastPaid.durationMonths || 1)
      : false;
    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "8/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const paid = current?.paid ?? coverage ?? false;
    const active = Boolean(paid);
    const planDuration = plan.durationMonths || 1;
    const planLabel = planDuration === 1
      ? "Mensual"
      : planDuration === 3
        ? "Trimestral"
        : planDuration === 6
          ? "Semestral"
          : "Anual";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${athlete.name}</td>
      <td>
        <span class="plan-badge plan-${planLabel.toLowerCase()}">${planLabel}</span>
        <select data-role="tariff" data-id="${athlete.id}">
          ${tariffPlans
            .map(
              (option) =>
                `<option value="${option.key}" ${option.key === tariff ? "selected" : ""}>${option.key}</option>`
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

  const totalActive = activeNow.size;
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
renderAthletePaymentMonthOptions();

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
on(ui.paymentForm, "submit", async (event) => {
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

on(ui.expenseForm, "submit", async (event) => {
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

on(ui.checkinForm, "submit", async (event) => {
  event.preventDefault();
  await addCheckin(
    ui.checkinName.value,
    ui.checkinType.value,
    currentUser?.uid
  );
  ui.checkinForm.reset();
  await refreshAll();
});

on(ui.trainingForm, "submit", async (event) => {
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

on(ui.athleteForm, "submit", async (event) => {
  event.preventDefault();
  const rawName = ui.athleteName.value.trim();
  const athletes = await getAthletes();
  const existing = athletes.find(
    (athlete) => athlete.name?.toLowerCase() === rawName.toLowerCase()
  );
  const athleteId = existing
    ? existing.id
    : await createAthlete(rawName, currentUser?.uid);
  const tariff = ui.athleteTariff.value;
  const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes");
  const price = plan.priceTotal;
  const paid = ui.athletePaid.value === "SI";
  const startMonth = ui.athletePaymentMonth?.value || selectedAthletePaymentMonth || selectedAthleteMonth;
  const duration = plan.durationMonths || 1;
  for (let i = 0; i < duration; i += 1) {
    const monthKey = addMonthsToKey(startMonth, i);
    await upsertAthleteMonth(
      athleteId,
      monthKey,
      {
        tariff,
        price,
        paid,
        active: paid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
      },
      currentUser?.uid
    );
  }
  ui.athleteForm.reset();
  setAthletePriceFromTariff();
  renderAthletePaymentMonthOptions();
  await refreshAll();
  await refreshAthleteMonthly();
});

on(ui.roleForm, "submit", async (event) => {
  event.preventDefault();
  await updateUserRole(ui.roleUserId.value.trim(), ui.roleValue.value);
  ui.roleForm.reset();
  await refreshAll();
});

on(ui.createUserForm, "submit", async (event) => {
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

on(ui.athleteTariff, "change", () => {
  setAthletePriceFromTariff();
});

on(ui.athleteMonthSelect, "change", async (event) => {
  selectedAthleteMonth = event.target.value;
  await refreshAthleteMonthly();
});

on(ui.athletePaymentMonth, "change", (event) => {
  selectedAthletePaymentMonth = event.target.value;
});

on(ui.paymentMonthSelect, "change", async (event) => {
  selectedPaymentMonth = event.target.value;
  await refreshPaymentList();
});

on(ui.expenseMonthSelect, "change", async (event) => {
  selectedExpenseMonth = event.target.value;
  await refreshExpenseList();
});

on(ui.athleteSearch, "input", async (event) => {
  athleteSearchTerm = event.target.value || "";
  await refreshAthleteMonthly();
});

on(ui.athleteList, "change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.role !== "tariff") return;
  const athleteId = target.dataset.id;
  const priceSpan = ui.athleteList.querySelector(
    `[data-role="price"][data-id="${athleteId}"]`
  );
  if (priceSpan) {
    const plan = tariffPlanMap.get(target.value);
    const newPrice = plan ? plan.priceTotal : 0;
    priceSpan.textContent = newPrice.toFixed(2);
  }
});

on(ui.athleteList, "click", async (event) => {
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
  const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes");
  const price = plan.priceTotal;
  const paid = paidSelect.value === "SI";
  await upsertAthleteMonth(
    athleteId,
    selectedAthleteMonth,
    {
      tariff,
      price,
      paid,
      active: paid,
      durationMonths: plan.durationMonths,
      priceMonthly: plan.priceMonthly,
    },
    currentUser?.uid
  );
  await refreshAthleteMonthly();
  await refreshAll();
});


on(ui.refreshSummary, "click", async () => {
  await refreshAll();
});

on(ui.monthlyYearSelect, "change", (event) => {
  selectedYear = event.target.value;
  renderMonthlySummary();
  ui.monthlyDetailCard.classList.add("hidden");
});

on(ui.monthlySummaryBody, "click", (event) => {
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

on(ui.monthlyDetailClose, "click", () => {
  ui.monthlyDetailCard.classList.add("hidden");
});
