export const $ = (id) => document.getElementById(id);

export const formatCurrency = (value) => `${value.toFixed(2)} €`;

export const ui = {
    // Pagos empleados
    employeePaymentsView: $("employeePaymentsView"),
    employeePaymentsList: $("employeePaymentsList"),
    employeePaymentYearSelect: $("employeePaymentYearSelect"),
    employeePaymentMonthSelect: $("employeePaymentMonthSelect"),
    employeePaymentNameFilter: $("employeePaymentNameFilter"),
    employeePaymentAddBtn: $("employeePaymentAddBtn"),
    employeePaymentModal: $("employeePaymentModal"),
    employeePaymentModalClose: $("employeePaymentModalClose"),
    employeePaymentForm: $("employeePaymentForm"),
    employeePaymentName: $("employeePaymentName"),
    employeePaymentAmount: $("employeePaymentAmount"),
    employeePaymentMethod: $("employeePaymentMethod"),
    employeePaymentDate: $("employeePaymentDate"),
  userBadge: $("userBadge"),
  userAvatar: $("userAvatar"),
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
  paymentCsvModal: $("paymentCsvModal"),
  paymentCsvOpen: $("paymentCsvOpen"),
  paymentCsvClose: $("paymentCsvClose"),
  paymentCsvForm: $("paymentCsvForm"),
  paymentCsvFile: $("paymentCsvFile"),
  paymentCsvStatus: $("paymentCsvStatus"),
  downloadPaymentTemplate: $("downloadPaymentTemplate"),
  paymentTemplateDownload: $("paymentTemplateDownload"),
  paymentEditModal: $("paymentEditModal"),
  paymentEditClose: $("paymentEditClose"),
  paymentEditForm: $("paymentEditForm"),
  paymentEditId: $("paymentEditId"),
  paymentEditConcept: $("paymentEditConcept"),
  paymentEditDate: $("paymentEditDate"),
  paymentEditAmount: $("paymentEditAmount"),
  paymentDeleteModal: $("paymentDeleteModal"),
  paymentDeleteId: $("paymentDeleteId"),
  paymentDeleteInfo: $("paymentDeleteInfo"),
  paymentDeleteConfirm: $("paymentDeleteConfirm"),
  paymentDeleteCancel: $("paymentDeleteCancel"),
  expenseForm: $("expenseForm"),
  expenseConcept: $("expenseConcept"),
  expenseDate: $("expenseDate"),
  expenseAmount: $("expenseAmount"),
  expenseMonthSelect: $("expenseMonthSelect"),
  expenseList: $("expenseList"),
  expenseCsvModal: $("expenseCsvModal"),
  expenseCsvOpen: $("expenseCsvOpen"),
  expenseCsvClose: $("expenseCsvClose"),
  expenseCsvForm: $("expenseCsvForm"),
  expenseCsvFile: $("expenseCsvFile"),
  expenseCsvStatus: $("expenseCsvStatus"),
  downloadExpenseTemplate: $("downloadExpenseTemplate"),
  expenseTemplateDownload: $("expenseTemplateDownload"),
  expenseEditModal: $("expenseEditModal"),
  expenseEditClose: $("expenseEditClose"),
  expenseEditForm: $("expenseEditForm"),
  expenseEditId: $("expenseEditId"),
  expenseEditConcept: $("expenseEditConcept"),
  expenseEditDate: $("expenseEditDate"),
  expenseEditAmount: $("expenseEditAmount"),
  expenseDeleteModal: $("expenseDeleteModal"),
  expenseDeleteId: $("expenseDeleteId"),
  expenseDeleteInfo: $("expenseDeleteInfo"),
  expenseDeleteConfirm: $("expenseDeleteConfirm"),
  expenseDeleteCancel: $("expenseDeleteCancel"),
  // Orders
  ordersView: $("ordersView"),
  orderMonthSelect: $("orderMonthSelect"),
  orderAddBtn: $("orderAddBtn"),
  orderList: $("orderList"),
  orderModal: $("orderModal"),
  orderModalClose: $("orderModalClose"),
  orderForm: $("orderForm"),
  orderDate: $("orderDate"),
  orderSupplier: $("orderSupplier"),
  orderSupplierOther: $("orderSupplierOther"),
  orderSupplierOtherLabel: $("orderSupplierOtherLabel"),
  orderPrice: $("orderPrice"),
  orderDocument: $("orderDocument"),
  orderEditModal: $("orderEditModal"),
  orderEditClose: $("orderEditClose"),
  orderEditForm: $("orderEditForm"),
  orderEditId: $("orderEditId"),
  orderEditDate: $("orderEditDate"),
  orderEditSupplier: $("orderEditSupplier"),
  orderEditSupplierOther: $("orderEditSupplierOther"),
  orderEditSupplierOtherLabel: $("orderEditSupplierOtherLabel"),
  orderEditPrice: $("orderEditPrice"),
  orderEditDocument: $("orderEditDocument"),
  orderDeleteModal: $("orderDeleteModal"),
  orderDeleteId: $("orderDeleteId"),
  orderDeleteInfo: $("orderDeleteInfo"),
  orderDeleteConfirm: $("orderDeleteConfirm"),
  orderDeleteCancel: $("orderDeleteCancel"),
  checkinUserName: $("checkinUserName"),
  checkinEditProfileBtn: $("checkinEditProfileBtn"),
  checkinProfileEdit: $("checkinProfileEdit"),
  checkinProfileForm: $("checkinProfileForm"),
  checkinProfileFirstName: $("checkinProfileFirstName"),
  checkinProfileLastName: $("checkinProfileLastName"),
  checkinProfileCancel: $("checkinProfileCancel"),
  checkinDateTime: $("checkinDateTime"),
  checkinStatus: $("checkinStatus"),
  checkinTimer: $("checkinTimer"),
  checkinInTime: $("checkinInTime"),
  checkinClosedStatus: $("checkinClosedStatus"),
  checkinClosedInTime: $("checkinClosedInTime"),
  checkinClosedOutTime: $("checkinClosedOutTime"),
  checkinClosedDuration: $("checkinClosedDuration"),
  checkinOpenBtn: $("checkinOpenBtn"),
  checkinCloseBtn: $("checkinCloseBtn"),
  checkinList: $("checkinList"),
  checkinAdminSection: $("checkinAdminSection"),
  checkinAdminMonthSelect: $("checkinAdminMonthSelect"),
  checkinAdminTotalHours: $("checkinAdminTotalHours"),
  checkinAdminTotalCount: $("checkinAdminTotalCount"),
  checkinAdminList: $("checkinAdminList"),
  checkinAdminSummaryList: $("checkinAdminSummaryList"),
  checkinDownloadBtn: $("checkinDownloadBtn"),
  checkinDownloadModal: $("checkinDownloadModal"),
  checkinDownloadClose: $("checkinDownloadClose"),
  checkinDownloadType: $("checkinDownloadType"),
  checkinDownloadMonthly: $("checkinDownloadMonthly"),
  checkinDownloadYearly: $("checkinDownloadYearly"),
  checkinDownloadMonth: $("checkinDownloadMonth"),
  checkinDownloadYear: $("checkinDownloadYear"),
  checkinDownloadWorker: $("checkinDownloadWorker"),
  checkinDownloadFormat: $("checkinDownloadFormat"),
  checkinDownloadConfirm: $("checkinDownloadConfirm"),
  // Checkin edit modal
  checkinEditModal: $("checkinEditModal"),
  checkinEditClose: $("checkinEditClose"),
  checkinEditForm: $("checkinEditForm"),
  checkinEditId: $("checkinEditId"),
  checkinEditWorker: $("checkinEditWorker"),
  checkinEditOriginalDate: $("checkinEditOriginalDate"),
  checkinEditIn: $("checkinEditIn"),
  checkinEditOut: $("checkinEditOut"),
  checkinEditReason: $("checkinEditReason"),
  checkinEditCancelBtn: $("checkinEditCancelBtn"),
  // Checkin history modal
  checkinHistoryModal: $("checkinHistoryModal"),
  checkinHistoryClose: $("checkinHistoryClose"),
  checkinHistoryWorker: $("checkinHistoryWorker"),
  checkinHistoryOriginal: $("checkinHistoryOriginal"),
  checkinHistoryCurrent: $("checkinHistoryCurrent"),
  checkinHistoryOut: $("checkinHistoryOut"),
  checkinHistoryDevice: $("checkinHistoryDevice"),
  checkinHistoryList: $("checkinHistoryList"),
  checkinHistoryEmpty: $("checkinHistoryEmpty"),
  // Vacaciones
  vacationAddBtn: $("vacationAddBtn"),
  vacationMonth: $("vacationMonth"),
  vacationMonthPrev: $("vacationMonthPrev"),
  vacationMonthNext: $("vacationMonthNext"),
  vacationWorkerSelect: $("vacationWorkerSelect"),
  vacationCalendar: $("vacationCalendar"),
  vacationLegend: $("vacationLegend"),
  vacationSummary: $("vacationSummary"),
  vacationTotalDays: $("vacationTotalDays"),
  vacationTotalPeriods: $("vacationTotalPeriods"),
  vacationCurrentYear: $("vacationCurrentYear"),
  vacationList: $("vacationList"),
  vacationModal: $("vacationModal"),
  vacationModalClose: $("vacationModalClose"),
  vacationForm: $("vacationForm"),
  vacationStart: $("vacationStart"),
  vacationEnd: $("vacationEnd"),
  vacationReason: $("vacationReason"),
  vacationDisplayName: $("vacationDisplayName"),
  vacationCancelBtn: $("vacationCancelBtn"),
  vacationEditModal: $("vacationEditModal"),
  vacationEditModalClose: $("vacationEditModalClose"),
  vacationEditForm: $("vacationEditForm"),
  vacationEditId: $("vacationEditId"),
  vacationEditUserId: $("vacationEditUserId"),
  vacationEditStart: $("vacationEditStart"),
  vacationEditEnd: $("vacationEditEnd"),
  vacationEditReason: $("vacationEditReason"),
  vacationEditDisplayName: $("vacationEditDisplayName"),
  vacationEditCancelBtn: $("vacationEditCancelBtn"),
  trainingForm: $("trainingForm"),
  trainingTitle: $("trainingTitle"),
  trainingDate: $("trainingDate"),
  trainingCoach: $("trainingCoach"),
  trainingList: $("trainingList"),
  athleteForm: $("athleteForm"),
  athleteName: $("athleteName"),
  athleteNameList: $("athleteNameList"),
  athletePaymentMonth: $("athletePaymentMonth"),
  athleteTariff: $("athleteTariff"),
  athletePrice: $("athletePrice"),
  athleteDiscount: $("athleteDiscount"),
  athleteDiscountReason: $("athleteDiscountReason"),
  athleteFinalPrice: $("athleteFinalPrice"),
  athletePaid: $("athletePaid"),
  athleteModal: $("athleteModal"),
  athleteModalOpen: $("athleteModalOpen"),
  athleteModalClose: $("athleteModalClose"),
  athleteCsvModal: $("athleteCsvModal"),
  athleteCsvOpen: $("athleteCsvOpen"),
  athleteCsvClose: $("athleteCsvClose"),
  athleteCsvForm: $("athleteCsvForm"),
  athleteCsvFile: $("athleteCsvFile"),
  athleteCsvMonth: $("athleteCsvMonth"),
  athleteCsvStatus: $("athleteCsvStatus"),
  downloadAthleteTemplate: $("downloadAthleteTemplate"),
  athleteMonthSelect: $("athleteMonthSelect"),
  athleteListMonthSelect: $("athleteListMonthSelect"),
  athleteSummaryActive: $("athleteSummaryActive"),
  athleteSummaryAverage: $("athleteSummaryAverage"),
  athleteSummaryNew: $("athleteSummaryNew"),
  athleteSummaryDrop: $("athleteSummaryDrop"),
  athleteSearch: $("athleteSearch"),
  athleteSearchList: $("athleteSearchList"),
  athletePaidFilter: $("athletePaidFilter"),
  athleteSaveAllBtn: $("athleteSaveAllBtn"),
  athleteList: $("athleteList"),
  athleteListCount: $("athleteListCount"),
  
  // Clases y turnos
  classesView: $("classesView"),
  bulkAssignBtn: $("bulkAssignBtn"),
  importClassesBtn: $("importClassesBtn"),
  addTeacherBtn: $("addTeacherBtn"),
  weekSelect: $("weekSelect"),
  prevWeekBtn: $("prevWeekBtn"),
  nextWeekBtn: $("nextWeekBtn"),
  currentWeekBtn: $("currentWeekBtn"),
  scheduleTableBody: $("scheduleTableBody"),
  teacherSearch: $("teacherSearch"),
  teacherStatusFilter: $("teacherStatusFilter"),
  teacherList: $("teacherList"),
  
  // Modales de clases
  teacherModal: $("teacherModal"),
  teacherModalTitle: $("teacherModalTitle"),
  teacherModalClose: $("teacherModalClose"),
  teacherForm: $("teacherForm"),
  teacherId: $("teacherId"),
  teacherName: $("teacherName"),
  teacherEmail: $("teacherEmail"),
  teacherPhone: $("teacherPhone"),
  teacherSpecialties: $("teacherSpecialties"),
  teacherStatus: $("teacherStatus"),
  cancelTeacher: $("cancelTeacher"),
  
  classAssignmentModal: $("classAssignmentModal"),
  assignmentModalTitle: $("assignmentModalTitle"),
  assignmentModalClose: $("assignmentModalClose"),
  assignmentForm: $("assignmentForm"),
  assignmentClassId: $("assignmentClassId"),
  assignmentDay: $("assignmentDay"),
  assignmentTime: $("assignmentTime"),
  classInfo: $("classInfo"),
  classInfoTitle: $("classInfoTitle"),
  classDay: $("classDay"),
  classTime: $("classTime"),
  classType: $("classType"),
  assignedTeacher: $("assignedTeacher"),
  assignmentNotes: $("assignmentNotes"),
  cancelAssignment: $("cancelAssignment"),
  removeAssignment: $("removeAssignment"),
  
  importClassesModal: $("importClassesModal"),
  importModalClose: $("importModalClose"),
  importClassesForm: $("importClassesForm"),
  classesFile: $("classesFile"),
  importPreview: $("importPreview"),
  previewContent: $("previewContent"),
  cancelImport: $("cancelImport"),
  importStatus: $("importStatus"),
  
  // Modal de asignación masiva
  bulkAssignModal: $("bulkAssignModal"),
  bulkAssignModalClose: $("bulkAssignModalClose"),
  bulkTeacherSelect: $("bulkTeacherSelect"),
  bulkPrevWeekBtn: $("bulkPrevWeekBtn"),
  bulkNextWeekBtn: $("bulkNextWeekBtn"),
  bulkCurrentWeekDisplay: $("bulkCurrentWeekDisplay"),
  bulkScheduleTableBody: $("bulkScheduleTableBody"),
  selectedTeacherName: $("selectedTeacherName"),
  selectedClassesCount: $("selectedClassesCount"),
  selectedClassesList: $("selectedClassesList"),
  bulkAssignExecute: $("bulkAssignExecute"),
  assignCountText: $("assignCountText"),
  bulkClearSelection: $("bulkClearSelection"),
  bulkAssignCancel: $("bulkAssignCancel"),
  
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
  // Perfil de usuario
  profileView: $("profileView"),
  profileForm: $("profileForm"),
  profileFirstName: $("profileFirstName"),
  profileLastName: $("profileLastName"),
  profileStatus: $("profileStatus"),
  profileAvatar: $("profileAvatar"),
  profileEmail: $("profileEmail"),
  profileRole: $("profileRole"),
  profileChangePasswordBtn: $("profileChangePasswordBtn"),
  passwordChangeModal: $("passwordChangeModal"),
  passwordChangeModalClose: $("passwordChangeModalClose"),
  passwordChangeModalForm: $("passwordChangeModalForm"),
  passwordChangeModalNew: $("passwordChangeModalNew"),
  passwordChangeModalConfirm: $("passwordChangeModalConfirm"),
  passwordChangeModalStatus: $("passwordChangeModalStatus"),
  mainShell: $("mainShell"),
  loginView: $("loginView"),
  menuButtons: Array.from(document.querySelectorAll(".menu-btn")),
  views: Array.from(document.querySelectorAll(".view")),
  // Acrobacias
  acroForm: $("acroForm"),
  acroName: $("acroName"),
  acroNameList: $("acroNameList"),
  acroPaymentMonth: $("acroPaymentMonth"),
  acroTariff: $("acroTariff"),
  acroPrice: $("acroPrice"),
  acroDiscount: $("acroDiscount"),
  acroDiscountReason: $("acroDiscountReason"),
  acroFinalPrice: $("acroFinalPrice"),
  acroPaid: $("acroPaid"),
  acroModal: $("acroModal"),
  acroModalOpen: $("acroModalOpen"),
  acroModalClose: $("acroModalClose"),
  acroCsvModal: $("acroCsvModal"),
  acroCsvOpen: $("acroCsvOpen"),
  acroCsvClose: $("acroCsvClose"),
  acroCsvForm: $("acroCsvForm"),
  acroCsvFile: $("acroCsvFile"),
  acroCsvMonth: $("acroCsvMonth"),
  acroCsvStatus: $("acroCsvStatus"),
  downloadAcroTemplate: $("downloadAcroTemplate"),
  acroMonthSelect: $("acroMonthSelect"),
  acroListMonthSelect: $("acroListMonthSelect"),
  acroSummaryActive: $("acroSummaryActive"),
  acroSummaryAverage: $("acroSummaryAverage"),
  acroSummaryNew: $("acroSummaryNew"),
  acroSummaryDrop: $("acroSummaryDrop"),
  acroSearch: $("acroSearch"),
  acroSearchList: $("acroSearchList"),
  acroPaidFilter: $("acroPaidFilter"),
  acroSaveAllBtn: $("acroSaveAllBtn"),
  acroList: $("acroList"),
  acroListCount: $("acroListCount"),
  // Cambio de contraseña inicial
  passwordChangeView: $("passwordChangeView"),
  passwordChangeForm: $("passwordChangeForm"),
  passwordChangeNew: $("passwordChangeNew"),
  passwordChangeConfirm: $("passwordChangeConfirm"),
  passwordChangeStatus: $("passwordChangeStatus"),
  // Mobile navigation
  mobileNav: $("mobileNav"),
  mobileNavButtons: Array.from(document.querySelectorAll(".mobile-nav-btn")),
  moreMenu: $("moreMenu"),
  moreMenuClose: $("moreMenuClose"),
  // Menu toggle and search
  menuToggle: $("menuToggle"),
  menuOverlay: $("menuOverlay"),
  globalSearch: $("globalSearch"),
  searchBtn: $("searchBtn"),
};

