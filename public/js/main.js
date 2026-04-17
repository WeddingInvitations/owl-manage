let employeePaymentsListenersInitialized = false;

// Sistema de lazy loading para vistas
const viewsInitialized = {
  summaryView: false,
  athletesView: false,
  acroView: false,
  halteView: false,
  telasView: false,
  singleClassesView: false,
  checkinsView: false,
  vacationsView: false,
  classesView: false,
  employeePaymentsView: false,
  cajaView: false
};

// OwlManage MVP
// TODO: Completa firebaseConfig.js con tu configuración real.
// Estructura modular simple: auth, datos, UI.

import {
  ui,
  formatCurrency,
  setAuthUI,
  setActiveView,
  updateMenuVisibility,
} from "./ui.js?v=20250409d";
import { bindAuth, updateUserProfile } from "./auth.js?v=20250219b";
import { auth, db } from "./firebase.js?v=20250309a";
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { initializeCaja } from "./caja.js?v=20250401";
import {
  addPayment,
  addExpense,
  openCheckin,
  closeCheckin,
  modifyCheckin,
  getCheckinWithHistory,
  getCheckinsForUserInRange,
  getAllCheckinsInRange,
  getOpenCheckinForUser,
  getLastCheckinForUser,
  getCheckinsForUser,
  getAllCheckins,
  addTraining,
  createAthlete,
  getAthletes,
  updateAthlete,
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getClassAssignments,
  createClassAssignment,
  updateClassAssignment,
  deleteClassAssignment,
  upsertClassAssignment,
  importClassesFromCSV,
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
  getUsersList,
  // Vacaciones
  addVacation,
  getVacationsForUser,
  getVacationsForAll,
  deleteVacation,
  updateVacation,
  getHolidaysForYear,
  updateUserRole,
  setMustChangePassword,
  createAcroAthlete,
  getAcroAthletes,
  updateAcroAthlete,
  getAllAcroAthleteMonths,
  getAcroAthleteMonthsForMonth,
  upsertAcroAthleteMonth,
  createHalteAthlete,
  getHalteAthletes,
  updateHalteAthlete,
  getAllHalteAthleteMonths,
  getHalteAthleteMonthsForMonth,
  upsertHalteAthleteMonth,
  createTelasAthlete,
  getTelasAthletes,
  updateTelasAthlete,
  getAllTelasAthleteMonths,
  getTelasAthleteMonthsForMonth,
  upsertTelasAthleteMonth,
  createSingleClassesAthlete,
  getSingleClassesAthletes,
  updateSingleClassesAthlete,
  getAllSingleClassesAthleteMonths,
  getSingleClassesAthleteMonthsForMonth,
  upsertSingleClassesAthleteMonth,
  updatePayment,
  deletePayment,
  updateExpense,
  deleteExpense,
  addOrder,
  updateOrder,
  deleteOrder,
  loadOrdersForMonth,
  addEmployeePayment,
  loadEmployeePayments,
} from "./data.js?v=20250409d";

import { createUserWithRole } from "./admin.js";

// Exponer Firebase globalmente para debugging
window.firebase = {
  auth: () => auth,
  firestore: () => db
};

// Utility functions for price calculation
function calculatePrice(athlete) {
  const tariff = athlete.tariff || "8/mes";
  const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes");
  const basePrice = plan.priceTotal;
  let discount = 0;
  if (athlete.discountReason === 'Familiar') discount = 15;
  else if (athlete.discountReason === 'Funcionario') discount = 10;
  else if (athlete.discountReason === 'Mañanas') discount = 10;
  return basePrice * (1 - discount / 100);
}

function calculateAcroPrice(athlete) {
  const tariff = athlete.tariff || "4/mes";
  const plan = acroTariffPlanMap.get(tariff) || acroTariffPlanMap.get("4/mes");
  const basePrice = plan.priceTotal;
  let discount = 0;
  if (athlete.discountReason === 'Familiar') discount = 15;
  else if (athlete.discountReason === 'Funcionario') discount = 10;
  else if (athlete.discountReason === 'Mañanas') discount = 10;
  return basePrice * (1 - discount / 100);
}

function calculateHaltePrice(athlete) {
  const tariff = athlete.tariff || "Pequeña";
  const plan = halteTariffPlanMap.get(tariff) || halteTariffPlanMap.get("Pequeña");
  const basePrice = plan.priceTotal;
  let discount = 0;
  if (athlete.discountReason === 'Familiar') discount = 15;
  else if (athlete.discountReason === 'Funcionario') discount = 10;
  else if (athlete.discountReason === 'Mañanas') discount = 10;
  return basePrice * (1 - discount / 100);
}

function calculateSingleClassesPrice(athlete) {
  const tariff = athlete.tariff || "Clase Crossfit";
  const plan = singleClassesTariffPlanMap.get(tariff) || singleClassesTariffPlanMap.get("Clase Crossfit");
  const basePrice = plan.priceTotal;
  let discount = 0;
  if (athlete.discountReason === 'Familiar') discount = 15;
  else if (athlete.discountReason === 'Funcionario') discount = 10;
  else if (athlete.discountReason === 'Mañanas') discount = 10;
  return basePrice * (1 - discount / 100);
}

// Global variables for current athletes data
let currentAthletes = [];
let currentAcroAthletes = [];
let currentHalteAthletes = [];
let currentTelasAthletes = [];
let currentSingleClassesAthletes = [];

window.debugAuth = async function() {
  console.log('DEBUG: Estado de autenticacion avanzado');

  try {
    const currentUser = auth.currentUser;
    console.log('Usuario Firebase:', currentUser);

    if (currentUser) {
      console.log('Email:', currentUser.email);
      console.log('UID:', currentUser.uid);

      // Verificar documento de usuario en Firestore
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log('Datos del usuario:', userData);
          console.log('Role:', userData.role);
          console.log('Creado:', userData.createdAt);
        } else {
          console.log('No se encontro documento de usuario en Firestore');
          console.log('Creando documento de usuario...');

          // Crear documento de usuario
          const { setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');

          await setDoc(userDocRef, {
            email: currentUser.email,
            displayName: currentUser.displayName || '',
            role: 'OWNER',
            createdAt: serverTimestamp(),
            mustChangePassword: false
          });

          console.log('Documento de usuario creado con rol OWNER');
        }
      } catch (error) {
        console.log('Error con documento de usuario:', error);
      }

      // Test de acceso a colecciones
      try {
        console.log('Probando acceso a datos...');

        const { collection, getDocs, limit, query } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');

        const paymentsQuery = query(collection(db, 'payments'), limit(5));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        console.log('Payments encontrados:', paymentsSnapshot.size);
        paymentsSnapshot.forEach((docItem) => {
          console.log('Payment:', docItem.id, docItem.data());
        });

        const expensesQuery = query(collection(db, 'expenses'), limit(5));
        const expensesSnapshot = await getDocs(expensesQuery);
        console.log('Expenses encontrados:', expensesSnapshot.size);
        expensesSnapshot.forEach((docItem) => {
          console.log('Expense:', docItem.id, docItem.data());
        });

        const athletesQuery = query(collection(db, 'athletes'), limit(5));
        const athletesSnapshot = await getDocs(athletesQuery);
        console.log('Athletes encontrados:', athletesSnapshot.size);
        athletesSnapshot.forEach((docItem) => {
          console.log('Athlete:', docItem.id, docItem.data());
        });
      } catch (error) {
        console.log('Error accediendo a datos:', error);
        console.log('Detalles del error:', error.code, error.message);
      }
    } else {
      console.log('No hay usuario autenticado');
    }
  } catch (error) {
    console.log('Error general en debug:', error);
  }
};

let currentUser = null;
let currentProfile = null;
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
let availableOrderMonths = [];
let selectedOrderMonth = "";
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

// Halterofilia state
let selectedHalteMonth = "";
let selectedHalteListMonth = "";
let selectedHaltePaymentMonth = "";
let haltePaidFilter = "ALL";
let halteSearchTerm = "";
let selectedHalteCsvMonth = "";

// Telas state
let selectedTelasMonth = "";
let selectedTelasListMonth = "";
let selectedTelasPaymentMonth = "";
let telasPaidFilter = "ALL";
let telasSearchTerm = "";
let selectedTelasCsvMonth = "";

// Single Classes state
let selectedSingleClassesMonth = "";
let selectedSingleClassesListMonth = "";
let selectedSingleClassesPaymentMonth = "";
let singleClassesPaidFilter = "ALL";
let singleClassesSearchTerm = "";
let selectedSingleClassesCsvMonth = "";

// Checkin state
let currentOpenCheckin = null;
let checkinTimerInterval = null;
let selectedCheckinAdminMonth = "";

// ========== SISTEMA DE TEMA CLARO/OSCURO ==========

// Función para aplicar tema
function applyTheme(theme) {
  console.log('🎨 Aplicando tema:', theme);
  const body = document.body;
  const themeIcon = document.querySelector('.theme-icon');
  
  if (theme === 'light') {
    body.classList.add('light');
    if (themeIcon) {
      themeIcon.textContent = '☀️';
      console.log('☀️ Cambiado a tema claro');
    }
  } else {
    body.classList.remove('light');
    if (themeIcon) {
      themeIcon.textContent = '🌙';
      console.log('🌙 Cambiado a tema oscuro');
    }
  }
  
  // Guardar preferencia en localStorage
  localStorage.setItem('owlmanage-theme', theme);
  console.log('💾 Tema guardado en localStorage:', theme);
}

// Función para obtener tema guardado o detectar preferencia del sistema
function getSavedTheme() {
  const saved = localStorage.getItem('owlmanage-theme');
  if (saved) return saved;
  
  // Si no hay tema guardado, usar preferencia del sistema
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

// Función para alternar tema
function toggleTheme() {
  console.log('🔄 Toggle tema solicitado');
  const currentTheme = document.body.classList.contains('light') ? 'light' : 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  console.log('📝 Tema actual:', currentTheme, '-> Nuevo tema:', newTheme);
  applyTheme(newTheme);
}

// Aplicar tema inmediatamente
const initialTheme = getSavedTheme();
applyTheme(initialTheme);

// Escuchar cambios en la preferencia del sistema
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!localStorage.getItem('owlmanage-theme')) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });
}

const on = (element, eventName, handler) => {
  if (!element) return;
  element.addEventListener(eventName, handler);
};

// --- Cambio de contraseña inicial ---
on(ui.passwordChangeForm, "submit", async (event) => {
  event.preventDefault();
  if (!auth.currentUser) {
    if (ui.passwordChangeStatus) {
      ui.passwordChangeStatus.textContent = "No hay usuario autenticado.";
    }
    return;
  }

  const newPassword = ui.passwordChangeNew?.value || "";
  const confirmPassword = ui.passwordChangeConfirm?.value || "";

  if (newPassword.length < 6) {
    if (ui.passwordChangeStatus) {
      ui.passwordChangeStatus.textContent = "La contraseña debe tener al menos 6 caracteres.";
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (ui.passwordChangeStatus) {
      ui.passwordChangeStatus.textContent = "Las contraseñas no coinciden.";
    }
    return;
  }

  if (ui.passwordChangeStatus) {
    ui.passwordChangeStatus.textContent = "Actualizando contraseña...";
  }

  try {
    await updatePassword(auth.currentUser, newPassword);
    await setMustChangePassword(auth.currentUser.uid, false);

    // Actualizar estado local y UI para entrar en la app
    if (currentProfile) {
      currentProfile.mustChangePassword = false;
    }

    if (ui.passwordChangeStatus) {
      ui.passwordChangeStatus.textContent = "Contraseña actualizada. Cargando aplicación...";
    }

    // Ocultar vista de cambio de contraseña y mostrar la app
    setAuthUI(ui, auth.currentUser, currentRole, false);
    updateMenuVisibility(ui, currentRole);
    if (ui.mobileNav) {
      ui.mobileNav.classList.toggle("hidden", !auth.currentUser);
    }

    // Cargar datos principales ahora que ya no requiere cambio de contraseña
    await refreshAll();
    await refreshAthleteMonthly();
    await refreshAcroMonthly();
    await refreshCheckinStatus();
    await refreshCheckinAdmin();
    await populateVacationWorkers();
    await renderVacations();
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    if (ui.passwordChangeStatus) {
      ui.passwordChangeStatus.textContent =
        "Error al cambiar la contraseña: " + (error.message || String(error));
    }
  }
});

const tariffPlans = [
  { key: "Open Box", durationMonths: 1, priceTotal: 50 },
  { key: "8/mes", durationMonths: 1, priceTotal: 70 },
  { key: "Fundador", durationMonths: 1, priceTotal: 70 },
  { key: "SPL", durationMonths: 1, priceTotal: 70 },
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
  { key: "Open Mensual", durationMonths: 1, priceTotal: 70 },
  { key: "12/mes", durationMonths: 1, priceTotal: 85 },
  { key: "Ilimitado", durationMonths: 1, priceTotal: 105 },
];

const acroTariffPlanMap = new Map(
  acroTariffPlans.map((plan) => [plan.key, {
    ...plan,
    priceMonthly: plan.priceTotal / plan.durationMonths,
  }])
);

// Tarifas específicas para Halterofilia
const halteTariffPlans = [
  { key: "Pequeña", durationMonths: 1, priceTotal: 30 },
  { key: "Grande", durationMonths: 1, priceTotal: 50 },
];

const halteTariffPlanMap = new Map(
  halteTariffPlans.map((plan) => [plan.key, {
    ...plan,
    priceMonthly: plan.priceTotal / plan.durationMonths,
  }])
);

const telasTariffPlans = [
  { key: "4/mes", durationMonths: 1, priceTotal: 45 },
  { key: "8/mes", durationMonths: 1, priceTotal: 65 },
  { key: "12/mes", durationMonths: 1, priceTotal: 85 },
  { key: "Ilimitado", durationMonths: 1, priceTotal: 105 },
];

const telasTariffPlanMap = new Map(
  telasTariffPlans.map((plan) => [plan.key, {
    ...plan,
    priceMonthly: plan.priceTotal / plan.durationMonths,
  }])
);

// Tarifas específicas para Clases Sueltas
const singleClassesTariffPlans = [
  { key: "Clase Crossfit", durationMonths: 1, priceTotal: 15 },
  { key: "Bono 10 Clases Crossfit", durationMonths: 1, priceTotal: 135 },
  { key: "Clase Acrobacias", durationMonths: 1, priceTotal: 15 },
  { key: "Open Acrobacias 1h", durationMonths: 1, priceTotal: 10 },
  { key: "Open Acrobacias 2h", durationMonths: 1, priceTotal: 15 },
];

const singleClassesTariffPlanMap = new Map(
  singleClassesTariffPlans.map((plan) => [plan.key, {
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
  await refreshOrderList();
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
    selectedPaymentMonth,
    handleEditPayment,
    handleDeletePayment
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
    selectedExpenseMonth,
    handleEditExpense,
    handleDeleteExpense
  );
}

function renderOrderMonthOptions() {
  if (!ui.orderMonthSelect) return;
  ui.orderMonthSelect.innerHTML = "";
  availableOrderMonths.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    if (key === selectedOrderMonth) {
      option.selected = true;
    }
    ui.orderMonthSelect.appendChild(option);
  });
}

async function refreshOrderList() {
  availableOrderMonths = getCurrentYearMonths();
  const currentKey = getMonthKey(new Date());
  if (!selectedOrderMonth || !availableOrderMonths.includes(selectedOrderMonth)) {
    selectedOrderMonth = availableOrderMonths.includes(currentKey)
      ? currentKey
      : (availableOrderMonths[0] || "");
  }
  renderOrderMonthOptions();
  await loadOrdersForMonth(
    ui.orderList,
    formatCurrency,
    selectedOrderMonth,
    handleEditOrder,
    handleDeleteOrder
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
    const basePrice = row.precio ? Number(row.precio) : plan.priceTotal;
    const discount = row.descuento || row.discount || 0;
    const discountReason = row.motivo_descuento || row.discount_reason || "";
    const finalPrice = basePrice * (1 - discount / 100);
    const price = finalPrice; // Use final price with discount applied
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
          basePrice,
          discount: Number(discount),
          discountReason,
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
  const basePrice = plan ? plan.priceTotal : 0;
  ui.athletePrice.value = basePrice;
  
  // Calculate final price with discount
  calculateAthleteFinalPrice();
}

function calculateAthleteFinalPrice() {
  const basePrice = parseFloat(ui.athletePrice.value) || 0;
  const discount = parseFloat(ui.athleteDiscount.value) || 0;
  const finalPrice = basePrice * (1 - discount / 100);
  ui.athleteFinalPrice.value = finalPrice.toFixed(2);
}

async function refreshAthleteMonthly() {
  if (!selectedAthleteMonth) {
    renderAthleteMonthOptions();
  }
  if (!selectedAthleteListMonth) {
    renderAthleteListMonthOptions();
  }
  const athletes = await getAthletes();
  currentAthletes = athletes; // Store globally for event listeners
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
    const basePrice = plan.priceTotal ?? 0;
    const discountReason = current?.discountReason || previous?.discountReason || lastPaid?.discountReason || "";
    let discount = 0;
    if (discountReason === 'Familiar') discount = 15;
    else if (discountReason === 'Funcionario') discount = 10;
    else if (discountReason === 'Mañanas') discount = 10;
    else if (discountReason === 'Amigo') discount = 10;
    const price = basePrice * (1 - discount / 100);
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
  let listAthletes = visibleAthletes.length > 0
    ? visibleAthletes
    : Array.from(new Map(listMonthRecords.map((record) => [
        record.athleteId,
        { id: record.athleteId, name: record.athleteName || "(Sin nombre)" },
      ])).values());

  // Ordenar por fecha de última actualización
  listAthletes = listAthletes.map(athlete => {
    const current = listMonthMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const mostRecent = history.length > 0 ? history[0] : null;
    const lastUpdate = current?.updatedAt || current?.createdAt || mostRecent?.updatedAt || mostRecent?.createdAt;
    return { ...athlete, lastUpdate };
  }).sort((a, b) => {
    if (!a.lastUpdate && !b.lastUpdate) return 0;
    if (!a.lastUpdate) return 1;
    if (!b.lastUpdate) return -1;
    const timeA = a.lastUpdate?.seconds || a.lastUpdate?.toMillis?.() / 1000 || 0;
    const timeB = b.lastUpdate?.seconds || b.lastUpdate?.toMillis?.() / 1000 || 0;
    return timeB - timeA;
  });

  listAthletes.forEach((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const previous = listPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "8/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = tariffPlanMap.get(tariff) || tariffPlanMap.get("8/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const discount = current?.discount ?? previous?.discount ?? lastPaid?.discount ?? 0;
    const discountReason = current?.discountReason ?? previous?.discountReason ?? lastPaid?.discountReason ?? "";
    let displayDiscount = discount;
    if (discountReason === 'Familiar') displayDiscount = 15;
    else if (discountReason === 'Funcionario') displayDiscount = 10;
    else if (discountReason === 'Mañanas') displayDiscount = 10;
    else if (discountReason === 'Amigo') displayDiscount = 10;
    else if (discountReason === 'Ninguno') displayDiscount = 0;
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
    row.dataset.id = athlete.id;
    row.dataset.name = athlete.name;
    row.innerHTML = `
      <td style="max-width: 200px;">
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <span data-role="athlete-name" data-id="${athlete.id}" style="flex: 1; line-height: 1.3;">${athlete.name}</span>
          <button class="edit-name-btn" data-role="edit-athlete-name" data-id="${athlete.id}" title="Editar nombre" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.6;">✏️</button>
        </div>
      </td>
      <td>
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
        <span data-role="discount-display" data-id="${athlete.id}">${displayDiscount}%</span>
      </td>
      <td>
        <select data-role="discount-reason" data-id="${athlete.id}">
          <option value="Ninguno" ${discountReason === "Ninguno" || !discountReason ? "selected" : ""}>Ninguno</option>
          <option value="Familiar" ${discountReason === "Familiar" ? "selected" : ""}>Familiar</option>
          <option value="Funcionario" ${discountReason === "Funcionario" ? "selected" : ""}>Funcionario</option>
          <option value="Mañanas" ${discountReason === "Mañanas" ? "selected" : ""}>Mañanas</option>
          <option value="Amigo" ${discountReason === "Amigo" ? "selected" : ""}>Amigo</option>
        </select>
      </td>
      <td><span data-role="final-price" data-id="${athlete.id}">${price.toFixed(2)}</span> €</td>
      <td>
        <select data-role="paid" data-id="${athlete.id}">
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>
        <span data-role="status" data-id="${athlete.id}" class="athlete-status-badge ${paid ? "athlete-status-paid" : "athlete-status-unpaid"}">${paid ? "Pagado" : "No Pagado"}</span>
      </td>
    `;
    ui.athleteList.appendChild(row);
    // Debug: verificar que el badge tiene el texto correcto
    const addedRow = ui.athleteList.querySelector(`tr[data-id="${athlete.id}"]`);
    const statusBadge = addedRow?.querySelector('[data-role="status"]');
    if (statusBadge && !statusBadge.textContent.trim()) {
      console.warn('❌ Badge sin texto para atleta:', athlete.name, 'paid:', paid);
      statusBadge.textContent = paid ? "Pagado" : "No Pagado";
    }
  });

  // Add event listeners for discount reason selects
  ui.athleteList.querySelectorAll('[data-role="discount-reason"]').forEach(select => {
    select.addEventListener('change', (e) => {
      const row = e.target.closest('tr');
      const discountDisplay = row.querySelector('[data-role="discount-display"]');
      const reason = e.target.value;
      let discountValue = 0;
      if (reason === 'Familiar') discountValue = 15;
      else if (reason === 'Funcionario') discountValue = 10; // example
      else if (reason === 'Mañanas') discountValue = 10; // example
      else if (reason === 'Amigo') discountValue = 10;
      // For Otro, maybe keep previous or 0
      discountDisplay.textContent = `${discountValue}%`;
    });
  });

  // Add event listeners for edit name buttons
  ui.athleteList.querySelectorAll('[data-role="edit-athlete-name"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const athleteId = e.target.dataset.id;
      const nameSpan = ui.athleteList.querySelector(`[data-role="athlete-name"][data-id="${athleteId}"]`);
      const currentName = nameSpan.textContent;
      const newName = prompt('Introduce el nuevo nombre del atleta:', currentName);
      
      if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
          await updateAthlete(athleteId, { name: newName.trim() }, currentUser?.uid);
          await refreshAthleteMonthly();
        } catch (error) {
          console.error('Error al actualizar el nombre del atleta:', error);
          alert('Error al actualizar el nombre del atleta');
        }
      }
    });
  });

  if (ui.athleteListCount) {
    ui.athleteListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }
  updatePendingSaveButtons();

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
  const basePrice = plan ? plan.priceTotal : 0;
  ui.acroPrice.value = basePrice;
  
  // Calculate final price with discount
  calculateAcroFinalPrice();
}

