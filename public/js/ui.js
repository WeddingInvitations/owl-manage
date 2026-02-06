export const $ = (id) => document.getElementById(id);

export const formatCurrency = (value) => `${value.toFixed(2)} €`;

export const ui = {
  userBadge: $("userBadge"),
  logoutBtn: $("logoutBtn"),
  loginForm: $("loginForm"),
  loginEmail: $("loginEmail"),
  loginPassword: $("loginPassword"),
  googleLoginBtn: $("googleLoginBtn"),
  summaryIncome: $("summaryIncome"),
  summaryExpenses: $("summaryExpenses"),
  summaryProfit: $("summaryProfit"),
  monthlySummaryBody: $("monthlySummaryBody"),
  monthlyYearSelect: $("monthlyYearSelect"),
  monthlyDetailCard: $("monthlyDetailCard"),
  monthlyDetailTitle: $("monthlyDetailTitle"),
  monthlyDetailClose: $("monthlyDetailClose"),
  monthlyIncomeBody: $("monthlyIncomeBody"),
  monthlyExpenseBody: $("monthlyExpenseBody"),
  monthlyDetailBalance: $("monthlyDetailBalance"),
  refreshSummary: $("refreshSummary"),
  paymentForm: $("paymentForm"),
  paymentConcept: $("paymentConcept"),
  paymentDate: $("paymentDate"),
  paymentAmount: $("paymentAmount"),
  paymentMonthSelect: $("paymentMonthSelect"),
  paymentList: $("paymentList"),
  expenseForm: $("expenseForm"),
  expenseConcept: $("expenseConcept"),
  expenseDate: $("expenseDate"),
  expenseAmount: $("expenseAmount"),
  expenseMonthSelect: $("expenseMonthSelect"),
  expenseList: $("expenseList"),
  checkinForm: $("checkinForm"),
  checkinName: $("checkinName"),
  checkinType: $("checkinType"),
  checkinList: $("checkinList"),
  trainingForm: $("trainingForm"),
  trainingTitle: $("trainingTitle"),
  trainingDate: $("trainingDate"),
  trainingCoach: $("trainingCoach"),
  trainingList: $("trainingList"),
  athleteForm: $("athleteForm"),
  athleteName: $("athleteName"),
  athleteTariff: $("athleteTariff"),
  athletePrice: $("athletePrice"),
  athletePaid: $("athletePaid"),
  athleteMonthSelect: $("athleteMonthSelect"),
  athleteSummaryActive: $("athleteSummaryActive"),
  athleteSummaryAverage: $("athleteSummaryAverage"),
  athleteSummaryNew: $("athleteSummaryNew"),
  athleteSummaryDrop: $("athleteSummaryDrop"),
  athleteList: $("athleteList"),
  rolesPanel: $("rolesPanel"),
  createUserForm: $("createUserForm"),
  createUserEmail: $("createUserEmail"),
  createUserTempPassword: $("createUserTempPassword"),
  createUserRole: $("createUserRole"),
  createUserStatus: $("createUserStatus"),
  roleForm: $("roleForm"),
  roleUserId: $("roleUserId"),
  roleValue: $("roleValue"),
  userList: $("userList"),
  mainShell: $("mainShell"),
  loginView: $("loginView"),
  menuButtons: Array.from(document.querySelectorAll(".menu-btn")),
  views: Array.from(document.querySelectorAll(".view")),
};

export function setAuthUI(currentUi, user, role, mustChangePassword) {
  if (user) {
    if (currentUi.userBadge) {
      currentUi.userBadge.textContent = `${user.email} · ${role}`;
    }
    if (currentUi.logoutBtn) {
      currentUi.logoutBtn.disabled = false;
    }
    if (currentUi.rolesPanel) {
      currentUi.rolesPanel.classList.toggle("hidden", role !== "OWNER");
    }
    if (currentUi.loginView) {
      currentUi.loginView.classList.add("hidden");
    }
    if (currentUi.mainShell) {
      currentUi.mainShell.classList.toggle("hidden", Boolean(mustChangePassword));
    }
  } else {
    if (currentUi.userBadge) {
      currentUi.userBadge.textContent = "Invitado";
    }
    if (currentUi.logoutBtn) {
      currentUi.logoutBtn.disabled = true;
    }
    if (currentUi.rolesPanel) {
      currentUi.rolesPanel.classList.add("hidden");
    }
    if (currentUi.mainShell) {
      currentUi.mainShell.classList.add("hidden");
    }
    if (currentUi.loginView) {
      currentUi.loginView.classList.remove("hidden");
    }
  }
}

export function setActiveView(viewId, currentUi) {
  currentUi.views.forEach((view) => {
    view.classList.toggle("hidden", view.id !== viewId);
  });
  currentUi.menuButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
}

export function updateMenuVisibility(currentUi, role) {
  const ownerOnlyViews = new Set([
    "summaryView",
    "paymentsView",
    "expensesView",
    "rolesView",
  ]);

  currentUi.menuButtons.forEach((button) => {
    const viewId = button.dataset.view;
    const shouldHide = role !== "OWNER" && ownerOnlyViews.has(viewId);
    button.classList.toggle("hidden", shouldHide);
  });

  currentUi.views.forEach((view) => {
    const shouldHide = role !== "OWNER" && ownerOnlyViews.has(view.id);
    view.classList.toggle("hidden", shouldHide || view.classList.contains("hidden"));
  });
}

