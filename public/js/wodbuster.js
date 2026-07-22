import { ui, formatCurrency } from "./ui.js";
import { 
  getWodBusterUsers, 
  setWodBusterBaseUrl, 
  setWodBusterApiKey,
  getWodBusterUsersFromDB,
  addWodBusterUser,
  updateWodBusterUser,
  deleteWodBusterUser,
  syncMultipleWodBusterUsers,
  getMonthLabel,
  updateWodBusterUserAPI
} from "./data.js";
import { 
  readExcelFile, 
  syncUsersWithExcel, 
  generateSyncReport, 
  downloadExcel,
  detectExcelColumns 
} from "./syncExcel.js";

let wodBusterInitialized = false;
let currentWodBusterUsers = []; // Almacenar usuarios cargados
let allWodBusterUsers = []; // Todos los usuarios sin filtrar
let lastSyncResult = null; // Para permitir regenerar el reporte
let currentUserId = null; // Usuario actual logueado
let selectedWodBusterMonth = null; // Mes seleccionado para filtrado
let currentEditingUser = null; // Datos originales del usuario en edición
let isSyncing = false; // Flag para prevenir sincronizaciones simultáneas

// Función para establecer el ID del usuario actual
export function setCurrentUserId(userId) {
  currentUserId = userId;
  console.log('WodBuster: Usuario establecido:', userId);
}

// Mapa de precios por tarifa
const tariffPrices = {
  // CrossFit Mensuales - Variantes de WodBuster
  "OPEN": 70,
  "Open Box": 70,
  "OWL 8": 70,
  "OWL 8 mañanas": 63,
  "8/mes": 70,
  "Fundador": 70,
  "SPL": 70,
  "Familiar": 40,
  "OWL 4": 40,
  "4/mes": 40,
  "OWL 6": 50,
  "6/mes": 50,
  "OWL 12": 80,
  "OWL 12 mañanas": 72,
  "12/mes": 80,
  "ilimitada": 100,
  "Ilimitada": 100,
  "Ilimitado": 100,
  "ILIMITADA": 100,
  "ILIMITADO": 100,
  "Ilimitada mañanas": 90,
  "ilimitadas mañanas": 90,
  "Ilimitadas mañanas": 90,
  // Acrobacias
  "Acro 4/mes": 45,
  "Acro 8/mes": 65,
  "Acro Open Mensual": 70,
  "Acro 12/mes": 85,
  "Acro Ilimitado": 105,
  // Halterofilia
  "Halte Pequeña": 30,
  "Halte Grande": 50,
  // Telas
  "Telas 4/mes": 45,
  "Telas 8/mes": 65,
  "Telas 12/mes": 85,
  "Telas Ilimitado": 105,
  // Clases Sueltas
  "Clase Crossfit": 15,
  "Bono 10 Clases Crossfit": 135,
  "Clase Acrobacias": 15,
  "Bono 10 Clases Acrobacias": 135,
  "Clase Telas": 15,
  "Bono 10 Clases Telas": 135,
  "Open Acrobacias 1h": 10,
  "Open Acrobacias 2h": 15
};

// Mapa de puntos disponibles por tarifa (para WodBuster)
const tariffPoints = {
  "OWL 8": 7,
  "OWL 12": 10,
  "Ilimitada": 13,
  "ilimitada": 13,
  "Ilimitado": 13,
  "ILIMITADA": 13,
  "ILIMITADO": 13,
  "OWL 8 mañanas": 7,
  "OWL 12 mañanas": 10,
  "Ilimitada mañanas": 13,
  "ilimitadas mañanas": 13,
  "Ilimitadas mañanas": 13,
  "Familiar": 13,
  "SPL": 13,
  "OWL 4": 7,
  "4/mes": 7,
  "OWL 6": 7,
  "6/mes": 7,
  "OPEN": 13, // Asumido 13 como Ilimitada, ajustar si es diferente
  "Open Box": 13,
  "8/mes": 7,
  "12/mes": 10,
  "Fundador": 13,
};

// Función para obtener el precio de una tarifa
function getTariffPrice(tarifa) {
  if (!tarifa) return null;
  return tariffPrices[tarifa] || null;
}

// Función para obtener los puntos disponibles de una tarifa
function getTariffPoints(tarifa) {
  if (!tarifa) return null;
  return tariffPoints[tarifa] || null;
}

// ========== TABLA DE EQUIVALENCIA ID TARIFA → NOMBRE TARIFA ==========
// Tabla maestra de equivalencia entre idTarifa (WodBuster) y nombre de tarifa
const TARIFF_ID_MAP = {
  1: "OWL 12",
  3: "Ilimitada",
  4: "SPL",
  6: "Familiar",
  7: "OWL 8",
  13: "OPEN",
  14: "OWL 8 mañanas",
  15: "OWL 12 mañanas",
  17: "Ilimitada mañanas",
  18: "OWL 4",
  19: "OWL 6"
};

// Función para obtener el nombre de tarifa basado en el ID
function getTariffNameById(idTarifa) {
  if (idTarifa === null || idTarifa === undefined) return null;
  return TARIFF_ID_MAP[idTarifa] || null;
}

// Función inversa: obtener ID de tarifa basado en el nombre
function getTariffIdByName(tarifaName) {
  if (!tarifaName) return null;
  
  // Buscar coincidencia exacta
  for (const [id, name] of Object.entries(TARIFF_ID_MAP)) {
    if (name === tarifaName) {
      return Number(id);
    }
  }
  
  // Si no hay coincidencia exacta, buscar coincidencia case-insensitive
  const normalizedInput = tarifaName.toLowerCase().trim();
  for (const [id, name] of Object.entries(TARIFF_ID_MAP)) {
    if (name.toLowerCase() === normalizedInput) {
      return Number(id);
    }
  }
  
  return null;
}

// Función para verificar si un usuario está activo
// Un usuario está activo si:
// 1. esAlumno === true
// 2. pagadoHasta es posterior o igual a la fecha actual (a nivel de mes)
function isUserActive(user) {
  // Primera condición: debe ser alumno
  if (user.esAlumno !== true) {
    return false;
  }
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // Segunda condición: si tiene clases sueltas, validar que tenga fecha vigente
  if (user.clasesSueltas && user.clasesSueltas > 0) {
    // Si tiene bono, validar fecha del bono (válido por 7 meses)
    if (user.fechaBono) {
      const bonoDate = new Date(user.fechaBono);
      if (!isNaN(bonoDate.getTime())) {
        bonoDate.setHours(0, 0, 0, 0);
        const bonoExpiry = new Date(bonoDate);
        bonoExpiry.setMonth(bonoExpiry.getMonth() + 7);
        
        if (now <= bonoExpiry) {
          return true; // Bono vigente
        }
      }
    }
    
    // Si tiene pagadoHasta vigente, también está activo
    if (user.pagadoHasta) {
      const pagadoHastaDate = new Date(user.pagadoHasta);
      if (!isNaN(pagadoHastaDate.getTime())) {
        pagadoHastaDate.setHours(0, 0, 0, 0);
        if (pagadoHastaDate >= now) {
          return true; // Fecha de pago vigente
        }
      }
    }
    
    // Tiene clases pero todas las fechas han expirado
    console.log('Usuario con clases sueltas pero fechas expiradas:', user.email, 
                'clasesSueltas:', user.clasesSueltas, 
                'pagadoHasta:', user.pagadoHasta,
                'fechaBono:', user.fechaBono);
    return false;
  }
  
  // Tercera condición: verificar fecha de pago vigente (sin clases sueltas)
  if (!user.pagadoHasta) {
    return false;
  }
  
  const pagadoHastaDate = new Date(user.pagadoHasta);
  
  // Validar que la fecha sea válida
  if (isNaN(pagadoHastaDate.getTime())) {
    console.warn('Fecha pagadoHasta inválida para usuario:', user.email, user.pagadoHasta);
    return false;
  }
  
  pagadoHastaDate.setHours(0, 0, 0, 0);
  
  // Considerar activo si pagadoHasta es >= a la fecha actual (hoy)
  return pagadoHastaDate >= now;
}

// Función para obtener el mes en formato YYYY-MM
function getMonthKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

// Renderizar opciones de selector de mes
function renderWodBusterMonthOptions() {
  if (!ui.wodBusterMonthSelect) return;
  
  const now = new Date();
  const options = [];
  
  // Generar últimos 12 meses
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(getMonthKey(date));
  }
  
  ui.wodBusterMonthSelect.innerHTML = "";
  options.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = getMonthLabel(key);
    ui.wodBusterMonthSelect.appendChild(option);
  });
  
  selectedWodBusterMonth = options[0];
  ui.wodBusterMonthSelect.value = selectedWodBusterMonth;
}

