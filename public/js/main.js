// OwlManage MVP
// TODO: Completa firebaseConfig.js con tu configuración real.
// Estructura modular simple: auth, datos, UI.

import { ui, formatCurrency, setAuthUI, setActiveView } from "./ui.js";
import { bindAuth } from "./auth.js";
import {
  addPayment,
  addExpense,
  addCheckin,
  addTraining,
  addAthlete,
  loadList,
  loadSummary,
  loadUsers,
  updateUserRole,
} from "./data.js";

let currentUser = null;
let currentRole = "RECEPTION";

async function refreshAll() {
  await loadSummary(ui, formatCurrency);
  await loadList("payments", ui.paymentList, (data) =>
    `${data.concept} · ${formatCurrency(Number(data.amount || 0))}`
  );
  await loadList("expenses", ui.expenseList, (data) =>
    `${data.concept} · ${formatCurrency(Number(data.amount || 0))}`
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

ui.menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view, ui);
  });
});

setActiveView("summaryView", ui);

bindAuth(
  ui,
  async (user, role) => {
    currentUser = user;
    currentRole = role;
    if (user) {
      await refreshAll();
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

ui.refreshSummary.addEventListener("click", async () => {
  await refreshAll();
});
