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
  if (period === "day") {
    start = new Date(d);
    end = new Date(d);
  } else if (period === "week") {
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

// Renderizar listado de ventas (muestra mensaje si está vacío)
function renderSalesList(sales) {
  ui.cajaList.innerHTML = "";
  const cajaEmpty = document.getElementById("cajaEmpty");
  if (!sales || sales.length === 0) {
    if (cajaEmpty) cajaEmpty.classList.remove("hidden");
    return;
  } else {
    if (cajaEmpty) cajaEmpty.classList.add("hidden");
  }
  sales.forEach(sale => {
    // Aseguramos que los campos existen y tienen el nombre correcto
    const date = sale.date || '';
    const item = sale.item || sale.objeto || '';
    const amount = sale.amount ?? sale.cantidad ?? '';
    const importe = sale.importe !== undefined ? Number(sale.importe).toFixed(2) : '';
    const vendedor = sale.vendedor || '';
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${date}</td><td>${item}</td><td>${amount}</td><td>${importe}</td><td>${vendedor}</td>`;
    ui.cajaList.appendChild(tr);
  });
}

async function refreshCajaList() {
  const period = ui.cajaPeriodFilter.value;
  const filterDate = ui.cajaDateFilter.value || new Date().toISOString().slice(0, 10);
  const filterItem = ui.cajaObjectFilter.value;
  const { start, end } = getDateRange(period, filterDate);
  // Si el filtro es "Todos los objetos", no filtrar por item
  const item = (filterItem && filterItem !== "ALL") ? filterItem : undefined;
  const sales = await loadSales({ startDate: start, endDate: end, item });
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

// Inicialización
if (ui.cajaView) {
  ui.cajaFilterDate.value = new Date().toISOString().slice(0, 10);
  refreshCajaList();
}