// Renderizar resumen mensual de WodBuster
function renderWodBusterSummary(users) {
  if (!ui.wodBusterSummaryActive || !selectedWodBusterMonth) return;
  
  // Filtrar usuarios activos del mes seleccionado
  const activeUsers = users.filter(user => {
    // Usuario debe estar activo (esAlumno === true)
    if (!user.esAlumno) return false;
    
    // Si tiene pagadoHasta, verificar que sea >= al mes seleccionado
    if (user.pagadoHasta) {
      const pagadoHastaKey = getMonthKey(new Date(user.pagadoHasta));
      return pagadoHastaKey >= selectedWodBusterMonth;
    }
    
    // Si no tiene pagadoHasta pero está activo, incluirlo
    return true;
  });
  
  // Calcular ingresos totales y tarifa media
  let totalIncome = 0;
  let usersWithPrice = 0;
  
  activeUsers.forEach(user => {
    const price = user.precio || getTariffPrice(user.tarifaExcel);
    if (price !== null && price !== undefined) {
      totalIncome += price;
      usersWithPrice++;
    }
  });
  
  const averageTariff = usersWithPrice > 0 ? totalIncome / usersWithPrice : 0;
  
  // Actualizar UI
  ui.wodBusterSummaryActive.textContent = String(activeUsers.length);
  ui.wodBusterSummaryIncome.textContent = formatCurrency(totalIncome);
  ui.wodBusterSummaryAverage.textContent = formatCurrency(averageTariff);
}

// Renderizar lista de usuarios de WodBuster
function renderWodBusterUsers(users) {
  if (!ui.wodBusterUsersList) return;

  ui.wodBusterUsersList.innerHTML = "";
  
  if (!users || users.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="8" class="muted">No se encontraron usuarios.</td>';
    ui.wodBusterUsersList.appendChild(tr);
    return;
  }

  users.forEach((user) => {
    const tr = document.createElement("tr");
    
    // ID (según documentación: id)
    const idCell = document.createElement("td");
    idCell.textContent = user.id || "-";
    tr.appendChild(idCell);
    
    // Nombre (WodBuster no tiene campo name en la respuesta, usar email como referencia)
    const nameCell = document.createElement("td");
    // Priorizar nombreCompleto (si fue sincronizado), luego name, luego email
    const displayName = user.nombreCompleto || user.nombre || user.name || user.email || "-";
    nameCell.textContent = displayName;
    tr.appendChild(nameCell);
    
    // Email (según documentación: email)
    const emailCell = document.createElement("td");
    emailCell.textContent = user.email || "-";
    tr.appendChild(emailCell);
    
    // Tarifa (desde Excel o mapeada desde idTarifa) + indicador de bono
    const tarifaCell = document.createElement("td");
    // Prioridad: tarifaExcel > mapeo desde idTarifa > "-"
    let displayTarifa = user.tarifaExcel || getTariffNameById(user.idTarifa) || "-";
    
    // Si tiene fechaBono y clases disponibles, mostrar info del bono
    if (user.fechaBono && user.clasesSueltas && user.clasesSueltas > 0) {
      const clasesText = `Bono (${user.clasesSueltas} ${user.clasesSueltas === 1 ? 'clase' : 'clases'})`;
      
      // Si tiene tarifa mensual diferente a "Bono...", mostrar ambas
      if (displayTarifa !== "-" && !displayTarifa.toLowerCase().includes('bono')) {
        displayTarifa = `${displayTarifa} + ${clasesText}`;
      } else {
        // Si no tiene tarifa o ya es un bono, mostrar solo el bono con clases
        displayTarifa = clasesText;
      }
    } else if (user.clasesSueltas && user.clasesSueltas > 0) {
      // Tiene clases sueltas pero no fechaBono (clases sueltas sin ser bono)
      const clasesText = `(${user.clasesSueltas} ${user.clasesSueltas === 1 ? 'clase' : 'clases'})`;
      if (displayTarifa !== "-") {
        displayTarifa = `${displayTarifa} ${clasesText}`;
      } else {
        displayTarifa = `Clases sueltas ${clasesText}`;
      }
    }
    
    tarifaCell.textContent = displayTarifa;
    tarifaCell.style.fontSize = "0.9em";
    tr.appendChild(tarifaCell);
    
    // Precio (calculado según la tarifa)
    const priceCell = document.createElement("td");
    // Prioridad: precio guardado > precio desde tarifaExcel > precio desde idTarifa mapeado
    const tarifaName = user.tarifaExcel || getTariffNameById(user.idTarifa);
    const price = user.precio || getTariffPrice(tarifaName);
    if (price !== null && price !== undefined) {
      priceCell.textContent = `${price}€`;
      priceCell.style.fontWeight = "600";
    } else {
      priceCell.textContent = "-";
      priceCell.classList.add("muted");
    }
    tr.appendChild(priceCell);
    
    // Estado (esAlumno + verificación de fecha de pago)
    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    const isActive = isUserActive(user);
    statusBadge.classList.add(isActive ? "success" : "danger");
    statusBadge.textContent = isActive ? "Activo" : "Inactivo";
    statusCell.appendChild(statusBadge);
    tr.appendChild(statusCell);
    
    // Fecha de pago vigente (pagadoHasta solo mes y año)
    const dateCell = document.createElement("td");
    if (user.pagadoHasta) {
      const date = new Date(user.pagadoHasta);
      // Formato: "julio 2026"
      const monthYear = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      dateCell.textContent = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
    } else {
      dateCell.textContent = "-";
    }
    tr.appendChild(dateCell);
    
    // Acciones
    const actionsCell = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "btn ghost small";
    editBtn.textContent = "✏️";
    editBtn.title = "Editar usuario";
    editBtn.onclick = () => openEditUserModal(user);
    actionsCell.appendChild(editBtn);
    tr.appendChild(actionsCell);
    
    ui.wodBusterUsersList.appendChild(tr);
  });

  // Actualizar contador
  if (ui.wodBusterUsersCount) {
    ui.wodBusterUsersCount.textContent = `Total: ${users.length} usuarios`;
  }
}

// Poblar el datalist de tarifas con las tarifas únicas de los usuarios
function populateTariffDatalist() {
  const datalist = document.getElementById('tariffOptions');
  if (!datalist) return;
  
  // Extraer todas las tarifas únicas de los usuarios
  const tariffSet = new Set();
  
  allWodBusterUsers.forEach(user => {
    const tariff = user.tarifaExcel || getTariffNameById(user.idTarifa);
    if (tariff && tariff !== '-') {
      tariffSet.add(tariff);
    }
  });
  
  // Ordenar tarifas alfabéticamente
  const sortedTariffs = Array.from(tariffSet).sort((a, b) => a.localeCompare(b, 'es'));
  
  // Limpiar datalist y agregar opciones
  datalist.innerHTML = '';
  sortedTariffs.forEach(tariff => {
    const option = document.createElement('option');
    option.value = tariff;
    datalist.appendChild(option);
  });
  
  console.log(`Datalist de tarifas poblado con ${sortedTariffs.length} opciones:`, sortedTariffs);
}

// Aplicar filtros a los usuarios de WodBuster
function applyWodBusterFilters() {
  // Obtener valores de los filtros
  const nameFilter = (document.getElementById('filterWodBusterName')?.value || '').toLowerCase().trim();
  const emailFilter = (document.getElementById('filterWodBusterEmail')?.value || '').toLowerCase().trim();
  const tariffFilterRaw = (document.getElementById('filterWodBusterTariff')?.value || '').trim();
  const tariffFilter = tariffFilterRaw.toLowerCase();
  const statusFilter = document.getElementById('filterWodBusterStatus')?.value || 'active';
  
  // Verificar si el valor de tarifa coincide exactamente con una opción del datalist
  let isExactTariffMatch = false;
  let exactTariffValue = '';
  
  if (tariffFilterRaw) {
    const datalist = document.getElementById('tariffOptions');
    if (datalist) {
      const options = Array.from(datalist.options);
      const exactMatch = options.find(option => 
        option.value.toLowerCase() === tariffFilter
      );
      if (exactMatch) {
        isExactTariffMatch = true;
        exactTariffValue = exactMatch.value;
        console.log(`Filtro de tarifa: coincidencia exacta detectada - "${exactTariffValue}"`);
      } else {
        console.log(`Filtro de tarifa: búsqueda parcial - "${tariffFilterRaw}"`);
      }
    }
  }
  
  // Filtrar usuarios
  let filteredUsers = allWodBusterUsers.filter(user => {
    // Filtro por nombre
    if (nameFilter) {
      const userName = (user.nombreCompleto || user.nombre || '').toLowerCase();
      if (!userName.includes(nameFilter)) {
        return false;
      }
    }
    
    // Filtro por email
    if (emailFilter) {
      const userEmail = (user.email || '').toLowerCase();
      if (!userEmail.includes(emailFilter)) {
        return false;
      }
    }
    
    // Filtro por tarifa - exacto o parcial según corresponda
    if (tariffFilter) {
      const userTariff = user.tarifaExcel || '';
      
      if (isExactTariffMatch) {
        // Comparación exacta (case-insensitive)
        if (userTariff !== exactTariffValue) {
          return false;
        }
      } else {
        // Búsqueda parcial (comportamiento original)
        if (!userTariff.toLowerCase().includes(tariffFilter)) {
          return false;
        }
      }
    }
    
    // Filtro por estado (activo/inactivo)
    if (statusFilter === 'active') {
      // Solo mostrar usuarios activos (esAlumno + fecha vigente)
      if (!isUserActive(user)) {
        return false;
      }
    } else if (statusFilter === 'inactive') {
      // Solo mostrar usuarios inactivos
      if (isUserActive(user)) {
        return false;
      }
    }
    // Si statusFilter === 'all', mostrar todos (no filtrar por estado)
    
    return true;
  });
  
  // Actualizar currentWodBusterUsers con los usuarios filtrados
  currentWodBusterUsers = filteredUsers;
  
  // Renderizar usuarios filtrados
  renderWodBusterUsers(filteredUsers);
  
  // Actualizar resumen con usuarios filtrados
  renderWodBusterSummary(filteredUsers);
}