function calculateAcroFinalPrice() {
  const basePrice = parseFloat(ui.acroPrice.value) || 0;
  const discount = parseFloat(ui.acroDiscount.value) || 0;
  const finalPrice = basePrice * (1 - discount / 100);
  ui.acroFinalPrice.value = finalPrice.toFixed(2);
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
    const basePrice = row.precio ? Number(row.precio) : plan.priceTotal;
    const discount = row.descuento || row.discount || 0;
    const discountReason = row.motivo_descuento || row.discount_reason || "";
    const finalPrice = basePrice * (1 - discount / 100);
    const price = finalPrice; // Use final price with discount applied
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
          basePrice,
          discount: Number(discount),
          discountReason,
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
  currentAcroAthletes = athletes; // Store globally for event listeners

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
    const basePrice = plan.priceTotal ?? 0;
    const discountReason = current?.discountReason || previous?.discountReason || lastPaid?.discountReason || "";
    let discount = 0;
    if (discountReason === 'Familiar') discount = 15;
    else if (discountReason === 'Funcionario') discount = 10;
    else if (discountReason === 'Mañanas') discount = 10;
    const price = basePrice * (1 - discount / 100);
    const paid = Boolean(current?.paid);
    const active = paid;

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
  let listAthletes = visibleAthletes.length > 0
    ? visibleAthletes
    : Array.from(new Map(listMonthRecords.map((record) => [
        record.athleteId,
        { id: record.athleteId, name: record.athleteName || "(Sin nombre)" },
      ])).values());

  // Ordenar por fecha de última actualización
  listAthletes = listAthletes.map(athlete => {
    const current = listMonthMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const mostRecent = history.length > 0 ? history[0] : null;
    const lastUpdate = current?.updatedAt || current?.createdAt || mostRecent?.updatedAt || mostRecent?.createdAt;
    return { ...athlete, lastUpdate };
  }).sort((a, b) => {
    if (!a.lastUpdate && !b.lastUpdate) return 0;
    if (!a.lastUpdate) return 1;
    if (!b.lastUpdate) return -1;
    const timeA = a.lastUpdate?.seconds || a.lastUpdate?.toMillis?.() / 1000 || 0;
    const timeB = b.lastUpdate?.seconds || b.lastUpdate?.toMillis?.() / 1000 || 0;
    return timeB - timeA;
  });

  listAthletes.forEach((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const previous = listPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "4/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = acroTariffPlanMap.get(tariff) || acroTariffPlanMap.get("4/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const discount = current?.discount ?? previous?.discount ?? lastPaid?.discount ?? 0;
    const discountReason = current?.discountReason ?? previous?.discountReason ?? lastPaid?.discountReason ?? "";
    let displayDiscount = discount;
    if (discountReason === 'Familiar') displayDiscount = 15;
    else if (discountReason === 'Funcionario') displayDiscount = 10;
    else if (discountReason === 'Mañanas') displayDiscount = 10;
    else if (discountReason === 'Ninguno') displayDiscount = 0;
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
    row.dataset.id = athlete.id;
    row.dataset.name = athlete.name || "";
    row.innerHTML = `
      <td style="max-width: 200px;">
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <span data-role="acro-athlete-name" data-id="${athlete.id}" style="flex: 1; line-height: 1.3;">${athlete.name || "(Sin nombre)"}</span>
          <button class="edit-name-btn" data-role="edit-acro-name" data-id="${athlete.id}" title="Editar nombre" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.6;">✏️</button>
        </div>
      </td>
      <td>
        <select data-role="acro-tariff" data-id="${athlete.id}">
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
        <span data-role="acro-discount-display" data-id="${athlete.id}">${displayDiscount}%</span>
      </td>
      <td>
        <select data-role="acro-discount-reason" data-id="${athlete.id}">
          <option value="Ninguno" ${discountReason === "Ninguno" || !discountReason ? "selected" : ""}>Ninguno</option>
          <option value="Familiar" ${discountReason === "Familiar" ? "selected" : ""}>Familiar</option>
          <option value="Funcionario" ${discountReason === "Funcionario" ? "selected" : ""}>Funcionario</option>
          <option value="Mañanas" ${discountReason === "Mañanas" ? "selected" : ""}>Mañanas</option>
          <option value="Otro" ${discountReason === "Otro" ? "selected" : ""}>Otro</option>
        </select>
      </td>
      <td><span data-role="acro-final-price" data-id="${athlete.id}">${price.toFixed(2)}</span> €</td>
      <td>
        <select data-role="acro-paid" data-id="${athlete.id}">
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>
        <span data-role="acro-status" data-id="${athlete.id}" class="athlete-status-badge ${paid ? "athlete-status-paid" : "athlete-status-unpaid"}">${paid ? "Pagado" : "No Pagado"}</span>
      </td>
    `;
    ui.acroList.appendChild(row);
    // Debug: verificar que el badge tiene el texto correcto
    const addedRow = ui.acroList.querySelector(`tr[data-id="${athlete.id}"]`);
    const statusBadge = addedRow?.querySelector('[data-role="acro-status"]');
    if (statusBadge && !statusBadge.textContent.trim()) {
      console.warn('❌ Badge sin texto para acro:', athlete.name, 'paid:', paid);
      statusBadge.textContent = paid ? "Pagado" : "No Pagado";
    }
  });

  // Add event listeners for acro discount reason selects
  ui.acroList.querySelectorAll('[data-role="acro-discount-reason"]').forEach(select => {
    select.addEventListener('change', (e) => {
      const row = e.target.closest('tr');
      const discountDisplay = row.querySelector('[data-role="acro-discount-display"]');
      const reason = e.target.value;
      let discountValue = 0;
      if (reason === 'Familiar') discountValue = 15;
      else if (reason === 'Funcionario') discountValue = 10;
      else if (reason === 'Mañanas') discountValue = 10;
      discountDisplay.textContent = `${discountValue}%`;
    });
  });

  // Add event listeners for edit acro name buttons
  ui.acroList.querySelectorAll('[data-role="edit-acro-name"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const athleteId = e.target.dataset.id;
      const nameSpan = ui.acroList.querySelector(`[data-role="acro-athlete-name"][data-id="${athleteId}"]`);
      const currentName = nameSpan.textContent;
      const newName = prompt('Introduce el nuevo nombre del atleta:', currentName);
      
      if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
          await updateAcroAthlete(athleteId, { name: newName.trim() }, currentUser?.uid);
          await refreshAcroMonthly();
        } catch (error) {
          console.error('Error al actualizar el nombre del atleta:', error);
          alert('Error al actualizar el nombre del atleta');
        }
      }
    });
  });

  if (ui.acroListCount) {
    ui.acroListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }
  updatePendingSaveButtons();

  const totalActive = activeNow.size;
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;

  if (ui.acroSummaryActive) ui.acroSummaryActive.textContent = String(totalActive);
  if (ui.acroSummaryAverage) ui.acroSummaryAverage.textContent = formatCurrency(averageTariff);
  if (ui.acroSummaryNew) ui.acroSummaryNew.textContent = String(totalNew);
  if (ui.acroSummaryDrop) ui.acroSummaryDrop.textContent = String(totalDrop);
}

// ========== HALTEROFILIA ==========

function renderHalteMonthOptions() {
  if (!ui.halteMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  ui.halteMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.halteMonthSelect.appendChild(option);
  });
  selectedHalteMonth = options[0];
  ui.halteMonthSelect.value = selectedHalteMonth;
}

function renderHalteListMonthOptions() {
  if (!ui.halteListMonthSelect) return;
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
  ui.halteListMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.halteListMonthSelect.appendChild(option);
  });
  selectedHalteListMonth = getMonthKey(now);
  ui.halteListMonthSelect.value = selectedHalteListMonth;
}

function renderHaltePaymentMonthOptions() {
  if (!ui.haltePaymentMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.haltePaymentMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.haltePaymentMonth.appendChild(option);
  });
  selectedHaltePaymentMonth = options[0];
  ui.haltePaymentMonth.value = selectedHaltePaymentMonth;
}

function renderHalteCsvMonthOptions() {
  if (!ui.halteCsvMonth) return;
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
  ui.halteCsvMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.halteCsvMonth.appendChild(option);
  });
  selectedHalteCsvMonth = getMonthKey(now);
  ui.halteCsvMonth.value = selectedHalteCsvMonth;
}

function setHaltePriceFromTariff() {
  if (!ui.halteTariff || !ui.haltePrice) return;
  const tariff = ui.halteTariff.value;
  const plan = halteTariffPlanMap.get(tariff);
  const basePrice = plan ? plan.priceTotal : 0;
  ui.haltePrice.value = basePrice;
  
  // Calculate final price with discount
  calculateHalteFinalPrice();
}

function calculateHalteFinalPrice() {
  const basePrice = parseFloat(ui.haltePrice.value) || 0;
  const discount = parseFloat(ui.halteDiscount.value) || 0;
  const finalPrice = basePrice * (1 - discount / 100);
  ui.halteFinalPrice.value = finalPrice.toFixed(2);
}

async function importHalteAthletesFromCsv(file, monthKey) {
  const text = await file.text();
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new Error("CSV vacío o sin datos");
  }
  const athletes = await getHalteAthletes();
  const athleteMap = new Map(
    athletes.map((athlete) => [athlete.name?.toLowerCase(), athlete])
  );
  let processed = 0;

  for (const row of rows) {
    const name = row.nombre || row.name || "";
    if (!name) continue;
    const paidValue = (row.pagado || row.paid || "").toString().trim().toUpperCase();
    const paid = paidValue === "SI" || paidValue === "TRUE" || paidValue === "1" || paidValue === "YES";
    const tariff = normalizeTariff(row.tarifa || row.plan || "", halteTariffPlans, "4/mes");
    const plan = halteTariffPlanMap.get(tariff) || halteTariffPlanMap.get("4/mes");
    const basePrice = row.precio ? Number(row.precio) : plan.priceTotal;
    const discount = row.descuento || row.discount || 0;
    const discountReason = row.motivo_descuento || row.discount_reason || "";
    const finalPrice = basePrice * (1 - discount / 100);
    const price = finalPrice; // Use final price with discount applied
    const duration = plan.durationMonths || 1;

    let athlete = athleteMap.get(name.toLowerCase());
    if (!athlete) {
      const id = await createHalteAthlete(name, currentUser?.uid);
      athlete = { id, name };
      athleteMap.set(name.toLowerCase(), athlete);
    }

    for (let i = 0; i < duration; i += 1) {
      const targetMonth = addMonthsToKey(monthKey, i);
      await upsertHalteAthleteMonth(
        athlete.id,
        targetMonth,
        {
          athleteName: athlete.name,
          tariff,
          price,
          basePrice,
          discount: Number(discount),
          discountReason,
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

async function refreshHalteMonthly() {
  if (!ui.halteList) return;
  
  if (!selectedHalteMonth) {
    renderHalteMonthOptions();
  }
  if (!selectedHalteListMonth) {
    renderHalteListMonthOptions();
  }

  const athletes = await getHalteAthletes();
  currentHalteAthletes = athletes; // Store globally for event listeners

  // Populate name datalists
  if (ui.halteNameList) {
    const names = Array.from(
      new Set(athletes.map((athlete) => athlete.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    ui.halteNameList.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ui.halteNameList.appendChild(option);
    });
  }

  if (ui.halteSearchList) {
    const names = Array.from(
      new Set(athletes.map((athlete) => athlete.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    ui.halteSearchList.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ui.halteSearchList.appendChild(option);
    });
  }

  const searchValue = halteSearchTerm.trim().toLowerCase();
  const visibleAthletes = searchValue
    ? athletes.filter((athlete) => athlete.name?.toLowerCase().includes(searchValue))
    : athletes;

  const allMonthRecords = await getAllHalteAthleteMonths();
  const summaryMonthRecords = await getHalteAthleteMonthsForMonth(selectedHalteMonth);
  const summaryPreviousMonth = getPreviousMonthKey(selectedHalteMonth);
  const summaryPreviousRecords = summaryPreviousMonth
    ? await getHalteAthleteMonthsForMonth(summaryPreviousMonth)
    : [];

  const listMonthRecords = await getHalteAthleteMonthsForMonth(selectedHalteListMonth);
  const listPreviousMonth = getPreviousMonthKey(selectedHalteListMonth);
  const listPreviousRecords = listPreviousMonth
    ? await getHalteAthleteMonthsForMonth(listPreviousMonth)
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

  ui.halteList.innerHTML = "";

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
    const plan = halteTariffPlanMap.get(tariff) || halteTariffPlanMap.get("4/mes") || fallbackPlan;
    const basePrice = plan.priceTotal ?? 0;
    const discountReason = current?.discountReason || previous?.discountReason || lastPaid?.discountReason || "";
    let discount = 0;
    if (discountReason === 'Familiar') discount = 15;
    else if (discountReason === 'Funcionario') discount = 10;
    else if (discountReason === 'Mañanas') discount = 10;
    const price = basePrice * (1 - discount / 100);
    const paid = Boolean(current?.paid);
    const active = paid;

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
  let listAthletes = visibleAthletes.length > 0
    ? visibleAthletes
    : Array.from(new Map(listMonthRecords.map((record) => [
        record.athleteId,
        { id: record.athleteId, name: record.athleteName || "(Sin nombre)" },
      ])).values());

  // Ordenar por fecha de última actualización
  listAthletes = listAthletes.map(athlete => {
    const current = listMonthMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const mostRecent = history.length > 0 ? history[0] : null;
    const lastUpdate = current?.updatedAt || current?.createdAt || mostRecent?.updatedAt || mostRecent?.createdAt;
    return { ...athlete, lastUpdate };
  }).sort((a, b) => {
    if (!a.lastUpdate && !b.lastUpdate) return 0;
    if (!a.lastUpdate) return 1;
    if (!b.lastUpdate) return -1;
    const timeA = a.lastUpdate?.seconds || a.lastUpdate?.toMillis?.() / 1000 || 0;
    const timeB = b.lastUpdate?.seconds || b.lastUpdate?.toMillis?.() / 1000 || 0;
    return timeB - timeA;
  });

  listAthletes.forEach((athlete) => {
    const current = listMonthMap.get(athlete.id);
    const previous = listPreviousMap.get(athlete.id);
    const history = athleteHistory.get(athlete.id) || [];
    const lastPaid = history.find((record) => record.paid);
    const tariff = current?.tariff || previous?.tariff || lastPaid?.tariff || "4/mes";
    const fallbackPlan = { durationMonths: 1, priceTotal: 0, priceMonthly: 0 };
    const plan = halteTariffPlanMap.get(tariff) || halteTariffPlanMap.get("4/mes") || fallbackPlan;
    const price = current?.price ?? previous?.price ?? lastPaid?.price ?? plan.priceTotal ?? 0;
    const discount = current?.discount ?? previous?.discount ?? lastPaid?.discount ?? 0;
    const discountReason = current?.discountReason ?? previous?.discountReason ?? lastPaid?.discountReason ?? "";
    let displayDiscount = discount;
    if (discountReason === 'Familiar') displayDiscount = 15;
    else if (discountReason === 'Funcionario') displayDiscount = 10;
    else if (discountReason === 'Mañanas') displayDiscount = 10;
    else if (discountReason === 'Ninguno') displayDiscount = 0;
    const paid = Boolean(current?.paid);
    const active = paid;

    if (haltePaidFilter === "SI" && !paid) {
      return;
    }
    if (haltePaidFilter === "NO" && paid) {
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
    row.dataset.id = athlete.id;
    row.dataset.name = athlete.name || "";
    row.innerHTML = `
      <td style="max-width: 200px;">
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <span data-role="halte-athlete-name" data-id="${athlete.id}" style="flex: 1; line-height: 1.3;">${athlete.name || "(Sin nombre)"}</span>
          <button class="edit-name-btn" data-role="edit-halte-name" data-id="${athlete.id}" title="Editar nombre" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.6;">✏️</button>
        </div>
      </td>
      <td>
        <select data-role="halte-tariff" data-id="${athlete.id}">
          ${halteTariffPlans
            .map(
              (option) =>
                `<option value="${option.key}" ${option.key === tariff ? "selected" : ""}>${option.key}</option>`
            )
            .join("")}
        </select>
      </td>
      <td><span data-role="halte-price" data-id="${athlete.id}">${price.toFixed(2)}</span> €</td>
      <td>
        <span data-role="halte-discount-display" data-id="${athlete.id}">${displayDiscount}%</span>
      </td>
      <td>
        <select data-role="halte-discount-reason" data-id="${athlete.id}">
          <option value="Ninguno" ${discountReason === "Ninguno" || !discountReason ? "selected" : ""}>Ninguno</option>
          <option value="Familiar" ${discountReason === "Familiar" ? "selected" : ""}>Familiar</option>
          <option value="Funcionario" ${discountReason === "Funcionario" ? "selected" : ""}>Funcionario</option>
          <option value="Mañanas" ${discountReason === "Mañanas" ? "selected" : ""}>Mañanas</option>
          <option value="Otro" ${discountReason === "Otro" ? "selected" : ""}>Otro</option>
        </select>
      </td>
      <td><span data-role="halte-final-price" data-id="${athlete.id}">${price.toFixed(2)}</span> €</td>
      <td>
        <select data-role="halte-paid" data-id="${athlete.id}">
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>
        <span data-role="halte-status" data-id="${athlete.id}" class="athlete-status-badge ${paid ? "athlete-status-paid" : "athlete-status-unpaid"}">${paid ? "Pagado" : "No Pagado"}</span>
      </td>
    `;
    ui.halteList.appendChild(row);
    // Debug: verificar que el badge tiene el texto correcto
    const addedRow = ui.halteList.querySelector(`tr[data-id="${athlete.id}"]`);
    const statusBadge = addedRow?.querySelector('[data-role="halte-status"]');
    if (statusBadge && !statusBadge.textContent.trim()) {
      console.warn('❌ Badge sin texto para halte:', athlete.name, 'paid:', paid);
      statusBadge.textContent = paid ? "Pagado" : "No Pagado";
    }
  });

  // Add event listeners for halte discount reason selects
  ui.halteList.querySelectorAll('[data-role="halte-discount-reason"]').forEach(select => {
    select.addEventListener('change', (e) => {
      const row = e.target.closest('tr');
      const discountDisplay = row.querySelector('[data-role="halte-discount-display"]');
      const reason = e.target.value;
      let discountValue = 0;
      if (reason === 'Familiar') discountValue = 15;
      else if (reason === 'Funcionario') discountValue = 10;
      else if (reason === 'Mañanas') discountValue = 10;
      discountDisplay.textContent = `${discountValue}%`;
    });
  });

  // Add event listeners for edit halte name buttons
  ui.halteList.querySelectorAll('[data-role="edit-halte-name"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const athleteId = e.target.dataset.id;
      const nameSpan = ui.halteList.querySelector(`[data-role="halte-athlete-name"][data-id="${athleteId}"]`);
      const currentName = nameSpan.textContent;
      const newName = prompt('Introduce el nuevo nombre del atleta:', currentName);
      
      if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
          await updateHalteAthlete(athleteId, { name: newName.trim() }, currentUser?.uid);
          await refreshHalteMonthly();
        } catch (error) {
          console.error('Error al actualizar el nombre del atleta:', error);
          alert('Error al actualizar el nombre del atleta');
        }
      }
    });
  });

  if (ui.halteListCount) {
    ui.halteListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }
  updatePendingSaveButtons();

  const totalActive = activeNow.size;
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;

  if (ui.halteSummaryActive) ui.halteSummaryActive.textContent = String(totalActive);
  if (ui.halteSummaryAverage) ui.halteSummaryAverage.textContent = formatCurrency(averageTariff);
  if (ui.halteSummaryNew) ui.halteSummaryNew.textContent = String(totalNew);
  if (ui.halteSummaryDrop) ui.halteSummaryDrop.textContent = String(totalDrop);
}

// ========== TELAS ==========

function renderTelasMonthOptions() {
  if (!ui.telasMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  ui.telasMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.telasMonthSelect.appendChild(option);
  });
  selectedTelasMonth = options[0];
  ui.telasMonthSelect.value = selectedTelasMonth;
}

function renderTelasListMonthOptions() {
  if (!ui.telasListMonthSelect) return;
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
  ui.telasListMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.telasListMonthSelect.appendChild(option);
  });
  selectedTelasListMonth = getMonthKey(now);
  ui.telasListMonthSelect.value = selectedTelasListMonth;
}

function renderTelasPaymentMonthOptions() {
  if (!ui.telasPaymentMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.telasPaymentMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.telasPaymentMonth.appendChild(option);
  });
  if (options.length > 0) ui.telasPaymentMonth.value = options[0];
}

function renderTelasCsvMonthOptions() {
  if (!ui.telasCsvMonth) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(getMonthKey(date));
  }
  ui.telasCsvMonth.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.telasCsvMonth.appendChild(option);
  });
  if (options.length > 0) ui.telasCsvMonth.value = options[0];
}

// ========== SINGLE CLASSES MONTH OPTIONS ==========

function renderSingleClassesMonthOptions() {
  if (!ui.singleClassesMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  ui.singleClassesMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.singleClassesMonthSelect.appendChild(option);
  });
  selectedSingleClassesMonth = options[0];
  ui.singleClassesMonthSelect.value = selectedSingleClassesMonth;
}

function renderSingleClassesListMonthOptions() {
  if (!ui.singleClassesListMonthSelect) return;
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
  ui.singleClassesListMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.singleClassesListMonthSelect.appendChild(option);
  });
  selectedSingleClassesListMonth = getMonthKey(now);
  ui.singleClassesListMonthSelect.value = selectedSingleClassesListMonth;
}

function setTelasPriceFromTariff() {
  const tariffKey = ui.telasTariff?.value;
  const plan = telasTariffPlanMap.get(tariffKey);
  if (plan && ui.telasPrice) {
    ui.telasPrice.value = String(plan.priceTotal);
  }
  calculateTelasFinalPrice();
}

function calculateTelasFinalPrice() {
  const basePrice = parseFloat(ui.telasPrice?.value || "0");
  const discount = parseFloat(ui.telasDiscount?.value || "0");
  const finalPrice = basePrice * (1 - discount / 100);
  if (ui.telasFinalPrice) ui.telasFinalPrice.value = finalPrice.toFixed(2);
}

async function importTelasAthletesFromCsv(file, monthKey) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter((line) => line.trim() !== "");
        if (lines.length === 0) {
          resolve({ success: 0, errors: 0 });
          return;
        }
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = headers.findIndex((h) =>
          h.includes("nombre") || h.includes("name")
        );
        const tariffIdx = headers.findIndex((h) =>
          h.includes("tarifa") || h.includes("tariff")
        );
        const paidIdx = headers.findIndex((h) =>
          h.includes("pagado") || h.includes("paid")
        );
        const priceIdx = headers.findIndex((h) =>
          h.includes("precio") || h.includes("price")
        );
        const discIdx = headers.findIndex((h) =>
          h.includes("descuento") || h.includes("discount")
        );
        const reasonIdx = headers.findIndex((h) =>
          h.includes("motivo") || h.includes("reason")
        );
        let success = 0;
        let errors = 0;
        for (let i = 1; i < lines.length; i++) {
          try {
            const cols = lines[i].split(",").map((c) => c.trim());
            const name = nameIdx >= 0 ? cols[nameIdx] : "";
            const tariff = tariffIdx >= 0 ? cols[tariffIdx] : "";
            const paidStr = paidIdx >= 0 ? cols[paidIdx] : "NO";
            const priceStr = priceIdx >= 0 ? cols[priceIdx] : "0";
            const discStr = discIdx >= 0 ? cols[discIdx] : "0";
            const reason = reasonIdx >= 0 ? cols[reasonIdx] : "";
            if (!name) continue;
            const athleteId = await createTelasAthlete(name, currentUserId);
            const paid = paidStr.toUpperCase() === "SI" || paidStr.toUpperCase() === "YES";
            const price = parseFloat(priceStr) || 0;
            const discount = parseFloat(discStr) || 0;
            const plan = telasTariffPlanMap.get(tariff) || telasTariffPlanMap.get("4/mes");
            const basePrice = plan.priceTotal;
            await upsertTelasAthleteMonth(
              athleteId,
              monthKey,
              {
                name,
                tariff,
                price: basePrice,
                discount,
                discountReason: reason,
                paid,
                durationMonths: 1,
                priceMonthly: basePrice,
                isPaymentMonth: true,
              },
              currentUserId
            );
            success++;
          } catch (err) {
            console.error("Error importing telas row:", err);
            errors++;
          }
        }
        resolve({ success, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function refreshTelasMonthly() {
  const monthKey = selectedTelasListMonth;
  if (!monthKey || !ui.telasList) return;
  ui.telasList.innerHTML = "";
  const allAthletes = await getTelasAthletes();
  currentTelasAthletes = allAthletes;
  const athleteMonths = await getTelasAthleteMonthsForMonth(monthKey);
  const athleteMonthsMap = new Map();
  for (const am of athleteMonths) {
    athleteMonthsMap.set(am.athleteId, am);
  }
  const [y, m] = monthKey.split("-").map(Number);
  let prevMonthKey = "";
  if (m === 1) {
    prevMonthKey = `${y - 1}-12`;
  } else {
    const pm = m - 1;
    prevMonthKey = `${y}-${pm < 10 ? "0" : ""}${pm}`;
  }
  const prevMonths = await getTelasAthleteMonthsForMonth(prevMonthKey);
  const activePrev = new Set(
    prevMonths.filter((am) => am.tariff && am.tariff !== "").map((am) => am.athleteId)
  );
  const entries = [];
  for (const athlete of allAthletes) {
    const am = athleteMonthsMap.get(athlete.id);
    let tariff = "";
    let paid = false;
    let discount = 0;
    let discountReason = "";
    let price = 0;
    let isPaymentMonth = false;
    let lastUpdate = null;
    if (am) {
      tariff = am.tariff || "";
      paid = am.paid || false;
      discount = am.discount || 0;
      discountReason = am.discountReason || "";
      price = am.price || 0;
      isPaymentMonth = am.isPaymentMonth || false;
      lastUpdate = am.updatedAt || am.createdAt;
    }
    entries.push({
      athlete,
      tariff,
      paid,
      discount,
      discountReason,
      price,
      isPaymentMonth,
      lastUpdate,
    });
  }

  // Ordenar por fecha de última actualización
  entries.sort((a, b) => {
    if (!a.lastUpdate && !b.lastUpdate) return 0;
    if (!a.lastUpdate) return 1;
    if (!b.lastUpdate) return -1;
    const timeA = a.lastUpdate?.seconds || a.lastUpdate?.toMillis?.() / 1000 || 0;
    const timeB = b.lastUpdate?.seconds || b.lastUpdate?.toMillis?.() / 1000 || 0;
    return timeB - timeA;
  });

  let filtered = entries;
  if (telasPaidFilter === "PAID") {
    filtered = filtered.filter((e) => e.paid);
  } else if (telasPaidFilter === "UNPAID") {
    filtered = filtered.filter((e) => !e.paid);
  }
  if (telasSearchTerm.trim() !== "") {
    const term = telasSearchTerm.trim().toLowerCase();
    filtered = filtered.filter((e) =>
      e.athlete.name.toLowerCase().includes(term)
    );
  }
  const visibleCount = filtered.length;
  const activeNow = new Set();
  let totalIncome = 0;
  for (const e of entries) {
    if (e.tariff && e.tariff !== "") {
      activeNow.add(e.athlete.id);
      if (e.paid && e.isPaymentMonth) {
        totalIncome += e.price;
      }
    }
  }
  filtered.forEach((e) => {
    const row = document.createElement("tr");
    const tariffOptions = ["", "4/mes", "8/mes", "12/mes", "Ilimitado"];
    const tariffOptionsHtml = tariffOptions
      .map((opt) => {
        const sel = opt === e.tariff ? "selected" : "";
        return `<option value="${opt}" ${sel}>${opt}</option>`;
      })
      .join("");
    const reasonOptions = ["", "Familiar", "Funcionario", "Mañanas", "Otro"];
    const reasonOptionsHtml = reasonOptions
      .map((opt) => {
        const sel = opt === e.discountReason ? "selected" : "";
        return `<option value="${opt}" ${sel}>${opt}</option>`;
      })
      .join("");
    const discountDisplay = e.discountReason
      ? e.discountReason === "Otro"
        ? `${e.discount}%`
        : `${e.discount}%`
      : `${e.discount}%`;
    const finalPrice = e.price * (1 - e.discount / 100);
    const paid = e.paid;
    row.dataset.id = e.athlete.id;
    row.dataset.name = e.athlete.name || "";
    row.innerHTML = `
      <td style="max-width: 200px;">
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <span data-role="telas-athlete-name" data-id="${e.athlete.id}" style="flex: 1; line-height: 1.3;">${e.athlete.name}</span>
          <button class="edit-name-btn" data-role="edit-telas-name" data-id="${e.athlete.id}" title="Editar nombre" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.6;">✏️</button>
        </div>
      </td>
      <td>
        <select data-role="telas-tariff" data-id="${e.athlete.id}">
          ${tariffOptionsHtml}
        </select>
      </td>
      <td><span data-role="telas-price" data-id="${e.athlete.id}">${e.price.toFixed(2)}</span> €</td>
      <td>
        <span data-role="telas-discount-display" data-id="${e.athlete.id}">${discountDisplay}</span>
      </td>
      <td>
        <select data-role="telas-discount-reason" data-id="${e.athlete.id}">
          <option value="" ${!e.discountReason ? "selected" : ""}>Ninguno</option>
          <option value="Familiar" ${e.discountReason === "Familiar" ? "selected" : ""}>Familiar</option>
          <option value="Funcionario" ${e.discountReason === "Funcionario" ? "selected" : ""}>Funcionario</option>
          <option value="Mañanas" ${e.discountReason === "Mañanas" ? "selected" : ""}>Mañanas</option>
          <option value="Otro" ${e.discountReason === "Otro" ? "selected" : ""}>Otro</option>
        </select>
      </td>
      <td><span data-role="telas-final-price" data-id="${e.athlete.id}">${finalPrice.toFixed(2)}</span> €</td>
      <td>
        <select data-role="telas-paid" data-id="${e.athlete.id}">
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>
        <span data-role="telas-status" data-id="${e.athlete.id}" class="athlete-status-badge ${paid ? "athlete-status-paid" : "athlete-status-unpaid"}">${paid ? "Pagado" : "No Pagado"}</span>
      </td>
    `;
    ui.telasList.appendChild(row);
    // Debug: verificar que el badge tiene el texto correcto
    const addedRow = ui.telasList.querySelector(`tr[data-id="${e.athlete.id}"]`);
    const statusBadge = addedRow?.querySelector('[data-role="telas-status"]');
    if (statusBadge && !statusBadge.textContent.trim()) {
      console.warn('❌ Badge sin texto para telas:', e.athlete.name, 'paid:', paid);
      statusBadge.textContent = paid ? "Pagado" : "No Pagado";
    }
  });

  // Add event listeners for telas discount reason selects
  ui.telasList.querySelectorAll('[data-role="telas-discount-reason"]').forEach(select => {
    select.addEventListener('change', (e) => {
      const row = e.target.closest('tr');
      const discountDisplay = row.querySelector('[data-role="telas-discount-display"]');
      const reason = e.target.value;
      let discountValue = 0;
      if (reason === 'Familiar') discountValue = 15;
      else if (reason === 'Funcionario') discountValue = 10;
      else if (reason === 'Mañanas') discountValue = 10;
      discountDisplay.textContent = `${discountValue}%`;
    });
  });

  // Add event listeners for edit telas name buttons
  ui.telasList.querySelectorAll('[data-role="edit-telas-name"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const athleteId = e.target.dataset.id;
      const nameSpan = ui.telasList.querySelector(`[data-role="telas-athlete-name"][data-id="${athleteId}"]`);
      const currentName = nameSpan.textContent;
      const newName = prompt('Introduce el nuevo nombre del atleta:', currentName);
      
      if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
          await updateTelasAthlete(athleteId, { name: newName.trim() }, currentUser?.uid);
          await refreshTelasMonthly();
        } catch (error) {
          console.error('Error al actualizar el nombre del atleta:', error);
          alert('Error al actualizar el nombre del atleta');
        }
      }
    });
  });

  if (ui.telasListCount) {
    ui.telasListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }
  updatePendingSaveButtons();

  const totalActive = activeNow.size;
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;

  if (ui.telasSummaryActive) ui.telasSummaryActive.textContent = String(totalActive);
  if (ui.telasSummaryAverage) ui.telasSummaryAverage.textContent = formatCurrency(averageTariff);
  if (ui.telasSummaryNew) ui.telasSummaryNew.textContent = String(totalNew);
  if (ui.telasSummaryDrop) ui.telasSummaryDrop.textContent = String(totalDrop);
}

