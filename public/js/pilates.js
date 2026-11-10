import { ui, formatCurrency } from "./ui.js";
import { normalizeSearchText } from "./search.js";
import {
  getPilatesAthletes,
  getPilatesAthleteMonthsForMonth,
  createPilatesAthlete,
  updatePilatesAthlete,
  deletePilatesAthlete,
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

function familyForMonthlyRecord(record) {
  if (record?.family === "pilates" || record?.family === "barre") return record.family;
  const tariff = String(extractPilatesTariff(record) || "").trim().toLowerCase();
  if (tariff.includes("barre")) return "barre";
  if (tariff.includes("reformer")) return "pilates";
  return null;
}

function groupMonthlyRecordsByFamily(records) {
  const grouped = new Map();
  records.forEach((record) => {
    const family = familyForMonthlyRecord(record);
    if (family) grouped.set(`${record.athleteId}__${family}`, record);
    else grouped.set(`${record.athleteId}__legacy`, record);
  });
  return grouped;
}

function getMonthlyRecordForFamily(recordsByFamily, athleteId, family = activePilatesFamily) {
  return recordsByFamily.get(`${athleteId}__${family}`)
    || recordsByFamily.get(`${athleteId}__legacy`)
    || null;
}

function getHistoryForFamily(history, family = activePilatesFamily) {
  return (history || []).filter((record) => familyForMonthlyRecord(record) === family);
}

function athleteHasFamily(athlete, family = activePilatesFamily) {
  return Array.isArray(athlete?.nestFamilies) && athlete.nestFamilies.includes(family);
}

function extractPilatesTariff(record) {
  return record?.tariff || record?.tarifa || record?.plan || record?.idTarifa || "";
}

function getPilatesTariffFromRecords(current, previous, lastPaid) {
  return extractPilatesTariff(current) || extractPilatesTariff(previous) || extractPilatesTariff(lastPaid) ||
    (activePilatesFamily === "barre" ? "Barre 4" : "Reformer 4");
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
  ui.pilatesView.dataset.pilatesFamily = activePilatesFamily;
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
  if (reason === "promoApertura") return 15;
  if (reason === "Familiar") return 10;
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
  for (let i = 8; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  for (let i = 1; i <= 2; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.pilatesMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.pilatesMonthSelect.appendChild(option);
  });
  ui.pilatesMonthSelect.value = getMonthKey(now);
}

function renderPilatesListMonthOptions() {
  if (!ui.pilatesListMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 8; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  for (let i = 1; i <= 2; i += 1) {
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
  const emailIndex = headers.findIndex((value) => value.includes("correo") || value.includes("email") || value.includes("e-mail"));
  if (emailIndex < 0) {
    throw new Error("El CSV debe incluir una columna correo o email para habilitar las reservas.");
  }
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
      const email = emailIndex >= 0 ? String(cols[emailIndex] || "").trim().toLowerCase() : "";
      if (!name) continue;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`Correo no válido en la fila ${i + 1}`);
      }

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
        const id = await createPilatesAthlete(name, null, email);
        athlete = { id, name, email };
        athleteMap.set(name.toLowerCase(), athlete);
      } else if (email && email !== String(athlete.email || "").trim().toLowerCase()) {
        await updatePilatesAthlete(athlete.id, { email, authUid: null }, null);
        athlete.email = email;
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
    button.addEventListener("click", (event) => {
      const athleteId = event.currentTarget.dataset.id;
      const athlete = pilatesListCacheData?.allAthletes.find((item) => item.id === athleteId);
      if (!athlete) return;
      ui.pilatesEditAthleteId.value = athlete.id;
      ui.pilatesEditName.value = athlete.name || "";
      ui.pilatesEditEmail.value = athlete.email || "";
      const history = pilatesListCacheData?.athleteHistory.get(athlete.id) || [];
      const historicalFamilies = new Set(history.map(familyForMonthlyRecord).filter(Boolean));
      const athleteFamilies = new Set([...(athlete.nestFamilies || []), ...historicalFamilies]);
      ui.pilatesEditFamilyPilates.checked = athleteFamilies.has("pilates");
      ui.pilatesEditFamilyBarre.checked = athleteFamilies.has("barre");
      ui.pilatesEditModal.classList.remove("hidden");
    });
  });

  ui.pilatesList.querySelectorAll('[data-role="delete-pilates-athlete"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      const athleteId = event.currentTarget.dataset.id;
      const athleteName = event.currentTarget.dataset.name || "este usuario";
      if (!athleteId || !confirm(`¿Eliminar a ${athleteName}? Se borrarán sus mensualidades y asignaciones del calendario.`)) return;
      try {
        await deletePilatesAthlete(athleteId);
        window.dispatchEvent(new CustomEvent("pilates-name-updated"));
      } catch (error) {
        console.error("Error al eliminar el usuario de The Nest:", error);
        alert("Error al eliminar el usuario");
      }
    });
  });
}