// Refrescar usuarios de WodBuster (desde API y BD)
// Cargar usuarios solo desde Firestore (sin sincronizar con API)
async function refreshWodBusterUsers() {
  if (ui.wodBusterStatus) {
    ui.wodBusterStatus.textContent = "Cargando usuarios desde base de datos local...";
  }

  try {
    console.log('Cargando usuarios desde Firestore...');
    const dbUsers = await getWodBusterUsersFromDB();
    console.log(`Usuarios en Firestore: ${dbUsers.length}`);
    
    // Guardar usuarios
    currentWodBusterUsers = dbUsers;
    allWodBusterUsers = dbUsers;
    
    // Poblar datalist de tarifas
    populateTariffDatalist();
    
    // Aplicar filtros (por defecto muestra solo activos) - esto también actualiza el resumen
    applyWodBusterFilters();
    
    if (ui.wodBusterStatus) {
      ui.wodBusterStatus.textContent = `Última actualización: ${new Date().toLocaleString("es-ES")} - ${dbUsers.length} usuarios (solo BD local)`;
    }
  } catch (error) {
    console.error("Error cargando usuarios desde Firestore:", error);
    
    if (ui.wodBusterUsersList) {
      ui.wodBusterUsersList.innerHTML = `
        <tr>
          <td colspan="9" class="error">
            Error al cargar usuarios: ${error.message}
          </td>
        </tr>
      `;
    }
    
    if (ui.wodBusterStatus) {
      ui.wodBusterStatus.textContent = "Error al cargar usuarios";
    }
  }
}

// Sincronizar con la API de WodBuster
async function syncWithWodBusterAPI() {
  // Prevenir sincronizaciones simultáneas
  if (isSyncing) {
    console.warn('⚠️ Ya hay una sincronización en curso, esperando...');
    alert('Ya hay una sincronización en curso. Por favor, espera a que termine.');
    return;
  }
  
  isSyncing = true;
  
  if (ui.wodBusterStatus) {
    ui.wodBusterStatus.textContent = "Sincronizando con WodBuster API...";
  }

  try {
    // Cargar usuarios desde Firestore
    console.log('📥 Cargando usuarios desde Firestore...');
    const dbUsers = await getWodBusterUsersFromDB();
    console.log(`✅ Usuarios en Firestore: ${dbUsers.length}`);
    
    // Cargar usuarios desde la API de WodBuster
    console.log('☁️ Sincronizando con API WodBuster...');
    const response = await getWodBusterUsers();
    
    console.log('Respuesta completa de WodBuster:', response);
    
    // Verificar si la respuesta tiene error (WodBuster usa EsOk y errorCode)
    if (response && (response.errorCode || response.EsOk === false)) {
      throw new Error(`Error ${response.errorCode || 'desconocido'}: ${response.errorMessage || 'Error desconocido'}`);
    }
    
    // Los datos de usuarios están en response.Data según la documentación
    const allUsersAPI = response.Data || [];
    
    // Calcular el último día del mes actual
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    lastDayOfMonth.setHours(0, 0, 0, 0); // Establecer a medianoche
    
    console.log('Último día del mes actual:', lastDayOfMonth.toISOString());
    
    // Filtrar usuarios activos Y con pago vigente hasta fin de mes
    const activeUsersAPI = allUsersAPI.filter(user => {
      // Debe estar activo
      if (user.esAlumno !== true) return false;
      
      // Debe tener pagadoHasta
      if (!user.pagadoHasta) return false;
      
      // Debe tener una tarifa asignada (idTarifa no null)
      if (user.idTarifa === null || user.idTarifa === undefined) return false;
      
      // Convertir pagadoHasta a Date
      const pagadoHasta = new Date(user.pagadoHasta);
      
      // pagadoHasta debe ser >= último día del mes
      return pagadoHasta >= lastDayOfMonth;
    });
    
    console.log(`Total usuarios API: ${allUsersAPI.length}, Usuarios activos con pago vigente: ${activeUsersAPI.length}`);
    console.log('Nota: Se cargan TODOS los usuarios de la API (activos e inactivos). El filtro por defecto muestra solo activos.');
    
    // Guardar usuarios de la API en Firestore
    console.log('💾 Guardando usuarios de WodBuster en Firestore...');
    const syncResult = await syncMultipleWodBusterUsers(allUsersAPI, currentUserId);
    console.log(`✅ Sincronización con Firestore completada: ${syncResult.created} creados, ${syncResult.updated} actualizados, ${syncResult.errors} errores`);
    
    // NO recargar desde BD - usar los datos que ya tenemos en memoria
    // Los usuarios de dbUsers ya tienen los docId, solo necesitamos combinarlos con los datos actualizados de la API
    console.log('🔄 Combinando usuarios de BD (en memoria) con datos actualizados de API...');
    
    // Combinar usuarios de BD y API (priorizar datos enriquecidos de BD)
    const emailMap = new Map();
    
    // Primero añadir usuarios de BD
    dbUsers.forEach(user => {
      if (user.email) {
        emailMap.set(user.email.toLowerCase(), user);
      }
    });
    
    // Luego actualizar con datos live de la API (sin sobrescribir campos enriquecidos)
    // IMPORTANTE: Usar allUsersAPI (no activeUsersAPI) para incluir TODOS los usuarios
    // El filtrado por activo/inactivo se hace después en applyWodBusterFilters()
    allUsersAPI.forEach(user => {
      if (user.email) {
        const email = user.email.toLowerCase();
        if (!emailMap.has(email)) {
          // Usuario no existe en BD, añadir de API con mapeo automático de tarifa
          const autoMappedTarifa = getTariffNameById(user.idTarifa) || '';
          emailMap.set(email, {
            ...user,
            tarifaExcel: autoMappedTarifa,
            precio: getTariffPrice(autoMappedTarifa)
          });
        } else {
          // Usuario existe en BD, solo actualizar campos live de API
          const existing = emailMap.get(email);
          
          // Si no hay tarifaExcel pero hay idTarifa, mapear automáticamente
          const autoMappedTarifa = existing.tarifaExcel || getTariffNameById(user.idTarifa) || '';
          
          emailMap.set(email, {
            ...user,  // Datos de API (id, esAlumno, pagadoHasta, idTarifa)
            ...existing,  // Datos de BD tienen prioridad
            // Asegurar que campos enriquecidos nunca se sobrescriben
            nombreCompleto: existing.nombreCompleto || user.name || '',
            nombre: existing.nombre || '',
            apellidos: existing.apellidos || '',
            telefono: existing.telefono || existing.telefonoExcel || '',
            telefonoExcel: existing.telefonoExcel || existing.telefono || '',
            tarifaExcel: autoMappedTarifa,
            precio: existing.precio || getTariffPrice(autoMappedTarifa),
            docId: existing.docId  // Preservar docId de BD
          });
        }
      }
    });
    
    // Convertir a array y ordenar por nombre
    const combinedUsers = Array.from(emailMap.values()).sort((a, b) => {
      const nameA = a.nombreCompleto || a.nombre || a.email || '';
      const nameB = b.nombreCompleto || b.nombre || b.email || '';
      return nameA.localeCompare(nameB);
    });
    
    console.log(`Total usuarios combinados: ${combinedUsers.length}`);
    
    // Guardar TODOS los usuarios para el filtrado
    allWodBusterUsers = combinedUsers;
    
    // Crear mapeo detallado de ID Tarifa → Información de tarifa
    // Usar TODOS los usuarios de la API (no solo los combinados) para tener datos completos
    const tarifaMap = new Map();
    
    // Analizar usuarios de la API para obtener el mapeo real
    allUsersAPI.forEach(user => {
      if (user.idTarifa !== null && user.idTarifa !== undefined) {
        if (!tarifaMap.has(user.idTarifa)) {
          tarifaMap.set(user.idTarifa, {
            usuarios: [],
            nombresUnicos: new Set()
          });
        }
        
        const info = tarifaMap.get(user.idTarifa);
        
        // Buscar datos enriquecidos en combinedUsers
        const userEnriquecido = combinedUsers.find(u => u.email === user.email);
        const nombre = userEnriquecido?.tarifaExcel || userEnriquecido?.nombreCompleto || user.email;
        const precio = userEnriquecido?.precio;
        
        info.usuarios.push({
          email: user.email,
          nombre: nombre,
          precio: precio
        });
        
        // Guardar nombres únicos de tarifa
        if (userEnriquecido?.tarifaExcel) {
          info.nombresUnicos.add(userEnriquecido.tarifaExcel);
        }
      }
    });
    
    // Mostrar mapeo detallado en consola ordenado por ID
    if (tarifaMap.size > 0) {
      console.log('═════════════════════════════════════════════════════════════════════════');
      console.log('📊 MAPEO COMPLETO: ID TARIFA → NOMBRE TARIFA → USUARIOS');
      console.log('═════════════════════════════════════════════════════════════════════════');
      
      const sortedEntries = Array.from(tarifaMap.entries()).sort((a, b) => a[0] - b[0]);
      
      sortedEntries.forEach(([idTarifa, info]) => {
        const { usuarios, nombresUnicos } = info;
        const nombresStr = nombresUnicos.size > 0 
          ? Array.from(nombresUnicos).join(' / ')
          : '(sin nombre asignado)';
        
        console.log(`\n🔸 ID ${String(idTarifa).padStart(3, ' ')} → ${nombresStr}`);
        console.log(`   Total usuarios: ${usuarios.length}`);
        
        // Mostrar hasta 3 ejemplos de usuarios
        const ejemplos = usuarios.slice(0, 3);
        ejemplos.forEach((u, idx) => {
          const precioStr = u.precio !== null && u.precio !== undefined 
            ? `${u.precio}€` 
            : '(sin precio)';
          console.log(`   ${idx + 1}. ${u.email} - ${precioStr}`);
        });
        
        if (usuarios.length > 3) {
          console.log(`   ... y ${usuarios.length - 3} usuarios más`);
        }
      });
      
      console.log('\n═════════════════════════════════════════════════════════════════════════');
      console.log(`📈 Total IDs de tarifa únicos: ${tarifaMap.size}`);
      console.log(`📊 Total usuarios analizados: ${allUsersAPI.length}`);
      console.log('═════════════════════════════════════════════════════════════════════════\n');
    }
    
    // Guardar usuarios para sincronización posterior
    currentWodBusterUsers = combinedUsers;
    allWodBusterUsers = combinedUsers;
    
    // Poblar datalist de tarifas con las tarifas únicas
    populateTariffDatalist();
    
    // Aplicar filtros (por defecto muestra solo activos) - esto también actualiza el resumen
    applyWodBusterFilters();
    
    if (ui.wodBusterStatus) {
      ui.wodBusterStatus.textContent = `Última sincronización: ${new Date().toLocaleString("es-ES")} - ${combinedUsers.length} usuarios (BD: ${dbUsers.length}, API: ${allUsersAPI.length}) - ${syncResult.created} nuevos, ${syncResult.updated} actualizados`;
    }
    
    // Mostrar resumen de la sincronización
    if (syncResult.created > 0 || syncResult.updated > 0) {
      alert(`✅ Sincronización completada:\n\n• ${syncResult.created} usuarios nuevos guardados\n• ${syncResult.updated} usuarios actualizados\n• ${syncResult.skipped || 0} usuarios sin cambios\n• ${combinedUsers.length} usuarios totales\n\nLos datos ahora están guardados en la base de datos local.`);
    }
    
  } catch (error) {
    console.error("Error cargando usuarios de WodBuster:", error);
    
    // Si falla la API, intentar cargar solo desde BD
    try {
      console.log('Error en API, cargando solo desde Firestore...');
      const dbUsers = await getWodBusterUsersFromDB();
      currentWodBusterUsers = dbUsers;
      allWodBusterUsers = dbUsers;
      
      // Poblar datalist de tarifas
      populateTariffDatalist();
      
      // Aplicar filtros (por defecto muestra solo activos) - esto también actualiza el resumen
      applyWodBusterFilters();
      
      if (ui.wodBusterStatus) {
        ui.wodBusterStatus.textContent = `Usuarios cargados desde BD local (${dbUsers.length}) - Error en API: ${error.message}`;
      }
    } catch (dbError) {
      console.error("Error cargando desde BD:", dbError);
      
      if (ui.wodBusterUsersList) {
        let errorMessage = error.message;
        
        // Mensaje específico para error 401
        if (error.message.includes('401')) {
          errorMessage = `❌ Error de autenticación (401): La API Key no es válida o el formato de autenticación es incorrecto.
          <br><br><strong>Posibles soluciones:</strong>
          <br>• Verifica que la API Key sea correcta en WodBuster
          <br>• Consulta la documentación de WodBuster para el formato correcto del header de autenticación
          <br>• Contacta al equipo de WodBuster para confirmar el método de autenticación`;
        }
        
        ui.wodBusterUsersList.innerHTML = `
          <tr>
            <td colspan="9" class="error">
              ${errorMessage}
            </td>
          </tr>
        `;
      }
      
      if (ui.wodBusterStatus) {
        ui.wodBusterStatus.textContent = "Error al cargar usuarios";
      }
    }
  } finally {
    // Liberar flag de sincronización
    isSyncing = false;
    console.log('🏁 Sincronización finalizada, flag liberado');
  }
}