// ========== SINGLE CLASSES AUXILIARY FUNCTIONS ==========

function renderSingleClassesPaymentMonthOptions() {
  if (!ui.singleClassesPaymentMonth) return;
  ui.singleClassesPaymentMonth.innerHTML = "";
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = getMonthKey(d);
    options.push(key);
  }
  if (!selectedSingleClassesPaymentMonth) {
    selectedSingleClassesPaymentMonth = options[0];
  }
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.singleClassesPaymentMonth.appendChild(option);
  });
  if (options.length > 0) ui.singleClassesPaymentMonth.value = options[0];
}

function renderSingleClassesCsvMonthOptions() {
  if (!ui.singleClassesCsvMonth) return;
  ui.singleClassesCsvMonth.innerHTML = "";
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = getMonthKey(d);
    options.push(key);
  }
  if (!selectedSingleClassesCsvMonth) {
    selectedSingleClassesCsvMonth = options[0];
  }
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.singleClassesCsvMonth.appendChild(option);
  });
  if (options.length > 0) ui.singleClassesCsvMonth.value = options[0];
}

function setSingleClassesPriceFromTariff() {
  const tariffKey = ui.singleClassesTariff?.value;
  const plan = singleClassesTariffPlanMap.get(tariffKey);
  if (plan && ui.singleClassesPrice) {
    ui.singleClassesPrice.value = String(plan.priceTotal);
  }
  calculateSingleClassesFinalPrice();
}

function calculateSingleClassesFinalPrice() {
  const basePrice = parseFloat(ui.singleClassesPrice?.value || "0");
  const discount = parseFloat(ui.singleClassesDiscount?.value || "0");
  const finalPrice = basePrice * (1 - discount / 100);
  if (ui.singleClassesFinalPrice) ui.singleClassesFinalPrice.value = finalPrice.toFixed(2);
}

async function importSingleClassesAthletesFromCsv(file, monthKey) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter((line) => line.trim() !== "");
        if (lines.length === 0) {
          resolve({ success: 0, errors: 0 });
          return;
        }
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = headers.findIndex((h) =>
          h.includes("nombre") || h.includes("name")
        );
        const tariffIdx = headers.findIndex((h) =>
          h.includes("tarifa") || h.includes("tariff")
        );
        const paidIdx = headers.findIndex((h) =>
          h.includes("pagado") || h.includes("paid")
        );
        const priceIdx = headers.findIndex((h) =>
          h.includes("precio") || h.includes("price")
        );
        const discIdx = headers.findIndex((h) =>
          h.includes("descuento") || h.includes("discount")
        );
        const reasonIdx = headers.findIndex((h) =>
          h.includes("motivo") || h.includes("reason")
        );
        let success = 0;
        let errors = 0;
        for (let i = 1; i < lines.length; i++) {
          try {
            const cols = lines[i].split(",").map((c) => c.trim());
            const name = nameIdx >= 0 ? cols[nameIdx] : "";
            const tariff = tariffIdx >= 0 ? cols[tariffIdx] : "";
            const paidStr = paidIdx >= 0 ? cols[paidIdx] : "NO";
            const priceStr = priceIdx >= 0 ? cols[priceIdx] : "0";
            const discStr = discIdx >= 0 ? cols[discIdx] : "0";
            const reason = reasonIdx >= 0 ? cols[reasonIdx] : "";
            if (!name) continue;
            const athleteId = await createSingleClassesAthlete(name, currentUserId);
            const paid = paidStr.toUpperCase() === "SI" || paidStr.toUpperCase() === "YES";
            const price = parseFloat(priceStr) || 0;
            const discount = parseFloat(discStr) || 0;
            const plan = singleClassesTariffPlanMap.get(tariff) || singleClassesTariffPlanMap.get("Clase Crossfit");
            const basePrice = plan.priceTotal;
            await upsertSingleClassesAthleteMonth(
              athleteId,
              monthKey,
              {
                name,
                tariff,
                price: basePrice,
                discount,
                discountReason: reason,
                paid,
                durationMonths: 1,
                priceMonthly: basePrice,
                isPaymentMonth: true,
              },
              currentUserId
            );
            success++;
          } catch (err) {
            console.error("Error importing single classes row:", err);
            errors++;
          }
        }
        resolve({ success, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function refreshSingleClassesMonthly() {
  const monthKey = selectedSingleClassesListMonth;
  if (!monthKey || !ui.singleClassesList) return;
  ui.singleClassesList.innerHTML = "";
  const allAthletes = await getSingleClassesAthletes();
  currentSingleClassesAthletes = allAthletes;
  const athleteMonths = await getSingleClassesAthleteMonthsForMonth(monthKey);
  const athleteMonthsMap = new Map();
  for (const am of athleteMonths) {
    athleteMonthsMap.set(am.athleteId, am);
  }
  const [y, m] = monthKey.split("-").map(Number);
  let prevMonthKey = "";
  if (m === 1) {
    prevMonthKey = `${y - 1}-12`;
  } else {
    const pm = m - 1;
    prevMonthKey = `${y}-${pm < 10 ? "0" : ""}${pm}`;
  }
  const prevMonths = await getSingleClassesAthleteMonthsForMonth(prevMonthKey);
  const activePrev = new Set(
    prevMonths.filter((am) => am.tariff && am.tariff !== "").map((am) => am.athleteId)
  );
  const entries = [];
  for (const athlete of allAthletes) {
    const am = athleteMonthsMap.get(athlete.id);
    let tariff = "";
    let paid = false;
    let discount = 0;
    let discountReason = "";
    let price = 0;
    let isPaymentMonth = false;
    let lastUpdate = null;
    if (am) {
      tariff = am.tariff || "";
      paid = am.paid === true || am.paid === "SI";
      discount = am.discount || 0;
      discountReason = am.discountReason || "";
      price = am.price || 0;
      isPaymentMonth = am.isPaymentMonth || false;
      lastUpdate = am.updatedAt || am.createdAt;
    }
    entries.push({
      athlete,
      tariff,
      paid,
      discount,
      discountReason,
      price,
      isPaymentMonth,
      lastUpdate,
    });
  }

  // Ordenar por fecha de última actualización
  entries.sort((a, b) => {
    if (!a.lastUpdate && !b.lastUpdate) return 0;
    if (!a.lastUpdate) return 1;
    if (!b.lastUpdate) return -1;
    const timeA = a.lastUpdate?.seconds || a.lastUpdate?.toMillis?.() / 1000 || 0;
    const timeB = b.lastUpdate?.seconds || b.lastUpdate?.toMillis?.() / 1000 || 0;
    return timeB - timeA;
  });

  let filtered = entries;
  if (singleClassesPaidFilter === "PAID") {
    filtered = filtered.filter((e) => e.paid);
  } else if (singleClassesPaidFilter === "UNPAID") {
    filtered = filtered.filter((e) => !e.paid);
  }
  if (singleClassesSearchTerm.trim() !== "") {
    const term = singleClassesSearchTerm.trim().toLowerCase();
    filtered = filtered.filter((e) =>
      e.athlete.name.toLowerCase().includes(term)
    );
  }
  const visibleCount = filtered.length;
  const activeNow = new Set();
  let totalIncome = 0;
  for (const e of entries) {
    if (e.tariff && e.tariff !== "") {
      activeNow.add(e.athlete.id);
      if (e.paid && e.isPaymentMonth) {
        totalIncome += e.price;
      }
    }
  }
  filtered.forEach((e) => {
    const row = document.createElement("tr");
    const tariffOptions = ["", "Clase Crossfit", "Bono 10 Clases Crossfit", "Clase Acrobacias", "Open Acrobacias 1h", "Open Acrobacias 2h"];
    const tariffOptionsHtml = tariffOptions
      .map((opt) => {
        const sel = opt === e.tariff ? "selected" : "";
        return `<option value="${opt}" ${sel}>${opt}</option>`;
      })
      .join("");
    const reasonOptions = ["", "Familiar", "Funcionario", "Mañanas", "Otro"];
    const reasonOptionsHtml = reasonOptions
      .map((opt) => {
        const sel = opt === e.discountReason ? "selected" : "";
        return `<option value="${opt}" ${sel}>${opt}</option>`;
      })
      .join("");
    const discountDisplay = e.discountReason
      ? e.discountReason === "Otro"
        ? `${e.discount}%`
        : `${e.discount}%`
      : `${e.discount}%`;
    const finalPrice = e.price * (1 - e.discount / 100);
    const paid = e.paid;
    row.dataset.id = e.athlete.id;
    row.dataset.name = e.athlete.name || "";
    row.innerHTML = `
      <td style="max-width: 200px;">
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <span data-role="singleclasses-athlete-name" data-id="${e.athlete.id}" style="flex: 1; line-height: 1.3;">${e.athlete.name}</span>
          <button class="edit-name-btn" data-role="edit-singleclasses-name" data-id="${e.athlete.id}" title="Editar nombre" style="flex-shrink: 0; padding: 2px 4px; cursor: pointer; border: none; background: transparent; font-size: 13px; opacity: 0.6;">✏️</button>
        </div>
      </td>
      <td>
        <select data-role="singleclasses-tariff" data-id="${e.athlete.id}" style="max-width: 180px;">
          ${tariffOptionsHtml}
        </select>
      </td>
      <td><span data-role="singleclasses-price" data-id="${e.athlete.id}">${e.price.toFixed(2)}</span> €</td>
      <td>
        <span data-role="singleclasses-discount-display" data-id="${e.athlete.id}">${discountDisplay}</span>
      </td>
      <td>
        <select data-role="singleclasses-discount-reason" data-id="${e.athlete.id}" style="width: 120px;">
          <option value="" ${!e.discountReason ? "selected" : ""}>Ninguno</option>
          <option value="Familiar" ${e.discountReason === "Familiar" ? "selected" : ""}>Familiar</option>
          <option value="Funcionario" ${e.discountReason === "Funcionario" ? "selected" : ""}>Funcionario</option>
          <option value="Mañanas" ${e.discountReason === "Mañanas" ? "selected" : ""}>Mañanas</option>
          <option value="Otro" ${e.discountReason === "Otro" ? "selected" : ""}>Otro</option>
        </select>
      </td>
      <td><span data-role="singleclasses-final-price" data-id="${e.athlete.id}">${finalPrice.toFixed(2)}</span> €</td>
      <td>
        <select data-role="singleclasses-paid" data-id="${e.athlete.id}">
          <option value="SI" ${paid ? "selected" : ""}>SI</option>
          <option value="NO" ${!paid ? "selected" : ""}>NO</option>
        </select>
      </td>
      <td>
        <span data-role="singleclasses-status" data-id="${e.athlete.id}" class="athlete-status-badge ${paid ? "athlete-status-paid" : "athlete-status-unpaid"}">${paid ? "Pagado" : "No Pagado"}</span>
      </td>
    `;
    ui.singleClassesList.appendChild(row);
    // Debug: verificar que el badge tiene el texto correcto
    const addedRow = ui.singleClassesList.querySelector(`tr[data-id="${e.athlete.id}"]`);
    const statusBadge = addedRow?.querySelector('[data-role="singleclasses-status"]');
    if (statusBadge && !statusBadge.textContent.trim()) {
      console.warn('❌ Badge sin texto para singleclasses:', e.athlete.name, 'paid:', paid);
      statusBadge.textContent = paid ? "Pagado" : "No Pagado";
    }
  });

  // Add event listeners for single classes discount reason selects
  ui.singleClassesList.querySelectorAll('[data-role="singleclasses-discount-reason"]').forEach(select => {
    select.addEventListener('change', (e) => {
      const row = e.target.closest('tr');
      const discountDisplay = row.querySelector('[data-role="singleclasses-discount-display"]');
      const reason = e.target.value;
      let discountValue = 0;
      if (reason === 'Familiar') discountValue = 15;
      else if (reason === 'Funcionario') discountValue = 10;
      else if (reason === 'Mañanas') discountValue = 10;
      discountDisplay.textContent = `${discountValue}%`;
    });
  });

  // Add event listeners for edit single classes name buttons
  ui.singleClassesList.querySelectorAll('[data-role="edit-singleclasses-name"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const athleteId = e.target.dataset.id;
      const nameSpan = ui.singleClassesList.querySelector(`[data-role="singleclasses-athlete-name"][data-id="${athleteId}"]`);
      const currentName = nameSpan.textContent;
      const newName = prompt('Introduce el nuevo nombre del atleta:', currentName);
      
      if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
          await updateSingleClassesAthlete(athleteId, { name: newName.trim() }, currentUser?.uid);
          await refreshSingleClassesMonthly();
        } catch (error) {
          console.error('Error al actualizar el nombre del atleta:', error);
          alert('Error al actualizar el nombre del atleta');
        }
      }
    });
  });

  if (ui.singleClassesListCount) {
    ui.singleClassesListCount.textContent = `Mostrando ${visibleCount} atletas`;
  }
  updatePendingSaveButtons();

  const totalActive = activeNow.size;
  const averageTariff = totalActive > 0 ? totalIncome / totalActive : 0;
  const totalNew = Array.from(activeNow).filter((id) => !activePrev.has(id)).length;
  const totalDrop = Array.from(activePrev).filter((id) => !activeNow.has(id)).length;

  if (ui.singleClassesSummaryActive) ui.singleClassesSummaryActive.textContent = String(totalActive);
  if (ui.singleClassesSummaryAverage) ui.singleClassesSummaryAverage.textContent = formatCurrency(averageTariff);
  if (ui.singleClassesSummaryNew) ui.singleClassesSummaryNew.textContent = String(totalNew);
  if (ui.singleClassesSummaryDrop) ui.singleClassesSummaryDrop.textContent = String(totalDrop);
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

// Mobile nav active state helper (defined early so it's available for bindAuth)
function updateMobileNavActive(viewId) {
  if (!ui.mobileNavButtons) return;
  ui.mobileNavButtons.forEach((btn) => {
    const isMore = btn.dataset.view === "moreView";
    const moreViews = ["checkinsView", "trainingsView", "rolesView", "profileView"];
    const isActive = btn.dataset.view === viewId || 
      (isMore && moreViews.includes(viewId));
    btn.classList.toggle("active", isActive);
  });
}


async function populateVacationWorkers() {
  if (!ui.vacationWorkerSelect) return;
  ui.vacationWorkerSelect.innerHTML = '<option value="">Yo</option>';
  try {
    const users = await getUsersList();
    users.forEach((u) => {
      if (!u.role) return;
      if (["OWNER", "RECEPTION", "COACH"].includes(u.role)) {
        const opt = document.createElement("option");
        const label = u.firstName ? `${u.firstName} ${u.lastName || ""}` : (u.email || u.id);
        opt.value = u.id;
        opt.textContent = `${label} ${u.role ? `(${u.role})` : ""}`;
        ui.vacationWorkerSelect.appendChild(opt);
      }
    });
  } catch (err) {
    console.error("Error loading users for vacations:", err);
  }
}

async function renderVacations() {

  if (!ui.vacationCalendar || !ui.vacationList) return;

  // --- FullCalendar integration ---
  const selectedWorker = ui.vacationWorkerSelect?.value || "";
  let now = new Date();
  if (ui._vacationFullCalendar) {
    now = ui._vacationFullCalendar.getDate();
  }
  const year = now.getFullYear();
  const month = now.getMonth();
  const palette = [
    '#6c7dff', '#4cd964', '#ffb86b', '#ff6b6b', '#9b59b6', '#00bcd4', '#ff8af3', '#ffc107'
  ];

  let vacations = [];
  try {
    if (selectedWorker) {
      vacations = await getVacationsForUser(selectedWorker);
    } else if (currentRole === 'OWNER') {
      vacations = await getVacationsForAll();
    } else {
      vacations = await getVacationsForUser(currentUser?.uid);
    }
  } catch (err) {
    console.error('Error fetching vacations:', err);
  }

  // Build user -> color map
  const users = [];
  const userIndex = {};
  vacations.forEach((v) => {
    if (!userIndex[v.userId]) {
      userIndex[v.userId] = users.length;
      users.push({ id: v.userId, name: v.userName || v.userId });
    }
  });
  const colorMap = {};
  users.forEach((u, i) => { colorMap[u.id] = palette[i % palette.length]; });

  // Holidays
  const holidays = getHolidaysForYear(year) || [];

  // Map vacations and holidays to FullCalendar events
  const events = [];
  vacations.forEach((v) => {
    events.push({
      title: v.userName ? v.userName : v.userId,
      start: v.startDate,
      end: v.endDate,
      backgroundColor: colorMap[v.userId] || palette[0],
      borderColor: colorMap[v.userId] || palette[0],
      textColor: '#fff',
      extendedProps: { reason: v.reason || '', userId: v.userId },
      allDay: true,
    });
  });
  holidays.forEach((h) => {
    events.push({
      title: h.name,
      start: h.date,
      backgroundColor: '#ffd166',
      borderColor: '#ffd166',
      textColor: '#222',
      allDay: true,
      display: 'background',
    });
  });

  // Only create FullCalendar once
  if (!ui._vacationFullCalendar) {
    const calendar = new window.FullCalendar.Calendar(ui.vacationCalendar, {
      initialView: 'dayGridMonth',
      locale: 'es',
      height: 'auto',
      firstDay: 1,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,dayGridWeek',
      },
      buttonText: {
        today: 'Hoy',
        month: 'Mes',
        week: 'Semana'
      },
      eventDidMount: function(info) {
        if (info.event.extendedProps.reason) {
          info.el.title = info.event.title + ': ' + info.event.extendedProps.reason;
        }
      },
      datesSet: function(arg) {
        // Only update legend/list on navigation - call renderVacations to get fresh data
        renderVacations();
      },
    });
    calendar.render();
    ui._vacationFullCalendar = calendar;
    calendar.gotoDate(now);
  }
  // Always update events for the current view
  ui._vacationFullCalendar.removeAllEvents();
  events.forEach(ev => ui._vacationFullCalendar.addEvent(ev));
  // Also update the list and legend
  renderVacationsListAndLegend({ vacations, users, colorMap, palette });

}

// Calculate vacation summary
function calculateVacationSummary(vacations) {
  if (!vacations || vacations.length === 0) {
    return { totalDays: 0, totalPeriods: 0, currentYearDays: 0 };
  }
  
  const currentYear = new Date().getFullYear();
  let totalDays = 0;
  let currentYearDays = 0;
  
  vacations.forEach(v => {
    const start = new Date(v.startDate);
    const end = new Date(v.endDate);
    // Calculate vacation days (inclusive)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    totalDays += days;
    
    // Check if vacation is in current year
    if (start.getFullYear() === currentYear || end.getFullYear() === currentYear) {
      currentYearDays += days;
    }
  });
  
  return {
    totalDays,
    totalPeriods: vacations.length,
    currentYearDays
  };
}

// Helper to update legend and list only
function renderVacationsListAndLegend(data = {}) {
  const { vacations = [], users = [], colorMap = {}, palette = [] } = data;
  
  // Hide legend and summary - not needed
  if (ui.vacationLegend) {
    ui.vacationLegend.style.display = 'none';
  }
  if (ui.vacationSummary) {
    ui.vacationSummary.style.display = 'none';
  }

  // Render list  
  if (!ui.vacationList) {
    return;
  }
  
  ui.vacationList.innerHTML = '';
  
  if (vacations.length > 0) {
    vacations.sort((a,b)=> new Date(a.startDate) - new Date(b.startDate));
    vacations.forEach((v)=>{
      const li = document.createElement('li');
      li.className = 'vacation-item';
      
      // Calculate vacation days
      const startDate = new Date(v.startDate);
      const endDate = new Date(v.endDate);
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // Create table-like structure for better alignment
      const table = document.createElement('div');
      table.className = 'vacation-table';
      
      const nameCell = document.createElement('div');
      nameCell.className = 'vacation-cell name-cell';
      nameCell.textContent = v.userName || v.userId || 'Desconocido';
      
      const datesCell = document.createElement('div');
      datesCell.className = 'vacation-cell dates-cell';
      datesCell.textContent = `${v.startDate} → ${v.endDate}`;
      
      const daysCell = document.createElement('div');
      daysCell.className = 'vacation-cell days-cell';
      daysCell.textContent = `${days} día${days !== 1 ? 's' : ''}`;
      
      const actionsCell = document.createElement('div');
      actionsCell.className = 'vacation-cell actions-cell';
      
      // Add edit button
      if (currentRole === 'OWNER' || v.createdBy === currentUser?.uid) {
        const edit = document.createElement('button'); 
        edit.className = 'btn ghost small'; 
        edit.textContent = 'Editar';
        edit.addEventListener('click', () => openEditVacationModal(v));
        actionsCell.appendChild(edit);
      }
      
      // Add delete button
      if (currentRole === 'OWNER' || v.createdBy === currentUser?.uid) {
        const del = document.createElement('button'); 
        del.className = 'btn ghost small danger'; 
        del.textContent = 'Eliminar';
        del.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este período de vacaciones?')) return;
          await deleteVacation(v.id);
          await renderVacations();
        });
        actionsCell.appendChild(del);
      }
      
      table.appendChild(nameCell);
      table.appendChild(datesCell);
      table.appendChild(daysCell);
      table.appendChild(actionsCell);
      
      li.appendChild(table);
      ui.vacationList.appendChild(li);
    });
  } else {
    // Show empty state
    const li = document.createElement('li');
    li.className = 'vacation-empty';
    li.innerHTML = '<div class="empty-message">No hay vacaciones registradas</div>';
    ui.vacationList.appendChild(li);
  }
}

// Open edit vacation modal
function openEditVacationModal(vacation) {
  if (!ui.vacationEditModal) return;
  
  ui.vacationEditId.value = vacation.id;
  ui.vacationEditUserId.value = vacation.userId;
  ui.vacationEditStart.value = vacation.startDate;
  ui.vacationEditEnd.value = vacation.endDate;
  ui.vacationEditReason.value = vacation.reason || '';
  ui.vacationEditDisplayName.value = vacation.userName || '';
  
  ui.vacationEditModal.classList.remove('hidden');
}

