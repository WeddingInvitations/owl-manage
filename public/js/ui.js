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
  refreshSummary: $("refreshSummary"),
  paymentForm: $("paymentForm"),
  paymentConcept: $("paymentConcept"),
  paymentAmount: $("paymentAmount"),
  paymentList: $("paymentList"),
  expenseForm: $("expenseForm"),
  expenseConcept: $("expenseConcept"),
  expenseAmount: $("expenseAmount"),
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
  athleteStatus: $("athleteStatus"),
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
  passwordModal: $("passwordModal"),
  changePasswordForm: $("changePasswordForm"),
  newPassword: $("newPassword"),
  confirmPassword: $("confirmPassword"),
  passwordStatus: $("passwordStatus"),
};

export function setAuthUI(currentUi, user, role) {
  if (user) {
    currentUi.userBadge.textContent = `${user.email} · ${role}`;
    currentUi.logoutBtn.disabled = false;
    currentUi.rolesPanel.classList.toggle("hidden", role !== "OWNER");
    currentUi.mainShell.classList.remove("hidden");
    currentUi.loginView.classList.add("hidden");
  } else {
    currentUi.userBadge.textContent = "Invitado";
    currentUi.logoutBtn.disabled = true;
    currentUi.rolesPanel.classList.add("hidden");
    currentUi.mainShell.classList.add("hidden");
    currentUi.loginView.classList.remove("hidden");
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

export function setPasswordModalVisible(currentUi, isVisible) {
  currentUi.passwordModal.classList.toggle("hidden", !isVisible);
}