// Función para actualizar precios masivamente según tarifas
async function updateAllPrices() {
  console.log('updateAllPrices() llamado');
  console.log('currentUserId:', currentUserId);
  
  if (!confirm('¿Deseas actualizar los precios de todos los usuarios según sus tarifas?\n\nEsto calculará y guardará el precio para cada usuario que tenga una tarifa asignada.')) {
    console.log('Usuario canceló la operación');
    return;
  }
  
  try {
    console.log('Iniciando actualización masiva de precios...');
    
    // Cargar todos los usuarios desde Firestore
    const dbUsers = await getWodBusterUsersFromDB();
    
    if (!dbUsers || dbUsers.length === 0) {
      alert('No hay usuarios en la base de datos para actualizar');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const user of dbUsers) {
      try {
        // Si ya tiene precio, saltar
        if (user.precio !== null && user.precio !== undefined) {
          skippedCount++;
          continue;
        }
        
        // Calcular precio según tarifa
        const tarifa = user.tarifaExcel;
        if (!tarifa) {
          skippedCount++;
          continue;
        }
        
        const precio = getTariffPrice(tarifa);
        if (precio === null || precio === undefined) {
          console.warn(`No se encontró precio para la tarifa: ${tarifa}`);
          skippedCount++;
          continue;
        }
        
        // Actualizar solo el campo precio
        await updateWodBusterUser(user.docId, { 
          ...user,
          precio: precio 
        }, currentUserId);
        
        updatedCount++;
        console.log(`Precio actualizado para ${user.email}: ${tarifa} = ${precio}€`);
        
      } catch (error) {
        errorCount++;
        console.error(`Error actualizando ${user.email}:`, error);
      }
    }
    
    console.log(`Actualización completada: ${updatedCount} actualizados, ${skippedCount} omitidos, ${errorCount} errores`);
    
    alert(`✅ Actualización de precios completada:\n\n• ${updatedCount} usuarios actualizados\n• ${skippedCount} usuarios omitidos (ya tenían precio o sin tarifa)\n• ${errorCount} errores`);
    
    // Refrescar lista
    await refreshWodBusterUsers();
    
  } catch (error) {
    console.error('Error en actualización masiva:', error);
    alert(`Error al actualizar precios: ${error.message}`);
  }
}

// Función para manejar la sincronización con Excel
async function handleExcelSync() {
  // Verificar que hay usuarios cargados
  if (!currentWodBusterUsers || currentWodBusterUsers.length === 0) {
    alert('Primero debes cargar los usuarios de WodBuster usando el botón "Actualizar"');
    return;
  }
  
  // Abrir selector de archivo
  if (ui.excelFileInput) {
    ui.excelFileInput.click();
  }
}