// Vacation modal open/close and submit
// --- Vacations Month Navigation ---
on(ui.vacationMonthPrev, "click", () => {
  if (!ui.vacationMonth) return;
  let d = ui.vacationMonth.value ? new Date(ui.vacationMonth.value + "-01") : new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  ui.vacationMonth.value = `${y}-${m}`;
  if (ui._vacationFullCalendar) ui._vacationFullCalendar.gotoDate(d);
});
on(ui.vacationMonthNext, "click", () => {
  if (!ui.vacationMonth) return;
  let d = ui.vacationMonth.value ? new Date(ui.vacationMonth.value + "-01") : new Date();
  d.setMonth(d.getMonth() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  ui.vacationMonth.value = `${y}-${m}`;
  if (ui._vacationFullCalendar) ui._vacationFullCalendar.gotoDate(d);
});
on(ui.vacationMonth, "change", () => {
  if (!ui.vacationMonth) return;
  let d = ui.vacationMonth.value ? new Date(ui.vacationMonth.value + "-01") : new Date();
  if (ui._vacationFullCalendar) ui._vacationFullCalendar.gotoDate(d);
});
on(ui.vacationAddBtn, "click", () => {
  if (!ui.vacationModal) return;
  ui.vacationStart.value = "";
  ui.vacationEnd.value = "";
  ui.vacationReason.value = "";
  ui.vacationDisplayName.value = "";
  // Clear edit modal fields to avoid confusion
  if (ui.vacationEditModal) {
    ui.vacationEditId.value = "";
    ui.vacationEditUserId.value = "";
    ui.vacationEditStart.value = "";
    ui.vacationEditEnd.value = "";
    ui.vacationEditReason.value = "";
    ui.vacationEditDisplayName.value = "";
  }
  ui.vacationModal.classList.remove("hidden");
});
on(ui.vacationModalClose, "click", () => ui.vacationModal?.classList.add("hidden"));
on(ui.vacationCancelBtn, "click", () => ui.vacationModal?.classList.add("hidden"));

on(ui.vacationForm, "submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const start = ui.vacationStart.value;
  const end = ui.vacationEnd.value;
  const reason = ui.vacationReason.value;
  const customName = ui.vacationDisplayName.value.trim();
  const forUser = ui.vacationWorkerSelect?.value || currentUser.uid;
  
  // Determinar el nombre a mostrar
  let userName = customName;
  if (!userName) {
    // Si no hay nombre personalizado, usar el del usuario seleccionado o el actual
    if (forUser === currentUser.uid) {
      // Si es el usuario actual, usar su perfil
      userName = (currentProfile?.firstName ? `${currentProfile.firstName} ${currentProfile.lastName || ""}` : currentUser.email) || "";
    } else {
      // Si es otro usuario, buscar su información en la lista de trabajadores
      const workerOption = ui.vacationWorkerSelect.querySelector(`option[value="${forUser}"]`);
      userName = workerOption ? workerOption.textContent.split('(')[0].trim() : forUser;
    }
  }
  
  try {
    await addVacation(forUser, userName, start, end, reason, currentUser.uid);
    ui.vacationModal?.classList.add("hidden");
    await renderVacations();
  } catch (err) {
    console.error("Error saving vacation:", err);
    alert("Error al guardar vacaciones: " + (err.message || err));
  }
});

on(ui.vacationWorkerSelect, "change", async () => renderVacations());
on(ui.vacationMonth, "change", async () => renderVacations());

// Edit vacation modal events
on(ui.vacationEditModalClose, "click", () => ui.vacationEditModal?.classList.add("hidden"));
on(ui.vacationEditCancelBtn, "click", () => ui.vacationEditModal?.classList.add("hidden"));

on(ui.vacationEditForm, "submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  
  const vacationId = ui.vacationEditId.value;
  const originalUserId = ui.vacationEditUserId.value; // Preserve original user
  const start = ui.vacationEditStart.value;
  const end = ui.vacationEditEnd.value;  
  const reason = ui.vacationEditReason.value;
  const customName = ui.vacationEditDisplayName.value.trim();
  
  // Determine display name
  let userName = customName;
  if (!userName) {
    if (originalUserId === currentUser.uid) {
      userName = (currentProfile?.firstName ? `${currentProfile.firstName} ${currentProfile.lastName || ""}` : currentUser.email) || "";
    } else {
      // For other users, try to get name from worker select or use original name
      const workerOption = ui.vacationWorkerSelect?.querySelector(`option[value="${originalUserId}"]`);
      userName = workerOption ? workerOption.textContent.split('(')[0].trim() : originalUserId;
    }
  }
  
  try {
    await updateVacation(vacationId, originalUserId, userName, start, end, reason);
    ui.vacationEditModal?.classList.add("hidden");
    await renderVacations();
  } catch (err) {
    console.error("Error updating vacation:", err);
    alert("Error al actualizar vacaciones: " + (err.message || err));
  }
});




// --- Pagos empleados ---
// Declaración y definición ANTES de cualquier uso
let employeePayments = [];
async function renderEmployeePayments() {
  employeePayments = await loadEmployeePayments();
  const year = ui.employeePaymentYearSelect.value;
  const month = ui.employeePaymentMonthSelect.value;
  const nameFilter = ui.employeePaymentNameFilter.value.toLowerCase();
  let filtered = employeePayments;
  if (year) filtered = filtered.filter(p => p.date && p.date.startsWith(year));
  if (month) filtered = filtered.filter(p => p.date && p.date.slice(5,7) === month.padStart(2,'0'));
  if (nameFilter) filtered = filtered.filter(p => (p.name||"").toLowerCase().includes(nameFilter));
  ui.employeePaymentsList.innerHTML = filtered.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${formatCurrency(Number(p.amount))}</td>
      <td>${p.method}</td>
      <td>${p.date}</td>
    </tr>
  `).join("") || '<tr><td colspan="4" class="muted">Sin pagos</td></tr>';
}

// Inicialización de listeners de pagos empleados SIEMPRE al cargar la app


function initEmployeePaymentsListeners() {
  if (employeePaymentsListenersInitialized) return;
  // Filtros pagos empleados
  if (ui.employeePaymentYearSelect && ui.employeePaymentMonthSelect && ui.employeePaymentNameFilter) {
    ui.employeePaymentYearSelect.innerHTML = `<option value="">Año</option>` + Array.from({length: 6}, (_,i) => {
      const y = new Date().getFullYear() - i;
      return `<option value="${y}">${y}</option>`;
    }).join("");
    ui.employeePaymentMonthSelect.innerHTML = `<option value="">Mes</option>` + Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${String(i+1).padStart(2,'0')}</option>`).join("");
    ui.employeePaymentYearSelect.addEventListener("change", renderEmployeePayments);
    ui.employeePaymentMonthSelect.addEventListener("change", renderEmployeePayments);
    ui.employeePaymentNameFilter.addEventListener("input", renderEmployeePayments);
  }
  // Modal añadir pago
  if (ui.employeePaymentAddBtn && ui.employeePaymentModal && ui.employeePaymentForm) {
    ui.employeePaymentAddBtn.addEventListener("click", () => {
      ui.employeePaymentModal.classList.remove("hidden");
      ui.employeePaymentForm.reset();
    });
    ui.employeePaymentModalClose.addEventListener("click", () => {
      ui.employeePaymentModal.classList.add("hidden");
    });
    ui.employeePaymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = ui.employeePaymentName.value.trim();
      const amount = ui.employeePaymentAmount.value;
      const method = ui.employeePaymentMethod.value;
      const date = ui.employeePaymentDate.value;
      if (!name || !amount || !method || !date) return;
      await addEmployeePayment({ name, amount, method, date, userId: (currentUser && currentUser.uid) || null });
      ui.employeePaymentModal.classList.add("hidden");
      await renderEmployeePayments();
    });
  }
  employeePaymentsListenersInitialized = true;
}

// Función para inicializar vista según sea necesario (lazy loading)
async function initializeViewIfNeeded(viewId) {
  if (viewsInitialized[viewId]) return;
  
  console.log(`Inicializando vista: ${viewId}`);
  
  switch(viewId) {
    case "summaryView":
      await refreshAll();
      viewsInitialized.summaryView = true;
      break;
      
    case "athletesView":
      await refreshAthleteMonthly();
      viewsInitialized.athletesView = true;
      break;
      
    case "acroView":
      await refreshAcroMonthly();
      viewsInitialized.acroView = true;
      break;
      
    case "halteView":
      await refreshHalteMonthly();
      viewsInitialized.halteView = true;
      break;
      
    case "telasView":
      await refreshTelasMonthly();
      viewsInitialized.telasView = true;
      break;
      
    case "singleClassesView":
      await refreshSingleClassesMonthly();
      viewsInitialized.singleClassesView = true;
      break;
      
    case "checkinsView":
      await refreshCheckinStatus();
      await refreshCheckinAdmin();
      viewsInitialized.checkinsView = true;
      break;
      
    case "vacationsView":
      await populateVacationWorkers();
      await renderVacations();
      viewsInitialized.vacationsView = true;
      break;
      
    case "employeePaymentsView":
      initEmployeePaymentsListeners();
      await renderEmployeePayments();
      viewsInitialized.employeePaymentsView = true;
      break;
      
    case "classesView":
      await initializeClasses();
      viewsInitialized.classesView = true;
      break;
      
    case "cajaView":
      await initializeCaja();
      viewsInitialized.cajaView = true;
      break;
  }
}

// Llama a la inicialización de listeners cada vez que se muestra la vista
ui.menuButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const viewId = button.dataset.view;
    setActiveView(viewId, ui);
    updateMobileNavActive(viewId);
    
    // Inicializar vista solo si no ha sido inicializada antes
    await initializeViewIfNeeded(viewId);
  });
});

// Mobile navigation buttons
ui.mobileNavButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const viewId = button.dataset.view;
    if (viewId === "moreView") {
      // Open more menu
      if (ui.moreMenu) {
        ui.moreMenu.classList.remove("hidden");
      }
    } else {
      setActiveView(viewId, ui);
      updateMobileNavActive(viewId);
      // Inicializar vista solo si no ha sido inicializada antes
      await initializeViewIfNeeded(viewId);
    }
  });
});

// More menu functionality
on(ui.moreMenuClose, "click", () => {
  if (ui.moreMenu) {
    ui.moreMenu.classList.add("hidden");
  }
});

// Close more menu when clicking outside (on the backdrop)
if (ui.moreMenu) {
  ui.moreMenu.addEventListener("click", (e) => {
    if (e.target === ui.moreMenu) {
      ui.moreMenu.classList.add("hidden");
    }
  });
}

// More menu option buttons
document.querySelectorAll('[data-close-more]').forEach((button) => {
  button.addEventListener("click", async () => {
    const viewId = button.dataset.view;
    if (viewId) {
      setActiveView(viewId, ui);
      await initializeViewIfNeeded(viewId);
      updateMobileNavActive(viewId);
      if (viewId === "vacationsView") {
        populateVacationWorkers().then(() => renderVacations());
      }
    }
    // Close more menu
    if (ui.moreMenu) {
      ui.moreMenu.classList.add("hidden");
    }
  });
});

// Event listener para el botón de cambio de tema
setTimeout(() => {
  const themeButton = document.getElementById('themeToggle');
  console.log('🔍 Buscando botón themeToggle:', themeButton);
  if (themeButton) {
    themeButton.onclick = () => {
      console.log('🎯 Click directo en botón de tema');
      toggleTheme();
    };
    console.log('✅ Evento onclick asignado al botón de tema');
  } else {
    console.log('❌ No se encontró el botón themeToggle después del timeout');
  }
}, 1000);

// No establecer vista inicial aquí - se establecerá después de la autenticación
// setActiveView("summaryView", ui);
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

function calculateDiscountFromReason(reason) {
  if (reason === "Familiar") return 15;
  if (reason === "Funcionario") return 10;
  if (reason === "Mañanas") return 10;
  return 0;
}

function setStatusBadge(statusElement, paid) {
  if (!statusElement) return;
  statusElement.textContent = paid ? "Pagado" : "No Pagado";
  statusElement.classList.toggle("athlete-status-paid", paid);
  statusElement.classList.toggle("athlete-status-unpaid", !paid);
}

function updatePendingSaveButtons() {
  const athletePending = ui.athleteList
    ? ui.athleteList.querySelectorAll("tr[data-dirty='true']").length
    : 0;
  const acroPending = ui.acroList
    ? ui.acroList.querySelectorAll("tr[data-dirty='true']").length
    : 0;

  if (ui.athleteSaveAllBtn) {
    ui.athleteSaveAllBtn.disabled = athletePending === 0;
    ui.athleteSaveAllBtn.textContent = `Guardar cambios (${athletePending})`;
  }
  if (ui.acroSaveAllBtn) {
    ui.acroSaveAllBtn.disabled = acroPending === 0;
    ui.acroSaveAllBtn.textContent = `Guardar cambios (${acroPending})`;
  }
}

function markDirtyRow(row) {
  if (!row) return;
  row.dataset.dirty = "true";
  row.classList.add("row-dirty");
  updatePendingSaveButtons();
}

async function saveAthleteRow(row) {
  const athleteId = row?.dataset?.id;
  const athleteName = row?.dataset?.name || "";
  const tariffSelect = row?.querySelector("[data-role='tariff']");
  const paidSelect = row?.querySelector("[data-role='paid']");
  const discountReasonInput = row?.querySelector("[data-role='discount-reason']");

  if (!athleteId || !tariffSelect || !paidSelect) {
    throw new Error("Fila inválida");
  }

  const newTariff = tariffSelect.value;
  const newPaid = paidSelect.value === "SI";
  const newDiscountReason = discountReasonInput ? discountReasonInput.value.trim() : "";
  const newDiscount = calculateDiscountFromReason(newDiscountReason);
  const plan = tariffPlanMap.get(newTariff) || tariffPlanMap.get("8/mes");
  const basePrice = plan.priceTotal;
  const newPrice = basePrice * (1 - newDiscount / 100);
  const monthKey = selectedAthleteListMonth || selectedAthleteMonth;
  const duration = plan.durationMonths || 1;

  for (let i = 0; i < duration; i += 1) {
    const targetMonth = addMonthsToKey(monthKey, i);
    await upsertAthleteMonth(
      athleteId,
      targetMonth,
      {
        athleteName,
        tariff: newTariff,
        price: newPrice,
        basePrice,
        discount: newDiscount,
        discountReason: newDiscountReason,
        paid: newPaid,
        active: newPaid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
}

async function saveAcroRow(row) {
  const athleteId = row?.dataset?.id;
  const athleteName = row?.dataset?.name || "";
  const tariffSelect = row?.querySelector("[data-role='acro-tariff']");
  const paidSelect = row?.querySelector("[data-role='acro-paid']");
  const discountReasonInput = row?.querySelector("[data-role='acro-discount-reason']");

  if (!athleteId || !tariffSelect || !paidSelect) {
    throw new Error("Fila inválida");
  }

  const newTariff = tariffSelect.value;
  const newPaid = paidSelect.value === "SI";
  const newDiscountReason = discountReasonInput ? discountReasonInput.value.trim() : "";
  const newDiscount = calculateDiscountFromReason(newDiscountReason);
  const plan = acroTariffPlanMap.get(newTariff) || acroTariffPlanMap.get("4/mes");
  const basePrice = plan.priceTotal;
  const newPrice = basePrice * (1 - newDiscount / 100);
  const monthKey = selectedAcroListMonth || selectedAcroMonth;
  const duration = plan.durationMonths || 1;

  for (let i = 0; i < duration; i += 1) {
    const targetMonth = addMonthsToKey(monthKey, i);
    await upsertAcroAthleteMonth(
      athleteId,
      targetMonth,
      {
        athleteName,
        tariff: newTariff,
        price: newPrice,
        basePrice,
        discount: newDiscount,
        discountReason: newDiscountReason,
        paid: newPaid,
        active: newPaid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
}

async function saveHalteRow(row) {
  const athleteId = row?.dataset?.id;
  const athleteName = row?.dataset?.name || "";
  const tariffSelect = row?.querySelector("[data-role='halte-tariff']");
  const paidSelect = row?.querySelector("[data-role='halte-paid']");
  const discountReasonInput = row?.querySelector("[data-role='halte-discount-reason']");

  if (!athleteId || !tariffSelect || !paidSelect) {
    throw new Error("Fila inválida");
  }

  const newTariff = tariffSelect.value;
  const newPaid = paidSelect.value === "SI";
  const newDiscountReason = discountReasonInput ? discountReasonInput.value.trim() : "";
  const newDiscount = calculateDiscountFromReason(newDiscountReason);
  const plan = halteTariffPlanMap.get(newTariff) || halteTariffPlanMap.get("Pequeña");
  const basePrice = plan.priceTotal;
  const newPrice = basePrice * (1 - newDiscount / 100);
  const monthKey = selectedHalteListMonth || selectedHalteMonth;
  const duration = plan.durationMonths || 1;

  for (let i = 0; i < duration; i += 1) {
    const targetMonth = addMonthsToKey(monthKey, i);
    await upsertHalteAthleteMonth(
      athleteId,
      targetMonth,
      {
        athleteName,
        tariff: newTariff,
        price: newPrice,
        basePrice,
        discount: newDiscount,
        discountReason: newDiscountReason,
        paid: newPaid,
        active: newPaid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
}

async function saveTelasRow(row) {
  const athleteId = row?.dataset?.id;
  const athleteName = row?.dataset?.name || "";
  const tariffSelect = row?.querySelector("[data-role='telas-tariff']");
  const paidSelect = row?.querySelector("[data-role='telas-paid']");
  const discountReasonInput = row?.querySelector("[data-role='telas-discount-reason']");

  if (!athleteId || !tariffSelect || !paidSelect) {
    throw new Error("Fila inválida");
  }

  const newTariff = tariffSelect.value;
  const newPaid = paidSelect.value === "SI";
  const newDiscountReason = discountReasonInput ? discountReasonInput.value.trim() : "";
  const newDiscount = calculateDiscountFromReason(newDiscountReason);
  const plan = telasTariffPlanMap.get(newTariff) || telasTariffPlanMap.get("4/mes");
  const basePrice = plan.priceTotal;
  const newPrice = basePrice * (1 - newDiscount / 100);
  const monthKey = selectedTelasListMonth || selectedTelasMonth;
  const duration = plan.durationMonths || 1;

  for (let i = 0; i < duration; i += 1) {
    const targetMonth = addMonthsToKey(monthKey, i);
    await upsertTelasAthleteMonth(
      athleteId,
      targetMonth,
      {
        name: athleteName,
        tariff: newTariff,
        price: newPrice,
        basePrice,
        discount: newDiscount,
        discountReason: newDiscountReason,
        paid: newPaid,
        active: newPaid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
}

async function saveSingleClassesRow(row) {
  const athleteId = row?.dataset?.id;
  const athleteName = row?.dataset?.name || "";
  const tariffSelect = row?.querySelector("[data-role='singleclasses-tariff']");
  const paidSelect = row?.querySelector("[data-role='singleclasses-paid']");
  const discountReasonInput = row?.querySelector("[data-role='singleclasses-discount-reason']");

  if (!athleteId || !tariffSelect || !paidSelect) {
    throw new Error("Fila inválida");
  }

  const newTariff = tariffSelect.value;
  const newPaid = paidSelect.value === "SI";
  const newDiscountReason = discountReasonInput ? discountReasonInput.value.trim() : "";
  const newDiscount = calculateDiscountFromReason(newDiscountReason);
  const plan = singleClassesTariffPlanMap.get(newTariff) || singleClassesTariffPlanMap.get("Clase Crossfit");
  const basePrice = plan.priceTotal;
  const newPrice = basePrice * (1 - newDiscount / 100);
  const monthKey = selectedSingleClassesListMonth || selectedSingleClassesMonth;
  const duration = plan.durationMonths || 1;

  for (let i = 0; i < duration; i += 1) {
    const targetMonth = addMonthsToKey(monthKey, i);
    await upsertSingleClassesAthleteMonth(
      athleteId,
      targetMonth,
      {
        name: athleteName,
        tariff: newTariff,
        price: newPrice,
        basePrice,
        discount: newDiscount,
        discountReason: newDiscountReason,
        paid: newPaid,
        active: newPaid,
        durationMonths: plan.durationMonths,
        priceMonthly: plan.priceMonthly,
        isPaymentMonth: i === 0,
      },
      currentUser?.uid
    );
  }
}

if (ui.athleteList) {
  ui.athleteList.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.matches("[data-role='tariff'], [data-role='discount-reason'], [data-role='paid']")) {
      return;
    }
    const row = target.closest("tr");
    markDirtyRow(row);
    if (target.matches("[data-role='paid']")) {
      const statusElement = row?.querySelector("[data-role='status']");
      setStatusBadge(statusElement, target.value === "SI");
    }
  });
}

if (ui.athleteSaveAllBtn) {
  ui.athleteSaveAllBtn.addEventListener("click", async () => {
    const dirtyRows = ui.athleteList
      ? Array.from(ui.athleteList.querySelectorAll("tr[data-dirty='true']"))
      : [];
    if (!dirtyRows.length) return;

    const originalText = ui.athleteSaveAllBtn.textContent;
    ui.athleteSaveAllBtn.textContent = "Guardando...";
    ui.athleteSaveAllBtn.disabled = true;

    let saved = 0;
    const failedNames = [];
    for (const row of dirtyRows) {
      try {
        await saveAthleteRow(row);
        saved += 1;
      } catch (error) {
        failedNames.push(row.dataset.name || row.dataset.id || "(sin nombre)");
        console.error("Error updating athlete row:", error);
      }
    }

    await refreshAthleteMonthly();
    updatePendingSaveButtons();
    ui.athleteSaveAllBtn.textContent = originalText;

    if (failedNames.length) {
      alert(`Guardados ${saved} cambios. Fallaron ${failedNames.length}: ${failedNames.join(", ")}`);
      return;
    }
    alert(`Guardados ${saved} cambios.`);
  });
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

// Halterofilia init
renderHalteMonthOptions();
setHaltePriceFromTariff();
renderHaltePaymentMonthOptions();
renderHalteListMonthOptions();
renderHalteCsvMonthOptions();
if (ui.halteModal) {
  ui.halteModal.classList.add("hidden");
}
if (ui.halteCsvModal) {
  ui.halteCsvModal.classList.add("hidden");
}

// Telas init
renderTelasMonthOptions();
setTelasPriceFromTariff();
renderTelasPaymentMonthOptions();
renderTelasListMonthOptions();
renderTelasCsvMonthOptions();
if (ui.telasModal) {
  ui.telasModal.classList.add("hidden");
}
if (ui.telasCsvModal) {
  ui.telasCsvModal.classList.add("hidden");
}

// Single Classes init
renderSingleClassesMonthOptions();
setSingleClassesPriceFromTariff();
renderSingleClassesPaymentMonthOptions();
renderSingleClassesListMonthOptions();
renderSingleClassesCsvMonthOptions();
if (ui.singleClassesModal) {
  ui.singleClassesModal.classList.add("hidden");
}
if (ui.singleClassesCsvModal) {
  ui.singleClassesCsvModal.classList.add("hidden");
}

if (ui.acroList) {
  ui.acroList.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.matches("[data-role='acro-tariff'], [data-role='acro-discount-reason'], [data-role='acro-paid']")) {
      return;
    }
    const row = target.closest("tr");
    markDirtyRow(row);
    if (target.matches("[data-role='acro-paid']")) {
      const statusElement = row?.querySelector("[data-role='acro-status']");
      setStatusBadge(statusElement, target.value === "SI");
    }
  });
}

if (ui.acroSaveAllBtn) {
  ui.acroSaveAllBtn.addEventListener("click", async () => {
    const dirtyRows = ui.acroList
      ? Array.from(ui.acroList.querySelectorAll("tr[data-dirty='true']"))
      : [];
    if (!dirtyRows.length) return;

    const originalText = ui.acroSaveAllBtn.textContent;
    ui.acroSaveAllBtn.textContent = "Guardando...";
    ui.acroSaveAllBtn.disabled = true;

    let saved = 0;
    const failedNames = [];
    for (const row of dirtyRows) {
      try {
        await saveAcroRow(row);
        saved += 1;
      } catch (error) {
        failedNames.push(row.dataset.name || row.dataset.id || "(sin nombre)");
        console.error("Error updating acro athlete row:", error);
      }
    }

    await refreshAcroMonthly();
    updatePendingSaveButtons();
    ui.acroSaveAllBtn.textContent = originalText;

    if (failedNames.length) {
      alert(`Guardados ${saved} cambios. Fallaron ${failedNames.length}: ${failedNames.join(", ")}`);
      return;
    }
    alert(`Guardados ${saved} cambios.`);
  });
}

if (ui.halteList) {
  ui.halteList.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.matches("[data-role='halte-tariff'], [data-role='halte-discount-reason'], [data-role='halte-paid']")) {
      return;
    }
    const row = target.closest("tr");
    markDirtyRow(row);
    if (target.matches("[data-role='halte-paid']")) {
      const statusElement = row?.querySelector("[data-role='halte-status']");
      setStatusBadge(statusElement, target.value === "SI");
    }
  });
}

if (ui.halteSaveAllBtn) {
  ui.halteSaveAllBtn.addEventListener("click", async () => {
    const dirtyRows = ui.halteList
      ? Array.from(ui.halteList.querySelectorAll("tr[data-dirty='true']"))
      : [];
    if (!dirtyRows.length) return;

    const originalText = ui.halteSaveAllBtn.textContent;
    ui.halteSaveAllBtn.textContent = "Guardando...";
    ui.halteSaveAllBtn.disabled = true;

    let saved = 0;
    const failedNames = [];
    for (const row of dirtyRows) {
      try {
        await saveHalteRow(row);
        saved += 1;
      } catch (error) {
        failedNames.push(row.dataset.name || row.dataset.id || "(sin nombre)");
        console.error("Error updating halte athlete row:", error);
      }
    }

    await refreshHalteMonthly();
    updatePendingSaveButtons();
    ui.halteSaveAllBtn.textContent = originalText;

    if (failedNames.length) {
      alert(`Guardados ${saved} cambios. Fallaron ${failedNames.length}: ${failedNames.join(", ")}`);
      return;
    }
    alert(`Guardados ${saved} cambios.`);
  });
}

if (ui.telasList) {
  ui.telasList.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.matches("[data-role='telas-tariff'], [data-role='telas-discount-reason'], [data-role='telas-paid']")) {
      return;
    }
    const row = target.closest("tr");
    markDirtyRow(row);
    if (target.matches("[data-role='telas-paid']")) {
      const statusElement = row?.querySelector("[data-role='telas-status']");
      setStatusBadge(statusElement, target.value === "SI");
    }
  });
}

if (ui.telasSaveAllBtn) {
  ui.telasSaveAllBtn.addEventListener("click", async () => {
    const dirtyRows = ui.telasList
      ? Array.from(ui.telasList.querySelectorAll("tr[data-dirty='true']"))
      : [];
    if (!dirtyRows.length) return;

    const originalText = ui.telasSaveAllBtn.textContent;
    ui.telasSaveAllBtn.textContent = "Guardando...";
    ui.telasSaveAllBtn.disabled = true;

    let saved = 0;
    const failedNames = [];
    for (const row of dirtyRows) {
      try {
        await saveTelasRow(row);
        saved += 1;
      } catch (error) {
        failedNames.push(row.dataset.name || row.dataset.id || "(sin nombre)");
        console.error("Error updating telas athlete row:", error);
      }
    }

    await refreshTelasMonthly();
    updatePendingSaveButtons();
    ui.telasSaveAllBtn.textContent = originalText;

    if (failedNames.length) {
      alert(`Guardados ${saved} cambios. Fallaron ${failedNames.length}: ${failedNames.join(", ")}`);
      return;
    }
    alert(`Guardados ${saved} cambios.`);
  });
}

if (ui.singleClassesList) {
  ui.singleClassesList.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.matches("[data-role='singleclasses-tariff'], [data-role='singleclasses-discount-reason'], [data-role='singleclasses-paid']")) {
      return;
    }
    const row = target.closest("tr");
    markDirtyRow(row);
    if (target.matches("[data-role='singleclasses-paid']")) {
      const statusElement = row?.querySelector("[data-role='singleclasses-status']");
      setStatusBadge(statusElement, target.value === "SI");
    }
  });
}

