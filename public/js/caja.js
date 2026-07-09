import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { ui } from "./ui.js";
import { auth } from "./firebase.js";
import {
  addPayment,
  addOrUpdateCajaPayment,
  addInventoryStock,
  consumeInventoryStock,
  getInventoryItems,
  getInventoryMovements,
  deleteInventoryItem,
} from "./data.js";

let inventoryInitialized = false;

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
  const periodSelect = ui.cajaPeriodSelect || document.getElementById("cajaPeriodSelect");
  const periodDate = ui.cajaPeriodDate || document.getElementById("cajaPeriodDate");
  if (!periodSelect && !periodDate) return;
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  if (periodType === "day") {
    if (periodSelect) {
      periodSelect.classList.add("hidden");
      periodSelect.innerHTML = "";
    }
    if (periodDate) {
      periodDate.classList.remove("hidden");
      periodDate.value = periodDate.value || currentDate.toISOString().slice(0, 10);
      periodDate.max = currentDate.toISOString().slice(0, 10);
      periodDate.min = new Date(currentYear, currentMonth - 12, 1).toISOString().slice(0, 10);
    }
  } else if (periodType === "month") {
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
    if (periodDate) periodDate.classList.add("hidden");
    if (periodSelect) periodSelect.classList.remove("hidden");
    periodSelect.innerHTML = months.map(m => 
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
    if (periodDate) periodDate.classList.add("hidden");
    if (periodSelect) periodSelect.classList.remove("hidden");
    periodSelect.innerHTML = weeks.map(w => 
      `<option value="${w.value}">${w.label}</option>`
    ).join("");
  }
}

function renderSalesSummary(sales) {
  if (!ui.cajaSummaryList) return;

  const grouped = new Map();
  let totalUnits = 0;
  let totalEuros = 0;

  (sales || []).forEach((sale) => {
    const item = String(sale.item || sale.objeto || "Sin producto").trim();
    const amount = Number(sale.amount ?? sale.cantidad ?? 0);
    const euros = Number(sale.importe ?? 0);

    totalUnits += Number.isFinite(amount) ? amount : 0;
    totalEuros += Number.isFinite(euros) ? euros : 0;

    if (!grouped.has(item)) {
      grouped.set(item, { units: 0, euros: 0 });
    }
    const entry = grouped.get(item);
    entry.units += Number.isFinite(amount) ? amount : 0;
    entry.euros += Number.isFinite(euros) ? euros : 0;
  });

  const rows = Array.from(grouped.entries())
    .map(([item, values]) => ({ item, ...values }))
    .sort((a, b) => b.euros - a.euros);

  ui.cajaSummaryList.innerHTML = "";

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="3" class="muted">No hay ventas en el periodo seleccionado.</td>';
    ui.cajaSummaryList.appendChild(tr);
  } else {
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.item}</td>
        <td>${row.units}</td>
        <td>${row.euros.toFixed(2)}</td>
      `;
      ui.cajaSummaryList.appendChild(tr);
    });
  }

  if (ui.cajaSummaryTotalUnits) {
    ui.cajaSummaryTotalUnits.textContent = String(totalUnits);
  }
  if (ui.cajaSummaryTotalEuros) {
    ui.cajaSummaryTotalEuros.textContent = `${totalEuros.toFixed(2)} €`;
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
    const method = sale.paymentMethod || sale.method || 'Efectivo';
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${date}</td><td>${item}</td><td>${amount}</td><td>${importe}</td><td>${method}</td>`;
    ui.cajaList.appendChild(tr);
  });
}

async function refreshCajaList() {
  const periodType = ui.cajaFilterPeriod?.value || 'month';
  const selectedPeriod = periodType === 'day'
    ? (ui.cajaPeriodDate?.value || ui.cajaPeriodSelect?.value)
    : ui.cajaPeriodSelect?.value;
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
  } else if (periodType === 'day') {
    start = selectedPeriod;
    end = selectedPeriod;
  }
  
  console.log(`Cargando ventas: ${start} a ${end}`);
  const sales = await loadSales({ startDate: start, endDate: end, item: filterItem === 'ALL' ? '' : filterItem });
  renderSalesSummary(sales);
  renderSalesList(sales);
}