// Guardar usuarios sincronizados en Firestore
async function saveSyncedUsersToFirestore(syncedUsers) {
  let savedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  
  for (const user of syncedUsers) {
    try {
      // Preparar datos para guardar
      const tarifa = user.tarifaExcel || '';
      const precio = user.precio || getTariffPrice(tarifa);
      
      // Calcular idTarifa automáticamente desde el nombre de tarifa del Excel
      // Si no coincide con ningún mapeo, preservar el idTarifa existente del usuario
      const calculatedIdTarifa = getTariffIdByName(tarifa);
      const finalIdTarifa = calculatedIdTarifa !== null ? calculatedIdTarifa : (user.idTarifa || null);
      
      const userData = {
        nombreCompleto: user.nombreCompleto || '',
        nombre: user.nombre || '',
        apellidos: user.apellidos || '',
        email: user.email,
        telefono: user.telefonoExcel || user.telefono || '',
        telefonoExcel: user.telefonoExcel || user.telefono || '',
        tarifaExcel: tarifa,
        precio: precio,
        esAlumno: user.esAlumno !== undefined ? user.esAlumno : true,
        pagadoHasta: user.pagadoHasta || null,
        id: user.id || null, // ID de WodBuster
        idTarifa: finalIdTarifa // ID de tarifa calculado o preservado
      };
      
      // Si el usuario tiene docId (ya está en Firestore), actualizar
      if (user.docId) {
        await updateWodBusterUser(user.docId, userData, currentUserId);
        updatedCount++;
        console.log(`Usuario actualizado en BD: ${user.email}`);
      } else {
        // Si no tiene docId, crear nuevo registro en Firestore
        const newDocId = await addWodBusterUser(userData, currentUserId);
        // Actualizar el usuario en memoria con el nuevo docId
        user.docId = newDocId;
        savedCount++;
        console.log(`Usuario guardado en BD: ${user.email} (ID: ${newDocId})`);
      }
    } catch (error) {
      errorCount++;
      console.error(`Error guardando usuario ${user.email} en BD:`, error);
    }
  }
  
  console.log(`Guardado en Firestore: ${savedCount} nuevos, ${updatedCount} actualizados, ${errorCount} errores`);
  
  if (errorCount > 0) {
    console.warn(`⚠️ ${errorCount} usuarios no se pudieron guardar en la base de datos`);
  }
  
  return { savedCount, updatedCount, errorCount };
}

// Función para procesar el archivo Excel seleccionado
async function processExcelFile(file) {
  if (!file) return;
  
  // Mostrar modal y sección de progreso
  if (ui.syncExcelModal) {
    ui.syncExcelModal.classList.remove("hidden");
  }
  
  if (ui.syncProgressSection) {
    ui.syncProgressSection.style.display = "block";
  }
  
  if (ui.syncResultSection) {
    ui.syncResultSection.style.display = "none";
  }
  
  if (ui.syncDownloadReportBtn) {
    ui.syncDownloadReportBtn.style.display = "none";
  }
  
  try {
    // Actualizar progreso
    const fileType = file.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'Excel';
    updateSyncProgress(`Leyendo archivo ${fileType}...`);
    
    // Leer Excel/CSV
    const excelData = await readExcelFile(file);
    
    if (!excelData || excelData.length === 0) {
      throw new Error('El archivo está vacío o no tiene datos válidos');
    }
    
    updateSyncProgress(`Archivo leído: ${excelData.length} registros encontrados`);
    
    // Detectar columnas automáticamente
    const columnInfo = detectExcelColumns(excelData);
    
    if (!columnInfo) {
      throw new Error('No se pudo detectar la estructura del Excel');
    }
    
    updateSyncProgress('Mapeando usuarios...');
    
    // Sincronizar usuarios
    const syncResult = syncUsersWithExcel(
      currentWodBusterUsers,
      excelData,
      columnInfo.mapping
    );
    
    // Guardar resultado para permitir regenerar el reporte
    lastSyncResult = syncResult;
    
    // Actualizar los usuarios actuales con los datos sincronizados
    currentWodBusterUsers = syncResult.usuariosSincronizados.concat(syncResult.usuariosNoSincronizados);
    allWodBusterUsers = currentWodBusterUsers;
    
    updateSyncProgress('Guardando datos sincronizados en base de datos...');
    
    // Guardar los datos sincronizados en Firestore
    const saveResult = await saveSyncedUsersToFirestore(syncResult.usuariosSincronizados);
    
    updateSyncProgress(`✅ Guardado completado: ${saveResult.savedCount} nuevos, ${saveResult.updatedCount} actualizados`);
    
    if (saveResult.errorCount > 0) {
      updateSyncProgress(`⚠️ ${saveResult.errorCount} usuarios no se pudieron guardar`);
    }
    
    // Recargar usuarios desde BD para tener los datos actualizados
    updateSyncProgress('Recargando usuarios desde base de datos...');
    const dbUsers = await getWodBusterUsersFromDB();
    
    // Combinar con usuarios no sincronizados
    const allUsers = [...dbUsers, ...syncResult.usuariosNoSincronizados];
    currentWodBusterUsers = allUsers;
    allWodBusterUsers = allUsers;
    
    updateSyncProgress('Sincronización completada y guardada en BD');
    
    // Poblar datalist de tarifas con los datos actualizados
    populateTariffDatalist();
    
    // Actualizar la tabla con los nuevos datos - esto también actualiza el resumen
    applyWodBusterFilters();
    
    // Mostrar resultados
    displaySyncResults(syncResult, columnInfo);
    
    // Actualizar estado con información de guardado
    if (ui.wodBusterStatus) {
      ui.wodBusterStatus.textContent = `Sincronización completada: ${syncResult.sincronizados} usuarios sincronizados y guardados en BD - ${new Date().toLocaleString("es-ES")}`;
    }
    
    // Ocultar progreso, mostrar resultados
    if (ui.syncProgressSection) {
      ui.syncProgressSection.style.display = "none";
    }
    
    if (ui.syncResultSection) {
      ui.syncResultSection.style.display = "block";
    }
    
    if (ui.syncDownloadReportBtn) {
      ui.syncDownloadReportBtn.style.display = "inline-block";
    }
    
  } catch (error) {
    console.error('Error en sincronización:', error);
    alert(`Error al procesar el archivo: ${error.message}`);
    
    // Cerrar modal en caso de error
    if (ui.syncExcelModal) {
      ui.syncExcelModal.classList.add("hidden");
    }
  }
}

// Actualizar texto de progreso
function updateSyncProgress(message) {
  if (ui.syncProgressText) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    ui.syncProgressText.innerHTML += `<div>[${timestamp}] ${message}</div>`;
  }
  console.log('Sync progress:', message);
}

// Mostrar resultados de la sincronización
function displaySyncResults(syncResult, columnInfo) {
  // Resumen numérico
  if (ui.syncTotalUsers) {
    ui.syncTotalUsers.textContent = syncResult.total;
  }
  
  if (ui.syncPercentage) {
    ui.syncPercentage.textContent = `${syncResult.porcentajeSincronizacion}%`;
  }
  
  if (ui.syncSyncedUsers) {
    ui.syncSyncedUsers.textContent = syncResult.sincronizados;
  }
  
  if (ui.syncUnsyncedUsers) {
    ui.syncUnsyncedUsers.textContent = syncResult.noSincronizados;
  }
  
  // Mapeo de columnas
  if (ui.syncColumnMapping && columnInfo) {
    const mappingHtml = `
      <div style="background: var(--success-color); color: white; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
        <strong>✅ Datos guardados permanentemente en la base de datos</strong>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">Los nombres, teléfonos y tarifas sincronizados se mostrarán siempre en el apartado de Usuarios WodBuster.</p>
      </div>
      <p style="margin: 0 0 0.5rem 0; font-weight: 600;">Columnas detectadas en el Excel:</p>
      <ul style="margin: 0; padding-left: 1.5rem;">
        <li><strong>Email:</strong> ${columnInfo.mapping.email || 'No detectado'}</li>
        <li><strong>Nombre:</strong> ${columnInfo.mapping.nombre || 'No detectado'}</li>
        <li><strong>Apellidos:</strong> ${columnInfo.mapping.apellidos || 'No detectado'}</li>
        <li><strong>Teléfono:</strong> ${columnInfo.mapping.telefono || 'No detectado'}</li>
        <li><strong>Tarifa:</strong> ${columnInfo.mapping.tarifa || 'No detectado'}</li>
      </ul>
      <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
        Columnas disponibles: ${columnInfo.columns.join(', ')}
      </p>
    `;
    ui.syncColumnMapping.innerHTML = mappingHtml;
  }
  
  // Lista de usuarios no sincronizados
  if (syncResult.noSincronizados > 0 && ui.syncUnsyncedList && ui.syncUnsyncedListItems) {
    ui.syncUnsyncedList.style.display = "block";
    
    ui.syncUnsyncedListItems.innerHTML = syncResult.usuariosNoSincronizados
      .map(user => `<li><strong>${user.email || 'Sin email'}</strong> - ${user.motivo}</li>`)
      .join('');
  } else if (ui.syncUnsyncedList) {
    ui.syncUnsyncedList.style.display = "none";
  }
}

