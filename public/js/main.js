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
  createAcroAthlete,
  getAcroAthletes,
  getAllAcroAthleteMonths,
  getAcroAthleteMonthsForMonth,
  upsertAcroAthleteMonth,
} from "./data.js?v=20250206t";
import { createUserWithRole } from "./admin.js";

let currentUser = null;
let currentRole = "RECEPTION";
let monthlyDetails = new Map();
let monthlyTotals = { income: 0, expenses: 0 };
let availableYears = [];
let selectedYear = "";
let selectedAthleteMonth = "";
let selectedAthleteListMonth = "";
let availablePaymentMonths = [];
let selectedPaymentMonth = "";
let availableExpenseMonths = [];
let selectedExpenseMonth = "";
let athleteSearchTerm = "";
let selectedAthletePaymentMonth = "";
let athletePaidFilter = "ALL";
let selectedAthleteCsvMonth = "";

// Acrobacias state
let selectedAcroMonth = "";
let selectedAcroListMonth = "";
let selectedAcroPaymentMonth = "";
let acroPaidFilter = "ALL";
let acroSearchTerm = "";
let selectedAcroCsvMonth = "";

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

// Tarifas específicas para Acrobacias
const acroTariffPlans = [
  { key: "4/mes", durationMonths: 1, priceTotal: 45 },
  { key: "8/mes", durationMonths: 1, priceTotal: 65 },
  { key: "12/mes", durationMonths: 1, priceTotal: 85 },
  { key: "Ilimitado", durationMonths: 1, priceTotal: 105 },
];