if (ui.singleClassesSaveAllBtn) {
  ui.singleClassesSaveAllBtn.addEventListener("click", async () => {
    const dirtyRows = ui.singleClassesList
      ? Array.from(ui.singleClassesList.querySelectorAll("tr[data-dirty='true']"))
      : [];
    if (!dirtyRows.length) return;

    const originalText = ui.singleClassesSaveAllBtn.textContent;
    ui.singleClassesSaveAllBtn.textContent = "Guardando...";
    ui.singleClassesSaveAllBtn.disabled = true;

    let saved = 0;
    const failedNames = [];
    for (const row of dirtyRows) {
      try {
        await saveSingleClassesRow(row);
        saved += 1;
      } catch (error) {
        failedNames.push(row.dataset.name || row.dataset.id || "(sin nombre)");
        console.error("Error updating single classes athlete row:", error);
      }
    }

    await refreshSingleClassesMonthly();
    updatePendingSaveButtons();
    ui.singleClassesSaveAllBtn.textContent = originalText;

    if (failedNames.length) {
      alert(`Guardados ${saved} cambios. Fallaron ${failedNames.length}: ${failedNames.join(", ")}`);
      return;
    }
    alert(`Guardados ${saved} cambios.`);
  });
}

updatePendingSaveButtons();

bindAuth(
  ui,
  async (user, profile) => {
    currentUser = user;
    currentProfile = profile;
    currentRole = profile.role;

    if (user) {
      // Si el usuario debe cambiar la contraseña, no cargamos todavía los datos pesados
      if (profile.mustChangePassword) {
        if (ui.passwordChangeStatus) ui.passwordChangeStatus.textContent = "";
        if (ui.passwordChangeNew) ui.passwordChangeNew.value = "";
        if (ui.passwordChangeConfirm) ui.passwordChangeConfirm.value = "";
        // Ocultar navegación móvil mientras está obligado a cambiar contraseña
        if (ui.mobileNav) {
          ui.mobileNav.classList.add("hidden");
        }
      } else {
        // Flujo normal: cargar datos de la app
        if (ui.checkinProfileFirstName) {
          ui.checkinProfileFirstName.value = profile.firstName || "";
        }
        if (ui.checkinProfileLastName) {
          ui.checkinProfileLastName.value = profile.lastName || "";
        }
        // Rellenar vista de perfil
        renderProfileView();

        // Actualizar visibilidad del menú según rol
        updateMenuVisibility(ui, currentRole);
        if (ui.mobileNav) {
          ui.mobileNav.classList.toggle("hidden", !user);
        }
        
        // Establecer vista inicial según rol y cargar solo sus datos
        let initialView = "summaryView"; // Default para OWNER
        if (currentRole !== "OWNER") {
          initialView = "checkinsView";
        }
        
        setActiveView(initialView, ui);
        updateMobileNavActive(initialView);
        
        // Cargar datos solo de la vista inicial (lazy loading)
        await initializeViewIfNeeded(initialView);
      }
    } else {
      stopCheckinTimer();
      if (ui.mobileNav) {
        ui.mobileNav.classList.add("hidden");
      }
    }
    updateUserBadge();
  },
  setAuthUI
);

function getUserInitials() {
  const firstName = currentProfile?.firstName?.trim() || "";
  const lastName = currentProfile?.lastName?.trim() || "";
  const initialsFromName = [firstName, lastName]
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");

  if (initialsFromName) {
    return initialsFromName.slice(0, 2);
  }

  const email = currentProfile?.email || currentUser?.email || "";
  if (email) {
    return email[0].toUpperCase();
  }

  return "?";
}

function updateUserBadge() {
  if (!ui.userBadge) return;

  if (!currentUser) {
    ui.userBadge.textContent = "Invitado";
    if (ui.userAvatar) {
      ui.userAvatar.textContent = "?";
    }
    return;
  }

  const initials = getUserInitials();
  const roleLabel = currentRole || currentProfile?.role || "";
  if (ui.userAvatar) {
    ui.userAvatar.textContent = initials;
  }
  ui.userBadge.textContent = roleLabel || "";
}

function renderProfileView() {
  if (!ui.profileView || !currentUser) return;

  if (ui.profileEmail) {
    ui.profileEmail.textContent = currentUser.email || "-";
  }
  if (ui.profileRole) {
    ui.profileRole.textContent = currentRole || currentProfile?.role || "-";
  }

  if (ui.profileFirstName) {
    ui.profileFirstName.value = currentProfile?.firstName || "";
  }
  if (ui.profileLastName) {
    ui.profileLastName.value = currentProfile?.lastName || "";
  }

  if (ui.profileAvatar) {
    ui.profileAvatar.style.backgroundImage = "";
    ui.profileAvatar.textContent = getUserInitials();
  }

  // Mantener el encabezado sincronizado con las iniciales actuales
  updateUserBadge();

  // Mostrar/ocultar botón de cambio de contraseña según tipo de login
  if (ui.profileChangePasswordBtn) {
    const hasEmail = !!auth.currentUser?.email;
    ui.profileChangePasswordBtn.classList.toggle("hidden", !hasEmail);
  }
}

// ---------- Funciones de importación CSV para pagos/gastos ----------