// Descargar reporte Excel
function downloadSyncReport() {
  if (!lastSyncResult) {
    alert('No hay resultados de sincronización para descargar');
    return;
  }
  
  try {
    const reportBlob = generateSyncReport(lastSyncResult);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `sincronizacion_wodbuster_${timestamp}.xlsx`;
    
    downloadExcel(reportBlob, filename);
    
    // Mostrar mensaje de éxito
    if (ui.syncProgressText) {
      ui.syncProgressText.innerHTML += `<div style="color: var(--success-color);">[${new Date().toLocaleTimeString('es-ES')}] ✅ Reporte descargado: ${filename}</div>`;
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    alert(`Error al generar el reporte: ${error.message}`);
  }
}

// ===== FUNCIONES PARA CRUD DE USUARIOS =====

// Abrir modal para añadir nuevo usuario
function openAddUserModal() {
  if (ui.wodBusterUserModal) {
    // Limpiar formulario
    ui.wodBusterUserModalTitle.textContent = "Añadir Usuario WodBuster";
    ui.wodBusterUserDocId.value = "";
    ui.wodBusterUserId.value = "";
    ui.wodBusterUserName.value = "";
    ui.wodBusterUserEmail.value = "";
    ui.wodBusterUserPhone.value = "";
    ui.wodBusterUserTariff.value = "";
    ui.wodBusterUserStatus.value = "true";
    ui.wodBusterUserPaymentDate.value = "";
    
    // Inicializar tipo de alta a "tarifa" por defecto
    const tariffTypeSelect = document.getElementById('wodBusterUserTariffType');
    if (tariffTypeSelect) {
      tariffTypeSelect.value = "tarifa";
    }
    
    // Limpiar campos de clase suelta y bono
    const classTypeEl = document.getElementById('wodBusterUserClassType');
    if (classTypeEl) classTypeEl.value = "Clase Crossfit";
    
    const bonoTypeEl = document.getElementById('wodBusterUserBonoType');
    if (bonoTypeEl) bonoTypeEl.value = "Bono 10 Clases Crossfit";
    
    const bonoDateEl = document.getElementById('wodBusterUserBonoDate');
    if (bonoDateEl) {
      bonoDateEl.value = "";
      bonoDateEl.readOnly = false;
      bonoDateEl.title = "";
    }
    
    // Limpiar info de clases disponibles si existe
    const oldInfo = document.getElementById('clasesDisponiblesInfo');
    if (oldInfo) oldInfo.remove();
    
    // Ocultar botón de eliminar
    ui.wodBusterUserDeleteBtn.style.display = "none";
    
    // Actualizar visibilidad de campos según tipo de alta
    handleTariffTypeChange();
    
    // Mostrar modal
    ui.wodBusterUserModal.classList.remove("hidden");
  }
}

// Abrir modal para editar usuario existente
function openEditUserModal(user) {
  if (ui.wodBusterUserModal) {
    // Guardar datos originales del usuario para el update
    currentEditingUser = user;
    
    // Rellenar formulario con datos del usuario
    ui.wodBusterUserModalTitle.textContent = "Editar Usuario WodBuster";
    ui.wodBusterUserDocId.value = user.docId || "";
    ui.wodBusterUserId.value = user.id || ""; // ID de WodBuster
    ui.wodBusterUserName.value = user.nombreCompleto || user.nombre || "";
    ui.wodBusterUserEmail.value = user.email || "";
    ui.wodBusterUserPhone.value = user.telefonoExcel || user.telefono || "";
    // Mapear automáticamente tarifa desde idTarifa si no hay tarifaExcel
    const displayTarifa = user.tarifaExcel || getTariffNameById(user.idTarifa) || "";
    ui.wodBusterUserTariff.value = displayTarifa;
    ui.wodBusterUserStatus.value = user.esAlumno ? "true" : "false";
    
    // Convertir fecha si existe
    if (user.pagadoHasta) {
      const date = new Date(user.pagadoHasta);
      ui.wodBusterUserPaymentDate.value = date.toISOString().split('T')[0];
    } else {
      ui.wodBusterUserPaymentDate.value = "";
    }
    
    // Inicializar tipo de alta: siempre "tarifa" cuando se edita un usuario existente
    const tariffTypeSelect = document.getElementById('wodBusterUserTariffType');
    if (tariffTypeSelect) {
      tariffTypeSelect.value = "tarifa";
    }
    
    // Si el usuario tiene fechaBono, mostrar en el campo correspondiente (solo informativo)
    const bonoDateEl = document.getElementById('wodBusterUserBonoDate');
    if (bonoDateEl && user.fechaBono) {
      const bonoDate = new Date(user.fechaBono);
      bonoDateEl.value = bonoDate.toISOString().split('T')[0];
      // Hacer el campo readonly para que no se modifique accidentalmente
      bonoDateEl.readOnly = true;
      bonoDateEl.title = `Bono activo desde ${bonoDate.toLocaleDateString('es-ES')}`;
    } else if (bonoDateEl) {
      bonoDateEl.readOnly = false;
      bonoDateEl.title = "";
    }
    
    // Mostrar información sobre clases sueltas si las tiene
    const tariffLabel = document.getElementById('wodBusterUserTariffLabel');
    if (tariffLabel && user.clasesSueltas && user.clasesSueltas > 0) {
      const infoSpan = document.createElement('span');
      infoSpan.style.fontSize = '0.85em';
      infoSpan.style.color = 'var(--success-color)';
      infoSpan.style.marginLeft = '8px';
      infoSpan.textContent = `(${user.clasesSueltas} clases disponibles)`;
      infoSpan.id = 'clasesDisponiblesInfo';
      // Eliminar info anterior si existe
      const oldInfo = document.getElementById('clasesDisponiblesInfo');
      if (oldInfo) oldInfo.remove();
      tariffLabel.appendChild(infoSpan);
    }
    
    // Mostrar botón de eliminar si el usuario tiene docId (está en BD)
    if (user.docId) {
      ui.wodBusterUserDeleteBtn.style.display = "inline-block";
    } else {
      ui.wodBusterUserDeleteBtn.style.display = "none";
    }
    
    // Mostrar botón de eliminar bono si el usuario tiene clases sueltas
    const deleteBonoBtn = document.getElementById('wodBusterUserDeleteBonoBtn');
    if (deleteBonoBtn) {
      if (user.clasesSueltas && user.clasesSueltas > 0) {
        deleteBonoBtn.style.display = "inline-block";
      } else {
        deleteBonoBtn.style.display = "none";
      }
    }
    
    // Actualizar visibilidad de campos según tipo de alta
    handleTariffTypeChange();
    
    // Mostrar modal
    ui.wodBusterUserModal.classList.remove("hidden");
  }
}

// Guardar usuario (crear o actualizar)
async function saveWodBusterUser() {
  try {
    // Validar campos requeridos
    const name = ui.wodBusterUserName.value.trim();
    const email = ui.wodBusterUserEmail.value.trim();
    
    if (!name || !email) {
      alert('Por favor, completa al menos el nombre y el email');
      return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Por favor, introduce un email válido');
      return;
    }
    
    // Obtener tipo de alta
    const tariffTypeEl = document.getElementById('wodBusterUserTariffType');
    const tariffType = tariffTypeEl ? tariffTypeEl.value : 'tarifa';
    
    let tarifa = '';
    let precio = null;
    let clasesSueltasIncrement = 0;
    let fechaBono = null;
    let pagadoHastaOverride = null;
    const isEditingExistingUser = currentEditingUser !== null;
    
    // Procesar según tipo de alta
    if (tariffType === 'clase-suelta') {
      // Clase suelta: añadir 1 a clasesSueltas
      const classTypeEl = document.getElementById('wodBusterUserClassType');
      tarifa = classTypeEl ? classTypeEl.value : 'Clase Crossfit';
      precio = getTariffPrice(tarifa);
      clasesSueltasIncrement = 1;
      console.log('💳 Alta con CLASE SUELTA:', tarifa, '- Incremento:', clasesSueltasIncrement);
    } else if (tariffType === 'bono') {
      // Bono: añadir 10 a clasesSueltas y establecer fechaBono y pagadoHasta
      const bonoTypeEl = document.getElementById('wodBusterUserBonoType');
      const bonoDateEl = document.getElementById('wodBusterUserBonoDate');
      
      // Si está editando usuario existente, mantener su tarifa mensual original
      // Si es alta nueva, usar el tipo de bono como tarifa
      if (isEditingExistingUser && currentEditingUser.tarifaExcel) {
        tarifa = currentEditingUser.tarifaExcel; // Mantener tarifa mensual original
        precio = currentEditingUser.precio || getTariffPrice(tarifa);
        console.log('🔄 Usuario existente - Manteniendo tarifa mensual:', tarifa);
      } else {
        tarifa = bonoTypeEl ? bonoTypeEl.value : 'Bono 10 Clases Crossfit';
        precio = getTariffPrice(tarifa);
      }
      
      clasesSueltasIncrement = 10;
      
      // Validar fecha de bono
      if (!bonoDateEl || !bonoDateEl.value) {
        alert('Por favor, selecciona la fecha de alta del bono');
        return;
      }
      
      // Establecer fechaBono con formato ISO
      const bonoDate = new Date(bonoDateEl.value);
      fechaBono = bonoDate.toISOString().split('.')[0]; // Formato: 2026-05-28T00:00:00
      
      // Calcular pagadoHasta: 7 meses después de la fecha del bono
      const pagadoHastaDate = new Date(bonoDate);
      pagadoHastaDate.setMonth(pagadoHastaDate.getMonth() + 7);
      pagadoHastaOverride = pagadoHastaDate.toISOString();
      
      console.log('🎫 Alta con BONO:', tarifa, '- Incremento:', clasesSueltasIncrement);
      console.log('📅 Fecha Bono:', fechaBono);
      console.log('📅 Pagado Hasta (7 meses):', pagadoHastaOverride);
    } else {
      // Tarifa mensual normal
      tarifa = ui.wodBusterUserTariff.value;
      precio = getTariffPrice(tarifa);
    }
    
    // Calcular idTarifa automáticamente desde el nombre de tarifa
    const calculatedIdTarifa = getTariffIdByName(tarifa);
    
    const userData = {
      nombreCompleto: name,
      email: email,
      telefono: ui.wodBusterUserPhone.value.trim(),
      telefonoExcel: ui.wodBusterUserPhone.value.trim(),
      tarifaExcel: tarifa,
      precio: precio,
      esAlumno: ui.wodBusterUserStatus.value === "true",
      pagadoHasta: pagadoHastaOverride || (ui.wodBusterUserPaymentDate.value ? new Date(ui.wodBusterUserPaymentDate.value).toISOString() : null),
      idTarifa: calculatedIdTarifa !== null ? calculatedIdTarifa : (currentEditingUser?.idTarifa || null),
      clasesSueltas: clasesSueltasIncrement > 0 ? (currentEditingUser?.clasesSueltas || 0) + clasesSueltasIncrement : (currentEditingUser?.clasesSueltas || 0)
    };
    
    // Añadir fechaBono: si se está dando de alta un bono nuevo, usar el nuevo
    // Si no, preservar el fechaBono existente del usuario
    if (fechaBono) {
      userData.fechaBono = fechaBono;
    } else if (currentEditingUser?.fechaBono) {
      // Preservar fechaBono existente si no se está actualizando
      userData.fechaBono = currentEditingUser.fechaBono;
    }
    
    // Separar nombre y apellidos si es posible
    const nameParts = name.split(' ').filter(p => p.length > 0);
    if (nameParts.length > 1) {
      userData.nombre = nameParts[0];
      userData.apellidos = nameParts.slice(1).join(' ');
    } else {
      userData.nombre = name;
      userData.apellidos = '';
    }
    
    const docId = ui.wodBusterUserDocId.value;
    const wodBusterId = ui.wodBusterUserId?.value; // ID del usuario en WodBuster (si existe)
    
    if (docId) {
      // Actualizar usuario existente en Firestore
      await updateWodBusterUser(docId, userData, currentUserId);
      console.log('Usuario actualizado en Firestore:', email);
      
      // Si tiene ID de WodBuster, actualizar también en la API
      if (wodBusterId && currentEditingUser) {
        try {
          console.log('📝 Usuario actual antes de actualizar:', currentEditingUser);
          console.log('📝 Datos del formulario:', userData);
          
          // Enviar todos los campos del usuario original + los modificados
          // Calcular idTarifa automáticamente desde el nombre de tarifa
          const newIdTarifa = getTariffIdByName(userData.tarifaExcel) || currentEditingUser.idTarifa || null;
          
          // Calcular puntos disponibles según la tarifa
          const puntosDisponibles = getTariffPoints(userData.tarifaExcel) || currentEditingUser.puntosDisponibles || 0;
          
          const apiData = {
            id: parseInt(wodBusterId),
            nombre: userData.nombre,
            apellidos: userData.apellidos,
            email: userData.email,
            telefono: userData.telefonoExcel || '',
            // IMPORTANTE: Enviar tarifa Y idTarifa (WodBuster necesita el ID)
            tarifa: userData.tarifaExcel || '',
            idTarifa: newIdTarifa, // ID de tarifa calculado automáticamente desde el nombre
            esAlumno: userData.esAlumno,
            pagadoHasta: userData.pagadoHasta,
            puntosDisponibles: puntosDisponibles, // Puntos según la tarifa
            // Campos que pueden ser requeridos por la API (usar originales si existen)
            clasesSueltas: userData.clasesSueltas || 0,
            // Otros campos que puedan existir en el usuario original
            ...(currentEditingUser.fechaAlta && { fechaAlta: currentEditingUser.fechaAlta }),
            ...(currentEditingUser.observaciones && { observaciones: currentEditingUser.observaciones }),
            ...(userData.fechaBono && { fechaBono: userData.fechaBono }),
          };
          
          console.log('🚀 ENVIANDO A WODBUSTER API:', JSON.stringify(apiData, null, 2));
          console.log(`💎 Puntos asignados: ${puntosDisponibles} (Tarifa: ${userData.tarifaExcel})`);
          const apiResponse = await updateWodBusterUserAPI(apiData);
          
          if (apiResponse && apiResponse.EsOk !== false) {
            console.log('Usuario actualizado en WodBuster API correctamente');
          } else {
            console.warn('La API de WodBuster retornó error:', apiResponse);
            alert('Usuario guardado localmente, pero hubo un problema al actualizar en WodBuster. Revisa la consola.');
          }
        } catch (apiError) {
          console.error('Error actualizando en WodBuster API:', apiError);
          alert('Usuario guardado localmente, pero no se pudo actualizar en WodBuster: ' + apiError.message);
        }
      }
    } else {
      // Crear nuevo usuario en Firestore
      const newDocId = await addWodBusterUser(userData, currentUserId);
      console.log('Usuario creado con ID:', newDocId);
      
      // Nota: Para crear usuarios nuevos en WodBuster API, necesitarías un endpoint /api/users/Create
      // Por ahora solo se guarda localmente
      console.log('Usuario creado solo localmente (no se sincroniza con WodBuster en creación)');
    }
    
    // Cerrar modal
    ui.wodBusterUserModal.classList.add("hidden");
    
    // Limpiar datos de edición
    currentEditingUser = null;
    
    // Refrescar lista
    await refreshWodBusterUsers();
    
    alert('Usuario guardado correctamente');
  } catch (error) {
    console.error('Error guardando usuario:', error);
    alert(`Error al guardar el usuario: ${error.message}`);
  }
}

// Eliminar usuario
async function deleteWodBusterUserConfirm() {
  const docId = ui.wodBusterUserDocId.value;
  const email = ui.wodBusterUserEmail.value;
  
  if (!docId) {
    alert('No se puede eliminar este usuario (no está en la base de datos local)');
    return;
  }
  
  const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar el usuario "${email}"?\n\nEsta acción no se puede deshacer.`);
  
  if (!confirmDelete) return;
  
  try {
    await deleteWodBusterUser(docId);
    console.log('Usuario eliminado:', docId);
    
    // Cerrar modal
    ui.wodBusterUserModal.classList.add("hidden");
    
    // Refrescar lista
    await refreshWodBusterUsers();
    
    alert('Usuario eliminado correctamente');
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    alert(`Error al eliminar el usuario: ${error.message}`);
  }
}

// Eliminar bono de un usuario
async function deleteWodBusterUserBono() {
  const docId = ui.wodBusterUserDocId.value;
  const email = ui.wodBusterUserEmail.value;
  const wodBusterId = ui.wodBusterUserId?.value;
  
  if (!docId) {
    alert('No se puede eliminar el bono de este usuario (no está en la base de datos local)');
    return;
  }
  
  if (!currentEditingUser || !currentEditingUser.clasesSueltas || currentEditingUser.clasesSueltas <= 0) {
    alert('Este usuario no tiene bono activo');
    return;
  }
  
  const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar el bono del usuario "${email}"?\n\nSe eliminarán ${currentEditingUser.clasesSueltas} clases disponibles.\n\nEsta acción no se puede deshacer.`);
  
  if (!confirmDelete) return;
  
  try {
    // Actualizar datos del usuario para eliminar el bono
    const userData = {
      clasesSueltas: 0,
      fechaBono: null,
    };
    
    // Actualizar en Firestore
    await updateWodBusterUser(docId, userData, currentUserId);
    console.log('Bono eliminado del usuario en Firestore:', email);
    
    // Si tiene ID de WodBuster, actualizar también en la API
    if (wodBusterId && currentEditingUser) {
      try {
        // Calcular idTarifa automáticamente desde el nombre de tarifa
        const idTarifa = getTariffIdByName(currentEditingUser.tarifaExcel) || currentEditingUser.idTarifa || null;
        
        // Calcular puntos disponibles según la tarifa
        const puntosDisponibles = getTariffPoints(currentEditingUser.tarifaExcel) || currentEditingUser.puntosDisponibles || 0;
        
        const apiData = {
          id: parseInt(wodBusterId),
          nombre: currentEditingUser.nombre,
          apellidos: currentEditingUser.apellidos,
          email: currentEditingUser.email,
          telefono: currentEditingUser.telefonoExcel || '',
          tarifa: currentEditingUser.tarifaExcel || '',
          idTarifa: idTarifa,
          esAlumno: currentEditingUser.esAlumno,
          pagadoHasta: currentEditingUser.pagadoHasta,
          puntosDisponibles: puntosDisponibles,
          clasesSueltas: 0, // Eliminar clases sueltas
          // Otros campos que puedan existir
          ...(currentEditingUser.fechaAlta && { fechaAlta: currentEditingUser.fechaAlta }),
          ...(currentEditingUser.observaciones && { observaciones: currentEditingUser.observaciones }),
        };
        
        console.log('🗑️ ELIMINANDO BONO EN WODBUSTER API:', JSON.stringify(apiData, null, 2));
        const apiResponse = await updateWodBusterUserAPI(apiData);
        
        if (apiResponse && apiResponse.EsOk !== false) {
          console.log('Bono eliminado en WodBuster API correctamente');
        } else {
          console.warn('La API de WodBuster retornó error:', apiResponse);
          alert('Bono eliminado localmente, pero hubo un problema al actualizar en WodBuster. Revisa la consola.');
        }
      } catch (apiError) {
        console.error('Error eliminando bono en WodBuster API:', apiError);
        alert('Bono eliminado localmente, pero no se pudo actualizar en WodBuster: ' + apiError.message);
      }
    }
    
    // Cerrar modal
    ui.wodBusterUserModal.classList.add("hidden");
    
    // Limpiar datos de edición
    currentEditingUser = null;
    
    // Refrescar lista
    await refreshWodBusterUsers();
    
    alert('Bono eliminado correctamente');
  } catch (error) {
    console.error('Error eliminando bono:', error);
    alert(`Error al eliminar el bono: ${error.message}`);
  }
}