const acroTariffPlanMap = new Map(
  acroTariffPlans.map((plan) => [plan.key, {
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

function getCurrentYearMonths() {
  const year = new Date().getFullYear();
  const months = [];
  for (let month = 1; month <= 12; month += 1) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
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
  availablePaymentMonths = getCurrentYearMonths();
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
  availableExpenseMonths = getCurrentYearMonths();
  const currentKey = getMonthKey(new Date());
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

function renderAthleteListMonthOptions() {
  if (!ui.athleteListMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 12; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  for (let i = 1; i <= 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.athleteListMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.athleteListMonthSelect.appendChild(option);
  });
  selectedAthleteListMonth = getMonthKey(now);
  ui.athleteListMonthSelect.value = selectedAthleteListMonth;
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

function renderAthleteCsvMonthOptions() {
  if (!ui.athleteCsvMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 12; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  for (let i = 1; i <= 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.athleteCsvMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.athleteCsvMonth.appendChild(option);
  });
  selectedAthleteCsvMonth = getMonthKey(now);
  ui.athleteCsvMonth.value = selectedAthleteCsvMonth;
}

function normalizeTariff(value, plans, fallbackKey) {
  if (!value) return fallbackKey;
  const normalized = value.trim();
  const match = plans.find((plan) => plan.key.toLowerCase() === normalized.toLowerCase());
  return match ? match.key : fallbackKey;
}

function parseCsvRows(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  return dataLines.map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((key, index) => {
      row[key] = values[index] ?? "";
    });
    return row;
  });
}

async function importAthletesFromCsv(file, monthKey) {
  const text = await file.text();
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new Error("CSV vacío o sin datos");
  }
  const athletes = await getAthletes();
  const athleteMap = new Map(
    athletes.map((athlete) => [athlete.name?.toLowerCase(), athlete])
  );
  let processed = 0;

  for (const row of rows) {
    const name = row.nombre || row.name || "";
    if (!name) continue;
    const paidValue = (row.pagado || row.paid || "").toString().trim().toUpperCase();
    const paid = paidValue === "SI" || paidValue === "TRUE" || paidValue === "1" || paidValue === "YES";
    const tariff = normalizeTariff(row.tarifa || row.plan || "", tariffPlans, "8/mes");
    const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes");
    const price = row.precio ? Number(row.precio) : plan.priceTotal;
    const duration = plan.durationMonths || 1;

    let athlete = athleteMap.get(name.toLowerCase());
    if (!athlete) {
      const id = await createAthlete(name, currentUser?.uid);
      athlete = { id, name };
      athleteMap.set(name.toLowerCase(), athlete);
    }

    for (let i = 0; i < duration; i += 1) {
      const targetMonth = addMonthsToKey(monthKey, i);
      await upsertAthleteMonth(
        athlete.id,
        targetMonth,
        {
          athleteName: athlete.name,
          tariff,
          price,
          paid,
          active: paid,
          durationMonths: plan.durationMonths,
          priceMonthly: plan.priceMonthly,
          isPaymentMonth: i === 0,
        },
        currentUser?.uid
      );
    }

    processed += 1;
  }

  return processed;
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
  if (!selectedAthleteListMonth) {
    renderAthleteListMonthOptions();
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
  const summaryMonthRecords = await getAthleteMonthsForMonth(selectedAthleteMonth);
  const summaryPreviousMonth = getPreviousMonthKey(selectedAthleteMonth);
  const summaryPreviousRecords = summaryPreviousMonth
    ? await getAthleteMonthsForMonth(summaryPreviousMonth)
    : [];

  const listMonthRecords = await getAthleteMonthsForMonth(selectedAthleteListMonth);
  const listPreviousMonth = getPreviousMonthKey(selectedAthleteListMonth);
  const listPreviousRecords = listPreviousMonth
    ? await getAthleteMonthsForMonth(listPreviousMonth)
    : [];

  const summaryMonthMap = new Map();
  summaryMonthRecords.forEach((record) => summaryMonthMap.set(record.athleteId, record));
  const summaryPreviousMap = new Map();
  summaryPreviousRecords.forEach((record) => summaryPreviousMap.set(record.athleteId, record));

  const listMonthMap = new Map();
  listMonthRecords.forEach((record) => listMonthMap.set(record.athleteId, record));
  const listPreviousMap = new Map();
  listPreviousRecords.forEach((record) => listPreviousMap.set(record.athleteId, record));
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
    const current = summaryMonthMap.get(athlete.id);
    const previous = summaryPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);

    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "8/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const paid = Boolean(current?.paid);
    const active = paid;
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
    if (previous?.paid) {
      activePrev.add(athlete.id);
    }
  });

  let visibleCount = 0;
  const listAthletes = visibleAthletes.length > 0
    ? visibleAthletes
    : Array.from(new Map(listMonthRecords.map((record) => [
        record.athleteId,
        { id: record.athleteId, name: record.athleteName || "(Sin nombre)" },
      ])).values());

  listAthletes.forEach((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const previous = listPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "8/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const paid = Boolean(current?.paid);
    const active = paid;
    if (athletePaidFilter === "SI" && !paid) {
      return;
    }
    if (athletePaidFilter === "NO" && paid) {
      return;
    }
    visibleCount += 1;
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
        <select data-role="tariff" data-id="${athlete.id}" ${paid ? "disabled" : ""}>
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
        <select data-role="paid" data-id="${athlete.id}" ${paid ? "disabled" : ""}>
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>${active ? "Activo" : "Inactivo"}</td>
      <td>
        <button class="btn small" data-role="save" data-id="${athlete.id}" data-name="${athlete.name}" ${paid ? "disabled" : ""}>
          Guardar
        </button>
      </td>
    `;
    ui.athleteList.appendChild(row);
  });

  if (ui.athleteListCount) {
    ui.athleteListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }

  const totalActive = activeNow.size;
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;

  ui.athleteSummaryActive.textContent = String(totalActive);
  ui.athleteSummaryAverage.textContent = formatCurrency(averageTariff);
  ui.athleteSummaryNew.textContent = String(totalNew);
  ui.athleteSummaryDrop.textContent = String(totalDrop);
}

// ========== ACROBACIAS ==========

function renderAcroMonthOptions() {
  if (!ui.acroMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  ui.acroMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.acroMonthSelect.appendChild(option);
  });
  selectedAcroMonth = options[0];
  ui.acroMonthSelect.value = selectedAcroMonth;
}

function renderAcroListMonthOptions() {
  if (!ui.acroListMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 12; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  for (let i = 1; i <= 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.acroListMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.acroListMonthSelect.appendChild(option);
  });
  selectedAcroListMonth = getMonthKey(now);
  ui.acroListMonthSelect.value = selectedAcroListMonth;
}

function renderAcroPaymentMonthOptions() {
  if (!ui.acroPaymentMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.acroPaymentMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.acroPaymentMonth.appendChild(option);
  });
  selectedAcroPaymentMonth = options[0];
  ui.acroPaymentMonth.value = selectedAcroPaymentMonth;
}

function renderAcroCsvMonthOptions() {
  if (!ui.acroCsvMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 12; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  for (let i = 1; i <= 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.acroCsvMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.acroCsvMonth.appendChild(option);
  });
  selectedAcroCsvMonth = getMonthKey(now);
  ui.acroCsvMonth.value = selectedAcroCsvMonth;
}

function setAcroPriceFromTariff() {
  if (!ui.acroTariff || !ui.acroPrice) return;
  const tariff = ui.acroTariff.value;
  const plan = acroTariffPlanMap.get(tariff);
  ui.acroPrice.value = plan ? plan.priceTotal : 0;
}

async function importAcroAthletesFromCsv(file, monthKey) {
  const text = await file.text();
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new Error("CSV vacío o sin datos");
  }
  const athletes = await getAcroAthletes();
  const athleteMap = new Map(
    athletes.map((athlete) => [athlete.name?.toLowerCase(), athlete])
  );
  let processed = 0;

  for (const row of rows) {
    const name = row.nombre || row.name || "";
    if (!name) continue;
    const paidValue = (row.pagado || row.paid || "").toString().trim().toUpperCase();
    const paid = paidValue === "SI" || paidValue === "TRUE" || paidValue === "1" || paidValue === "YES";
    const tariff = normalizeTariff(row.tarifa || row.plan || "", acroTariffPlans, "4/mes");
    const plan = acroTariffPlanMap.get(tariff) || acroTariffPlanMap.get("4/mes");
    const price = row.precio ? Number(row.precio) : plan.priceTotal;
    const duration = plan.durationMonths || 1;

    let athlete = athleteMap.get(name.toLowerCase());
    if (!athlete) {
      const id = await createAcroAthlete(name, currentUser?.uid);
      athlete = { id, name };
      athleteMap.set(name.toLowerCase(), athlete);
    }

    for (let i = 0; i < duration; i += 1) {
      const targetMonth = addMonthsToKey(monthKey, i);
      await upsertAcroAthleteMonth(
        athlete.id,
        targetMonth,
        {
          athleteName: athlete.name,
          tariff,
          price,
          paid,
          active: paid,
          durationMonths: plan.durationMonths,
          priceMonthly: plan.priceMonthly,
          isPaymentMonth: i === 0,
        },
        currentUser?.uid
      );
    }

    processed += 1;
  }

  return processed;
}

async function refreshAcroMonthly() {
  if (!ui.acroList) return;
  
  if (!selectedAcroMonth) {
    renderAcroMonthOptions();
  }
  if (!selectedAcroListMonth) {
    renderAcroListMonthOptions();
  }

  const athletes = await getAcroAthletes();

  // Populate name datalists
  if (ui.acroNameList) {
    const names = Array.from(
      new Set(athletes.map((athlete) => athlete.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    ui.acroNameList.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ui.acroNameList.appendChild(option);
    });
  }

  if (ui.acroSearchList) {
    const names = Array.from(
      new Set(athletes.map((athlete) => athlete.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    ui.acroSearchList.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ui.acroSearchList.appendChild(option);
    });
  }

  const searchValue = acroSearchTerm.trim().toLowerCase();
  const visibleAthletes = searchValue
    ? athletes.filter((athlete) => athlete.name?.toLowerCase().includes(searchValue))
    : athletes;

  const allMonthRecords = await getAllAcroAthleteMonths();
  const summaryMonthRecords = await getAcroAthleteMonthsForMonth(selectedAcroMonth);
  const summaryPreviousMonth = getPreviousMonthKey(selectedAcroMonth);
  const summaryPreviousRecords = summaryPreviousMonth
    ? await getAcroAthleteMonthsForMonth(summaryPreviousMonth)
    : [];

  const listMonthRecords = await getAcroAthleteMonthsForMonth(selectedAcroListMonth);
  const listPreviousMonth = getPreviousMonthKey(selectedAcroListMonth);
  const listPreviousRecords = listPreviousMonth
    ? await getAcroAthleteMonthsForMonth(listPreviousMonth)
    : [];

  const summaryMonthMap = new Map();
  summaryMonthRecords.forEach((record) => summaryMonthMap.set(record.athleteId, record));
  const summaryPreviousMap = new Map();
  summaryPreviousRecords.forEach((record) => summaryPreviousMap.set(record.athleteId, record));

  const listMonthMap = new Map();
  listMonthRecords.forEach((record) => listMonthMap.set(record.athleteId, record));
  const listPreviousMap = new Map();
  listPreviousRecords.forEach((record) => listPreviousMap.set(record.athleteId, record));

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

  ui.acroList.innerHTML = "";

  const activeNow = new Set();
  const activePrev = new Set();
  let totalIncome = 0;

  athletes.forEach((athlete) => {
    const current = summaryMonthMap.get(athlete.id);
    const previous = summaryPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);

    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "4/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = acroTariffPlanMap.get(tariff) || acroTariffPlanMap.get("4/mes") || fallbackPlan;
    const paid = Boolean(current?.paid);

    if (paid) {
      activeNow.add(athlete.id);
      const divisor = current?.durationMonths || plan.durationMonths || 1;
      totalIncome += Number((current?.price ?? plan.priceTotal) || 0) / divisor;
    }
    if (previous?.paid) {
      activePrev.add(athlete.id);
    }
  });

  let visibleCount = 0;
  const listAthletes = visibleAthletes.length > 0
    ? visibleAthletes
    : Array.from(new Map(listMonthRecords.map((record) => [
        record.athleteId,
        { id: record.athleteId, name: record.athleteName || "(Sin nombre)" },
      ])).values());

  listAthletes.forEach((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const previous = listPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "4/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = acroTariffPlanMap.get(tariff) || acroTariffPlanMap.get("4/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const paid = Boolean(current?.paid);
    const active = paid;

    if (acroPaidFilter === "SI" && !paid) {
      return;
    }
    if (acroPaidFilter === "NO" && paid) {
      return;
    }

    visibleCount += 1;
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
      <td>${athlete.name || "(Sin nombre)"}</td>
      <td>
        <span class="plan-badge plan-${planLabel.toLowerCase()}">${planLabel}</span>
        <select data-role="acro-tariff" data-id="${athlete.id}" ${paid ? "disabled" : ""}>
          ${acroTariffPlans
            .map(
              (option) =>
                `<option value="${option.key}" ${option.key === tariff ? "selected" : ""}>${option.key}</option>`
            )
            .join("")}
        </select>
      </td>
      <td><span data-role="acro-price" data-id="${athlete.id}">${price.toFixed(2)}</span> €</td>
      <td>
        <select data-role="acro-paid" data-id="${athlete.id}" ${paid ? "disabled" : ""}>
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>${active ? "Activo" : "Inactivo"}</td>
      <td>
        <button class="btn small" data-role="acro-save" data-id="${athlete.id}" data-name="${athlete.name || ""}" ${paid ? "disabled" : ""}>
          Guardar
        </button>
      </td>
    `;
    ui.acroList.appendChild(row);
  });

  if (ui.acroListCount) {
    ui.acroListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }

  const totalActive = activeNow.size;
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;

  if (ui.acroSummaryActive) ui.acroSummaryActive.textContent = String(totalActive);
  if (ui.acroSummaryAverage) ui.acroSummaryAverage.textContent = formatCurrency(averageTariff);
  if (ui.acroSummaryNew) ui.acroSummaryNew.textContent = String(totalNew);
  if (ui.acroSummaryDrop) ui.acroSummaryDrop.textContent = String(totalDrop);
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
renderAthleteListMonthOptions();
renderAthleteCsvMonthOptions();
if (ui.athleteModal) {
  ui.athleteModal.classList.add("hidden");
}
if (ui.athleteCsvModal) {
  ui.athleteCsvModal.classList.add("hidden");
}

// Acrobacias init
renderAcroMonthOptions();
setAcroPriceFromTariff();
renderAcroPaymentMonthOptions();
renderAcroListMonthOptions();
renderAcroCsvMonthOptions();
if (ui.acroModal) {
  ui.acroModal.classList.add("hidden");
}
if (ui.acroCsvModal) {
  ui.acroCsvModal.classList.add("hidden");
}

bindAuth(
  ui,
  async (user, profile) => {
    currentUser = user;
    currentRole = profile.role;
    if (user) {
      await refreshAll();
      await refreshAthleteMonthly();
      await refreshAcroMonthly();
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
  const athleteName = existing?.name || rawName;
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
        athleteName,
        tariff,
        price,
        paid,
        active: paid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
  ui.athleteForm.reset();
  setAthletePriceFromTariff();
  renderAthletePaymentMonthOptions();
  if (ui.athleteModal) {
    ui.athleteModal.classList.add("hidden");
  }
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

on(ui.athleteModalOpen, "click", () => {
  ui.athleteModal?.classList.remove("hidden");
});

on(ui.athleteModalClose, "click", () => {
  ui.athleteModal?.classList.add("hidden");
});

on(ui.athleteCsvOpen, "click", () => {
  renderAthleteCsvMonthOptions();
  ui.athleteCsvModal?.classList.remove("hidden");
});

on(ui.athleteCsvClose, "click", () => {
  ui.athleteCsvModal?.classList.add("hidden");
});

on(ui.athleteCsvMonth, "change", (event) => {
  selectedAthleteCsvMonth = event.target.value;
});

on(ui.athleteCsvForm, "submit", async (event) => {
  event.preventDefault();
  if (!ui.athleteCsvFile?.files?.length) return;
  ui.athleteCsvStatus.textContent = "Importando...";
  const monthKey = ui.athleteCsvMonth?.value || selectedAthleteCsvMonth || getMonthKey(new Date());
  try {
    const processed = await importAthletesFromCsv(ui.athleteCsvFile.files[0], monthKey);
    ui.athleteCsvStatus.textContent = `Importados ${processed} atletas.`;
    ui.athleteCsvForm.reset();
    renderAthleteCsvMonthOptions();
    ui.athleteCsvModal?.classList.add("hidden");
    await refreshAll();
    await refreshAthleteMonthly();
  } catch (error) {
    ui.athleteCsvStatus.textContent = `Error: ${error.message || error}`;
  }
});

on(ui.athleteMonthSelect, "change", async (event) => {
  selectedAthleteMonth = event.target.value;
  await refreshAthleteMonthly();
});

on(ui.athleteListMonthSelect, "change", async (event) => {
  selectedAthleteListMonth = event.target.value;
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

on(ui.athletePaidFilter, "change", async (event) => {
  athletePaidFilter = event.target.value || "ALL";
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
  const athleteName = button.dataset.name || "";
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
  const duration = paid ? (plan.durationMonths || 1) : 1;
  
  // Si se marca como pagado y la tarifa es multi-mes, crear registros para meses siguientes
  for (let i = 0; i < duration; i += 1) {
    const monthKey = addMonthsToKey(selectedAthleteListMonth, i);
    await upsertAthleteMonth(
      athleteId,
      monthKey,
      {
        athleteName,
        tariff,
        price,
        paid,
        active: paid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
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

// ========== ACROBACIAS EVENT HANDLERS ==========

on(ui.acroForm, "submit", async (event) => {
  event.preventDefault();
  const rawName = ui.acroName.value.trim();
  if (!rawName) return;
  
  const athletes = await getAcroAthletes();
  const existing = athletes.find(
    (athlete) => athlete.name?.toLowerCase() === rawName.toLowerCase()
  );
  const athleteId = existing
    ? existing.id
    : await createAcroAthlete(rawName, currentUser?.uid);
  const athleteName = existing?.name || rawName;
  const tariff = ui.acroTariff.value;
  const plan = acroTariffPlanMap.get(tariff) || acroTariffPlanMap.get("4/mes");
  const price = plan.priceTotal;
  const paid = ui.acroPaid.value === "SI";
  const startMonth = ui.acroPaymentMonth?.value || selectedAcroPaymentMonth || selectedAcroMonth;
  const duration = plan.durationMonths || 1;
  
  for (let i = 0; i < duration; i += 1) {
    const monthKey = addMonthsToKey(startMonth, i);
    await upsertAcroAthleteMonth(
      athleteId,
      monthKey,
      {
        athleteName,
        tariff,
        price,
        paid,
        active: paid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
  
  ui.acroForm.reset();
  setAcroPriceFromTariff();
  renderAcroPaymentMonthOptions();
  if (ui.acroModal) {
    ui.acroModal.classList.add("hidden");
  }
  await refreshAcroMonthly();
});

on(ui.acroTariff, "change", () => {
  setAcroPriceFromTariff();
});

on(ui.acroModalOpen, "click", () => {
  ui.acroModal?.classList.remove("hidden");
});

on(ui.acroModalClose, "click", () => {
  ui.acroModal?.classList.add("hidden");
});

on(ui.acroCsvOpen, "click", () => {
  renderAcroCsvMonthOptions();
  ui.acroCsvModal?.classList.remove("hidden");
});

on(ui.acroCsvClose, "click", () => {
  ui.acroCsvModal?.classList.add("hidden");
});

on(ui.acroCsvMonth, "change", (event) => {
  selectedAcroCsvMonth = event.target.value;
});

on(ui.acroCsvForm, "submit", async (event) => {
  event.preventDefault();
  if (!ui.acroCsvFile?.files?.length) return;
  ui.acroCsvStatus.textContent = "Importando...";
  const monthKey = ui.acroCsvMonth?.value || selectedAcroCsvMonth || getMonthKey(new Date());
  try {
    const processed = await importAcroAthletesFromCsv(ui.acroCsvFile.files[0], monthKey);
    ui.acroCsvStatus.textContent = `Importados ${processed} atletas.`;
    ui.acroCsvForm.reset();
    renderAcroCsvMonthOptions();
    ui.acroCsvModal?.classList.add("hidden");
    await refreshAcroMonthly();
  } catch (error) {
    ui.acroCsvStatus.textContent = `Error: ${error.message || error}`;
  }
});

on(ui.acroMonthSelect, "change", async (event) => {
  selectedAcroMonth = event.target.value;
  await refreshAcroMonthly();
});

on(ui.acroListMonthSelect, "change", async (event) => {
  selectedAcroListMonth = event.target.value;
  await refreshAcroMonthly();
});

on(ui.acroPaymentMonth, "change", (event) => {
  selectedAcroPaymentMonth = event.target.value;
});

on(ui.acroSearch, "input", async (event) => {
  acroSearchTerm = event.target.value || "";
  await refreshAcroMonthly();
});

on(ui.acroPaidFilter, "change", async (event) => {
  acroPaidFilter = event.target.value || "ALL";
  await refreshAcroMonthly();
});

on(ui.acroList, "change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.role !== "acro-tariff") return;
  const athleteId = target.dataset.id;
  const priceSpan = ui.acroList.querySelector(
    `[data-role="acro-price"][data-id="${athleteId}"]`
  );
  if (priceSpan) {
    const plan = acroTariffPlanMap.get(target.value);
    const newPrice = plan ? plan.priceTotal : 0;
    priceSpan.textContent = newPrice.toFixed(2);
  }
});

on(ui.acroList, "click", async (event) => {
  const button = event.target.closest("button[data-role='acro-save']");
  if (!button) return;
  const athleteId = button.dataset.id;
  const athleteName = button.dataset.name || "";
  const tariffSelect = ui.acroList.querySelector(
    `select[data-role="acro-tariff"][data-id="${athleteId}"]`
  );
  const paidSelect = ui.acroList.querySelector(
    `select[data-role="acro-paid"][data-id="${athleteId}"]`
  );
  if (!tariffSelect || !paidSelect) return;
  const tariff = tariffSelect.value;
  const plan = acroTariffPlanMap.get(tariff) || acroTariffPlanMap.get("4/mes");
  const price = plan.priceTotal;
  const paid = paidSelect.value === "SI";
  const duration = paid ? (plan.durationMonths || 1) : 1;
  
  // Si se marca como pagado y la tarifa es multi-mes, crear registros para meses siguientes
  for (let i = 0; i < duration; i += 1) {
    const monthKey = addMonthsToKey(selectedAcroListMonth, i);
    await upsertAcroAthleteMonth(
      athleteId,
      monthKey,
      {
        athleteName,
        tariff,
        price,
        paid,
        active: paid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
  await refreshAcroMonthly();
});
