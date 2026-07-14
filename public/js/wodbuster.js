import { ui } from "./ui.js";
import { 
  getWodBusterUsers, 
  setWodBusterBaseUrl, 
  setWodBusterApiKey,
  getWodBusterUsersFromDB,
  addWodBusterUser,
  updateWodBusterUser,
  deleteWodBusterUser,
  syncMultipleWodBusterUsers
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
let lastSyncResult = null; // Para permitir regenerar el reporte
let currentUserId = null; // Usuario actual logueado

// Mapa de precios por tarifa
const tariffPrices = {
  // CrossFit Mensuales
  "Open Box": 70,
  "8/mes": 70,
  "Fundador": 70,
  "SPL": 70,
  "Familiar": 40,
  "4/mes": 40,
  "6/mes": 50,
  "12/mes": 80,
  "Ilimitado": 100,
  // CrossFit Trimestrales
  "Trimestre 8/mes": 200,
  "Trimestre 12/mes": 230,
  "Trimestre ilimitado": 285,
  // CrossFit Semestrales
  "Semestre 8/mes": 380,
  "Semestre 12/mes": 430,
  "Semestre ilimitado": 540,
  // CrossFit Anuales
  "Anual 8/mes": 715,
  "Anual 12/mes": 815,
  "Anual ilimitado": 1020,
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
  "Open Acrobacias 1h": 10,
  "Open Acrobacias 2h": 15
};

// Función para obtener el precio de una tarifa
function getTariffPrice(tarifa) {
  if (!tarifa) return null;
  return tariffPrices[tarifa] || null;
}

// Renderizar lista de usuarios de WodBuster
function renderWodBusterUsers(users) {
  if (!ui.wodBusterUsersList) return;

  ui.wodBusterUsersList.innerHTML = "";
  
  if (!users || users.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="9" class="muted">No se encontraron usuarios.</td>';
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
    
    // Teléfono (no disponible en la documentación)
    const phoneCell = document.createElement("td");
    // Priorizar telefonoExcel (si fue sincronizado), luego telefono, luego phone
    const displayPhone = user.telefonoExcel || user.telefono || user.phone || "-";
    phoneCell.textContent = displayPhone;
    tr.appendChild(phoneCell);
    
    // Tarifa (desde Excel o WodBuster)
    const tarifaCell = document.createElement("td");
    const displayTarifa = user.tarifaExcel || "-";
    tarifaCell.textContent = displayTarifa;
    tarifaCell.style.fontSize = "0.9em";
    tr.appendChild(tarifaCell);
    
    // Precio (calculado según la tarifa)
    const priceCell = document.createElement("td");
    const price = user.precio || getTariffPrice(user.tarifaExcel);
    if (price !== null && price !== undefined) {
      priceCell.textContent = `${price}€`;
      priceCell.style.fontWeight = "600";
    } else {
      priceCell.textContent = "-";
      priceCell.classList.add("muted");
    }
    tr.appendChild(priceCell);
    
    // Estado (según documentación: esAlumno indica si es alumno activo)
    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    const isActive = user.esAlumno === true;
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

// Refrescar usuarios de WodBuster (desde API y BD)
async function refreshWodBusterUsers() {
  if (ui.wodBusterStatus) {
    ui.wodBusterStatus.textContent = "Cargando usuarios...";
  }

  try {
    // Cargar usuarios desde Firestore
    console.log('Cargando usuarios desde Firestore...');
    const dbUsers = await getWodBusterUsersFromDB();
    console.log(`Usuarios en Firestore: ${dbUsers.length}`);
    
    // Cargar usuarios desde la API de WodBuster
    console.log('Cargando usuarios desde API WodBuster...');
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
    
    // Sincronizar usuarios de la API con Firestore en segundo plano
    if (activeUsersAPI.length > 0) {
      console.log('Sincronizando usuarios de API con Firestore...');
      syncMultipleWodBusterUsers(activeUsersAPI, currentUserId).then(result => {
        console.log(`Sincronización completada: ${result.created} creados, ${result.updated} actualizados, ${result.errors} errores`);
      }).catch(err => {
        console.error('Error en sincronización automática:', err);
      });
    }
    
    // Combinar usuarios de BD y API (priorizar datos enriquecidos de BD)
    const emailMap = new Map();
    
    // Primero añadir usuarios de BD
    dbUsers.forEach(user => {
      if (user.email) {
        emailMap.set(user.email.toLowerCase(), user);
      }
    });
    
    // Luego actualizar con datos live de la API (sin sobrescribir campos enriquecidos)
    activeUsersAPI.forEach(user => {
      if (user.email) {
        const email = user.email.toLowerCase();
        if (!emailMap.has(email)) {
          // Usuario no existe en BD, añadir de API
          emailMap.set(email, user);
        } else {
          // Usuario existe en BD, solo actualizar campos live de API
          const existing = emailMap.get(email);
          emailMap.set(email, {
            ...user,  // Datos de API (id, esAlumno, pagadoHasta, idTarifa)
            ...existing,  // Datos de BD tienen prioridad
            // Asegurar que campos enriquecidos nunca se sobrescriben
            nombreCompleto: existing.nombreCompleto || user.name || '',
            nombre: existing.nombre || '',
            apellidos: existing.apellidos || '',
            telefono: existing.telefono || existing.telefonoExcel || '',
            telefonoExcel: existing.telefonoExcel || existing.telefono || '',
            tarifaExcel: existing.tarifaExcel || '',
            precio: existing.precio || getTariffPrice(existing.tarifaExcel),
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
    
    // Guardar usuarios para sincronización posterior
    currentWodBusterUsers = combinedUsers;
    
    renderWodBusterUsers(combinedUsers);
    
    if (ui.wodBusterStatus) {
      ui.wodBusterStatus.textContent = `Última actualización: ${new Date().toLocaleString("es-ES")} - ${combinedUsers.length} usuarios (BD: ${dbUsers.length}, API: ${activeUsersAPI.length})`;
    }
  } catch (error) {
    console.error("Error cargando usuarios de WodBuster:", error);
    
    // Si falla la API, intentar cargar solo desde BD
    try {
      console.log('Error en API, cargando solo desde Firestore...');
      const dbUsers = await getWodBusterUsersFromDB();
      currentWodBusterUsers = dbUsers;
      renderWodBusterUsers(dbUsers);
      
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
  }
}

// Función para actualizar precios masivamente según tarifas
async function updateAllPrices() {
  if (!confirm('¿Deseas actualizar los precios de todos los usuarios según sus tarifas?\n\nEsto calculará y guardará el precio para cada usuario que tenga una tarifa asignada.')) {
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
        idTarifa: user.idTarifa || null
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
    
    updateSyncProgress('Sincronización completada y guardada en BD');
    
    // Actualizar la tabla con los nuevos datos
    renderWodBusterUsers(allUsers);
    
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
    ui.wodBusterUserName.value = "";
    ui.wodBusterUserEmail.value = "";
    ui.wodBusterUserPhone.value = "";
    ui.wodBusterUserTariff.value = "";
    ui.wodBusterUserStatus.value = "true";
    ui.wodBusterUserPaymentDate.value = "";
    
    // Ocultar botón de eliminar
    ui.wodBusterUserDeleteBtn.style.display = "none";
    
    // Mostrar modal
    ui.wodBusterUserModal.classList.remove("hidden");
  }
}

// Abrir modal para editar usuario existente
function openEditUserModal(user) {
  if (ui.wodBusterUserModal) {
    // Rellenar formulario con datos del usuario
    ui.wodBusterUserModalTitle.textContent = "Editar Usuario WodBuster";
    ui.wodBusterUserDocId.value = user.docId || "";
    ui.wodBusterUserName.value = user.nombreCompleto || user.nombre || "";
    ui.wodBusterUserEmail.value = user.email || "";
    ui.wodBusterUserPhone.value = user.telefonoExcel || user.telefono || "";
    ui.wodBusterUserTariff.value = user.tarifaExcel || "";
    ui.wodBusterUserStatus.value = user.esAlumno ? "true" : "false";
    
    // Convertir fecha si existe
    if (user.pagadoHasta) {
      const date = new Date(user.pagadoHasta);
      ui.wodBusterUserPaymentDate.value = date.toISOString().split('T')[0];
    } else {
      ui.wodBusterUserPaymentDate.value = "";
    }
    
    // Mostrar botón de eliminar si el usuario tiene docId (está en BD)
    if (user.docId) {
      ui.wodBusterUserDeleteBtn.style.display = "inline-block";
    } else {
      ui.wodBusterUserDeleteBtn.style.display = "none";
    }
    
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
    
    // Preparar datos del usuario
    const tarifa = ui.wodBusterUserTariff.value;
    const precio = getTariffPrice(tarifa);
    
    const userData = {
      nombreCompleto: name,
      email: email,
      telefono: ui.wodBusterUserPhone.value.trim(),
      telefonoExcel: ui.wodBusterUserPhone.value.trim(),
      tarifaExcel: tarifa,
      precio: precio,
      esAlumno: ui.wodBusterUserStatus.value === "true",
      pagadoHasta: ui.wodBusterUserPaymentDate.value ? new Date(ui.wodBusterUserPaymentDate.value).toISOString() : null
    };
    
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
    
    if (docId) {
      // Actualizar usuario existente
      await updateWodBusterUser(docId, userData, currentUserId);
      console.log('Usuario actualizado:', email);
    } else {
      // Crear nuevo usuario
      const newDocId = await addWodBusterUser(userData, currentUserId);
      console.log('Usuario creado con ID:', newDocId);
    }
    
    // Cerrar modal
    ui.wodBusterUserModal.classList.add("hidden");
    
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

// Inicializar vista de WodBuster
export async function initializeWodBuster() {
  if (!ui.wodBusterView) {
    return;
  }

  if (!wodBusterInitialized) {
    // Event listener para botón de refrescar
    if (ui.wodBusterRefreshBtn) {
      ui.wodBusterRefreshBtn.addEventListener("click", async () => {
        await refreshWodBusterUsers();
      });
    }
    
    // Event listener para botón de añadir usuario
    if (ui.addWodBusterUserBtn) {
      ui.addWodBusterUserBtn.addEventListener("click", () => {
        openAddUserModal();
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
    
    // Event listener para botón de sincronizar con Excel
    if (ui.wodBusterSyncExcelBtn) {
      ui.wodBusterSyncExcelBtn.addEventListener("click", () => {
        handleExcelSync();
      });
    }
    
    // Event listener para botón de actualizar precios
    const updatePricesBtn = document.getElementById('wodBusterUpdatePricesBtn');
    if (updatePricesBtn) {
      updatePricesBtn.addEventListener("click", async () => {
        await updateAllPrices();
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
  }

  // Cargar usuarios al entrar a la vista
  await refreshWodBusterUsers();
}