// Manejar cambio de tipo de alta (mensual/clase-suelta/bono)
function handleTariffTypeChange() {
  const tariffTypeSelect = document.getElementById('wodBusterUserTariffType');
  if (!tariffTypeSelect) return;
  
  const selectedType = tariffTypeSelect.value;
  
  // Elementos para clase suelta
  const classTypeLabel = document.getElementById('wodBusterUserClassTypeLabel');
  
  // Elementos para bono
  const bonoTypeLabel = document.getElementById('wodBusterUserBonoTypeLabel');
  const bonoDateLabel = document.getElementById('wodBusterUserBonoDateLabel');
  
  // Elementos para tarifa mensual
  const tariffLabel = document.getElementById('wodBusterUserTariffLabel');
  
  // Mostrar/ocultar secciones según el tipo seleccionado
  if (selectedType === 'clase-suelta') {
    // Mostrar tipo de clase, ocultar bono y tarifa mensual
    if (classTypeLabel) classTypeLabel.style.display = 'block';
    if (bonoTypeLabel) bonoTypeLabel.style.display = 'none';
    if (bonoDateLabel) bonoDateLabel.style.display = 'none';
    if (tariffLabel) tariffLabel.style.display = 'none';
  } else if (selectedType === 'bono') {
    // Mostrar tipo de bono y fecha, ocultar clase suelta y tarifa mensual
    if (classTypeLabel) classTypeLabel.style.display = 'none';
    if (bonoTypeLabel) bonoTypeLabel.style.display = 'block';
    if (bonoDateLabel) bonoDateLabel.style.display = 'block';
    if (tariffLabel) tariffLabel.style.display = 'none';
  } else { // tarifa (mensual)
    // Mostrar tarifa mensual, ocultar clase suelta y bono
    if (classTypeLabel) classTypeLabel.style.display = 'none';
    if (bonoTypeLabel) bonoTypeLabel.style.display = 'none';
    if (bonoDateLabel) bonoDateLabel.style.display = 'none';
    if (tariffLabel) tariffLabel.style.display = 'block';
  }
}