function downloadCsvTemplate(filename, type) {
  const headers = ["Concepto", "Fecha", "Importe"];
  const exampleRow = type === "payment" 
    ? ["Cuota mensual", "2026-02-01", "50.00"]
    : ["Material oficina", "2026-02-01", "25.00"];
  
  const csv = [headers, exampleRow]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAthleteTemplate() {
  const headers = ["nombre", "tarifa", "pagado", "precio", "descuento", "motivo_descuento"];
  const exampleRow = ["Juan Pérez", "8/mes", "SI", "80", "10", "Estudiante"];
  
  const csv = [headers, exampleRow]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-atletas.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAcroTemplate() {
  const headers = ["nombre", "tarifa", "pagado", "precio", "descuento", "motivo_descuento"];
  const exampleRow = ["María García", "4/mes", "NO", "45", "15", "Hermano/a"];
  
  const csv = [headers, exampleRow]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-acrobacias.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadHalteTemplate() {
  const headers = ["nombre", "tarifa", "pagado", "precio", "descuento", "motivo_descuento"];
  const exampleRow = ["Juan Pérez", "Pequeña", "NO", "30", "15", "Familiar"];
  
  const csv = [headers, exampleRow]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-halterofilia.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadTelasTemplate() {
  const headers = ["nombre", "tarifa", "pagado", "precio", "descuento", "motivo_descuento"];
  const exampleRow = ["María García", "4/mes", "NO", "45", "15", "Familiar"];
  
  const csv = [headers, exampleRow]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-telas.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function parsePaymentExpenseCsvRows(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return []; // Solo cabecera o vacío
  // Ignorar primera fila (cabecera)
  const dataLines = lines.slice(1);
  return dataLines.map((line) => {
    // Manejar CSV con comillas y sin comillas
    const values = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    // Limpiar comillas externas
    const cleaned = values.map((v) => v.replace(/^"|"$/g, "").trim());
    
    // Parsear importe (manejar tanto punto como coma decimal)
    const amountStr = (cleaned[2] || "0").replace(",", ".");
    const amount = parseFloat(amountStr) || 0;
    
    return {
      concept: cleaned[0] || "",
      date: cleaned[1] || "",
      amount,
    };
  });
}

async function importPaymentsFromCsv(file) {
  const text = await file.text();
  const rows = parsePaymentExpenseCsvRows(text);
  console.log("Rows parsed:", rows);
  if (rows.length === 0) {
    throw new Error("CSV vacío o sin datos (solo cabecera)");
  }
  let processed = 0;
  for (const row of rows) {
    console.log("Processing row:", row);
    if (!row.concept || !row.date) {
      console.log("Skipping - missing concept or date");
      continue;
    }
    if (row.amount <= 0) {
      console.log("Skipping - amount <= 0:", row.amount);
      continue;
    }
    await addPayment(row.concept, row.amount, row.date, currentUser?.uid);
    console.log("Added payment:", row);
    processed += 1;
  }
  return processed;
}

async function importExpensesFromCsv(file) {
  const text = await file.text();
  const rows = parsePaymentExpenseCsvRows(text);
  console.log("Rows parsed:", rows);
  if (rows.length === 0) {
    throw new Error("CSV vacío o sin datos (solo cabecera)");
  }
  let processed = 0;
  for (const row of rows) {
    console.log("Processing row:", row);
    if (!row.concept || !row.date) {
      console.log("Skipping - missing concept or date");
      continue;
    }
    if (row.amount <= 0) {
      console.log("Skipping - amount <= 0:", row.amount);
      continue;
    }
    await addExpense(row.concept, row.amount, row.date, currentUser?.uid);
    console.log("Added expense:", row);
    processed += 1;
  }
  return processed;
}

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

// Payment Edit/Delete handlers
function handleEditPayment(paymentId, paymentData) {
  ui.paymentEditId.value = paymentId;
  ui.paymentEditConcept.value = paymentData.concept || "";
  ui.paymentEditDate.value = paymentData.date || "";
  ui.paymentEditAmount.value = paymentData.amount || 0;
  ui.paymentEditModal?.classList.remove("hidden");
}

function handleDeletePayment(paymentId, paymentData) {
  ui.paymentDeleteId.value = paymentId;
  ui.paymentDeleteInfo.textContent = `${paymentData.concept || ""} · ${paymentData.date || ""} · ${formatCurrency(Number(paymentData.amount || 0))}`;
  ui.paymentDeleteModal?.classList.remove("hidden");
}

on(ui.paymentEditClose, "click", () => {
  ui.paymentEditModal?.classList.add("hidden");
});

on(ui.paymentEditForm, "submit", async (event) => {
  event.preventDefault();
  const paymentId = ui.paymentEditId.value;
  if (!paymentId) return;
  try {
    await updatePayment(
      paymentId,
      ui.paymentEditConcept.value,
      Number(ui.paymentEditAmount.value),
      ui.paymentEditDate.value,
      currentUser?.uid
    );
    ui.paymentEditModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    console.error("Error updating payment:", error);
    alert("Error al actualizar el ingreso: " + (error.message || error));
  }
});

on(ui.paymentDeleteConfirm, "click", async () => {
  const paymentId = ui.paymentDeleteId.value;
  if (!paymentId) return;
  try {
    await deletePayment(paymentId);
    ui.paymentDeleteModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    console.error("Error deleting payment:", error);
    alert("Error al eliminar el ingreso: " + (error.message || error));
  }
});

on(ui.paymentDeleteCancel, "click", () => {
  ui.paymentDeleteModal?.classList.add("hidden");
});

// Expense Edit/Delete handlers
function handleEditExpense(expenseId, expenseData) {
  ui.expenseEditId.value = expenseId;
  ui.expenseEditConcept.value = expenseData.concept || "";
  ui.expenseEditDate.value = expenseData.date || "";
  ui.expenseEditAmount.value = expenseData.amount || 0;
  ui.expenseEditModal?.classList.remove("hidden");
}

function handleDeleteExpense(expenseId, expenseData) {
  ui.expenseDeleteId.value = expenseId;
  ui.expenseDeleteInfo.textContent = `${expenseData.concept || ""} · ${expenseData.date || ""} · ${formatCurrency(Number(expenseData.amount || 0))}`;
  ui.expenseDeleteModal?.classList.remove("hidden");
}

on(ui.expenseEditClose, "click", () => {
  ui.expenseEditModal?.classList.add("hidden");
});

on(ui.expenseEditForm, "submit", async (event) => {
  event.preventDefault();
  const expenseId = ui.expenseEditId.value;
  if (!expenseId) return;
  try {
    await updateExpense(
      expenseId,
      ui.expenseEditConcept.value,
      Number(ui.expenseEditAmount.value),
      ui.expenseEditDate.value,
      currentUser?.uid
    );
    ui.expenseEditModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    console.error("Error updating expense:", error);
    alert("Error al actualizar el gasto: " + (error.message || error));
  }
});

on(ui.expenseDeleteConfirm, "click", async () => {
  const expenseId = ui.expenseDeleteId.value;
  if (!expenseId) return;
  try {
    await deleteExpense(expenseId);
    ui.expenseDeleteModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    console.error("Error deleting expense:", error);
    alert("Error al eliminar el gasto: " + (error.message || error));
  }
});

on(ui.expenseDeleteCancel, "click", () => {
  ui.expenseDeleteModal?.classList.add("hidden");
});

// Payment CSV handlers
on(ui.paymentCsvOpen, "click", () => {
  ui.paymentCsvModal?.classList.remove("hidden");
});

on(ui.paymentCsvClose, "click", () => {
  ui.paymentCsvModal?.classList.add("hidden");
});

on(ui.paymentCsvForm, "submit", async (event) => {
  event.preventDefault();
  if (!ui.paymentCsvFile?.files?.length) return;
  ui.paymentCsvStatus.textContent = "Importando...";
  try {
    const processed = await importPaymentsFromCsv(ui.paymentCsvFile.files[0]);
    ui.paymentCsvStatus.textContent = `Importados ${processed} ingresos.`;
    ui.paymentCsvForm.reset();
    ui.paymentCsvModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    ui.paymentCsvStatus.textContent = `Error: ${error.message || error}`;
  }
});

on(ui.paymentTemplateDownload, "click", () => {
  downloadCsvTemplate("plantilla-ingresos.csv", "payment");
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

// Expense CSV handlers
on(ui.expenseCsvOpen, "click", () => {
  ui.expenseCsvModal?.classList.remove("hidden");
});

on(ui.expenseCsvClose, "click", () => {
  ui.expenseCsvModal?.classList.add("hidden");
});

on(ui.expenseCsvForm, "submit", async (event) => {
  event.preventDefault();
  if (!ui.expenseCsvFile?.files?.length) return;
  ui.expenseCsvStatus.textContent = "Importando...";
  try {
    const processed = await importExpensesFromCsv(ui.expenseCsvFile.files[0]);
    ui.expenseCsvStatus.textContent = `Importados ${processed} gastos.`;
    ui.expenseCsvForm.reset();
    ui.expenseCsvModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    ui.expenseCsvStatus.textContent = `Error: ${error.message || error}`;
  }
});

on(ui.expenseTemplateDownload, "click", () => {
  downloadCsvTemplate("plantilla-gastos.csv", "expense");
});

// ========== ORDERS SYSTEM ==========

// Toggle supplier other field
function toggleSupplierOtherField() {
  const isOther = ui.orderSupplier?.value === "Otros";
  ui.orderSupplierOtherLabel?.classList.toggle("hidden", !isOther);
  if (!isOther && ui.orderSupplierOther) {
    ui.orderSupplierOther.value = "";
  }
}

function toggleEditSupplierOtherField() {
  const isOther = ui.orderEditSupplier?.value === "Otros";
  ui.orderEditSupplierOtherLabel?.classList.toggle("hidden", !isOther);
  if (!isOther && ui.orderEditSupplierOther) {
    ui.orderEditSupplierOther.value = "";
  }
}

on(ui.orderSupplier, "change", toggleSupplierOtherField);
on(ui.orderEditSupplier, "change", toggleEditSupplierOtherField);

// Order form submit
on(ui.orderForm, "submit", async (event) => {
  event.preventDefault();
  
  let supplier = ui.orderSupplier.value;
  if (supplier === "Otros") {
    const otherSupplier = ui.orderSupplierOther?.value?.trim();
    if (!otherSupplier) {
      alert("Por favor, introduce el nombre del proveedor");
      return;
    }
    supplier = otherSupplier;
  }
  
  await addOrder(
    supplier,
    Number(ui.orderPrice.value),
    ui.orderDate.value,
    ui.orderDocument.value,
    currentUser?.uid
  );
  
  ui.orderForm.reset();
  toggleSupplierOtherField();
  ui.orderModal?.classList.add("hidden");
  await refreshAll();
});

// Order modal handlers
on(ui.orderAddBtn, "click", () => {
  ui.orderForm.reset();
  toggleSupplierOtherField();
  ui.orderModal?.classList.remove("hidden");
});

on(ui.orderModalClose, "click", () => {
  ui.orderModal?.classList.add("hidden");
});

// Order month select
on(ui.orderMonthSelect, "change", async () => {
  selectedOrderMonth = ui.orderMonthSelect.value;
  await refreshOrderList();
});

// Order Edit/Delete handlers
function handleEditOrder(orderId, orderData) {
  ui.orderEditId.value = orderId;
  ui.orderEditDate.value = orderData.date || "";
  ui.orderEditPrice.value = orderData.price || 0;
  ui.orderEditDocument.value = orderData.document || "";
  
  // Check if supplier is one of the predefined ones
  const predefinedSuppliers = ["Velites", "Prozis", "Picsil", "Ramrage"];
  if (predefinedSuppliers.includes(orderData.supplier)) {
    ui.orderEditSupplier.value = orderData.supplier;
    ui.orderEditSupplierOther.value = "";
  } else {
    ui.orderEditSupplier.value = "Otros";
    ui.orderEditSupplierOther.value = orderData.supplier || "";
  }
  
  toggleEditSupplierOtherField();
  ui.orderEditModal?.classList.remove("hidden");
}

function handleDeleteOrder(orderId, orderData) {
  ui.orderDeleteId.value = orderId;
  ui.orderDeleteInfo.textContent = `${orderData.supplier || ""} · ${orderData.date || ""} · ${formatCurrency(Number(orderData.price || 0))}`;
  ui.orderDeleteModal?.classList.remove("hidden");
}

on(ui.orderEditClose, "click", () => {
  ui.orderEditModal?.classList.add("hidden");
});

on(ui.orderEditForm, "submit", async (event) => {
  event.preventDefault();
  const orderId = ui.orderEditId.value;
  if (!orderId) return;
  
  let supplier = ui.orderEditSupplier.value;
  if (supplier === "Otros") {
    const otherSupplier = ui.orderEditSupplierOther?.value?.trim();
    if (!otherSupplier) {
      alert("Por favor, introduce el nombre del proveedor");
      return;
    }
    supplier = otherSupplier;
  }
  
  try {
    await updateOrder(
      orderId,
      supplier,
      Number(ui.orderEditPrice.value),
      ui.orderEditDate.value,
      ui.orderEditDocument.value,
      currentUser?.uid
    );
    ui.orderEditModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    console.error("Error updating order:", error);
    alert("Error al actualizar el pedido: " + (error.message || error));
  }
});

on(ui.orderDeleteConfirm, "click", async () => {
  const orderId = ui.orderDeleteId.value;
  if (!orderId) return;
  try {
    await deleteOrder(orderId);
    ui.orderDeleteModal?.classList.add("hidden");
    await refreshAll();
  } catch (error) {
    console.error("Error deleting order:", error);
    alert("Error al eliminar el pedido: " + (error.message || error));
  }
});

on(ui.orderDeleteCancel, "click", () => {
  ui.orderDeleteModal?.classList.add("hidden");
});

// ========== CHECKIN SYSTEM ==========

function formatTime(date) {
  if (!date) return "-";
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateCheckinDateTime() {
  if (ui.checkinDateTime) {
    const now = new Date();
    ui.checkinDateTime.textContent = now.toLocaleString("es-ES", {
      dateStyle: "full",
      timeStyle: "medium",
    });
  }
}

function startCheckinTimer(startTime) {
  if (checkinTimerInterval) {
    clearInterval(checkinTimerInterval);
  }
  
  const updateTimer = () => {
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    if (ui.checkinTimer) {
      ui.checkinTimer.textContent = formatDuration(elapsed);
    }
  };
  
  updateTimer();
  checkinTimerInterval = setInterval(updateTimer, 1000);
}

function stopCheckinTimer() {
  if (checkinTimerInterval) {
    clearInterval(checkinTimerInterval);
    checkinTimerInterval = null;
  }
}

async function refreshCheckinStatus() {
  if (!currentUser) return;
  
  // Update user name and datetime - show full name if available, otherwise email
  if (ui.checkinUserName) {
    const fullName = [currentProfile?.firstName, currentProfile?.lastName].filter(Boolean).join(" ");
    ui.checkinUserName.textContent = fullName || currentUser.email || "-";
  }
  updateCheckinDateTime();
  
  // Check for open checkin
  currentOpenCheckin = await getOpenCheckinForUser(currentUser.uid);
  
  if (currentOpenCheckin) {
    // Has open checkin
    ui.checkinStatus?.classList.remove("hidden");
    ui.checkinClosedStatus?.classList.add("hidden");
    
    const checkInTime = currentOpenCheckin.checkInTime?.toDate?.() || null;
    if (ui.checkinInTime) {
      ui.checkinInTime.textContent = formatTime(checkInTime);
    }
    
    if (checkInTime) {
      startCheckinTimer(checkInTime);
    }
    
    if (ui.checkinOpenBtn) ui.checkinOpenBtn.disabled = true;
    if (ui.checkinCloseBtn) ui.checkinCloseBtn.disabled = false;
  } else {
    // No open checkin - check for last closed one
    ui.checkinStatus?.classList.add("hidden");
    stopCheckinTimer();
    
    const lastCheckin = await getLastCheckinForUser(currentUser.uid);
    
    if (lastCheckin && lastCheckin.status === "closed") {
      ui.checkinClosedStatus?.classList.remove("hidden");
      
      const checkInTime = lastCheckin.checkInTime?.toDate?.() || null;
      const checkOutTime = lastCheckin.checkOutTime?.toDate?.() || null;
      
      if (ui.checkinClosedInTime) {
        ui.checkinClosedInTime.textContent = formatTime(checkInTime);
      }
      if (ui.checkinClosedOutTime) {
        ui.checkinClosedOutTime.textContent = formatTime(checkOutTime);
      }
      if (ui.checkinClosedDuration && checkInTime && checkOutTime) {
        const duration = checkOutTime.getTime() - checkInTime.getTime();
        ui.checkinClosedDuration.textContent = formatDuration(duration);
      }
    } else {
      ui.checkinClosedStatus?.classList.add("hidden");
    }
    
    if (ui.checkinOpenBtn) ui.checkinOpenBtn.disabled = false;
    if (ui.checkinCloseBtn) ui.checkinCloseBtn.disabled = true;
  }
  
  // Refresh checkin history
  await refreshCheckinHistory();
}

async function refreshCheckinHistory() {
  if (!currentUser || !ui.checkinList) return;
  
  const checkins = await getCheckinsForUser(currentUser.uid);
  checkins.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  
  ui.checkinList.innerHTML = "";
  
  checkins.slice(0, 20).forEach((checkin) => {
    const checkInTime = checkin.checkInTime?.toDate?.() || null;
    const checkOutTime = checkin.checkOutTime?.toDate?.() || null;
    const status = checkin.status === "open" ? "Abierto" : "Cerrado";
    
    let durationText = "-";
    if (checkInTime && checkOutTime) {
      const duration = checkOutTime.getTime() - checkInTime.getTime();
      durationText = formatDuration(duration);
    }
    
    const dateStr = checkInTime ? checkInTime.toLocaleDateString("es-ES") : "-";
    const inTimeStr = formatTime(checkInTime);
    const outTimeStr = checkOutTime ? formatTime(checkOutTime) : "-";
    
    const li = document.createElement("li");
    li.innerHTML = `<span>${dateStr} · ${inTimeStr} - ${outTimeStr} · ${durationText}</span><span class="status-${checkin.status}">${status}</span>`;
    ui.checkinList.appendChild(li);
  });
}

// Helper to get device info
function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
    language: navigator.language || "",
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
  };
}

on(ui.checkinOpenBtn, "click", async () => {
  if (!currentUser) return;
  try {
    const fullName = [currentProfile?.firstName, currentProfile?.lastName].filter(Boolean).join(" ");
    const deviceInfo = getDeviceInfo();
    await openCheckin(currentUser.uid, currentUser.email, fullName, deviceInfo);
    await refreshCheckinStatus();
    await refreshCheckinAdmin();
  } catch (error) {
    console.error("Error opening checkin:", error);
    alert("Error al abrir fichaje: " + (error.message || error));
  }
});

on(ui.checkinCloseBtn, "click", async () => {
  if (!currentUser || !currentOpenCheckin) return;
  try {
    const deviceInfo = getDeviceInfo();
    await closeCheckin(currentOpenCheckin.id, deviceInfo);
    await refreshCheckinStatus();
    await refreshCheckinAdmin();
  } catch (error) {
    console.error("Error closing checkin:", error);
    alert("Error al cerrar fichaje: " + (error.message || error));
  }
});

// Profile edit handlers
on(ui.checkinEditProfileBtn, "click", () => {
  if (ui.checkinProfileEdit) {
    ui.checkinProfileEdit.classList.remove("hidden");
  }
});

on(ui.checkinProfileCancel, "click", () => {
  if (ui.checkinProfileEdit) {
    ui.checkinProfileEdit.classList.add("hidden");
  }
  // Reset to saved values
  if (ui.checkinProfileFirstName) {
    ui.checkinProfileFirstName.value = currentProfile?.firstName || "";
  }
  if (ui.checkinProfileLastName) {
    ui.checkinProfileLastName.value = currentProfile?.lastName || "";
  }
});

on(ui.checkinProfileForm, "submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  
  const firstName = ui.checkinProfileFirstName?.value?.trim() || "";
  const lastName = ui.checkinProfileLastName?.value?.trim() || "";
  
  try {
    await updateUserProfile(currentUser.uid, firstName, lastName);
    // Update local profile
    currentProfile = { ...currentProfile, firstName, lastName };
    renderProfileView();
    // Hide form
    if (ui.checkinProfileEdit) {
      ui.checkinProfileEdit.classList.add("hidden");
    }
    // Update displayed name
    await refreshCheckinStatus();
    alert("Perfil actualizado correctamente");
  } catch (error) {
    console.error("Error updating profile:", error);
    alert("Error al actualizar perfil: " + (error.message || error));
  }
});

on(ui.profileForm, "submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const firstName = ui.profileFirstName?.value?.trim() || "";
  const lastName = ui.profileLastName?.value?.trim() || "";

  if (ui.profileStatus) {
    ui.profileStatus.textContent = "Guardando cambios...";
  }

  try {
    await updateUserProfile(currentUser.uid, firstName, lastName);

    currentProfile = { ...currentProfile, firstName, lastName };
    renderProfileView();
    await refreshCheckinStatus();

    if (ui.profileStatus) {
      ui.profileStatus.textContent = "Perfil actualizado correctamente.";
    }
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    if (ui.profileStatus) {
      ui.profileStatus.textContent =
        "Error al actualizar perfil: " + (error.message || String(error));
    }
  }
});

// Modal de cambio de contraseña
on(ui.profileChangePasswordBtn, "click", () => {
  if (ui.passwordChangeModal) {
    ui.passwordChangeModal.classList.remove("hidden");
  }
  if (ui.passwordChangeModalNew) ui.passwordChangeModalNew.value = "";
  if (ui.passwordChangeModalConfirm) ui.passwordChangeModalConfirm.value = "";
  if (ui.passwordChangeModalStatus) ui.passwordChangeModalStatus.textContent = "";
});

on(ui.passwordChangeModalClose, "click", () => {
  if (ui.passwordChangeModal) {
    ui.passwordChangeModal.classList.add("hidden");
  }
});

on(ui.passwordChangeModalForm, "submit", async (e) => {
  e.preventDefault();
  if (!auth.currentUser) return;

  const newPassword = ui.passwordChangeModalNew?.value || "";
  const confirmPassword = ui.passwordChangeModalConfirm?.value || "";

  if (!newPassword || !confirmPassword) {
    if (ui.passwordChangeModalStatus) {
      ui.passwordChangeModalStatus.textContent = "Rellena ambos campos de contraseña.";
    }
    return;
  }

  if (newPassword.length < 6) {
    if (ui.passwordChangeModalStatus) {
      ui.passwordChangeModalStatus.textContent = "La nueva contraseña debe tener al menos 6 caracteres.";
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (ui.passwordChangeModalStatus) {
      ui.passwordChangeModalStatus.textContent = "Las contraseñas no coinciden.";
    }
    return;
  }

  if (ui.passwordChangeModalStatus) {
    ui.passwordChangeModalStatus.textContent = "Actualizando contraseña...";
  }

  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      if (ui.passwordChangeModalStatus) {
        ui.passwordChangeModalStatus.textContent = "Solo disponible para usuarios con email y contraseña.";
      }
      return;
    }

    await updatePassword(user, newPassword);

    if (ui.passwordChangeModalNew) ui.passwordChangeModalNew.value = "";
    if (ui.passwordChangeModalConfirm) ui.passwordChangeModalConfirm.value = "";

    if (ui.passwordChangeModalStatus) {
      ui.passwordChangeModalStatus.textContent = "Contraseña actualizada correctamente.";
    }

    // Cerrar modal después de 2 segundos
    setTimeout(() => {
      if (ui.passwordChangeModal) {
        ui.passwordChangeModal.classList.add("hidden");
      }
    }, 2000);
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    let message = "Error al cambiar la contraseña.";
    if (error.code === "auth/requires-recent-login") {
      message = "Por seguridad, vuelve a iniciar sesión y prueba de nuevo.";
    } else if (error.code === "auth/too-many-requests") {
      message = "Demasiados intentos. Inténtalo de nuevo más tarde.";
    } else if (error.message) {
      message = error.message;
    }
    if (ui.passwordChangeModalStatus) {
      ui.passwordChangeModalStatus.textContent = message;
    }
  }
});

// Update datetime every second
setInterval(updateCheckinDateTime, 1000);

// ========== ADMIN CHECKIN SYSTEM (OWNER ONLY) ==========

function renderCheckinAdminMonthOptions() {
  if (!ui.checkinAdminMonthSelect) return;
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  ui.checkinAdminMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.checkinAdminMonthSelect.appendChild(option);
  });
  if (!selectedCheckinAdminMonth) {
    selectedCheckinAdminMonth = options[0];
  }
  ui.checkinAdminMonthSelect.value = selectedCheckinAdminMonth;
}

function formatHoursMinutes(milliseconds) {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

async function refreshCheckinAdmin() {
  if (currentRole !== "OWNER") {
    ui.checkinAdminSection?.classList.add("hidden");
    return;
  }
  
  ui.checkinAdminSection?.classList.remove("hidden");
  renderCheckinAdminMonthOptions();
  
  const allCheckins = await getAllCheckins();
  
  // Filter by selected month
  const filteredCheckins = allCheckins.filter((checkin) => {
    const checkInTime = checkin.checkInTime?.toDate?.();
    if (!checkInTime) return false;
    const monthKey = getMonthKey(checkInTime);
    return monthKey === selectedCheckinAdminMonth;
  });
  
  // Sort by date descending
  filteredCheckins.sort((a, b) => {
    const aTime = a.checkInTime?.toMillis?.() || 0;
    const bTime = b.checkInTime?.toMillis?.() || 0;
    return bTime - aTime;
  });
  
  // Calculate totals
  let totalDuration = 0;
  const workerStats = new Map();
  
  filteredCheckins.forEach((checkin) => {
    const checkInTime = checkin.checkInTime?.toDate?.();
    const checkOutTime = checkin.checkOutTime?.toDate?.();
    const displayName = checkin.userName || checkin.userEmail || checkin.userId || "Desconocido";
    
    if (!workerStats.has(displayName)) {
      workerStats.set(displayName, { count: 0, totalDuration: 0, days: new Set() });
    }
    
    const stats = workerStats.get(displayName);
    stats.count += 1;
    
    if (checkInTime && checkOutTime) {
      const duration = checkOutTime.getTime() - checkInTime.getTime();
      totalDuration += duration;
      stats.totalDuration += duration;
      stats.days.add(checkInTime.toDateString());
    }
  });
  
  // Update summary
  if (ui.checkinAdminTotalHours) {
    ui.checkinAdminTotalHours.textContent = formatHoursMinutes(totalDuration);
  }
  if (ui.checkinAdminTotalCount) {
    ui.checkinAdminTotalCount.textContent = String(filteredCheckins.length);
  }
  
  // Render checkin list
  if (ui.checkinAdminList) {
    ui.checkinAdminList.innerHTML = "";
    
    filteredCheckins.forEach((checkin) => {
      const checkInTime = checkin.checkInTime?.toDate?.();
      const checkOutTime = checkin.checkOutTime?.toDate?.();
      const displayName = checkin.userName || checkin.userEmail || checkin.userId || "Desconocido";
      const status = checkin.status === "open" ? "Abierto" : "Cerrado";
      const hasModifications = (checkin.modificationHistory && checkin.modificationHistory.length > 0);
      
      let durationText = "-";
      if (checkInTime && checkOutTime) {
        const duration = checkOutTime.getTime() - checkInTime.getTime();
        durationText = formatDuration(duration);
      }
      
      const dateStr = checkInTime ? checkInTime.toLocaleDateString("es-ES") : "-";
      const inTimeStr = formatTime(checkInTime);
      const outTimeStr = checkOutTime ? formatTime(checkOutTime) : "-";
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${displayName}</td>
        <td>${dateStr}</td>
        <td>${inTimeStr}</td>
        <td>${outTimeStr}</td>
        <td>${durationText}</td>
        <td><span class="status-badge ${checkin.status}">${status}</span></td>
        <td class="actions-cell">
          <button class="btn ghost small checkin-edit-btn" data-id="${checkin.id}" title="Editar">✏️</button>
          <button class="btn ghost small checkin-history-btn ${hasModifications ? 'has-history' : ''}" data-id="${checkin.id}" title="Ver historial">📋</button>
        </td>
      `;
      ui.checkinAdminList.appendChild(row);
    });
    
    // Add event listeners for edit and history buttons
    ui.checkinAdminList.querySelectorAll(".checkin-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => openCheckinEditModal(btn.dataset.id));
    });
    ui.checkinAdminList.querySelectorAll(".checkin-history-btn").forEach((btn) => {
      btn.addEventListener("click", () => openCheckinHistoryModal(btn.dataset.id));
    });
  }
  
  // Render worker summary
  if (ui.checkinAdminSummaryList) {
    ui.checkinAdminSummaryList.innerHTML = "";
    
    workerStats.forEach((stats, email) => {
      const avgPerDay = stats.days.size > 0 
        ? stats.totalDuration / stats.days.size 
        : 0;
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${email}</td>
        <td>${stats.count}</td>
        <td>${formatHoursMinutes(stats.totalDuration)}</td>
        <td>${formatHoursMinutes(avgPerDay)}</td>
      `;
      ui.checkinAdminSummaryList.appendChild(row);
    });
  }
}

on(ui.checkinAdminMonthSelect, "change", async (event) => {
  selectedCheckinAdminMonth = event.target.value;
  await refreshCheckinAdmin();
});

// ========== CHECKIN EDIT & HISTORY FUNCTIONS ==========

let checkinEditData = null; // Stores data of checkin being edited

async function openCheckinEditModal(checkinId) {
  try {
    const checkin = await getCheckinWithHistory(checkinId);
    if (!checkin) {
      alert("No se encontró el fichaje");
      return;
    }
    
    checkinEditData = checkin;
    
    // Populate modal
    if (ui.checkinEditId) ui.checkinEditId.value = checkinId;
    if (ui.checkinEditWorker) {
      ui.checkinEditWorker.textContent = checkin.userName || checkin.userEmail || "Desconocido";
    }
    
    const checkInTime = checkin.checkInTime?.toDate?.();
    const checkOutTime = checkin.checkOutTime?.toDate?.();
    
    if (ui.checkinEditOriginalDate && checkInTime) {
      ui.checkinEditOriginalDate.textContent = checkInTime.toLocaleString("es-ES");
    }
    
    // Set datetime-local values
    if (ui.checkinEditIn && checkInTime) {
      ui.checkinEditIn.value = formatDateTimeLocal(checkInTime);
    }
    if (ui.checkinEditOut) {
      ui.checkinEditOut.value = checkOutTime ? formatDateTimeLocal(checkOutTime) : "";
    }
    if (ui.checkinEditReason) ui.checkinEditReason.value = "";
    
    ui.checkinEditModal?.classList.remove("hidden");
  } catch (error) {
    console.error("Error loading checkin:", error);
    alert("Error al cargar fichaje: " + (error.message || error));
  }
}

function formatDateTimeLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function openCheckinHistoryModal(checkinId) {
  try {
    const checkin = await getCheckinWithHistory(checkinId);
    if (!checkin) {
      alert("No se encontró el fichaje");
      return;
    }
    
    // Populate header info
    if (ui.checkinHistoryWorker) {
      ui.checkinHistoryWorker.textContent = checkin.userName || checkin.userEmail || "Desconocido";
    }
    
    const checkInTime = checkin.checkInTime?.toDate?.();
    const checkOutTime = checkin.checkOutTime?.toDate?.();
    const originalTime = checkin.originalCheckInTime 
      ? new Date(checkin.originalCheckInTime) 
      : checkInTime;
    
    if (ui.checkinHistoryOriginal) {
      ui.checkinHistoryOriginal.textContent = originalTime ? originalTime.toLocaleString("es-ES") : "-";
    }
    if (ui.checkinHistoryCurrent) {
      ui.checkinHistoryCurrent.textContent = checkInTime ? checkInTime.toLocaleString("es-ES") : "-";
    }
    if (ui.checkinHistoryOut) {
      ui.checkinHistoryOut.textContent = checkOutTime ? checkOutTime.toLocaleString("es-ES") : "-";
    }
    
    // Device info
    if (ui.checkinHistoryDevice) {
      const deviceInfo = checkin.deviceInfo;
      if (deviceInfo && deviceInfo.userAgent) {
        const platform = deviceInfo.platform || "Desconocido";
        const browser = deviceInfo.userAgent.split(" ").slice(-1)[0] || "Desconocido";
        const screen = deviceInfo.screenWidth && deviceInfo.screenHeight 
          ? `${deviceInfo.screenWidth}x${deviceInfo.screenHeight}` 
          : "Desconocido";
        ui.checkinHistoryDevice.innerHTML = `
          <div><strong>Plataforma:</strong> ${platform}</div>
          <div><strong>Navegador:</strong> ${browser}</div>
          <div><strong>Pantalla:</strong> ${screen}</div>
          <div><strong>Idioma:</strong> ${deviceInfo.language || "-"}</div>
        `;
      } else {
        ui.checkinHistoryDevice.textContent = "No disponible";
      }
    }
    
    // Modification history
    const history = checkin.modificationHistory || [];
    if (ui.checkinHistoryList) {
      ui.checkinHistoryList.innerHTML = "";
      
      if (history.length === 0) {
        ui.checkinHistoryEmpty?.classList.remove("hidden");
        ui.checkinHistoryList.closest(".table-responsive")?.classList.add("hidden");
      } else {
        ui.checkinHistoryEmpty?.classList.add("hidden");
        ui.checkinHistoryList.closest(".table-responsive")?.classList.remove("hidden");
        
        history.forEach((mod) => {
          const modDate = new Date(mod.modifiedAt);
          const prevValues = mod.previousValues || {};
          let prevText = [];
          if (prevValues.checkInTime) {
            prevText.push(`Entrada: ${new Date(prevValues.checkInTime).toLocaleString("es-ES")}`);
          }
          if (prevValues.checkOutTime) {
            prevText.push(`Salida: ${new Date(prevValues.checkOutTime).toLocaleString("es-ES")}`);
          }
          if (prevValues.status) {
            prevText.push(`Estado: ${prevValues.status}`);
          }
          
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${modDate.toLocaleString("es-ES")}</td>
            <td>${mod.modifiedBy || "-"}</td>
            <td>${mod.reason || "-"}</td>
            <td>${prevText.join("<br>") || "-"}</td>
          `;
          ui.checkinHistoryList.appendChild(row);
        });
      }
    }
    
    ui.checkinHistoryModal?.classList.remove("hidden");
  } catch (error) {
    console.error("Error loading checkin history:", error);
    alert("Error al cargar historial: " + (error.message || error));
  }
}

// Edit modal handlers
on(ui.checkinEditClose, "click", () => {
  ui.checkinEditModal?.classList.add("hidden");
  checkinEditData = null;
});

on(ui.checkinEditCancelBtn, "click", () => {
  ui.checkinEditModal?.classList.add("hidden");
  checkinEditData = null;
});

on(ui.checkinEditForm, "submit", async (event) => {
  event.preventDefault();
  
  if (!checkinEditData || !currentUser) return;
  
  const checkinId = ui.checkinEditId?.value;
  const newCheckInTime = ui.checkinEditIn?.value ? new Date(ui.checkinEditIn.value) : null;
  const newCheckOutTime = ui.checkinEditOut?.value ? new Date(ui.checkinEditOut.value) : null;
  const reason = ui.checkinEditReason?.value?.trim();
  
  if (!reason) {
    alert("Debes indicar el motivo del cambio");
    return;
  }
  
  try {
    const updates = {};
    if (newCheckInTime) {
      updates.checkInTime = newCheckInTime;
    }
    if (newCheckOutTime) {
      updates.checkOutTime = newCheckOutTime;
      updates.status = "closed";
    }
    
    const modifierInfo = currentUser.email || currentUser.uid;
    await modifyCheckin(checkinId, updates, modifierInfo, reason);
    
    ui.checkinEditModal?.classList.add("hidden");
    checkinEditData = null;
    
    await refreshCheckinAdmin();
    alert("Fichaje modificado correctamente");
  } catch (error) {
    console.error("Error updating checkin:", error);
    alert("Error al modificar fichaje: " + (error.message || error));
  }
});

// History modal handler
on(ui.checkinHistoryClose, "click", () => {
  ui.checkinHistoryModal?.classList.add("hidden");
});

// Checkin Download handlers
function renderCheckinDownloadOptions() {
  // Render month options (last 24 months)
  if (ui.checkinDownloadMonth) {
    const now = new Date();
    ui.checkinDownloadMonth.innerHTML = "";
    for (let i = 0; i < 24; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = getMonthKey(date);
      const option = document.createElement("option");
      option.value = key;
      option.textContent = getMonthLabel(key);
      ui.checkinDownloadMonth.appendChild(option);
    }
  }
  
  // Render year options (current year and 2 previous)
  if (ui.checkinDownloadYear) {
    const currentYear = new Date().getFullYear();
    ui.checkinDownloadYear.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const year = currentYear - i;
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      ui.checkinDownloadYear.appendChild(option);
    }
  }
}

on(ui.checkinDownloadBtn, "click", async () => {
  renderCheckinDownloadOptions();
  // Populate worker filter
  if (ui.checkinDownloadWorker) {
    const allCheckins = await getAllCheckins();
    const workers = new Map();
    allCheckins.forEach((c) => {
      const name = c.userName || c.userEmail || c.userId || "Desconocido";
      const key = c.userId || c.userEmail;
      if (!workers.has(key)) {
        workers.set(key, { id: key, name });
      }
    });
    ui.checkinDownloadWorker.innerHTML = '<option value="">Todos los trabajadores</option>';
    workers.forEach((w) => {
      const option = document.createElement("option");
      option.value = w.id;
      option.textContent = w.name;
      ui.checkinDownloadWorker.appendChild(option);
    });
  }
  ui.checkinDownloadModal?.classList.remove("hidden");
});

on(ui.checkinDownloadClose, "click", () => {
  ui.checkinDownloadModal?.classList.add("hidden");
});

on(ui.checkinDownloadType, "change", (event) => {
  const type = event.target.value;
  if (type === "monthly") {
    ui.checkinDownloadMonthly?.classList.remove("hidden");
    ui.checkinDownloadYearly?.classList.add("hidden");
  } else {
    ui.checkinDownloadMonthly?.classList.add("hidden");
    ui.checkinDownloadYearly?.classList.remove("hidden");
  }
});

on(ui.checkinDownloadConfirm, "click", async () => {
  const type = ui.checkinDownloadType?.value || "monthly";
  const format = ui.checkinDownloadFormat?.value || "excel";
  const selectedWorker = ui.checkinDownloadWorker?.value || "";
  const allCheckins = await getAllCheckins();
  
  let filteredCheckins;
  let periodLabel;
  
  if (type === "monthly") {
    const selectedMonth = ui.checkinDownloadMonth?.value || "";
    filteredCheckins = allCheckins.filter((checkin) => {
      const checkInTime = checkin.checkInTime?.toDate?.();
      if (!checkInTime) return false;
      return getMonthKey(checkInTime) === selectedMonth;
    });
    periodLabel = selectedMonth;
  } else {
    const selectedYear = ui.checkinDownloadYear?.value || "";
    filteredCheckins = allCheckins.filter((checkin) => {
      const checkInTime = checkin.checkInTime?.toDate?.();
      if (!checkInTime) return false;
      return String(checkInTime.getFullYear()) === selectedYear;
    });
    periodLabel = selectedYear;
  }
  
  // Filter by worker if selected
  if (selectedWorker) {
    filteredCheckins = filteredCheckins.filter((c) => 
      c.userId === selectedWorker || c.userEmail === selectedWorker
    );
  }
  
  // Sort by date
  filteredCheckins.sort((a, b) => {
    const aTime = a.checkInTime?.toMillis?.() || 0;
    const bTime = b.checkInTime?.toMillis?.() || 0;
    return aTime - bTime;
  });
  
  // Prepare data
  const checkinRows = [
    ["Trabajador", "Fecha", "Entrada", "Salida", "Duración (horas)", "Duración (minutos)", "Estado"],
  ];
  
  filteredCheckins.forEach((checkin) => {
    const checkInTime = checkin.checkInTime?.toDate?.();
    const checkOutTime = checkin.checkOutTime?.toDate?.();
    const displayName = checkin.userName || checkin.userEmail || checkin.userId || "Desconocido";
    const status = checkin.status === "open" ? "Abierto" : "Cerrado";
    
    const dateStr = checkInTime ? checkInTime.toLocaleDateString("es-ES") : "";
    const inTimeStr = checkInTime ? checkInTime.toLocaleTimeString("es-ES") : "";
    const outTimeStr = checkOutTime ? checkOutTime.toLocaleTimeString("es-ES") : "";
    
    let durationHours = "";
    let durationMinutes = "";
    if (checkInTime && checkOutTime) {
      const durationMs = checkOutTime.getTime() - checkInTime.getTime();
      const totalMinutes = Math.floor(durationMs / 60000);
      durationHours = (totalMinutes / 60).toFixed(2);
      durationMinutes = String(totalMinutes);
    }
    
    checkinRows.push([displayName, dateStr, inTimeStr, outTimeStr, durationHours, durationMinutes, status]);
  });
  
  // Worker summary
  const workerStats = new Map();
  filteredCheckins.forEach((checkin) => {
    const displayName = checkin.userName || checkin.userEmail || checkin.userId || "Desconocido";
    const checkInTime = checkin.checkInTime?.toDate?.();
    const checkOutTime = checkin.checkOutTime?.toDate?.();
    
    if (!workerStats.has(displayName)) {
      workerStats.set(displayName, { count: 0, totalDuration: 0, days: new Set() });
    }
    
    const stats = workerStats.get(displayName);
    stats.count += 1;
    
    if (checkInTime && checkOutTime) {
      const duration = checkOutTime.getTime() - checkInTime.getTime();
      stats.totalDuration += duration;
      stats.days.add(checkInTime.toDateString());
    }
  });
  
  const summaryRows = [
    ["Trabajador", "Fichajes", "Horas totales", "Media por día"],
  ];
  
  workerStats.forEach((stats, name) => {
    const totalHours = (stats.totalDuration / 3600000).toFixed(2);
    const avgHours = stats.days.size > 0 
      ? (stats.totalDuration / stats.days.size / 3600000).toFixed(2)
      : "0.00";
    summaryRows.push([name, stats.count, totalHours, avgHours]);
  });
  
  const workerSuffix = selectedWorker ? `-${selectedWorker.substring(0, 8)}` : "";
  
  // Export based on format
  if (format === "csv") {
    // CSV export
    const csvContent = checkinRows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fichajes-${periodLabel}${workerSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } else if (format === "pdf") {
    // PDF export using jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text("Informe de Fichajes", 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${periodLabel}`, 14, 28);
    if (selectedWorker) {
      const workerName = filteredCheckins[0]?.userName || filteredCheckins[0]?.userEmail || selectedWorker;
      doc.text(`Trabajador: ${workerName}`, 14, 34);
    }
    
    // Summary table
    let yPos = selectedWorker ? 44 : 38;
    doc.setFontSize(12);
    doc.text("Resumen", 14, yPos);
    yPos += 6;
    
    doc.setFontSize(9);
    summaryRows.forEach((row, idx) => {
      if (idx === 0) {
        doc.setFont(undefined, "bold");
      } else {
        doc.setFont(undefined, "normal");
      }
      const text = row.join(" | ");
      doc.text(text, 14, yPos);
      yPos += 5;
    });
    
    // Detailed table
    yPos += 8;
    doc.setFontSize(12);
    doc.text("Detalle de fichajes", 14, yPos);
    yPos += 6;
    
    doc.setFontSize(8);
    checkinRows.forEach((row, idx) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      if (idx === 0) {
        doc.setFont(undefined, "bold");
      } else {
        doc.setFont(undefined, "normal");
      }
      const text = `${row[0]} | ${row[1]} | ${row[2]} - ${row[3]} | ${row[4]}h | ${row[6]}`;
      doc.text(text, 14, yPos);
      yPos += 4;
    });
    
    doc.save(`fichajes-${periodLabel}${workerSuffix}.pdf`);
  } else {
    // Excel export (default)
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.aoa_to_sheet(checkinRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Fichajes");
    
    const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen por trabajador");
    
    XLSX.writeFile(wb, `fichajes-${periodLabel}${workerSuffix}.xlsx`);
  }
  
  ui.checkinDownloadModal?.classList.add("hidden");
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
  const basePrice = plan.priceTotal;
  const discountReason = ui.athleteDiscountReason.value;
  let discount = parseFloat(ui.athleteDiscount.value) || 0;
  // Apply predefined discounts
  if (discountReason === 'Familiar') discount = 15;
  else if (discountReason === 'Funcionario') discount = 10;
  else if (discountReason === 'Mañanas') discount = 10;
  else if (discountReason === 'Ninguno') discount = 0;
  const finalPrice = basePrice * (1 - discount / 100);
  const price = finalPrice; // Use final price with discount applied
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
        basePrice,
        discount,
        discountReason,
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
  ui.athleteDiscount.value = 0;
  ui.athleteDiscountReason.value = "Ninguno";
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

on(ui.athleteDiscountReason, "change", () => {
  const reason = ui.athleteDiscountReason.value;
  let discountValue = 0;
  if (reason === 'Familiar') discountValue = 15;
  else if (reason === 'Funcionario') discountValue = 10;
  else if (reason === 'Mañanas') discountValue = 10;
  ui.athleteDiscount.value = discountValue;
  calculateAthleteFinalPrice();
});

on(ui.athleteDiscount, "input", () => {
  calculateAthleteFinalPrice();
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
  const basePrice = plan.priceTotal;
  const discountReason = ui.acroDiscountReason.value;
  let discount = parseFloat(ui.acroDiscount.value) || 0;
  // Apply predefined discounts
  if (discountReason === 'Familiar') discount = 15;
  else if (discountReason === 'Funcionario') discount = 10;
  else if (discountReason === 'Mañanas') discount = 10;
  else if (discountReason === 'Ninguno') discount = 0;
  const finalPrice = basePrice * (1 - discount / 100);
  const price = finalPrice; // Use final price with discount applied
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
        basePrice,
        discount,
        discountReason,
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
  ui.acroDiscount.value = 0;
  ui.acroDiscountReason.value = "Ninguno";
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

on(ui.acroDiscountReason, "change", () => {
  const reason = ui.acroDiscountReason.value;
  let discountValue = 0;
  if (reason === 'Familiar') discountValue = 15;
  else if (reason === 'Funcionario') discountValue = 10;
  else if (reason === 'Mañanas') discountValue = 10;
  ui.acroDiscount.value = discountValue;
  calculateAcroFinalPrice();
});

on(ui.acroDiscount, "input", () => {
  calculateAcroFinalPrice();
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

// ========== HALTEROFILIA EVENT LISTENERS ==========

on(ui.halteForm, "submit", async (event) => {
  event.preventDefault();
  const rawName = ui.halteName.value.trim();
  if (!rawName) return;
  
  const athletes = await getHalteAthletes();
  const existing = athletes.find(
    (athlete) => athlete.name?.toLowerCase() === rawName.toLowerCase()
  );
  const athleteId = existing
    ? existing.id
    : await createHalteAthlete(rawName, currentUser?.uid);
  const athleteName = existing?.name || rawName;
  const tariff = ui.halteTariff.value;
  const plan = halteTariffPlanMap.get(tariff) || halteTariffPlanMap.get("Pequeña");
  const basePrice = plan.priceTotal;
  const discountReason = ui.halteDiscountReason.value;
  let discount = parseFloat(ui.halteDiscount.value) || 0;
  const finalPrice = parseFloat(ui.halteFinalPrice.value) || basePrice;
  const paid = ui.haltePaid.value;
  const monthKey = ui.haltePaymentMonth.value || selectedHaltePaymentMonth || getMonthKey(new Date());

  if (athleteId) {
    await upsertHalteAthleteMonth(
      athleteId,
      monthKey,
      {
        name: athleteName,
        tariff,
        price: basePrice,
        discount,
        discountReason,
        finalPrice,
        paid,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      currentUser?.uid
    );
  }
  
  ui.halteForm.reset();
  ui.halteDiscount.value = 0;
  ui.halteDiscountReason.value = "Ninguno";
  setHaltePriceFromTariff();
  renderHaltePaymentMonthOptions();
  if (ui.halteModal) {
    ui.halteModal.classList.add("hidden");
  }
  await refreshHalteMonthly();
});

on(ui.halteTariff, "change", () => {
  setHaltePriceFromTariff();
});

on(ui.halteDiscountReason, "change", () => {
  const reason = ui.halteDiscountReason.value;
  let discountValue = 0;
  if (reason === 'Familiar') discountValue = 15;
  else if (reason === 'Funcionario') discountValue = 10;
  else if (reason === 'Mañanas') discountValue = 10;
  ui.halteDiscount.value = discountValue;
  calculateHalteFinalPrice();
});

on(ui.halteDiscount, "input", () => {
  calculateHalteFinalPrice();
});

on(ui.halteModalOpen, "click", () => {
  ui.halteModal?.classList.remove("hidden");
});

on(ui.halteModalClose, "click", () => {
  ui.halteModal?.classList.add("hidden");
});

on(ui.halteCsvOpen, "click", () => {
  renderHalteCsvMonthOptions();
  ui.halteCsvModal?.classList.remove("hidden");
});

on(ui.halteCsvClose, "click", () => {
  ui.halteCsvModal?.classList.add("hidden");
});

on(ui.halteCsvMonth, "change", (event) => {
  selectedHalteCsvMonth = event.target.value;
});

on(ui.halteCsvForm, "submit", async (event) => {
  event.preventDefault();
  if (!ui.halteCsvFile?.files?.length) return;
  ui.halteCsvStatus.textContent = "Importando...";
  const monthKey = ui.halteCsvMonth?.value || selectedHalteCsvMonth || getMonthKey(new Date());
  try {
    const processed = await importHalteAthletesFromCsv(ui.halteCsvFile.files[0], monthKey);
    ui.halteCsvStatus.textContent = `Importados ${processed} atletas.`;
    ui.halteCsvForm.reset();
    renderHalteCsvMonthOptions();
    ui.halteCsvModal?.classList.add("hidden");
    await refreshHalteMonthly();
  } catch (error) {
    ui.halteCsvStatus.textContent = `Error: ${error.message || error}`;
  }
});

// ========== TELAS EVENT LISTENERS ==========

on(ui.telasForm, "submit", async (event) => {
  event.preventDefault();
  const rawName = ui.telasName.value.trim();
  if (!rawName) return;
  
  const athletes = await getTelasAthletes();
  const existing = athletes.find(
    (athlete) => athlete.name?.toLowerCase() === rawName.toLowerCase()
  );
  const athleteId = existing
    ? existing.id
    : await createTelasAthlete(rawName, currentUser?.uid);
  const athleteName = existing?.name || rawName;
  const tariff = ui.telasTariff.value;
  const plan = telasTariffPlanMap.get(tariff) || telasTariffPlanMap.get("4/mes");
  const basePrice = plan.priceTotal;
  const discountReason = ui.telasDiscountReason.value;
  let discount = parseFloat(ui.telasDiscount.value) || 0;
  const finalPrice = parseFloat(ui.telasFinalPrice.value) || basePrice;
  const paid = ui.telasPaid.value === "SI";
  const monthKey = ui.telasPaymentMonth.value || selectedTelasPaymentMonth || getMonthKey(new Date());

  if (athleteId) {
    await upsertTelasAthleteMonth(
      athleteId,
      monthKey,
      {
        name: athleteName,
        tariff,
        price: basePrice,
        discount,
        discountReason,
        finalPrice,
        paid,
        durationMonths: 1,
        priceMonthly: basePrice,
        isPaymentMonth: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      currentUser?.uid
    );
  }
  
  ui.telasForm.reset();
  ui.telasDiscount.value = 0;
  ui.telasDiscountReason.value = "";
  setTelasPriceFromTariff();
  renderTelasPaymentMonthOptions();
  if (ui.telasModal) {
    ui.telasModal.classList.add("hidden");
  }
  await refreshTelasMonthly();
});

on(ui.telasTariff, "change", () => {
  setTelasPriceFromTariff();
});

on(ui.telasDiscountReason, "change", () => {
  const reason = ui.telasDiscountReason.value;
  let discountValue = 0;
  if (reason === 'Familiar') discountValue = 15;
  else if (reason === 'Funcionario') discountValue = 10;
  else if (reason === 'Mañanas') discountValue = 10;
  ui.telasDiscount.value = discountValue;
  calculateTelasFinalPrice();
});

on(ui.telasDiscount, "input", () => {
  calculateTelasFinalPrice();
});

on(ui.telasModalOpen, "click", () => {
  ui.telasModal?.classList.remove("hidden");
});

on(ui.telasModalClose, "click", () => {
  ui.telasModal?.classList.add("hidden");
});

on(ui.telasCsvOpen, "click", () => {
  renderTelasCsvMonthOptions();
  ui.telasCsvModal?.classList.remove("hidden");
});

on(ui.telasCsvClose, "click", () => {
  ui.telasCsvModal?.classList.add("hidden");
});

on(ui.telasCsvMonth, "change", (event) => {
  selectedTelasCsvMonth = event.target.value;
});

on(ui.telasCsvForm, "submit", async (event) => {
  event.preventDefault();
  if (!ui.telasCsvFile?.files?.length) return;
  ui.telasCsvStatus.textContent = "Importando...";
  const monthKey = ui.telasCsvMonth?.value || selectedTelasCsvMonth || getMonthKey(new Date());
  try {
    const result = await importTelasAthletesFromCsv(ui.telasCsvFile.files[0], monthKey);
    ui.telasCsvStatus.textContent = `Importados ${result.success} atletas. Errores: ${result.errors}`;
    ui.telasCsvForm.reset();
    renderTelasCsvMonthOptions();
    ui.telasCsvModal?.classList.add("hidden");
    await refreshTelasMonthly();
  } catch (error) {
    ui.telasCsvStatus.textContent = `Error: ${error.message || error}`;
  }
});

// ========== SINGLE CLASSES EVENT LISTENERS ==========

on(ui.singleClassesForm, "submit", async (event) => {
  event.preventDefault();
  const rawName = ui.singleClassesName.value.trim();
  if (!rawName) return;
  
  const athletes = await getSingleClassesAthletes();
  const existing = athletes.find(
    (athlete) => athlete.name?.toLowerCase() === rawName.toLowerCase()
  );
  const athleteId = existing
    ? existing.id
    : await createSingleClassesAthlete(rawName, currentUser?.uid);
  const athleteName = existing?.name || rawName;
  const tariff = ui.singleClassesTariff.value;
  const plan = singleClassesTariffPlanMap.get(tariff) || singleClassesTariffPlanMap.get("Clase Crossfit");
  const basePrice = plan.priceTotal;
  const discountReason = ui.singleClassesDiscountReason.value;
  let discount = parseFloat(ui.singleClassesDiscount.value) || 0;
  const finalPrice = parseFloat(ui.singleClassesFinalPrice.value) || basePrice;
  const paid = ui.singleClassesPaid.value === "SI";
  const monthKey = ui.singleClassesPaymentMonth.value || selectedSingleClassesPaymentMonth || getMonthKey(new Date());

  if (athleteId) {
    await upsertSingleClassesAthleteMonth(
      athleteId,
      monthKey,
      {
        name: athleteName,
        tariff,
        price: basePrice,
        discount,
        discountReason,
        finalPrice,
        paid,
        durationMonths: 1,
        priceMonthly: basePrice,
        isPaymentMonth: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      currentUser?.uid
    );
  }
  
  ui.singleClassesForm.reset();
  ui.singleClassesDiscount.value = 0;
  ui.singleClassesDiscountReason.value = "";
  setSingleClassesPriceFromTariff();
  renderSingleClassesPaymentMonthOptions();
  if (ui.singleClassesModal) {
    ui.singleClassesModal.classList.add("hidden");
  }
  await refreshSingleClassesMonthly();
});

on(ui.singleClassesTariff, "change", () => {
  setSingleClassesPriceFromTariff();
});

on(ui.singleClassesDiscountReason, "change", () => {
  const reason = ui.singleClassesDiscountReason.value;
  let discountValue = 0;
  if (reason === 'Familiar') discountValue = 15;
  else if (reason === 'Funcionario') discountValue = 10;
  else if (reason === 'Mañanas') discountValue = 10;
  ui.singleClassesDiscount.value = discountValue;
  calculateSingleClassesFinalPrice();
});

on(ui.singleClassesDiscount, "input", () => {
  calculateSingleClassesFinalPrice();
});

on(ui.singleClassesModalOpen, "click", () => {
  renderSingleClassesPaymentMonthOptions();
  setSingleClassesPriceFromTariff();
  ui.singleClassesModal?.classList.remove("hidden");
});

on(ui.singleClassesModalClose, "click", () => {
  ui.singleClassesModal?.classList.add("hidden");
});

on(ui.singleClassesCsvOpen, "click", () => {
  renderSingleClassesCsvMonthOptions();
  ui.singleClassesCsvModal?.classList.remove("hidden");
});

on(ui.singleClassesCsvClose, "click", () => {
  ui.singleClassesCsvModal?.classList.add("hidden");
});

on(ui.singleClassesCsvMonth, "change", (event) => {
  selectedSingleClassesCsvMonth = event.target.value;
});

on(ui.singleClassesCsvForm, "submit", async (event) => {
  event.preventDefault();
  if (!ui.singleClassesCsvFile?.files?.length) return;
  ui.singleClassesCsvStatus.textContent = "Importando...";
  const monthKey = ui.singleClassesCsvMonth?.value || selectedSingleClassesCsvMonth || getMonthKey(new Date());
  try {
    const result = await importSingleClassesAthletesFromCsv(ui.singleClassesCsvFile.files[0], monthKey);
    ui.singleClassesCsvStatus.textContent = `Importados ${result.success} atletas. Errores: ${result.errors}`;
    ui.singleClassesCsvForm.reset();
    renderSingleClassesCsvMonthOptions();
    ui.singleClassesCsvModal?.classList.add("hidden");
    await refreshSingleClassesMonthly();
  } catch (error) {
    ui.singleClassesCsvStatus.textContent = `Error: ${error.message || error}`;
  }
});

// ========== MONTH FILTER EVENT LISTENERS ==========

// Athletes - Month filters
on(ui.athleteMonthSelect, "change", async (event) => {
  selectedAthleteMonth = event.target.value;
  await refreshAthleteMonthly();
});

on(ui.athleteListMonthSelect, "change", async (event) => {
  selectedAthleteListMonth = event.target.value;
  await refreshAthleteMonthly();
});

// Athletes - Search and paid filter
on(ui.athleteSearch, "input", async (event) => {
  athleteSearchTerm = event.target.value;
  await refreshAthleteMonthly();
});

on(ui.athletePaidFilter, "change", async (event) => {
  athletePaidFilter = event.target.value;
  await refreshAthleteMonthly();
});

// Acrobacias - Month filters  
on(ui.acroMonthSelect, "change", async (event) => {
  selectedAcroMonth = event.target.value;
  await refreshAcroMonthly();
});

on(ui.acroListMonthSelect, "change", async (event) => {
  selectedAcroListMonth = event.target.value;
  await refreshAcroMonthly();
});

// Acrobacias - Search and paid filter
on(ui.acroSearch, "input", async (event) => {
  acroSearchTerm = event.target.value;
  await refreshAcroMonthly();
});

on(ui.acroPaidFilter, "change", async (event) => {
  acroPaidFilter = event.target.value;
  await refreshAcroMonthly();
});

// Halterofilia - Month filters  
on(ui.halteMonthSelect, "change", async (event) => {
  selectedHalteMonth = event.target.value;
  await refreshHalteMonthly();
});

on(ui.halteListMonthSelect, "change", async (event) => {
  selectedHalteListMonth = event.target.value;
  await refreshHalteMonthly();
});

// Halterofilia - Search and paid filter
on(ui.halteSearch, "input", async (event) => {
  halteSearchTerm = event.target.value;
  await refreshHalteMonthly();
});

on(ui.haltePaidFilter, "change", async (event) => {
  haltePaidFilter = event.target.value;
  await refreshHalteMonthly();
});

// Telas - Month filters  
on(ui.telasMonthSelect, "change", async (event) => {
  selectedTelasMonth = event.target.value;
  await refreshTelasMonthly();
});

on(ui.telasListMonthSelect, "change", async (event) => {
  selectedTelasListMonth = event.target.value;
  await refreshTelasMonthly();
});

// Telas - Search and paid filter
on(ui.telasSearch, "input", async (event) => {
  telasSearchTerm = event.target.value;
  await refreshTelasMonthly();
});

on(ui.telasPaidFilter, "change", async (event) => {
  telasPaidFilter = event.target.value;
  await refreshTelasMonthly();
});

// Single Classes - Month filters  
on(ui.singleClassesMonthSelect, "change", async (event) => {
  selectedSingleClassesMonth = event.target.value;
  await refreshSingleClassesMonthly();
});

on(ui.singleClassesListMonthSelect, "change", async (event) => {
  selectedSingleClassesListMonth = event.target.value;
  await refreshSingleClassesMonthly();
});

// Single Classes - Search and paid filter
on(ui.singleClassesSearch, "input", async (event) => {
  singleClassesSearchTerm = event.target.value;
  await refreshSingleClassesMonthly();
});

on(ui.singleClassesPaidFilter, "change", async (event) => {
  singleClassesPaidFilter = event.target.value;
  await refreshSingleClassesMonthly();
});

// Payment and expense month filters
on(ui.paymentMonthSelect, "change", async (event) => {
  selectedPaymentMonth = event.target.value;
  await refreshPaymentList();
});

on(ui.expenseMonthSelect, "change", async (event) => {
  selectedExpenseMonth = event.target.value;
  await refreshExpenseList();
});

on(ui.downloadPaymentTemplate, "click", () => {
  downloadCsvTemplate('plantilla_ingresos.csv', 'payment');
});

on(ui.downloadExpenseTemplate, "click", () => {
  downloadCsvTemplate('plantilla_gastos.csv', 'expense');
});

on(ui.downloadAthleteTemplate, "click", () => {
  downloadAthleteTemplate();
});

on(ui.downloadAcroTemplate, "click", () => {
  downloadAcroTemplate();
});

on(ui.downloadHalteTemplate, "click", () => {
  downloadHalteTemplate();
});

on(ui.downloadTelasTemplate, "click", () => {
  downloadTelasTemplate();
});

// ========== CLASES Y TURNOS ==========

// Estado de clases
let currentWeekStart = null;
let currentWeekEnd = null;
let selectedWeekOffset = 0;
let classesData = [];
let teachersData = [];
let assignmentsData = [];
let teacherSearchTerm = "";
let teacherStatusFilter = "ALL";

// Estado para asignación masiva
let selectedClasses = new Set();
let selectedBulkTeacher = null;
let bulkCurrentWeekStart = null;
let bulkCurrentWeekEnd = null;

// Utilidades de fechas para clases
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes como primer día
  return new Date(d.setDate(diff));
}

function getWeekEnd(date) {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateForDisplay(date) {
  // Formato compacto para el select: "6 abr"
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short'
  }).format(date);
}

function formatDateForDisplayLong(date) {
  // Formato largo si se necesita
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(date);
}

function getWeekDates(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }
  return dates;
}

// Renderizado de opciones de semana
function renderWeekOptions() {
  if (!ui.weekSelect) {
    console.warn('weekSelect element not found');
    return;
  }
  
  console.log('renderWeekOptions called. weekSelect exists:', !!ui.weekSelect);
  
  const today = new Date();
  const options = [];
  
  // Generar opciones de semana centradas en el offset actual
  // Esto asegura que siempre haya opciones válidas
  const minOffset = selectedWeekOffset - 4;
  const maxOffset = selectedWeekOffset + 8;
  
  for (let offset = minOffset; offset <= maxOffset; offset++) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() + (offset * 7));
    const weekStart = getWeekStart(weekDate);
    const weekEnd = getWeekEnd(weekDate);
    
    // Formato compacto: "6 abr - 12 abr"
    const startStr = formatDateForDisplay(weekStart);
    const endStr = formatDateForDisplay(weekEnd);
    const label = `${startStr} - ${endStr}`;
    options.push({ offset, label, weekStart, weekEnd });
  }
  
  console.log(`Generated ${options.length} week options. First option:`, options[0]?.label);
  
  ui.weekSelect.innerHTML = "";
  options.forEach(option => {
    const optionElement = document.createElement("option");
    optionElement.value = option.offset;
    optionElement.textContent = option.label;
    if (option.offset === selectedWeekOffset) {
      optionElement.selected = true;
    }
    ui.weekSelect.appendChild(optionElement);
  });
  
  console.log('Options added to select. Select has', ui.weekSelect.options.length, 'options');
  console.log('Selected option index:', ui.weekSelect.selectedIndex);
  if (ui.weekSelect.selectedIndex >= 0) {
    console.log('Selected option text:', ui.weekSelect.options[ui.weekSelect.selectedIndex].text);
  }
  
  // Establecer fechas basadas en el offset seleccionado
  const selectedOption = options.find(opt => opt.offset === selectedWeekOffset);
  if (selectedOption) {
    currentWeekStart = selectedOption.weekStart;
    currentWeekEnd = selectedOption.weekEnd;
  } else {
    // Fallback: calcular fechas basadas en el offset
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() + (selectedWeekOffset * 7));
    currentWeekStart = getWeekStart(weekDate);
    currentWeekEnd = getWeekEnd(weekDate);
  }
  
  console.log('Week options rendered. Offset:', selectedWeekOffset, 'Week:', currentWeekStart, 'to', currentWeekEnd);
}

// Cargar datos de clases
async function loadClassesData() {
  try {
    // Asegurarse de que las fechas estén inicializadas
    if (!currentWeekStart || !currentWeekEnd) {
      const today = new Date();
      currentWeekStart = getWeekStart(today);
      currentWeekEnd = getWeekEnd(today);
      console.log('Initialized week dates in loadClassesData');
    }
    
    [classesData, teachersData, assignmentsData] = await Promise.all([
      getClasses(),
      getTeachers(),
      getClassAssignments(formatDate(currentWeekStart), formatDate(currentWeekEnd))
    ]);
    
    console.log('Classes data loaded:', { 
      classes: classesData.length, 
      teachers: teachersData.length, 
      assignments: assignmentsData.length 
    });
  } catch (error) {
    console.error("Error loading classes data:", error);
  }
}

// Cargar asignaciones para la semana específica de la modal
async function loadAssignmentsForBulkWeek() {
  try {
    assignmentsData = await getClassAssignments(formatDate(bulkCurrentWeekStart), formatDate(bulkCurrentWeekEnd));
  } catch (error) {
    console.error("Error loading assignments for bulk week:", error);
  }
}

// Función para normalizar nombres de clases para data-attributes
function normalizeClassType(className) {
  if (!className) return '';
  return className.toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ñ/g, 'n')
    .trim();
}

// Renderizar tabla de horarios
function renderScheduleTable() {
  if (!ui.scheduleTableBody) {
    console.warn('scheduleTableBody element not found');
    return;
  }
  
  console.log('Rendering schedule table. Classes:', classesData.length, 'Teachers:', teachersData.length, 'Assignments:', assignmentsData.length);
  
  // Horarios típicos del gimnasio
  const timeSlots = [
    "07:00h", "08:00h", "09:00h", "10:00h", "11:00h", "12:00h", 
    "14:30h", "15:30h", "17:00h", "18:00h", "19:00h", "20:00h", "21:00h"
  ];
  
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const weekDates = getWeekDates(currentWeekStart);
  
  ui.scheduleTableBody.innerHTML = "";
  
  timeSlots.forEach(timeSlot => {
    const row = document.createElement("tr");
    
    // Columna de hora
    const timeCell = document.createElement("td");
    timeCell.textContent = timeSlot;
    timeCell.className = "time-header";
    row.appendChild(timeCell);
    
    // Columnas de días
    days.forEach((day, dayIndex) => {
      const dayCell = document.createElement("td");
      dayCell.className = "day-cell";
      
      // Buscar clases para este día y hora
      const dayClasses = classesData.filter(cls => 
        cls.day === day && cls.time === timeSlot
      );
      
      if (dayClasses.length === 0) {
        dayCell.innerHTML = '<div class="no-class">-</div>';
      } else {
        // Crear un contenedor para múltiples clases
        const classesContainer = document.createElement("div");
        classesContainer.className = "classes-container";
        
        dayClasses.forEach((cls, index) => {
          const classSlot = document.createElement("div");
          classSlot.className = "class-slot";
          classSlot.dataset.classId = cls.id;
          classSlot.dataset.day = day;
          classSlot.dataset.time = timeSlot;
          classSlot.dataset.date = formatDate(weekDates[dayIndex]);
          classSlot.dataset.classType = normalizeClassType(cls.name);
          
          // Buscar asignación de profesor para esta clase
          const dateForSearch = formatDate(weekDates[dayIndex]);
          const assignment = assignmentsData.find(assign => 
            assign.classId === cls.id && 
            assign.date === dateForSearch && 
            assign.time === timeSlot
          );
          
          const teacher = assignment ? teachersData.find(t => t.id === assignment.teacherId) : null;
          
          if (teacher) {
            classSlot.classList.add("assigned");
          }
          
          classSlot.innerHTML = `
            <div class="class-info">
              <div class="class-name">${cls.name}</div>
              <div class="teacher-info">
                <span class="teacher-name">${teacher ? teacher.name : 'Sin asignar'}</span>
              </div>
            </div>
          `;
          
          classSlot.addEventListener('click', () => openAssignmentModal(cls, day, timeSlot, formatDate(weekDates[dayIndex]), assignment));
          
          classesContainer.appendChild(classSlot);
        });
        
        dayCell.appendChild(classesContainer);
      }
      
      row.appendChild(dayCell);
    });
    
    ui.scheduleTableBody.appendChild(row);
  });
  
  console.log('Schedule table rendered with', timeSlots.length, 'time slots');
}

// Abrir modal de asignación
function openAssignmentModal(classData, day, time, date, existingAssignment = null) {
  if (!ui.classAssignmentModal) return;
  
  // Llenar información de la clase
  ui.classDay.textContent = day;
  ui.classTime.textContent = time;
  ui.classType.textContent = classData.name;
  
  // Llenar select de profesores
  ui.assignedTeacher.innerHTML = '<option value="">Sin asignar</option>';
  teachersData
    .filter(teacher => teacher.status === 'ACTIVE')
    .forEach(teacher => {
      const option = document.createElement("option");
      option.value = teacher.id;
      option.textContent = teacher.name;
      if (existingAssignment && existingAssignment.teacherId === teacher.id) {
        option.selected = true;
      }
      ui.assignedTeacher.appendChild(option);
    });
  
  // Llenar datos del formulario
  ui.assignmentClassId.value = classData.id;
  ui.assignmentDay.value = day;
  ui.assignmentTime.value = time;
  ui.assignmentNotes.value = existingAssignment?.notes || "";
  
  ui.classAssignmentModal.classList.remove("hidden");
}

// Renderizar lista de profesores
function renderTeachersList() {
  if (!ui.teacherList) return;
  
  const filteredTeachers = teachersData.filter(teacher => {
    const matchesSearch = !teacherSearchTerm || 
      teacher.name?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(teacherSearchTerm.toLowerCase());
    
    const matchesStatus = teacherStatusFilter === "ALL" || teacher.status === teacherStatusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  ui.teacherList.innerHTML = "";
  
  filteredTeachers.forEach(teacher => {
    const row = document.createElement("tr");
    
    const specialties = Array.isArray(teacher.specialties) ? teacher.specialties : [];
    const specialtiesHtml = specialties.map(spec => 
      `<span class="specialty-badge">${spec}</span>`
    ).join('');
    
    row.innerHTML = `
      <td>${teacher.name || '-'}</td>
      <td>${teacher.email || '-'}</td>
      <td>${teacher.phone || '-'}</td>
      <td>
        <div class="teacher-specialties">${specialtiesHtml}</div>
      </td>
      <td>
        <span class="teacher-status ${teacher.status?.toLowerCase() || 'inactive'}">
          ${teacher.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <button class="btn small secondary" onclick="editTeacher('${teacher.id}')">Editar</button>
        <button class="btn small danger" onclick="deleteTeacherConfirm('${teacher.id}')">Eliminar</button>
      </td>
    `;
    
    ui.teacherList.appendChild(row);
  });
}

// ========== ASIGNACIÓN MASIVA ==========

// Renderizar calendario para asignación masiva
function renderBulkScheduleTable() {
  if (!ui.bulkScheduleTableBody) return;
  
  const timeSlots = [
    "07:00h", "08:00h", "09:00h", "10:00h", "11:00h", "12:00h", 
    "14:30h", "15:30h", "17:00h", "18:00h", "19:00h", "20:00h", "21:00h"
  ];
  
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const weekDates = getWeekDates(bulkCurrentWeekStart);
  
  ui.bulkScheduleTableBody.innerHTML = "";
  
  timeSlots.forEach(timeSlot => {
    const row = document.createElement("tr");
    
    // Columna de hora
    const timeCell = document.createElement("td");
    timeCell.textContent = timeSlot;
    timeCell.className = "time-header";
    row.appendChild(timeCell);
    
    // Columnas de días
    days.forEach((day, dayIndex) => {
      const dayCell = document.createElement("td");
      dayCell.className = "day-cell";
      
      // Buscar clases para este día y hora
      const dayClasses = classesData.filter(cls => 
        cls.day === day && cls.time === timeSlot
      );
      
      if (dayClasses.length === 0) {
        dayCell.innerHTML = '<div class="no-class">-</div>';
      } else {
        const classesContainer = document.createElement("div");
        classesContainer.className = "classes-container";
        
        dayClasses.forEach(cls => {
          const classSlot = document.createElement("div");
          classSlot.className = "class-slot";
          classSlot.dataset.classId = cls.id;
          classSlot.dataset.day = day;
          classSlot.dataset.time = timeSlot;
          classSlot.dataset.date = formatDate(weekDates[dayIndex]);
          classSlot.dataset.classType = normalizeClassType(cls.name);
          
          // Verificar si ya está asignada
          const assignment = assignmentsData.find(assign => 
            assign.classId === cls.id && 
            assign.date === formatDate(weekDates[dayIndex]) && 
            assign.time === timeSlot
          );
          
          const teacher = assignment ? teachersData.find(t => t.id === assignment.teacherId) : null;
          
          if (teacher) {
            classSlot.classList.add("assigned");
          }
          
          // Verificar si está seleccionada
          const classKey = `${cls.id}|${formatDate(weekDates[dayIndex])}|${timeSlot}`;
          if (selectedClasses.has(classKey)) {
            classSlot.classList.add("selected");
          }
          
          classSlot.innerHTML = `
            <div class="class-info">
              <div class="class-name">${cls.name}</div>
              <div class="teacher-info">
                <span class="teacher-name">${teacher ? teacher.name : 'Sin asignar'}</span>
              </div>
            </div>
          `;
          
          // Event listener para selección
          classSlot.addEventListener('click', () => toggleClassSelection(cls, day, timeSlot, formatDate(weekDates[dayIndex]), classSlot));
          
          classesContainer.appendChild(classSlot);
        });
        
        dayCell.appendChild(classesContainer);
      }
      
      row.appendChild(dayCell);
    });
    
    ui.bulkScheduleTableBody.appendChild(row);
  });
}

// Actualizar display de semana en modal de asignación masiva
function updateBulkWeekDisplay() {
  if (!ui.bulkCurrentWeekDisplay || !bulkCurrentWeekStart) return;
  
  const weekEnd = new Date(bulkCurrentWeekStart);
  weekEnd.setDate(bulkCurrentWeekStart.getDate() + 6);
  
  const startStr = formatDateForDisplay(bulkCurrentWeekStart);
  const endStr = formatDateForDisplay(weekEnd);
  
  ui.bulkCurrentWeekDisplay.textContent = `Semana del ${startStr} - ${endStr}`;
}

// Toggle selección de clase
function toggleClassSelection(classData, day, time, date, element) {
  const classKey = `${classData.id}|${date}|${time}`;
  
  if (selectedClasses.has(classKey)) {
    selectedClasses.delete(classKey);
    element.classList.remove("selected");
  } else {
    selectedClasses.add(classKey);
    element.classList.add("selected");
  }
  
  updateSelectionSummary();
}

// Actualizar resumen de selección
function updateSelectionSummary() {
  const count = selectedClasses.size;
  
  // Actualizar contador
  ui.selectedClassesCount.textContent = count;
  ui.assignCountText.textContent = count;
  
  // Habilitar/deshabilitar botón
  ui.bulkAssignExecute.disabled = count === 0 || !selectedBulkTeacher;
  
  // Actualizar lista de clases seleccionadas
  ui.selectedClassesList.innerHTML = "";
  
  selectedClasses.forEach(classKey => {
    const [classId, date, time] = classKey.split('-');
    const classData = classesData.find(c => c.id === classId);
    
    if (classData) {
      const item = document.createElement("div");
      item.className = "selected-class-item";
      item.innerHTML = `
        ${classData.name} - ${classData.day} ${time}
        <button class="remove-btn" onclick="removeClassSelection('${classKey}')">×</button>
      `;
      ui.selectedClassesList.appendChild(item);
    }
  });
}

// Quitar selección de clase individual
window.removeClassSelection = function(classKey) {
  selectedClasses.delete(classKey);
  renderBulkScheduleTable();
  updateSelectionSummary();
};

// Limpiar toda la selección
function clearAllSelection() {
  selectedClasses.clear();
  renderBulkScheduleTable();
  updateSelectionSummary();
}

// Renderizar opciones de profesores para asignación masiva
function renderBulkTeacherOptions() {
  if (!ui.bulkTeacherSelect) return;
  
  ui.bulkTeacherSelect.innerHTML = '<option value="">Seleccionar profesor...</option>';
  
  teachersData
    .filter(teacher => teacher.status === 'ACTIVE')
    .forEach(teacher => {
      const option = document.createElement("option");
      option.value = teacher.id;
      option.textContent = teacher.name;
      ui.bulkTeacherSelect.appendChild(option);
    });
}

// Ejecutar asignación masiva
async function executeBulkAssignment() {
  if (!selectedBulkTeacher || selectedClasses.size === 0) return;
  
  console.log('Ejecutando asignación masiva para', selectedClasses.size, 'clases');
  console.log('Profesor seleccionado:', selectedBulkTeacher);
  
  ui.bulkAssignExecute.disabled = true;
  ui.bulkAssignExecute.textContent = "Asignando...";
  
  try {
    const assignments = [];
    
    selectedClasses.forEach(classKey => {
      const [classId, date, time] = classKey.split('|');
      console.log('Asignando clase:', classId, 'el', date, 'a las', time);
      assignments.push(
        upsertClassAssignment(classId, date, time, selectedBulkTeacher, "", currentUser?.uid)
      );
    });
    
    await Promise.all(assignments);
    console.log('Todas las asignaciones completadas');
    
    // Limpiar selección y cerrar modal
    clearAllSelection();
    ui.bulkAssignModal.classList.add("hidden");
    
    // Refrescar vista principal
    console.log('Refrescando vista principal...');
    await refreshClassesView();
    
    alert(`Se asignaron ${assignments.length} clases correctamente.`);
    
  } catch (error) {
    console.error("Error in bulk assignment:", error);
    alert("Error al realizar la asignación masiva");
  } finally {
    ui.bulkAssignExecute.disabled = false;
    ui.bulkAssignExecute.textContent = `🎯 Asignar a 0 clases`;
  }
}

// Funciones de profesores
window.editTeacher = async function(teacherId) {
  const teacher = teachersData.find(t => t.id === teacherId);
  if (!teacher) return;
  
  ui.teacherModalTitle.textContent = "Editar Profesor";
  ui.teacherId.value = teacher.id;
  ui.teacherName.value = teacher.name || "";
  ui.teacherEmail.value = teacher.email || "";
  ui.teacherPhone.value = teacher.phone || "";
  ui.teacherStatus.value = teacher.status || "ACTIVE";
  
  // Seleccionar especialidades
  Array.from(ui.teacherSpecialties.options).forEach(option => {
    option.selected = teacher.specialties?.includes(option.value) || false;
  });
  
  ui.teacherModal.classList.remove("hidden");
};

window.deleteTeacherConfirm = async function(teacherId) {
  const teacher = teachersData.find(t => t.id === teacherId);
  if (!teacher) return;
  
  if (confirm(`¿Estás seguro de que quieres eliminar al profesor "${teacher.name}"?`)) {
    try {
      await deleteTeacher(teacherId);
      await refreshClassesView();
    } catch (error) {
      console.error("Error deleting teacher:", error);
      alert("Error al eliminar el profesor");
    }
  }
};

// Refrescar vista de clases
async function refreshClassesView() {
  console.log('Refreshing classes view...');
  await loadClassesData(); // Esta función ya carga classes, teachers y assignments
  renderScheduleTable();
  renderTeachersList();
  console.log('Classes view refreshed');
}

// Event listeners para clases

on(ui.weekSelect, "change", async (event) => {
  selectedWeekOffset = parseInt(event.target.value);
  console.log('Week select changed to offset:', selectedWeekOffset);
  const today = new Date();
  const weekDate = new Date(today);
  weekDate.setDate(today.getDate() + (selectedWeekOffset * 7));
  currentWeekStart = getWeekStart(weekDate);
  currentWeekEnd = getWeekEnd(weekDate);
  await refreshClassesView();
});

on(ui.prevWeekBtn, "click", async () => {
  selectedWeekOffset--;
  console.log('Previous week clicked. New offset:', selectedWeekOffset);
  renderWeekOptions(); // Regenerar opciones para que incluyan el nuevo offset
  const today = new Date();
  const weekDate = new Date(today);
  weekDate.setDate(today.getDate() + (selectedWeekOffset * 7));
  currentWeekStart = getWeekStart(weekDate);
  currentWeekEnd = getWeekEnd(weekDate);
  await refreshClassesView();
});

on(ui.nextWeekBtn, "click", async () => {
  selectedWeekOffset++;
  console.log('Next week clicked. New offset:', selectedWeekOffset);
  renderWeekOptions(); // Regenerar opciones para que incluyan el nuevo offset
  const today = new Date();
  const weekDate = new Date(today);
  weekDate.setDate(today.getDate() + (selectedWeekOffset * 7));
  currentWeekStart = getWeekStart(weekDate);
  currentWeekEnd = getWeekEnd(weekDate);
  await refreshClassesView();
});

on(ui.currentWeekBtn, "click", async () => {
  selectedWeekOffset = 0;
  console.log('Current week clicked. Offset reset to:', selectedWeekOffset);
  renderWeekOptions(); // Regenerar opciones
  const today = new Date();
  currentWeekStart = getWeekStart(today);
  currentWeekEnd = getWeekEnd(today);
  await refreshClassesView();
});

on(ui.addTeacherBtn, "click", () => {
  ui.teacherModalTitle.textContent = "Añadir Profesor";
  ui.teacherForm.reset();
  ui.teacherId.value = "";
  ui.teacherModal.classList.remove("hidden");
});

on(ui.bulkAssignBtn, "click", async () => {
  console.log('Abriendo modal de asignación masiva');
  
  // Asegurar que los datos estén cargados
  if (!classesData || classesData.length === 0) {
    console.log('Cargando datos de clases...');
    await loadClassesData();
  }
  
  if (!assignmentsData) {
    console.log('Cargando datos de asignaciones...');
    await loadAssignmentsData();
  }
  
  if (!teachersData || teachersData.length === 0) {
    console.log('Cargando datos de profesores...');
    await loadTeachersData();
  }
  
  // Inicializar semana de la modal con la semana actual del vista principal
  bulkCurrentWeekStart = new Date(currentWeekStart);
  bulkCurrentWeekEnd = new Date(currentWeekEnd);
  
  // Limpiar selección anterior
  selectedClasses.clear();
  selectedBulkTeacher = null;
  
  // Renderizar contenido del modal
  renderBulkTeacherOptions();
  updateBulkWeekDisplay();
  renderBulkScheduleTable();
  updateSelectionSummary();
  
  // Resetear UI
  ui.bulkTeacherSelect.value = "";
  ui.selectedTeacherName.textContent = "Ninguno seleccionado";
  
  ui.bulkAssignModal.classList.remove("hidden");
});

// Navegación de semanas en modal de asignación masiva
on(ui.bulkPrevWeekBtn, "click", async () => {
  bulkCurrentWeekStart.setDate(bulkCurrentWeekStart.getDate() - 7);
  bulkCurrentWeekEnd = getWeekEnd(bulkCurrentWeekStart);
  
  // Recargar asignaciones para la nueva semana
  await loadAssignmentsForBulkWeek();
  
  // Limpiar selecciones
  selectedClasses.clear();
  
  updateBulkWeekDisplay();
  renderBulkScheduleTable();
  updateSelectionSummary();
});

on(ui.bulkNextWeekBtn, "click", async () => {
  bulkCurrentWeekStart.setDate(bulkCurrentWeekStart.getDate() + 7);
  bulkCurrentWeekEnd = getWeekEnd(bulkCurrentWeekStart);
  
  // Recargar asignaciones para la nueva semana
  await loadAssignmentsForBulkWeek();
  
  // Limpiar selecciones
  selectedClasses.clear();
  
  updateBulkWeekDisplay();
  renderBulkScheduleTable();
  updateSelectionSummary();
});

on(ui.teacherModalClose, "click", () => {
  ui.teacherModal.classList.add("hidden");
});

on(ui.cancelTeacher, "click", () => {
  ui.teacherModal.classList.add("hidden");
});

on(ui.teacherForm, "submit", async (event) => {
  event.preventDefault();
  
  const teacherData = {
    name: ui.teacherName.value.trim(),
    email: ui.teacherEmail.value.trim(),
    phone: ui.teacherPhone.value.trim(),
    specialties: Array.from(ui.teacherSpecialties.selectedOptions).map(opt => opt.value),
    status: ui.teacherStatus.value,
  };
  
  try {
    const teacherId = ui.teacherId.value;
    if (teacherId) {
      await updateTeacher(teacherId, teacherData, currentUser?.uid);
    } else {
      await createTeacher(teacherData, currentUser?.uid);
    }
    
    ui.teacherModal.classList.add("hidden");
    await refreshClassesView();
  } catch (error) {
    console.error("Error saving teacher:", error);
    alert("Error al guardar el profesor");
  }
});

on(ui.teacherSearch, "input", (event) => {
  teacherSearchTerm = event.target.value;
  renderTeachersList();
});

on(ui.teacherStatusFilter, "change", (event) => {
  teacherStatusFilter = event.target.value;
  renderTeachersList();
});

on(ui.assignmentModalClose, "click", () => {
  ui.classAssignmentModal.classList.add("hidden");
});

on(ui.cancelAssignment, "click", () => {
  ui.classAssignmentModal.classList.add("hidden");
});

on(ui.assignmentForm, "submit", async (event) => {
  event.preventDefault();
  
  const classId = ui.assignmentClassId.value;
  const day = ui.assignmentDay.value;
  const time = ui.assignmentTime.value;
  const teacherId = ui.assignedTeacher.value;
  const notes = ui.assignmentNotes.value.trim();
  
  // Calcular fecha basada en el día de la semana
  const weekDates = getWeekDates(currentWeekStart);
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const dayIndex = days.indexOf(day);
  const date = formatDate(weekDates[dayIndex]);
  
  try {
    if (teacherId) {
      await upsertClassAssignment(classId, date, time, teacherId, notes, currentUser?.uid);
    } else {
      // Eliminar asignación si no hay profesor seleccionado
      const existingAssignment = assignmentsData.find(assign => 
        assign.classId === classId && 
        assign.date === date && 
        assign.time === time
      );
      if (existingAssignment) {
        await deleteClassAssignment(existingAssignment.id);
      }
    }
    
    ui.classAssignmentModal.classList.add("hidden");
    await refreshClassesView();
  } catch (error) {
    console.error("Error saving assignment:", error);
    alert("Error al guardar la asignación");
  }
});

on(ui.removeAssignment, "click", async () => {
  const classId = ui.assignmentClassId.value;
  const day = ui.assignmentDay.value;
  const time = ui.assignmentTime.value;
  
  // Calcular fecha basada en el día de la semana
  const weekDates = getWeekDates(currentWeekStart);
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const dayIndex = days.indexOf(day);
  const date = formatDate(weekDates[dayIndex]);
  
  const existingAssignment = assignmentsData.find(assign => 
    assign.classId === classId && 
    assign.date === date && 
    assign.time === time
  );
  
  if (existingAssignment && confirm("¿Estás seguro de que quieres quitar esta asignación?")) {
    try {
      await deleteClassAssignment(existingAssignment.id);
      ui.classAssignmentModal.classList.add("hidden");
      await refreshClassesView();
    } catch (error) {
      console.error("Error removing assignment:", error);
      alert("Error al quitar la asignación");
    }
  }
});

on(ui.importClassesBtn, "click", () => {
  ui.importClassesModal.classList.remove("hidden");
});

on(ui.importModalClose, "click", () => {
  ui.importClassesModal.classList.add("hidden");
});

on(ui.cancelImport, "click", () => {
  ui.importClassesModal.classList.add("hidden");
});

on(ui.classesFile, "change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const lines = content.split('\n').slice(0, 5); // Mostrar solo las primeras 5 líneas
    ui.previewContent.innerHTML = `<pre>${lines.join('\n')}</pre>`;
    ui.importPreview.classList.remove("hidden");
  };
  reader.readAsText(file);
});

on(ui.importClassesForm, "submit", async (event) => {
  event.preventDefault();
  
  const file = ui.classesFile.files[0];
  if (!file) return;
  
  ui.importStatus.textContent = "Importando clases...";
  ui.importStatus.className = "status-message info";
  
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvContent = e.target.result;
        const importedCount = await importClassesFromCSV(csvContent, currentUser?.uid);
        
        ui.importStatus.textContent = `Se importaron ${importedCount} clases correctamente.`;
        ui.importStatus.className = "status-message success";
        
        ui.importClassesForm.reset();
        ui.importPreview.classList.add("hidden");
        
        setTimeout(() => {
          ui.importClassesModal.classList.add("hidden");
          ui.importStatus.textContent = "";
          ui.importStatus.className = "status-message";
        }, 2000);
        
        await refreshClassesView();
      } catch (error) {
        console.error("Error importing classes:", error);
        ui.importStatus.textContent = `Error al importar: ${error.message}`;
        ui.importStatus.className = "status-message error";
      }
    };
    reader.readAsText(file);
  } catch (error) {
    console.error("Error reading file:", error);
    ui.importStatus.textContent = `Error al leer el archivo: ${error.message}`;
    ui.importStatus.className = "status-message error";
  }
});

// Event listeners para asignación masiva
on(ui.bulkAssignModalClose, "click", () => {
  ui.bulkAssignModal.classList.add("hidden");
});

on(ui.bulkAssignCancel, "click", () => {
  ui.bulkAssignModal.classList.add("hidden");
});

on(ui.bulkTeacherSelect, "change", (event) => {
  selectedBulkTeacher = event.target.value || null;
  const teacherName = selectedBulkTeacher 
    ? teachersData.find(t => t.id === selectedBulkTeacher)?.name || "Desconocido"
    : "Ninguno seleccionado";
  
  ui.selectedTeacherName.textContent = teacherName;
  updateSelectionSummary();
});

on(ui.bulkClearSelection, "click", () => {
  clearAllSelection();
});

on(ui.bulkAssignExecute, "click", () => {
  if (selectedClasses.size === 0 || !selectedBulkTeacher) return;
  
  const teacher = teachersData.find(t => t.id === selectedBulkTeacher);
  const confirmation = confirm(
    `¿Estás seguro de asignar ${selectedClasses.size} clases al profesor ${teacher?.name}?`
  );
  
  if (confirmation) {
    executeBulkAssignment();
  }
});

// Inicialización de clases
async function initializeClasses() {
  if (!ui.weekSelect || !ui.scheduleTableBody) {
    console.log('Elementos de clases no encontrados, saltando inicialización');
    return;
  }
  
  console.log('Inicializando vista de clases...');
  console.log('weekSelect element:', ui.weekSelect);
  console.log('weekSelect visible:', ui.weekSelect.offsetParent !== null);
  
  // Inicializar offset a 0 si no está definido
  if (selectedWeekOffset === undefined || selectedWeekOffset === null) {
    selectedWeekOffset = 0;
  }
  
  // Renderizar opciones y cargar datos
  renderWeekOptions();
  
  console.log('After renderWeekOptions:');
  console.log('  weekSelect options count:', ui.weekSelect.options.length);
  console.log('  weekSelect innerHTML length:', ui.weekSelect.innerHTML.length);
  console.log('  weekSelect value:', ui.weekSelect.value);
  
  await refreshClassesView();
  
  console.log('Vista de clases inicializada');
}

// Inicialización del menú desplegable
function initializeMenuToggle() {
  const menuToggles = document.querySelectorAll('.menu-section-toggle');
  
  menuToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const sectionName = toggle.dataset.toggle;
      const content = document.querySelector(`[data-content="${sectionName}"]`);
      
      if (content) {
        const isExpanded = content.classList.contains('expanded');
        
        // Toggle expanded class
        content.classList.toggle('expanded');
        toggle.classList.toggle('expanded');
        
        // Guardar estado en localStorage
        localStorage.setItem(`menu-${sectionName}`, !isExpanded);
      }
    });
  });
  
  // Restaurar estados guardados o expandir por defecto
  menuToggles.forEach(toggle => {
    const sectionName = toggle.dataset.toggle;
    const savedState = localStorage.getItem(`menu-${sectionName}`);
    const content = document.querySelector(`[data-content="${sectionName}"]`);
    
    if (content) {
      // Si hay estado guardado, usarlo; si no, expandir por defecto
      const shouldExpand = savedState !== null ? savedState === 'true' : true;
      
      if (shouldExpand) {
        content.classList.add('expanded');
        toggle.classList.add('expanded');
      }
    }
  });
}

