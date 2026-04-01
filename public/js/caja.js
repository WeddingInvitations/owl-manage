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

function renderSalesList(sales) {
  ui.cajaSalesList.innerHTML = "";
  sales.forEach(sale => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${sale.date}</td><td>${sale.item}</td><td>${sale.amount}</td>`;
    ui.cajaSalesList.appendChild(tr);
  });
}

async function refreshCajaList() {
  const period = ui.cajaFilterPeriod.value;
  const filterDate = ui.cajaFilterDate.value || new Date().toISOString().slice(0, 10);
  const filterItem = ui.cajaFilterItem.value;
  const { start, end } = getDateRange(period, filterDate);
  const sales = await loadSales({ startDate: start, endDate: end, item: filterItem });
  renderSalesList(sales);
}

// Añadir venta
export async function addSale({ item, amount, date, userId }) {
  await addDoc(collection(db, "sales"), {
    item,
    amount: Number(amount),
    date,
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
  ui.cajaDate.value = new Date().toISOString().slice(0, 10);
});
ui.cajaModalClose?.addEventListener("click", () => {
  ui.cajaModal.classList.add("hidden");
});
ui.cajaForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const item = ui.cajaItem.value;
  const amount = ui.cajaAmount.value;
  const date = ui.cajaDate.value;
  await addSale({ item, amount, date, userId: auth.currentUser?.uid });
  ui.cajaModal.classList.add("hidden");
  await refreshCajaList();
});
ui.cajaFilterBtn?.addEventListener("click", refreshCajaList);

// Inicialización
if (ui.cajaView) {
  ui.cajaFilterDate.value = new Date().toISOString().slice(0, 10);
  refreshCajaList();
}