if (ui.pilatesEditModalClose) {
  ui.pilatesEditModalClose.addEventListener("click", () => ui.pilatesEditModal.classList.add("hidden"));
}
if (ui.pilatesEditCancel) {
  ui.pilatesEditCancel.addEventListener("click", () => ui.pilatesEditModal.classList.add("hidden"));
}
if (ui.pilatesEditForm) {
  ui.pilatesEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const athleteId = ui.pilatesEditAthleteId.value;
    const athlete = pilatesListCacheData?.allAthletes.find((item) => item.id === athleteId);
    if (!athlete) return;

    const name = ui.pilatesEditName.value.trim();
    const email = ui.pilatesEditEmail.value.trim().toLowerCase();
    if (!name) {
      alert("Introduce el nombre de la alumna.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Introduce un correo válido.");
      return;
    }
    const emailAlreadyUsed = email && pilatesListCacheData.allAthletes.some((item) =>
      item.id !== athleteId && String(item.email || "").trim().toLowerCase() === email
    );
    if (emailAlreadyUsed) {
      alert("Ese correo ya está asignado a otra ficha de The Nest.");
      return;
    }

    const nestFamilies = [
      ...(ui.pilatesEditFamilyPilates.checked ? ["pilates"] : []),
      ...(ui.pilatesEditFamilyBarre.checked ? ["barre"] : []),
    ];
    const updates = { name, email, nestFamilies };
    if (String(athlete.email || "").trim().toLowerCase() !== email) updates.authUid = null;
    const saveButton = ui.pilatesEditForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    try {
      await updatePilatesAthlete(athleteId, updates, null);
      ui.pilatesEditModal.classList.add("hidden");
      window.dispatchEvent(new CustomEvent("pilates-name-updated"));
    } catch (error) {
      console.error("Error al actualizar la ficha de The Nest:", error);
      alert("No se pudo guardar la ficha. Comprueba los datos e inténtalo de nuevo.");
    } finally {
      saveButton.disabled = false;
    }
  });
}

