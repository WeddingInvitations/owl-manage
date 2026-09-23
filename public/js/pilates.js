import { ui, formatCurrency } from "./ui.js";
import {
  getPilatesAthletes,
  getPilatesAthleteMonthsForMonth,
  createPilatesAthlete,
  updatePilatesAthlete,
  upsertPilatesAthleteMonth,
  getMonthLabel,
  getAllPilatesAthleteMonths,
} from "./data.js";

let pilatesInitialized = false;
let pilatesListCacheData = null;
let pilatesNameSortDirection = null;

const pilatesTariffPlans = [
  { key: "Reformer 4", durationMonths: 1, priceTotal: 65 },
  { key: "Reformer 8", durationMonths: 1, priceTotal: 109 },
  { key: "Reformer 12", durationMonths: 1, priceTotal: 145 },
  { key: "Barre 4", durationMonths: 1, priceTotal: 55 },
  { key: "Barre 8", durationMonths: 1, priceTotal: 85 },
  { key: "Barre 12", durationMonths: 1, priceTotal: 125 },
];

const pilatesTariffPlanMap = new Map(
  pilatesTariffPlans.map((plan) => [plan.key, {
    ...plan,
    priceMonthly: plan.priceTotal / plan.durationMonths,
  }])
);

const pilatesFamilyConfig = {
  pilates: {
    label: "The Nest Pilates",
    familyLabel: "Tarifas Reformer",
    tariffs: ["Reformer 4", "Reformer 8", "Reformer 12"],
  },
  barre: {
    label: "The Nest Barre",
    familyLabel: "Tarifas Barre",
    tariffs: ["Barre 4", "Barre 8", "Barre 12"],
  },
};

let activePilatesFamily = "pilates";

function getPilatesFamilyConfig(family = activePilatesFamily) {
  return pilatesFamilyConfig[family] || pilatesFamilyConfig.pilates;
}

function getPilatesFamilyForTariff(tariff) {
  const normalizedTariff = String(tariff || "").trim().toLowerCase();
  if (!normalizedTariff) return "pilates";
  if (normalizedTariff.includes("barre")) return "barre";
  if (normalizedTariff.includes("reformer")) return "pilates";
  return "pilates";
}

function extractPilatesTariff(record) {
  return record?.tariff || record?.tarifa || record?.plan || record?.idTarifa || "";
}

function getPilatesTariffFromRecords(current, previous, lastPaid) {
  return extractPilatesTariff(current) || extractPilatesTariff(previous) || extractPilatesTariff(lastPaid) || "Reformer 4";
}

function renderPilatesTariffOptions() {
  if (!ui.pilatesTariff) return;

  const config = getPilatesFamilyConfig();
  const previousValue = ui.pilatesTariff.value;

  ui.pilatesTariff.innerHTML = "";
  config.tariffs.forEach((tariffKey) => {
    const plan = pilatesTariffPlanMap.get(tariffKey);
    if (!plan) return;
    const option = document.createElement("option");
    option.value = plan.key;
    option.textContent = `${plan.key} - ${plan.priceTotal}€`;
    ui.pilatesTariff.appendChild(option);
  });

  const nextValue = config.tariffs.includes(previousValue) ? previousValue : config.tariffs[0];
  if (nextValue) {
    ui.pilatesTariff.value = nextValue;
  }
}