// Inicializar el menú toggle cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMenuToggle);
} else {
  initializeMenuToggle();
}

// Inicialización del menú móvil y búsqueda
function initializeMobileMenuAndSearch() {
  // Close menu on overlay click
  ui.menuOverlay?.addEventListener('click', () => {
    const sideMenu = document.querySelector('.side-menu');
    const overlay = ui.menuOverlay;
    sideMenu.classList.remove('open');
    overlay.classList.remove('show');
  });

  // Global search
  const performSearch = () => {
    const query = (ui.globalSearch?.value || "").toLowerCase().trim();
    // For now, filter the current view's table if it exists
    const currentView = document.querySelector('.view:not(.hidden)');
    if (currentView) {
      const table = currentView.querySelector('table');
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? '' : 'none';
        });
      }
    }
  };

  ui.globalSearch?.addEventListener('input', performSearch);
  ui.searchBtn?.addEventListener('click', performSearch);
}

// Inicializar menú móvil y búsqueda
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMobileMenuAndSearch);
} else {
  initializeMobileMenuAndSearch();
}

// Global event listeners for discount changes
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-role="discount-reason"]')) {
    const id = e.target.getAttribute('data-id');
    const reason = e.target.value;
    const athlete = currentAthletes.find(a => a.id === id);
    if (athlete) {
      athlete.discountReason = reason;
      const price = calculatePrice(athlete);
      const priceSpan = document.querySelector(`[data-role="final-price"][data-id="${id}"]`);
      if (priceSpan) {
        priceSpan.textContent = price.toFixed(2);
      }
    }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-role="acro-discount-reason"]')) {
    const id = e.target.getAttribute('data-id');
    const reason = e.target.value;
    const athlete = currentAcroAthletes.find(a => a.id === id);
    if (athlete) {
      athlete.discountReason = reason;
      const price = calculateAcroPrice(athlete);
      const priceSpan = document.querySelector(`[data-role="acro-final-price"][data-id="${id}"]`);
      if (priceSpan) {
        priceSpan.textContent = price.toFixed(2);
      }
    }
  }
});

