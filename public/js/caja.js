import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { ui } from "./ui.js";
import { auth } from "./firebase.js";

// Helpers para fechas
function getDateRange(period, baseDate) {
  const d = new Date(baseDate);
  let start, end;
  if (period === "week") {
    const day = d.getDay();
    start = new Date(d);
    start.setDate(d.getDate() - day);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (period === "month") {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// Popular el selector de períodos según el tipo (mes o semana)
function populatePeriodSelect(periodType) {
  if (!ui.cajaPeriodSelect) return;
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  if (periodType === "month") {
    // Generar últimos 12 meses
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const monthName = monthNames[d.getMonth()];
      months.push({ value: `${year}-${month}`, label: `${monthName} ${year}` });
    }
    ui.cajaPeriodSelect.innerHTML = months.map(m => 
      `<option value="${m.value}">${m.label}</option>`
    ).join("");
  } else if (periodType === "week") {
    // Generar últimas 12 semanas
    const weeks = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (i * 7));
      const day = d.getDay();
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - day);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const startStr = startOfWeek.toISOString().slice(0, 10);
      const label = `Semana del ${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1} al ${endOfWeek.getDate()}/${endOfWeek.getMonth() + 1}`;
      weeks.push({ value: startStr, label: label });
    }
    ui.cajaPeriodSelect.innerHTML = weeks.map(w => 
      `<option value="${w.value}">${w.label}</option>`
    ).join("");
  }
}

// Renderizar listado de ventas (muestra mensaje si está vacío)
function renderSalesList(sales) {
  ui.cajaList.innerHTML = "";
  if (!sales || sales.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty-row";
    tr.innerHTML = '<td colspan="5" style="text-align:center;color:#888;">No hay ventas registradas</td>';
    ui.cajaList.appendChild(tr);
    return;
  }
  sales.forEach(sale => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${sale.date}</td><td>${sale.item}</td><td>${sale.amount}</td><td>${sale.importe?.toFixed(2) ?? ''}</td><td>${sale.vendedor ?? ''}</td>`;
    ui.cajaList.appendChild(tr);
  });
}

async function refreshCajaList() {
  const period = ui.cajaFilterPeriod?.value || "month";
  const selectedPeriod = ui.cajaPeriodSelect?.value;
  const filterItem = ui.cajaFilterItem?.value;
  
  console.log("🔍 DEBUG Caja Filter:", { period, selectedPeriod, filterItem });
  
  let startDate, endDate;
  
  if (selectedPeriod) {
    // Usar el período seleccionado
    const { start, end } = getDateRange(period, selectedPeriod);
    startDate = start;
    endDate = end;
  } else {
    // Si no hay selección, usar el período actual
    const today = new Date().toISOString().slice(0, 10);
    const { start, end } = getDateRange(period, today);
    startDate = start;
    endDate = end;
  }
  
  console.log("📅 Date Range:", { startDate, endDate });
  
  const itemFilter = (filterItem === "ALL" || !filterItem) ? "" : filterItem;
  const sales = await loadSales({ startDate, endDate, item: itemFilter });
  console.log("💰 Sales found:", sales.length, sales);
  
  renderSalesList(sales);
}

// Añadir venta
export async function addSale({ item, amount, date, importe, vendedor, userId }) {
  await addDoc(collection(db, "sales"), {
    item,
    amount: Number(amount),
    date,
    importe: Number(importe),
    vendedor,
    createdAt: serverTimestamp(),
    createdBy: userId || null,
  });
}

// Cargar ventas con filtros
export async function loadSales({ startDate, endDate, item }) {
  let q = query(collection(db, "sales"), orderBy("date", "desc"));
  
  // Si se especifican fechas, aplicar filtro de rango
  if (startDate && endDate) {
    q = query(
      collection(db, "sales"),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc")
    );
  }
  
  const snap = await getDocs(q);
  let sales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filtro por ítem si se especifica
  if (item) {
    sales = sales.filter(sale => sale.item.toLowerCase().includes(item.toLowerCase()));
  }
  
  return sales;
}

// Modal lógica
ui.cajaAddBtn?.addEventListener("click", () => {
  ui.cajaModal.classList.remove("hidden");
  ui.cajaForm.reset();
  // Al abrir el modal, poner la fecha de hoy por defecto
  if (ui.cajaVentaFecha) {
    ui.cajaVentaFecha.value = new Date().toISOString().slice(0, 10);
  }
});
ui.cajaModalClose?.addEventListener("click", () => {
  ui.cajaModal.classList.add("hidden");
});
ui.cajaForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const item = ui.cajaVentaObjeto.value;
  const amount = ui.cajaVentaCantidad.value;
  const date = ui.cajaVentaFecha.value;
  const importe = ui.cajaVentaImporte.value;
  const vendedor = ui.cajaVentaVendedor.value;
  await addSale({ item, amount, date, importe, vendedor, userId: auth.currentUser?.uid });
  ui.cajaModal.classList.add("hidden");
  await refreshCajaList();
});
ui.cajaFilterBtn?.addEventListener("click", refreshCajaList);

// Event listeners para filtros automáticos
ui.cajaFilterPeriod?.addEventListener("change", () => {
  const periodType = ui.cajaFilterPeriod.value;
  populatePeriodSelect(periodType);
  refreshCajaList();
});
ui.cajaPeriodSelect?.addEventListener("change", refreshCajaList);
ui.cajaFilterItem?.addEventListener("change", refreshCajaList);

// Inicialización
if (ui.cajaView) {
  console.log("🚀 Inicializando Caja...");
  
  // Configurar período por defecto como mes
  if (ui.cajaFilterPeriod) {
    ui.cajaFilterPeriod.value = "month";
    console.log("📊 Período configurado:", ui.cajaFilterPeriod.value);
  } else {
    console.warn("⚠️ ui.cajaFilterPeriod no encontrado");
  }
  
  // Popular el selector de períodos
  populatePeriodSelect("month");
  
  console.log("🔄 Ejecutando refreshCajaList...");
  refreshCajaList();
}