function updatePilatesFamilyUI() {
  if (!ui.pilatesView) return;

  const config = getPilatesFamilyConfig();
  ui.pilatesView.querySelectorAll("[data-pilates-family-tab]").forEach((button) => {
    const isActive = button.dataset.pilatesFamilyTab === activePilatesFamily;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  const familyLabel = ui.pilatesView.querySelector("[data-pilates-family-label]");
  if (familyLabel) {
    familyLabel.textContent = config.familyLabel;
  }

  renderPilatesTariffOptions();
  setPilatesPriceFromTariff();
}

export function setPilatesFamily(family) {
  activePilatesFamily = pilatesFamilyConfig[family] ? family : "pilates";
  updatePilatesFamilyUI();
}

export function getPilatesFamily() {
  return activePilatesFamily;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month < 10 ? "0" : ""}${month}`;
}

function getPreviousMonthKey(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return getMonthKey(date);
}

function getPilatesDiscountValue(reason) {
  if (reason === "Familiar") return 15;
  if (reason === "Funcionario") return 10;
  if (reason === "Mañanas") return 10;
  if (reason === "Amigo") return 10;
  return 0;
}

export function initializePilates() {
  if (pilatesInitialized) return;
  pilatesInitialized = true;
  renderPilatesPaymentMonthOptions();
  renderPilatesMonthOptions();
  renderPilatesListMonthOptions();
  updatePilatesFamilyUI();
  updatePilatesNameSortHeader();

  if (ui.pilatesNameSortHeader) {
    ui.pilatesNameSortHeader.addEventListener("click", () => {
      pilatesNameSortDirection = pilatesNameSortDirection === "asc" ? "desc" : "asc";
      updatePilatesNameSortHeader();
      filterAndRenderPilatesList(ui.pilatesSearch?.value || "", ui.pilatesPaidFilter?.value || "ALL");
    });
  }
}

function getPilatesSortableName(name) {
  return (name || "").trim().toLocaleLowerCase("es");
}

function updatePilatesNameSortHeader() {
  if (!ui.pilatesNameSortHeader) return;

  if (pilatesNameSortDirection === "asc") {
    ui.pilatesNameSortHeader.textContent = "Nombre ▲";
    return;
  }

  if (pilatesNameSortDirection === "desc") {
    ui.pilatesNameSortHeader.textContent = "Nombre ▼";
    return;
  }

  ui.pilatesNameSortHeader.textContent = "Nombre";
}

export function renderPilatesPaymentMonthOptions() {
  if (!ui.pilatesPaymentMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.pilatesPaymentMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.pilatesPaymentMonth.appendChild(option);
  });
  if (options.length > 0) ui.pilatesPaymentMonth.value = options[0];
}

function renderPilatesMonthOptions() {
  if (!ui.pilatesMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  ui.pilatesMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.pilatesMonthSelect.appendChild(option);
  });
  if (options.length > 0) ui.pilatesMonthSelect.value = options[0];
}

function renderPilatesListMonthOptions() {
  if (!ui.pilatesListMonthSelect) return;
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
  ui.pilatesListMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.pilatesListMonthSelect.appendChild(option);
  });
  ui.pilatesListMonthSelect.value = getMonthKey(now);
}

export function renderPilatesCsvMonthOptions() {
  if (!ui.pilatesCsvMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.pilatesCsvMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.pilatesCsvMonth.appendChild(option);
  });
  if (options.length > 0) ui.pilatesCsvMonth.value = options[0];
}

export function setPilatesPriceFromTariff() {
  const tariffKey = ui.pilatesTariff?.value;
  const plan = pilatesTariffPlanMap.get(tariffKey);
  if (plan && ui.pilatesPrice) {
    ui.pilatesPrice.value = String(plan.priceTotal);
  }
  calculatePilatesFinalPrice();
}

export function calculatePilatesFinalPrice() {
  const basePrice = parseFloat(ui.pilatesPrice?.value || "0") || 0;
  const discount = parseFloat(ui.pilatesDiscount?.value || "0") || 0;
  const finalPrice = basePrice * (1 - discount / 100);
  if (ui.pilatesFinalPrice) {
    ui.pilatesFinalPrice.value = finalPrice.toFixed(2);
  }
}

export async function importPilatesAthletesFromCsv(file, monthKey) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { success: 0, errors: 0 };
  }

  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const nameIndex = headers.findIndex((value) => value.includes("nombre") || value.includes("name"));
  const tariffIndex = headers.findIndex((value) => value.includes("tarifa") || value.includes("plan") || value.includes("tariff"));
  const paidIndex = headers.findIndex((value) => value.includes("pagado") || value.includes("paid"));
  const priceIndex = headers.findIndex((value) => value.includes("precio") || value.includes("price"));
  const discountIndex = headers.findIndex((value) => value.includes("descuento") || value.includes("discount"));
  const reasonIndex = headers.findIndex((value) => value.includes("motivo") || value.includes("reason"));

  const athletes = await getPilatesAthletes();
  const athleteMap = new Map(athletes.map((athlete) => [athlete.name?.toLowerCase(), athlete]));
  let success = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i += 1) {
    try {
      const cols = lines[i].split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
      const name = nameIndex >= 0 ? cols[nameIndex] : "";
      if (!name) continue;

      const tariff = tariffIndex >= 0 && cols[tariffIndex] ? cols[tariffIndex] : "Reformer 4";
      const paidValue = paidIndex >= 0 ? cols[paidIndex] : "NO";
      const paid = ["SI", "TRUE", "1", "YES"].includes((paidValue || "").toUpperCase());
      const reason = reasonIndex >= 0 ? cols[reasonIndex] : "";
      const plan = pilatesTariffPlanMap.get(tariff) || pilatesTariffPlanMap.get("Reformer 4");
      const basePrice = priceIndex >= 0 && cols[priceIndex] ? Number(cols[priceIndex]) : plan.priceTotal;
      const discount = discountIndex >= 0 && cols[discountIndex] ? Number(cols[discountIndex]) : getPilatesDiscountValue(reason);
      const finalPrice = basePrice * (1 - discount / 100);

      let athlete = athleteMap.get(name.toLowerCase());
      if (!athlete) {
        const id = await createPilatesAthlete(name, null);
        athlete = { id, name };
        athleteMap.set(name.toLowerCase(), athlete);
      }

      await upsertPilatesAthleteMonth(
        athlete.id,
        monthKey,
        {
          athleteName: athlete.name,
          tariff,
          price: finalPrice,
          basePrice,
          discount,
          discountReason: reason,
          paid,
          paymentMethod: "Efectivo",
          active: paid,
          durationMonths: 1,
          priceMonthly: finalPrice,
          isPaymentMonth: true,
        },
        null
      );

      success += 1;
    } catch (error) {
      console.error("Error importing pilates row:", error);
      errors += 1;
    }
  }

  return { success, errors };
}

function attachPilatesRowListeners() {
  if (!ui.pilatesList) return;

  ui.pilatesList.querySelectorAll('[data-role="pilates-discount-reason"]').forEach((select) => {
    select.addEventListener("change", (event) => {
      const row = event.target.closest("tr");
      const reason = event.target.value;
      const discountDisplay = row?.querySelector('[data-role="pilates-discount-display"]');
      const tariffSelect = row?.querySelector('[data-role="pilates-tariff"]');
      const tariff = tariffSelect?.value || "Reformer 4";
      const plan = pilatesTariffPlanMap.get(tariff) || pilatesTariffPlanMap.get("Reformer 4");
      const priceElement = row?.querySelector('[data-role="pilates-price"]');
      const finalPriceElement = row?.querySelector('[data-role="pilates-final-price"]');
      const discountValue = getPilatesDiscountValue(reason);

      if (discountDisplay) discountDisplay.textContent = `${discountValue}%`;
      if (priceElement) priceElement.textContent = Number(plan.priceTotal || 0).toFixed(2);
      if (finalPriceElement) {
        const finalPrice = Number(plan.priceTotal || 0) * (1 - discountValue / 100);
        finalPriceElement.textContent = finalPrice.toFixed(2);
      }
    });
  });

  ui.pilatesList.querySelectorAll('[data-role="pilates-tariff"]').forEach((select) => {
    select.addEventListener("change", (event) => {
      const row = event.target.closest("tr");
      const newTariff = event.target.value;
      const plan = pilatesTariffPlanMap.get(newTariff) || pilatesTariffPlanMap.get("Reformer 4");
      const reasonSelect = row?.querySelector('[data-role="pilates-discount-reason"]');
      const discountValue = getPilatesDiscountValue(reasonSelect?.value || "Ninguno");
      const priceElement = row?.querySelector('[data-role="pilates-price"]');
      const finalPriceElement = row?.querySelector('[data-role="pilates-final-price"]');

      if (priceElement) priceElement.textContent = Number(plan.priceTotal || 0).toFixed(2);
      if (finalPriceElement) {
        const finalPrice = Number(plan.priceTotal || 0) * (1 - discountValue / 100);
        finalPriceElement.textContent = finalPrice.toFixed(2);
      }
    });
  });

  ui.pilatesList.querySelectorAll('[data-role="edit-pilates-name"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      const athleteId = event.target.dataset.id;
      const nameSpan = ui.pilatesList.querySelector(`[data-role="pilates-athlete-name"][data-id="${athleteId}"]`);
      const currentName = nameSpan?.textContent || "";
      const newName = prompt("Introduce el nuevo nombre del atleta:", currentName);
      if (newName && newName.trim() !== "" && newName !== currentName) {
        try {
          await updatePilatesAthlete(athleteId, { name: newName.trim() }, null);
          window.dispatchEvent(new CustomEvent("pilates-name-updated"));
        } catch (error) {
          console.error("Error al actualizar el nombre del atleta:", error);
          alert("Error al actualizar el nombre del atleta");
        }
      }
    });
  });
}

function filterAndRenderPilatesList(searchTerm, paidFilter) {
  if (!pilatesListCacheData || !ui.pilatesList) return;
  const { allAthletes, athletesFallback, listMonthMap, listPreviousMap, athleteHistory } = pilatesListCacheData;
  updatePilatesNameSortHeader();
  const familyConfig = getPilatesFamilyConfig();
  const familyTariffs = new Set(familyConfig.tariffs);
  const searchValue = (searchTerm || "").trim().toLowerCase();
  const filteredAthletes = searchValue
    ? allAthletes.filter((athlete) => athlete.name?.toLowerCase().includes(searchValue))
    : allAthletes;

  let listAthletes = !searchValue && filteredAthletes.length === 0 ? athletesFallback : filteredAthletes;

  listAthletes = listAthletes.map((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const mostRecent = history.length > 0 ? history[0] : null;
    const lastUpdate = current?.updatedAt || current?.createdAt || mostRecent?.updatedAt || mostRecent?.createdAt;
    return { ...athlete, lastUpdate };
  }).filter((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const previous = listPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = getPilatesTariffFromRecords(current, previous, lastPaid);
    return familyTariffs.has(tariff);
  }).sort((a, b) => {
    if (pilatesNameSortDirection) {
      const comparison = getPilatesSortableName(a.name).localeCompare(getPilatesSortableName(b.name), "es");
      return pilatesNameSortDirection === "asc" ? comparison : -comparison;
    }

    if (!a.lastUpdate && !b.lastUpdate) return 0;
    if (!a.lastUpdate) return 1;
    if (!b.lastUpdate) return -1;
    const timeA = a.lastUpdate?.seconds || a.lastUpdate?.toMillis?.() / 1000 || 0;
    const timeB = b.lastUpdate?.seconds || b.lastUpdate?.toMillis?.() / 1000 || 0;
    return timeB - timeA;
  });

  ui.pilatesList.innerHTML = "";
  let visibleCount = 0;
  listAthletes.forEach((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const previous = listPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = getPilatesTariffFromRecords(current, previous, lastPaid);
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = pilatesTariffPlanMap.get(tariff) || pilatesTariffPlanMap.get("Reformer 4") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const discountReason = current?.discountReason ?? previous?.discountReason ?? lastPaid?.discountReason ?? "";
    const displayDiscount = getPilatesDiscountValue(discountReason);
    const paid = Boolean(current?.paid);
    const paymentMethod = current?.paymentMethod || previous?.paymentMethod || lastPaid?.paymentMethod || "Efectivo";
    if (paidFilter === "SI" && !paid) return;
    if (paidFilter === "NO" && paid) return;

    visibleCount += 1;
    const row = document.createElement("tr");
    row.dataset.id = athlete.id;
    row.dataset.name = athlete.name || "";
    row.innerHTML = `
      <td style="max-width: 200px;">
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <span data-role="pilates-athlete-name" data-id="${athlete.id}" style="flex: 1; line-height: 1.3;">${athlete.name || "(Sin nombre)"}</span>
          <button class="edit-name-btn" data-role="edit-pilates-name" data-id="${athlete.id}" title="Editar nombre" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.6;">✏️</button>
        </div>
      </td>
      <td>
        <select data-role="pilates-tariff" data-id="${athlete.id}">
          ${pilatesTariffPlans.map((option) => `<option value="${option.key}" ${option.key === tariff ? "selected" : ""}>${option.key}</option>`).join("")}
        </select>
      </td>
      <td><span data-role="pilates-price" data-id="${athlete.id}">${Number(price).toFixed(2)}</span> €</td>
      <td><span data-role="pilates-discount-display" data-id="${athlete.id}">${displayDiscount}%</span></td>
      <td>
        <select data-role="pilates-discount-reason" data-id="${athlete.id}">
          <option value="Ninguno" ${discountReason === "Ninguno" || !discountReason ? "selected" : ""}>Ninguno</option>
          <option value="Familiar" ${discountReason === "Familiar" ? "selected" : ""}>Familiar</option>
          <option value="Funcionario" ${discountReason === "Funcionario" ? "selected" : ""}>Funcionario</option>
          <option value="Mañanas" ${discountReason === "Mañanas" ? "selected" : ""}>Mañanas</option>
          <option value="Otro" ${discountReason === "Otro" ? "selected" : ""}>Otro</option>
        </select>
      </td>
      <td><span data-role="pilates-final-price" data-id="${athlete.id}">${Number(price).toFixed(2)}</span> €</td>
      <td style="min-width:110px;">
        <select data-role="pilates-paid" data-id="${athlete.id}" class="${paid ? "select-paid" : "select-unpaid"}">
          <option value="SI" ${paid ? "selected" : ""}>Sí</option>
          <option value="NO" ${!paid ? "selected" : ""}>No</option>
        </select>
      </td>
      <td style="min-width:110px;">
        <select data-role="pilates-payment-method" data-id="${athlete.id}">
          <option value="Efectivo" ${paymentMethod === "Efectivo" ? "selected" : ""}>Efectivo</option>
          <option value="Tarjeta" ${paymentMethod === "Tarjeta" ? "selected" : ""}>Tarjeta</option>
        </select>
      </td>
    `;
    ui.pilatesList.appendChild(row);
  });

  if (visibleCount === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="8" style="text-align: center; padding: 16px; color: #888;">No se encontraron coincidencias</td>`;
    ui.pilatesList.appendChild(emptyRow);
  }

  attachPilatesRowListeners();

  if (ui.pilatesListCount) {
    ui.pilatesListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }
}