// Inicializar vista de WodBuster
export async function initializeWodBuster() {
  if (!ui.wodBusterView) {
    return;
  }

  if (!wodBusterInitialized) {
    // Event listener para botón de refrescar (sincronizar con WodBuster API)
    if (ui.wodBusterRefreshBtn) {
      ui.wodBusterRefreshBtn.addEventListener("click", async () => {
        await syncWithWodBusterAPI();
      });
    }
    
    // Event listener para botón de añadir usuario
    if (ui.addWodBusterUserBtn) {
      ui.addWodBusterUserBtn.addEventListener("click", () => {
        openAddUserModal();
      });
    }
    
    // Event listeners para filtros
    const filterNameInput = document.getElementById('filterWodBusterName');
    const filterEmailInput = document.getElementById('filterWodBusterEmail');
    const filterTariffInput = document.getElementById('filterWodBusterTariff');
    const filterStatusSelect = document.getElementById('filterWodBusterStatus');
    
    if (filterNameInput) {
      filterNameInput.addEventListener('input', () => {
        applyWodBusterFilters();
      });
    }
    
    if (filterEmailInput) {
      filterEmailInput.addEventListener('input', () => {
        applyWodBusterFilters();
      });
    }
    
    if (filterTariffInput) {
      filterTariffInput.addEventListener('input', () => {
        applyWodBusterFilters();
      });
    }
    
    if (filterStatusSelect) {
      filterStatusSelect.addEventListener('change', () => {
        applyWodBusterFilters();
      });
    }
    
    // Event listeners para modal de usuario
    if (ui.wodBusterUserSaveBtn) {
      ui.wodBusterUserSaveBtn.addEventListener("click", async () => {
        await saveWodBusterUser();
      });
    }
    
    if (ui.wodBusterUserCancelBtn) {
      ui.wodBusterUserCancelBtn.addEventListener("click", () => {
        if (ui.wodBusterUserModal) {
          ui.wodBusterUserModal.classList.add("hidden");
        }
      });
    }
    
    if (ui.wodBusterUserDeleteBtn) {
      ui.wodBusterUserDeleteBtn.addEventListener("click", async () => {
        await deleteWodBusterUserConfirm();
      });
    }
    
    // Event listener para botón de eliminar bono
    const deleteBonoBtn = document.getElementById('wodBusterUserDeleteBonoBtn');
    if (deleteBonoBtn) {
      deleteBonoBtn.addEventListener("click", async () => {
        await deleteWodBusterUserBono();
      });
    }
    
    // Event listener para cambio de tipo de alta
    const tariffTypeSelect = document.getElementById('wodBusterUserTariffType');
    if (tariffTypeSelect) {
      tariffTypeSelect.addEventListener('change', () => {
        handleTariffTypeChange();
      });
      // Inicializar estado al cargar
      handleTariffTypeChange();
    }
    
    // Event listener para botón de sincronizar con Excel
    if (ui.wodBusterSyncExcelBtn) {
      ui.wodBusterSyncExcelBtn.addEventListener("click", () => {
        handleExcelSync();
      });
    }
    
    // Event listener para botón de actualizar precios
    const updatePricesBtn = document.getElementById('wodBusterUpdatePricesBtn');
    console.log('Botón de actualizar precios encontrado:', updatePricesBtn);
    if (updatePricesBtn) {
      console.log('Añadiendo event listener al botón de actualizar precios');
      updatePricesBtn.addEventListener("click", async () => {
        console.log('Click en botón de actualizar precios detectado');
        await updateAllPrices();
      });
    } else {
      console.error('No se encontró el botón wodBusterUpdatePricesBtn');
    }
    
    // Event listener para selector de mes
    if (ui.wodBusterMonthSelect) {
      ui.wodBusterMonthSelect.addEventListener("change", (event) => {
        selectedWodBusterMonth = event.target.value;
        console.log('Mes seleccionado:', selectedWodBusterMonth);
        renderWodBusterSummary(currentWodBusterUsers);
      });
    }
    
    // Event listener para cuando se selecciona un archivo
    if (ui.excelFileInput) {
      ui.excelFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          processExcelFile(file);
        }
        // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
        e.target.value = '';
      });
    }
    
    // Event listener para cerrar modal de sincronización
    if (ui.syncCloseModalBtn) {
      ui.syncCloseModalBtn.addEventListener("click", () => {
        if (ui.syncExcelModal) {
          ui.syncExcelModal.classList.add("hidden");
        }
        // Reset progress text
        if (ui.syncProgressText) {
          ui.syncProgressText.innerHTML = 'Iniciando...';
        }
      });
    }
    
    // Event listener para descargar reporte
    if (ui.syncDownloadReportBtn) {
      ui.syncDownloadReportBtn.addEventListener("click", () => {
        downloadSyncReport();
      });
    }

    // Event listeners para modal de configuración (opcional)
    if (ui.wodBusterConfigCancel) {
      ui.wodBusterConfigCancel.addEventListener("click", () => {
        if (ui.wodBusterConfigModal) {
          ui.wodBusterConfigModal.classList.add("hidden");
        }
      });
    }

    if (ui.wodBusterConfigSave) {
      ui.wodBusterConfigSave.addEventListener("click", () => {
        const baseUrl = ui.wodBusterBaseUrl?.value?.trim();
        const apiKey = ui.wodBusterApiKey?.value?.trim();
        
        if (baseUrl) {
          setWodBusterBaseUrl(baseUrl);
        }
        
        if (apiKey) {
          setWodBusterApiKey(apiKey);
        }
        
        if (ui.wodBusterConfigModal) {
          ui.wodBusterConfigModal.classList.add("hidden");
        }
        
        // Refrescar usuarios con nueva configuración
        refreshWodBusterUsers();
      });
    }

    wodBusterInitialized = true;
    
    // Renderizar selector de mes
    renderWodBusterMonthOptions();
    
    // Cargar usuarios solo la primera vez
    await refreshWodBusterUsers();
  }
}