function filterAndRenderPilatesList(searchTerm, paidFilter) {
  if (!pilatesListCacheData || !ui.pilatesList) return;
  const { allAthletes, athletesFallback, listMonthMap, listPreviousMap, athleteHistory } = pilatesListCacheData;
  updatePilatesNameSortHeader();
  const familyConfig = getPilatesFamilyConfig();
  const familyTariffs = new Set(familyConfig.tariffs);
  const familyTariffOptions = familyConfig.tariffs
    .map((tariffKey) => `<option value="${tariffKey}">${tariffKey}</option>`)
    .join("");
  const searchValue = normalizeSearchText(searchTerm);
  const filteredAthletes = searchValue
    ? allAthletes.filter((athlete) => normalizeSearchText(athlete.name).includes(searchValue))
    : allAthletes;

  let listAthletes = !searchValue && filteredAthletes.length === 0 ? athletesFallback : filteredAthletes;

  listAthletes = listAthletes.map((athlete) => {
    const current = getMonthlyRecordForFamily(listMonthMap, athlete.id);
    const history = getHistoryForFamily(athleteHistory.get(athlete.id));
    const mostRecent = history.length > 0 ? history[0] : null;
    const lastUpdate = current?.updatedAt || current?.createdAt || mostRecent?.updatedAt || mostRecent?.createdAt;
    return { ...athlete, lastUpdate };
  }).filter((athlete) => {
    const current = getMonthlyRecordForFamily(listMonthMap, athlete.id);
    const previous = getMonthlyRecordForFamily(listPreviousMap, athlete.id);
    const history = getHistoryForFamily(athleteHistory.get(athlete.id));
    const lastPaid = history.find((record) => record.paid);
    const tariff = getPilatesTariffFromRecords(current, previous, lastPaid);
    return familyTariffs.has(tariff) || athleteHasFamily(athlete);
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
    const current = getMonthlyRecordForFamily(listMonthMap, athlete.id);
    const previous = getMonthlyRecordForFamily(listPreviousMap, athlete.id);
    const history = getHistoryForFamily(athleteHistory.get(athlete.id));
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
    row.dataset.family = getPilatesFamilyForTariff(tariff);
    row.innerHTML = `
      <td style="max-width: 200px;">
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <span data-role="pilates-athlete-name" class="list-row-name" data-id="${athlete.id}" style="flex: 1; line-height: 1.3;">${athlete.name || "(Sin nombre)"}</span>
          <button class="edit-name-btn" data-role="edit-pilates-name" data-id="${athlete.id}" title="Editar nombre y correo" aria-label="Editar nombre y correo de ${athlete.name || "alumna"}" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.7;">✏️</button>
          <button class="edit-name-btn" data-role="delete-pilates-athlete" data-id="${athlete.id}" data-name="${athlete.name || ""}" title="Eliminar usuario" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.8; color: #b42318;">🗑</button>
        </div>
      </td>
      <td>
        <select data-role="pilates-tariff" data-id="${athlete.id}">
          ${familyTariffOptions.replace(`value="${tariff}"`, `value="${tariff}" selected`)}
        </select>
      </td>
      <td><span data-role="pilates-price" data-id="${athlete.id}">${Number(price).toFixed(2)}</span> €</td>
      <td><span data-role="pilates-discount-display" data-id="${athlete.id}">${displayDiscount}%</span></td>
      <td>
        <select data-role="pilates-discount-reason" data-id="${athlete.id}">
          <option value="Ninguno" ${discountReason === "Ninguno" || !discountReason ? "selected" : ""}>Ninguno</option>
          <option value="promoApertura" ${discountReason === "promoApertura" ? "selected" : ""}>Promo apertura</option>
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
    const emailLabel = document.createElement("small");
    emailLabel.className = "pilates-athlete-email";
    emailLabel.textContent = athlete.email || "Sin correo para reservas";
    row.querySelector("td")?.appendChild(emailLabel);
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

export function renderFilteredPilatesList(searchTerm, paidFilter) {
  filterAndRenderPilatesList(searchTerm, paidFilter);
}

export function getPilatesFamilyAthletes() {
  if (!pilatesListCacheData) return [];
  const { allAthletes, listMonthMap, listPreviousMap, athleteHistory } = pilatesListCacheData;
  const familyTariffs = new Set(getPilatesFamilyConfig().tariffs);

  return allAthletes
    .filter((athlete) => {
      const current = getMonthlyRecordForFamily(listMonthMap, athlete.id);
      const previous = getMonthlyRecordForFamily(listPreviousMap, athlete.id);
      const history = getHistoryForFamily(athleteHistory.get(athlete.id));
      const lastPaid = history.find((record) => record.paid);
      const tariff = getPilatesTariffFromRecords(current, previous, lastPaid);
      return familyTariffs.has(tariff) || athleteHasFamily(athlete);
    })
    .sort((first, second) => String(first.name || "").localeCompare(String(second.name || ""), "es"));
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

  const summaryMonth = selectedPilatesMonth || selectedPilatesListMonth || ui.pilatesMonthSelect?.value || getMonthKey(new Date());
  const listMonth = summaryMonth;
  if (ui.pilatesMonthSelect) ui.pilatesMonthSelect.value = summaryMonth;
  if (ui.pilatesListMonthSelect) ui.pilatesListMonthSelect.value = listMonth;
  if (ui.pilatesSummaryMonthLabel) {
    ui.pilatesSummaryMonthLabel.textContent = summaryMonth ? `· ${getMonthLabel(summaryMonth)}` : "";
  }

  const listPreviousMonth = getPreviousMonthKey(listMonth);
  const athletesPromise = getPilatesAthletes();
  const allMonthRecordsPromise = getAllPilatesAthleteMonths();
  const summaryMonthRecordsPromise = getPilatesAthleteMonthsForMonth(summaryMonth);
  const listMonthRecordsPromise = listMonth === summaryMonth
    ? summaryMonthRecordsPromise
    : getPilatesAthleteMonthsForMonth(listMonth);
  const listPreviousRecordsPromise = listPreviousMonth
    ? getPilatesAthleteMonthsForMonth(listPreviousMonth)
    : Promise.resolve([]);
  const [athletes, allMonthRecords, summaryMonthRecords, listMonthRecords, listPreviousRecords] = await Promise.all([
    athletesPromise,
    allMonthRecordsPromise,
    summaryMonthRecordsPromise,
    listMonthRecordsPromise,
    listPreviousRecordsPromise,
  ]);
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

  const summaryMonthMap = groupMonthlyRecordsByFamily(summaryMonthRecords);
  const listMonthMap = groupMonthlyRecordsByFamily(listMonthRecords);
  const listPreviousMap = groupMonthlyRecordsByFamily(listPreviousRecords);

  const athleteHistory = new Map();
  allMonthRecords.forEach((record) => {
    if (!athleteHistory.has(record.athleteId)) {
      athleteHistory.set(record.athleteId, []);
    }
    athleteHistory.get(record.athleteId).push(record);
  });
  athleteHistory.forEach((records) => records.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)));

  const activeNow = new Set();
  const newAthletes = new Set();
  const familyAthletes = new Set();
  athletes.forEach((athlete) => {
    const current = getMonthlyRecordForFamily(summaryMonthMap, athlete.id);
    const history = getHistoryForFamily(athleteHistory.get(athlete.id));
    const lastPaid = history.find((record) => record.paid);
    const latestRecord = history[0];
    const tariff = getPilatesTariffFromRecords(current, latestRecord, lastPaid);
    if (!familyTariffs.has(tariff) && !athleteHasFamily(athlete)) return;
    familyAthletes.add(athlete.id);
    const paid = Boolean(current?.paid);
    if (paid) {
      activeNow.add(athlete.id);
      if (!history.some((record) => record.month < summaryMonth)) {
        newAthletes.add(athlete.id);
      }
    }
  });

  const familyListRecords = listMonthRecords.filter((record) => familyForMonthlyRecord(record) === activePilatesFamily);
  const athletesFallback = Array.from(
    new Map(familyListRecords.map((record) => [
      record.athleteId,
      { id: record.athleteId, name: record.athleteName || "(Sin nombre)" },
    ])).values()
  );
  pilatesListCacheData = { allAthletes: athletes, athletesFallback, listMonthMap, listPreviousMap, athleteHistory };
  filterAndRenderPilatesList(pilatesSearchTerm, pilatesPaidFilter);

  const totalActive = activeNow.size;
  const totalNew = newAthletes.size;
  if (ui.pilatesSummaryActive) ui.pilatesSummaryActive.textContent = String(totalActive);
  if (ui.pilatesSummaryNew) ui.pilatesSummaryNew.textContent = String(totalNew);
  if (ui.pilatesSummaryTotal) ui.pilatesSummaryTotal.textContent = String(familyAthletes.size);
}

export { pilatesTariffPlanMap };
