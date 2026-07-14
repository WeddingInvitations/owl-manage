import { ui } from "./ui.js";
import { getWodBusterUsers, setWodBusterBaseUrl, setWodBusterApiKey } from "./data.js";
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

// Renderizar lista de usuarios de WodBuster
function renderWodBusterUsers(users) {
  if (!ui.wodBusterUsersList) return;

  ui.wodBusterUsersList.innerHTML = "";
  
  if (!users || users.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="muted">No se encontraron usuarios.</td>';
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
    
    ui.wodBusterUsersList.appendChild(tr);
  });

  // Actualizar contador
  if (ui.wodBusterUsersCount) {
    ui.wodBusterUsersCount.textContent = `Total: ${users.length} usuarios`;
  }
}

// Refrescar usuarios de WodBuster
async function refreshWodBusterUsers() {
  if (ui.wodBusterStatus) {
    ui.wodBusterStatus.textContent = "Cargando usuarios...";
  }

  try {
    const response = await getWodBusterUsers();
    
    console.log('Respuesta completa de WodBuster:', response);
    
    // Verificar si la respuesta tiene error (WodBuster usa EsOk y errorCode)
    if (response && (response.errorCode || response.EsOk === false)) {
      throw new Error(`Error ${response.errorCode || 'desconocido'}: ${response.errorMessage || 'Error desconocido'}`);
    }
    
    // Los datos de usuarios están en response.Data según la documentación
    const allUsers = response.Data || [];
    
    // Calcular el último día del mes actual
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    lastDayOfMonth.setHours(0, 0, 0, 0); // Establecer a medianoche
    
    console.log('Último día del mes actual:', lastDayOfMonth.toISOString());
    
    // Filtrar usuarios activos Y con pago vigente hasta fin de mes
    const activeUsers = allUsers.filter(user => {
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
    
    console.log(`Total usuarios: ${allUsers.length}, Usuarios activos y con pago vigente: ${activeUsers.length}`);
    
    // Guardar usuarios para sincronización posterior
    currentWodBusterUsers = activeUsers;
    
    renderWodBusterUsers(activeUsers);
    
    if (ui.wodBusterStatus) {
      ui.wodBusterStatus.textContent = `Última actualización: ${new Date().toLocaleString("es-ES")} - ${activeUsers.length} usuarios activos con pago vigente`;
    }
  } catch (error) {
    console.error("Error cargando usuarios de WodBuster:", error);
    
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
          <td colspan="6" class="error">
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
    
    // Actualizar la tabla con los nuevos datos
    renderWodBusterUsers(currentWodBusterUsers);
    
    updateSyncProgress('Sincronización completada');
    
    // Mostrar resultados
    displaySyncResults(syncResult, columnInfo);
    
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
      <p style="margin: 0 0 0.5rem 0; font-weight: 600;">Columnas detectadas en el Excel:</p>
      <ul style="margin: 0; padding-left: 1.5rem;">
        <li><strong>Email:</strong> ${columnInfo.mapping.email || 'No detectado'}</li>
        <li><strong>Nombre:</strong> ${columnInfo.mapping.nombre || 'No detectado'}</li>
        <li><strong>Apellidos:</strong> ${columnInfo.mapping.apellidos || 'No detectado'}</li>
        <li><strong>Teléfono:</strong> ${columnInfo.mapping.telefono || 'No detectado'}</li>
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
    
    // Event listener para botón de sincronizar con Excel
    if (ui.wodBusterSyncExcelBtn) {
      ui.wodBusterSyncExcelBtn.addEventListener("click", () => {
        handleExcelSync();
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
