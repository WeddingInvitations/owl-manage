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
import { addPayment } from "./data.js";

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
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${date}</td><td>${item}</td><td>${amount}</td><td>${importe}</td>`;
    ui.cajaList.appendChild(tr);
  });
}

async function refreshCajaList() {
  const periodType = ui.cajaFilterPeriod?.value || 'month';
  const selectedPeriod = ui.cajaPeriodSelect?.value;
  const filterItem = ui.cajaFilterItem?.value;
  
  if (!selectedPeriod) {
    console.warn('No hay período seleccionado');
    return;
  }
  
  let start, end;
  
  if (periodType === 'month') {
    // selectedPeriod viene como "YYYY-MM"
    const [year, month] = selectedPeriod.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    start = startDate.toISOString().slice(0, 10);
    end = endDate.toISOString().slice(0, 10);
  } else if (periodType === 'week') {
    // selectedPeriod viene como "YYYY-MM-DD" (inicio de semana)
    const startDate = new Date(selectedPeriod);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    start = selectedPeriod;
    end = endDate.toISOString().slice(0, 10);
  }
  
  console.log(`Cargando ventas: ${start} a ${end}`);
  const sales = await loadSales({ startDate: start, endDate: end, item: filterItem === 'ALL' ? '' : filterItem });
  renderSalesList(sales);
}

// Añadir venta
export async function addSale({ item, amount, date, importe, userId }) {
  await addDoc(collection(db, "sales"), {
    item,
    amount: Number(amount),
    date,
    importe: Number(importe),
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

// Función para obtener todos los objetos únicos
async function loadUniqueItems() {
  const snap = await getDocs(collection(db, "sales"));
  const items = new Set();
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.item) {
      items.add(data.item);
    }
  });
  return Array.from(items).sort();
}

// Poblar selector de objetos
async function populateItemFilter() {
  if (!ui.cajaFilterItem) return;
  
  const items = await loadUniqueItems();
  const currentValue = ui.cajaFilterItem.value;
  
  let html = '<option value="ALL">Todos los objetos</option>';
  items.forEach(item => {
    html += `<option value="${item}">${item}</option>`;
  });
  
  ui.cajaFilterItem.innerHTML = html;
  
  // Restaurar el valor seleccionado si existía
  if (currentValue && items.includes(currentValue)) {
    ui.cajaFilterItem.value = currentValue;
  }
}

// Función para calcular el importe basado en producto y cantidad
function calculateImporte() {
  const selectElement = ui.cajaVentaObjeto;
  const selectedValue = selectElement.value;
  const cantidad = parseFloat(ui.cajaVentaCantidad.value) || 0;
  
  if (selectedValue === "OTRO") {
    // Para producto personalizado, usar el precio unitario manual
    const precioUnitario = parseFloat(ui.cajaVentaPrecioUnitario.value) || 0;
    const total = precioUnitario * cantidad;
    ui.cajaVentaImporte.value = total.toFixed(2);
  } else if (selectElement.selectedIndex > 0) {
    // Para productos predefinidos
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const price = parseFloat(selectedOption.dataset.price) || 0;
    const total = price * cantidad;
    ui.cajaVentaImporte.value = total.toFixed(2);
  } else {
    ui.cajaVentaImporte.value = "0.00";
  }
}

// Función para mostrar/ocultar campos según el producto seleccionado
function toggleProductFields() {
  const selectedValue = ui.cajaVentaObjeto.value;
  const isOtro = selectedValue === "OTRO";
  
  // Mostrar/ocultar campos de producto y precio personalizado
  if (ui.cajaVentaObjetoOtroLabel) {
    ui.cajaVentaObjetoOtroLabel.classList.toggle("hidden", !isOtro);
  }
  if (ui.cajaVentaPrecioUnitarioLabel) {
    ui.cajaVentaPrecioUnitarioLabel.classList.toggle("hidden", !isOtro);
  }
  
  // Limpiar campos si se cambia de OTRO a otro producto
  if (!isOtro) {
    if (ui.cajaVentaObjetoOtro) ui.cajaVentaObjetoOtro.value = "";
    if (ui.cajaVentaPrecioUnitario) ui.cajaVentaPrecioUnitario.value = "";
  }
  
  calculateImporte();
}

// Modal lógica
ui.cajaAddBtn?.addEventListener("click", () => {
  ui.cajaModal.classList.remove("hidden");
  ui.cajaForm.reset();
  // Al abrir el modal, poner la fecha de hoy por defecto
  if (ui.cajaVentaFecha) {
    ui.cajaVentaFecha.value = new Date().toISOString().slice(0, 10);
  }
  // Ocultar campos de producto personalizado por defecto
  if (ui.cajaVentaObjetoOtroLabel) {
    ui.cajaVentaObjetoOtroLabel.classList.add("hidden");
  }
  if (ui.cajaVentaPrecioUnitarioLabel) {
    ui.cajaVentaPrecioUnitarioLabel.classList.add("hidden");
  }
  calculateImporte();
});
ui.cajaModalClose?.addEventListener("click", () => {
  ui.cajaModal.classList.add("hidden");
});

// Event listeners para calcular automáticamente el importe
ui.cajaVentaObjeto?.addEventListener("change", toggleProductFields);
ui.cajaVentaCantidad?.addEventListener("input", calculateImporte);
ui.cajaVentaPrecioUnitario?.addEventListener("input", calculateImporte);

ui.cajaForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const selectedValue = ui.cajaVentaObjeto.value;
  let item = selectedValue;
  
  // Si es OTRO, usar el nombre personalizado
  if (selectedValue === "OTRO") {
    const customItem = ui.cajaVentaObjetoOtro.value.trim();
    if (!customItem) {
      alert("Por favor, ingresa el nombre del producto");
      return;
    }
    const customPrice = parseFloat(ui.cajaVentaPrecioUnitario.value);
    if (!customPrice || customPrice <= 0) {
      alert("Por favor, ingresa un precio válido");
      return;
    }
    item = customItem;
  }
  
  const amount = ui.cajaVentaCantidad.value;
  const date = ui.cajaVentaFecha.value;
  const importe = parseFloat(ui.cajaVentaImporte.value);
  
  // Guardar la venta
  await addSale({ item, amount, date, importe, userId: auth.currentUser?.uid });
  
  // Crear automáticamente un ingreso con el concepto "Ventas Caja"
  await addPayment("Ventas Caja", importe, date, auth.currentUser?.uid);
  
  ui.cajaModal.classList.add("hidden");
  // Actualizar filtro de objetos y lista
  await populateItemFilter();
  await refreshCajaList();
});

// Event listeners para filtros automáticos
ui.cajaFilterPeriod?.addEventListener("change", () => {
  const periodType = ui.cajaFilterPeriod.value;
  populatePeriodSelect(periodType);
  refreshCajaList();
});
ui.cajaPeriodSelect?.addEventListener("change", refreshCajaList);
ui.cajaFilterItem?.addEventListener("change", refreshCajaList);

// Función de inicialización de Caja
export async function initializeCaja() {
  if (!ui.cajaView) {
    console.warn("⚠️ cajaView no encontrado");
    return;
  }
  
  console.log("🚀 Inicializando Caja...");
  
  // Configurar período por defecto como mes
  if (ui.cajaFilterPeriod) {
    ui.cajaFilterPeriod.value = "month";
  }
  
  // Popular el selector de períodos
  populatePeriodSelect("month");
  
  // Popular el selector de objetos
  await populateItemFilter();
  
  // Cargar datos
  await refreshCajaList();
  
  console.log("✅ Caja inicializada");
}
