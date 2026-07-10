import { ui } from "./ui.js";
import { getWodBusterUsers, setWodBusterBaseUrl, setWodBusterApiKey } from "./data.js";

let wodBusterInitialized = false;

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
    nameCell.textContent = user.name || user.email || "-";
    tr.appendChild(nameCell);
    
    // Email (según documentación: email)
    const emailCell = document.createElement("td");
    emailCell.textContent = user.email || "-";
    tr.appendChild(emailCell);
    
    // Teléfono (no disponible en la documentación)
    const phoneCell = document.createElement("td");
    phoneCell.textContent = user.telefono || user.phone || "-";
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