// Caja
ui.cajaView = $("cajaView");
ui.cajaList = $("cajaList");
ui.cajaAddBtn = $("cajaAddBtn");
ui.cajaModal = $("cajaModal");
ui.cajaModalClose = $("cajaModalClose");
ui.cajaForm = $("cajaForm");
ui.cajaVentaFecha = $("cajaVentaFecha");
ui.cajaVentaObjeto = $("cajaVentaObjeto");
ui.cajaVentaObjetoOtro = $("cajaVentaObjetoOtro");
ui.cajaVentaObjetoOtroLabel = $("cajaVentaObjetoOtroLabel");
ui.cajaVentaPrecioUnitario = $("cajaVentaPrecioUnitario");
ui.cajaVentaPrecioUnitarioLabel = $("cajaVentaPrecioUnitarioLabel");
ui.cajaVentaCantidad = $("cajaVentaCantidad");
ui.cajaVentaImporte = $("cajaVentaImporte");
ui.cajaFilterPeriod = $("cajaPeriodFilter");
ui.cajaPeriodSelect = $("cajaPeriodSelect");
ui.cajaFilterItem = $("cajaObjectFilter");

export function setAuthUI(currentUi, user, role, mustChangePassword) {
  if (user) {
    if (currentUi.logoutBtn) {
      currentUi.logoutBtn.disabled = false;
    }
    if (currentUi.rolesPanel) {
      currentUi.rolesPanel.classList.toggle("hidden", role !== "OWNER");
    }
    if (currentUi.loginView) {
      currentUi.loginView.classList.add("hidden");
    }
    // Si debe cambiar la contraseña, mostramos sólo la vista de cambio y ocultamos la app
    if (currentUi.passwordChangeView) {
      currentUi.passwordChangeView.classList.toggle("hidden", !mustChangePassword);
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
    if (currentUi.passwordChangeView) {
      currentUi.passwordChangeView.classList.add("hidden");
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
  // Definir qué secciones puede ver cada rol
  const visibleSections = {
    OWNER: ["contabilidad", "usuarios", "equipo", "admin"],
    RECEPTION: ["contabilidad", "usuarios", "equipo"],
    COACH: ["contabilidad", "usuarios", "equipo"],
    TEAM_LEADER: ["contabilidad", "usuarios", "equipo"]
  };

  // Vistas específicas que solo puede ver OWNER dentro de Contabilidad
  const ownerOnlyViews = [
    "summaryView",
    "paymentsView", 
    "expensesView",
    "employeePaymentsView"
  ];

  // Vistas que pueden ver OWNER y TEAM_LEADER
  const teamLeaderViews = [
    "classesView"
  ];

  const sectionsToShow = visibleSections[role] || [];

  // Ocultar/mostrar secciones completas del menú
  const menuSections = document.querySelectorAll(".menu-section");
  menuSections.forEach((section) => {
    const sectionName = section.dataset.section;
    const shouldHide = !sectionsToShow.includes(sectionName);
    section.classList.toggle("hidden", shouldHide);
  });

  // Ocultar/mostrar vistas correspondientes
  currentUi.views.forEach((view) => {
    const viewId = view.id;
    
    // profileView siempre visible
    if (viewId === "profileView") {
      return;
    }
    
    // Determinar a qué sección pertenece cada vista
    const viewToSection = {
      // Contabilidad
      "summaryView": "contabilidad",
      "paymentsView": "contabilidad",
      "expensesView": "contabilidad",
      "cajaView": "contabilidad",
      "employeePaymentsView": "contabilidad",
      // Usuarios
      "athletesView": "usuarios",
      "acroView": "usuarios",
      // Equipo
      "checkinsView": "equipo",
      "vacationsView": "equipo",
      "trainingsView": "equipo",
      "classesView": "equipo",
      // Admin
      "rolesView": "admin"
    };
    
    const sectionForView = viewToSection[viewId];
    if (sectionForView) {
      const shouldHide = !sectionsToShow.includes(sectionForView);
      view.classList.toggle("hidden", shouldHide);
    }
    
    // Ocultar vistas específicas de OWNER
    if (ownerOnlyViews.includes(viewId) && role !== "OWNER") {
      view.classList.add("hidden");
    }

    // Ocultar vistas que solo pueden ver OWNER y TEAM_LEADER
    if (teamLeaderViews.includes(viewId) && role !== "OWNER" && role !== "TEAM_LEADER") {
      view.classList.add("hidden");
    }
  });
  
  // También ocultar botones de menú para vistas específicas de OWNER
  currentUi.menuButtons.forEach((button) => {
    const viewId = button.dataset.view;
    if (ownerOnlyViews.includes(viewId) && role !== "OWNER") {
      button.classList.add("hidden");
    }

    // Ocultar botones de menú que solo pueden ver OWNER y TEAM_LEADER
    if (teamLeaderViews.includes(viewId) && role !== "OWNER" && role !== "TEAM_LEADER") {
      button.classList.add("hidden");
    }
  });
}