// Añadir venta
export async function addSale({ item, amount, date, importe, paymentMethod, userId }) {
  await addDoc(collection(db, "sales"), {
    item,
    amount: Number(amount),
    date,
    importe: Number(importe),
    paymentMethod: paymentMethod || "Efectivo",
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
  if (ui.cajaPeriodDate && !ui.cajaPeriodDate.value) {
    ui.cajaPeriodDate.value = new Date().toISOString().slice(0, 10);
  }
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

function formatMovementDate(movement) {
  if (movement.date) return movement.date;
  if (movement.createdAt && typeof movement.createdAt.toDate === "function") {
    return movement.createdAt.toDate().toISOString().slice(0, 10);
  }
  return "-";
}

function renderInventoryList(items) {
  if (!ui.inventoryList) return;

  ui.inventoryList.innerHTML = "";
  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4" class="muted">No hay productos en inventario.</td>';
    ui.inventoryList.appendChild(tr);
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement("tr");
    const stock = Number(item.stock || 0);
    const updatedAt = item.updatedAt?.toDate?.() || item.createdAt?.toDate?.() || null;
    const updatedLabel = updatedAt
      ? updatedAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
      : "-";

    const productNameCell = document.createElement("td");
    productNameCell.textContent = item.name || "-";
    tr.appendChild(productNameCell);

    const stockCell = document.createElement("td");
    const stockPill = document.createElement("span");
    stockPill.className = `inventory-stock-pill ${stock <= 5 ? "low" : "ok"}`;
    stockPill.textContent = stock;
    stockCell.appendChild(stockPill);
    tr.appendChild(stockCell);

    const updatedCell = document.createElement("td");
    updatedCell.textContent = updatedLabel;
    tr.appendChild(updatedCell);

    const actionsCell = document.createElement("td");
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "record-actions";
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-icon btn-delete";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Eliminar producto";
    deleteBtn.onclick = () => handleDeleteInventoryItem(item.id, item.name);
    
    actionsDiv.appendChild(deleteBtn);
    actionsCell.appendChild(actionsDiv);
    tr.appendChild(actionsCell);

    ui.inventoryList.appendChild(tr);
  });
}

function renderInventoryMovements(movements) {
  if (!ui.inventoryMovementsList) return;

  ui.inventoryMovementsList.innerHTML = "";
  if (!movements.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="muted">Sin movimientos registrados.</td>';
    ui.inventoryMovementsList.appendChild(tr);
    return;
  }

  movements.forEach((movement) => {
    const tr = document.createElement("tr");
    const change = Number(movement.quantityChange || 0);
    tr.innerHTML = `
      <td>${formatMovementDate(movement)}</td>
      <td>${movement.itemName || "-"}</td>
      <td class="${change < 0 ? "inventory-negative" : "inventory-positive"}">${change > 0 ? "+" : ""}${change}</td>
      <td>${Number(movement.stockAfter || 0)}</td>
      <td>${movement.movementType || "-"}</td>
      <td>${movement.note || "-"}</td>
    `;
    ui.inventoryMovementsList.appendChild(tr);
  });
}

function updateInventoryProductOptions() {
  if (!ui.inventoryProduct || !ui.cajaVentaObjeto) return;

  const currentValue = ui.inventoryProduct.value;
  const cajaOptions = Array.from(ui.cajaVentaObjeto.options || []);
  const inventoryOptions = cajaOptions.filter((option) => {
    const value = String(option.value || "").trim();
    return value && value !== "OTRO";
  });

  ui.inventoryProduct.innerHTML = '<option value="">Seleccionar producto...</option>';
  inventoryOptions.forEach((option) => {
    const newOption = document.createElement("option");
    newOption.value = option.value;
    newOption.textContent = option.value;
    ui.inventoryProduct.appendChild(newOption);
  });

  if (currentValue && inventoryOptions.some((option) => option.value === currentValue)) {
    ui.inventoryProduct.value = currentValue;
  }
}

async function refreshInventoryView() {
  const [items, movements] = await Promise.all([
    getInventoryItems(),
    getInventoryMovements(100),
  ]);

  updateInventoryProductOptions();
  renderInventoryList(items);
  renderInventoryMovements(movements);
}

function handleDeleteInventoryItem(itemId, itemName) {
  if (!ui.inventoryDeleteModal || !ui.inventoryDeleteInfo || !ui.inventoryDeleteId) return;
  
  ui.inventoryDeleteId.value = itemId;
  ui.inventoryDeleteInfo.textContent = `Producto: ${itemName}`;
  ui.inventoryDeleteModal.classList.remove("hidden");
}

if (ui.inventoryDeleteCancel) {
  ui.inventoryDeleteCancel.addEventListener("click", () => {
    if (ui.inventoryDeleteModal) {
      ui.inventoryDeleteModal.classList.add("hidden");
    }
  });
}

if (ui.inventoryDeleteConfirm) {
  ui.inventoryDeleteConfirm.addEventListener("click", async () => {
    const itemId = ui.inventoryDeleteId?.value;
    if (!itemId) return;

    try {
      await deleteInventoryItem(itemId);
      if (ui.inventoryDeleteModal) {
        ui.inventoryDeleteModal.classList.add("hidden");
      }
      await refreshInventoryView();
      if (ui.inventoryStatus) {
        ui.inventoryStatus.textContent = "Producto eliminado correctamente";
        setTimeout(() => {
          if (ui.inventoryStatus) ui.inventoryStatus.textContent = "";
        }, 3000);
      }
    } catch (error) {
      alert(error?.message || "No se pudo eliminar el producto");
    }
  });
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
  const selectedOption = ui.cajaVentaObjeto.options[ui.cajaVentaObjeto.selectedIndex];
  const nonStockItems = new Set(["BONO AGUA", "BONO MONSTER"]);
  const selectedKey = String(selectedValue || "").trim().toUpperCase();
  const isNonStockItem = nonStockItems.has(selectedKey);
  const shouldTrackStock = selectedValue === "OTRO"
    ? true
    : !isNonStockItem && selectedOption?.dataset.trackStock !== "false";
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
  
  const amount = Number(ui.cajaVentaCantidad.value);
  const date = ui.cajaVentaFecha.value;
  const importe = parseFloat(ui.cajaVentaImporte.value);
  const paymentMethod = ui.cajaVentaMetodo?.value || "Efectivo";

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("La cantidad debe ser mayor que 0");
    return;
  }

  let inventoryConsumed = false;
  if (shouldTrackStock) {
    try {
      await consumeInventoryStock({
        itemName: item,
        units: amount,
        date,
        note: "Venta en caja",
        userId: auth.currentUser?.uid,
      });
      inventoryConsumed = true;
    } catch (error) {
      const message = String(error?.message || "");
      const isStockError = message.toLowerCase().includes("stock insuficiente");
      if (!isStockError) {
        alert(error?.message || "No se pudo descontar stock. Revisa inventario.");
        return;
      }
    }
  }
  
  try {
    // Guardar la venta
    await addSale({ item, amount, date, importe, paymentMethod, userId: auth.currentUser?.uid });
    
    // Crear o actualizar el ingreso de "Ventas Caja" acumulando el monto por día
    await addOrUpdateCajaPayment(importe, date, auth.currentUser?.uid);
  } catch (error) {
    if (inventoryConsumed) {
      await addInventoryStock({
        itemName: item,
        units: amount,
        date,
        note: "Rollback por error al guardar venta",
        userId: auth.currentUser?.uid,
      });
    }
    alert(error?.message || "No se pudo guardar la venta");
    return;
  }
  
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
ui.cajaTodayBtn?.addEventListener("click", () => {
  if (ui.cajaFilterPeriod) {
    ui.cajaFilterPeriod.value = "day";
  }
  if (ui.cajaPeriodDate) {
    ui.cajaPeriodDate.value = new Date().toISOString().slice(0, 10);
  }
  populatePeriodSelect("day");
  refreshCajaList();
});
ui.cajaFilterItem?.addEventListener("change", refreshCajaList);

// Función de inicialización de Caja
export async function initializeCaja() {
  if (!ui.cajaView) {
    console.warn("⚠️ cajaView no encontrado");
    return;
  }
  
  console.log("🚀 Inicializando Caja...");
  
  // Configurar período por defecto como día
  if (ui.cajaFilterPeriod) {
    ui.cajaFilterPeriod.value = "day";
  }
  if (ui.cajaPeriodDate) {
    ui.cajaPeriodDate.value = new Date().toISOString().slice(0, 10);
  }
  
  // Popular el selector de períodos
  populatePeriodSelect("day");
  
  // Popular el selector de objetos
  await populateItemFilter();
  
  // Cargar datos
  await refreshCajaList();
  
  console.log("✅ Caja inicializada");
}

export async function initializeInventory() {
  if (!ui.inventoryView) {
    return;
  }

  if (!inventoryInitialized) {
    ui.inventoryRefreshBtn?.addEventListener("click", async () => {
      await refreshInventoryView();
      if (ui.inventoryStatus) {
        ui.inventoryStatus.textContent = "Inventario actualizado";
      }
    });

    ui.inventoryForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const itemName = ui.inventoryProduct?.value?.trim() || "";
      const units = Number(ui.inventoryUnits?.value || 0);
      const date = ui.inventoryDate?.value || new Date().toISOString().slice(0, 10);
      const note = ui.inventoryNote?.value?.trim() || "";

      if (!itemName) {
        if (ui.inventoryStatus) ui.inventoryStatus.textContent = "Introduce un producto";
        return;
      }

      if (!Number.isFinite(units) || units <= 0) {
        if (ui.inventoryStatus) ui.inventoryStatus.textContent = "Las unidades deben ser mayores que 0";
        return;
      }

      if (ui.inventoryStatus) ui.inventoryStatus.textContent = "Guardando entrada...";
      try {
        await addInventoryStock({
          itemName,
          units,
          date,
          note,
          userId: auth.currentUser?.uid,
        });
        ui.inventoryForm.reset();
        if (ui.inventoryDate) {
          ui.inventoryDate.value = new Date().toISOString().slice(0, 10);
        }
        if (ui.inventoryStatus) ui.inventoryStatus.textContent = "Entrada registrada correctamente";
        await refreshInventoryView();
      } catch (error) {
        if (ui.inventoryStatus) {
          ui.inventoryStatus.textContent = error?.message || "Error al registrar entrada";
        }
      }
    });

    inventoryInitialized = true;
  }

  if (ui.inventoryDate && !ui.inventoryDate.value) {
    ui.inventoryDate.value = new Date().toISOString().slice(0, 10);
  }
  await refreshInventoryView();
}