export async function refreshPilatesMonthly(
  selectedPilatesMonth,
  selectedPilatesListMonth,
  selectedPilatesPaymentMonth,
  pilatesPaidFilter,
  pilatesSearchTerm,
  selectedPilatesCsvMonth
) {
  if (!ui.pilatesList) return;
  if (!selectedPilatesMonth) {
    renderPilatesMonthOptions();
  }
  if (!selectedPilatesListMonth) {
    renderPilatesListMonthOptions();
  }
  if (!ui.pilatesPaymentMonth?.options?.length) {
    renderPilatesPaymentMonthOptions();
  }
  if (!ui.pilatesCsvMonth?.options?.length) {
    renderPilatesCsvMonthOptions();
  }
  void selectedPilatesPaymentMonth;
  void selectedPilatesCsvMonth;

  const summaryMonth = selectedPilatesMonth || ui.pilatesMonthSelect?.value || getMonthKey(new Date());
  const listMonth = selectedPilatesListMonth || ui.pilatesListMonthSelect?.value || getMonthKey(new Date());
  if (ui.pilatesMonthSelect) ui.pilatesMonthSelect.value = summaryMonth;
  if (ui.pilatesListMonthSelect) ui.pilatesListMonthSelect.value = listMonth;

  const athletes = await getPilatesAthletes();
  const familyConfig = getPilatesFamilyConfig();
  const familyTariffs = new Set(familyConfig.tariffs);
  if (ui.pilatesNameList) {
    const names = Array.from(new Set(athletes.map((athlete) => athlete.name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    ui.pilatesNameList.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ui.pilatesNameList.appendChild(option);
    });
  }

  const allMonthRecords = await getAllPilatesAthleteMonths();
  const summaryMonthRecords = await getPilatesAthleteMonthsForMonth(summaryMonth);
  const summaryPreviousMonth = getPreviousMonthKey(summaryMonth);
  const summaryPreviousRecords = summaryPreviousMonth ? await getPilatesAthleteMonthsForMonth(summaryPreviousMonth) : [];
  const listMonthRecords = await getPilatesAthleteMonthsForMonth(listMonth);
  const listPreviousMonth = getPreviousMonthKey(listMonth);
  const listPreviousRecords = listPreviousMonth ? await getPilatesAthleteMonthsForMonth(listPreviousMonth) : [];

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
  athleteHistory.forEach((records) => records.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)));

  const activeNow = new Set();
  const activePrev = new Set();
  let totalIncome = 0;
  athletes.forEach((athlete) => {
    const current = summaryMonthMap.get(athlete.id);
    const previous = summaryPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = getPilatesTariffFromRecords(current, previous, lastPaid);
    if (!familyTariffs.has(tariff)) return;
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = pilatesTariffPlanMap.get(tariff) || pilatesTariffPlanMap.get("Reformer 4") || fallbackPlan;
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

  const athletesFallback = Array.from(
    new Map(listMonthRecords.map((record) => [
      record.athleteId,
      { id: record.athleteId, name: record.athleteName || "(Sin nombre)" },
    ])).values()
  );
  pilatesListCacheData = { allAthletes: athletes, athletesFallback, listMonthMap, listPreviousMap, athleteHistory };
  filterAndRenderPilatesList(pilatesSearchTerm, pilatesPaidFilter);

  const totalActive = activeNow.size;
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;
  if (ui.pilatesSummaryActive) ui.pilatesSummaryActive.textContent = String(totalActive);
  if (ui.pilatesSummaryAverage) ui.pilatesSummaryAverage.textContent = formatCurrency(averageTariff);
  if (ui.pilatesSummaryNew) ui.pilatesSummaryNew.textContent = String(totalNew);
  if (ui.pilatesSummaryDrop) ui.pilatesSummaryDrop.textContent = String(totalDrop);
}

export { pilatesTariffPlanMap };
