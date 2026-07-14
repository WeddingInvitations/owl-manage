// Módulo de sincronización Excel-WodBuster
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs';

/**
 * Leer archivo Excel/CSV y devolver datos estructurados
 * @param {File} file - Archivo Excel o CSV
 * @returns {Promise<Array>} Array de objetos con los datos
 */
export async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    // Detectar si es CSV por la extensión
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    
    reader.onload = (e) => {
      try {
        let workbook;
        
        if (isCSV) {
          // Para CSV, leer como texto con codificación UTF-8
          const text = e.target.result;
          
          // Configuración específica para CSV con posibles comas en los campos
          workbook = XLSX.read(text, { 
            type: 'string',
            raw: false,
            codepage: 65001, // UTF-8
            FS: ',', // Field separator
            // SheetJS maneja automáticamente campos entre comillas
          });
        } else {
          // Para Excel, leer como array buffer
          const data = new Uint8Array(e.target.result);
          workbook = XLSX.read(data, { 
            type: 'array',
            raw: false
          });
        }
        
        // Leer la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false,
          defval: '',
          blankrows: false // Ignorar filas vacías
        });
        
        console.log(`Datos leídos del ${isCSV ? 'CSV' : 'Excel'}:`, jsonData);
        console.log(`Total de registros: ${jsonData.length}`);
        
        resolve(jsonData);
      } catch (error) {
        reject(new Error(`Error al leer el archivo: ${error.message}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    
    // Leer según el tipo de archivo
    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Normalizar email para comparación
 * @param {string} email - Email a normalizar
 * @returns {string} Email normalizado
 */
function normalizeEmail(email) {
  if (!email) return '';
  return email.toString().toLowerCase().trim();
}

/**
 * Limpiar y normalizar un campo de texto
 * @param {string} text - Texto a limpiar
 * @returns {string} Texto limpio
 */
function cleanTextField(text) {
  if (!text) return '';
  return text.toString().trim().replace(/\s+/g, ' '); // Reemplazar múltiples espacios por uno solo
}

/**
 * Sincronizar usuarios de WodBuster con datos del Excel
 * @param {Array} wodBusterUsers - Usuarios de WodBuster
 * @param {Array} excelData - Datos del Excel
 * @param {Object} columnMapping - Mapeo de columnas del Excel
 * @returns {Object} Resultado de la sincronización
 */
export function syncUsersWithExcel(wodBusterUsers, excelData, columnMapping = {}) {
  // Mapeo por defecto de columnas (puede ser personalizado)
  const mapping = {
    email: columnMapping.email || 'email',
    nombre: columnMapping.nombre || 'nombre',
    apellidos: columnMapping.apellidos || 'apellidos',
    telefono: columnMapping.telefono || 'telefono',
    ...columnMapping
  };
  
  // Crear un mapa del Excel por email para búsqueda rápida
  const excelMap = new Map();
  excelData.forEach((row, index) => {
    try {
      const email = normalizeEmail(row[mapping.email]);
      if (email) {
        excelMap.set(email, row);
      } else {
        console.warn(`Fila ${index + 2} sin email válido, se omitirá`);
      }
    } catch (error) {
      console.warn(`Error procesando fila ${index + 2}:`, error);
    }
  });
  
  console.log(`Total registros válidos en Excel: ${excelMap.size}`);
  
  const syncedUsers = [];
  const unsyncedUsers = [];
  
  wodBusterUsers.forEach(user => {
    const userEmail = normalizeEmail(user.email);
    const excelRow = excelMap.get(userEmail);
    
    if (excelRow) {
      // Usuario encontrado - sincronizar datos
      // Si hay columna de nombre completo, usarla; si no, combinar nombre y apellidos
      let nombreCompleto;
      let nombre;
      let apellidos;
      
      if (excelRow[mapping.nombre] && !mapping.apellidos) {
        // CSV tiene solo "Nombre" con nombre completo
        nombreCompleto = cleanTextField(excelRow[mapping.nombre]);
        // Intentar separar nombre y apellidos
        const partes = nombreCompleto.split(' ').filter(p => p.length > 0);
        if (partes.length > 1) {
          nombre = partes[0];
          apellidos = partes.slice(1).join(' ');
        } else {
          nombre = nombreCompleto;
          apellidos = '';
        }
      } else {
        // Excel tiene columnas separadas
        nombre = cleanTextField(excelRow[mapping.nombre] || user.name || '');
        apellidos = cleanTextField(excelRow[mapping.apellidos] || '');
        nombreCompleto = `${nombre} ${apellidos}`.trim();
      }
      
      const syncedUser = {
        ...user,
        nombreCompleto: nombreCompleto,
        nombre: nombre,
        apellidos: apellidos,
        telefonoExcel: cleanTextField(excelRow[mapping.telefono] || user.telefono || ''),
        sincronizado: true,
        fechaSincronizacion: new Date().toISOString()
      };
      syncedUsers.push(syncedUser);
    } else {
      // Usuario NO encontrado en Excel
      unsyncedUsers.push({
        ...user,
        sincronizado: false,
        motivo: 'Email no encontrado en Excel'
      });
    }
  });
  
  return {
    total: wodBusterUsers.length,
    sincronizados: syncedUsers.length,
    noSincronizados: unsyncedUsers.length,
    usuariosSincronizados: syncedUsers,
    usuariosNoSincronizados: unsyncedUsers,
    porcentajeSincronizacion: wodBusterUsers.length > 0 
      ? ((syncedUsers.length / wodBusterUsers.length) * 100).toFixed(2) 
      : 0
  };
}

/**
 * Generar archivo Excel con el resultado de la sincronización
 * @param {Object} syncResult - Resultado de la sincronización
 * @returns {Blob} Archivo Excel como Blob
 */
export function generateSyncReport(syncResult) {
  const workbook = XLSX.utils.book_new();
  
  // === HOJA 1: RESUMEN ===
  const resumenData = [
    ['RESUMEN DE SINCRONIZACIÓN'],
    [''],
    ['Total usuarios WodBuster', syncResult.total],
    ['Usuarios sincronizados', syncResult.sincronizados],
    ['Usuarios NO sincronizados', syncResult.noSincronizados],
    ['Porcentaje de sincronización', `${syncResult.porcentajeSincronizacion}%`],
    ['Fecha de sincronización', new Date().toLocaleString('es-ES')],
    [''],
    ['DETALLE DE USUARIOS NO SINCRONIZADOS'],
    ['Email', 'Motivo']
  ];
  
  // Añadir usuarios no sincronizados al resumen
  syncResult.usuariosNoSincronizados.forEach(user => {
    resumenData.push([
      user.email || '-',
      user.motivo || 'Desconocido'
    ]);
  });
  
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  
  // Ajustar ancho de columnas
  wsResumen['!cols'] = [
    { wch: 35 },
    { wch: 40 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen');
  
  // === HOJA 2: USUARIOS SINCRONIZADOS ===
  const usuariosData = syncResult.usuariosSincronizados.map(user => ({
    'ID WodBuster': user.id || '-',
    'Email': user.email || '-',
    'Nombre': user.nombre || '-',
    'Apellidos': user.apellidos || '-',
    'Nombre Completo': user.nombreCompleto || '-',
    'Teléfono': user.telefonoExcel || user.telefono || '-',
    'Estado': user.esAlumno ? 'Activo' : 'Inactivo',
    'Pago Hasta': user.pagadoHasta 
      ? new Date(user.pagadoHasta).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : '-',
    'ID Tarifa': user.idTarifa || '-',
    'Fecha Sincronización': new Date(user.fechaSincronizacion).toLocaleString('es-ES')
  }));
  
  const wsUsuarios = XLSX.utils.json_to_sheet(usuariosData);
  
  // Ajustar ancho de columnas
  wsUsuarios['!cols'] = [
    { wch: 12 }, // ID
    { wch: 35 }, // Email
    { wch: 20 }, // Nombre
    { wch: 20 }, // Apellidos
    { wch: 30 }, // Nombre Completo
    { wch: 15 }, // Teléfono
    { wch: 10 }, // Estado
    { wch: 20 }, // Pago Hasta
    { wch: 12 }, // ID Tarifa
    { wch: 20 }  // Fecha Sincronización
  ];
  
  XLSX.utils.book_append_sheet(workbook, wsUsuarios, 'Usuarios Sincronizados');
  
  // === HOJA 3: TODOS LOS USUARIOS (sincronizados + no sincronizados) ===
  const todosUsuariosData = [
    ...syncResult.usuariosSincronizados.map(user => ({
      'ID': user.id || '-',
      'Email': user.email || '-',
      'Nombre': user.nombre || '-',
      'Apellidos': user.apellidos || '-',
      'Teléfono': user.telefonoExcel || user.telefono || '-',
      'Estado': user.esAlumno ? 'Activo' : 'Inactivo',
      'Sincronizado': 'SÍ',
      'Observaciones': ''
    })),
    ...syncResult.usuariosNoSincronizados.map(user => ({
      'ID': user.id || '-',
      'Email': user.email || '-',
      'Nombre': user.name || user.email || '-',
      'Apellidos': '-',
      'Teléfono': user.telefono || '-',
      'Estado': user.esAlumno ? 'Activo' : 'Inactivo',
      'Sincronizado': 'NO',
      'Observaciones': user.motivo || ''
    }))
  ];
  
  const wsTodos = XLSX.utils.json_to_sheet(todosUsuariosData);
  
  wsTodos['!cols'] = [
    { wch: 12 }, // ID
    { wch: 35 }, // Email
    { wch: 20 }, // Nombre
    { wch: 20 }, // Apellidos
    { wch: 15 }, // Teléfono
    { wch: 10 }, // Estado
    { wch: 15 }, // Sincronizado
    { wch: 40 }  // Observaciones
  ];
  
  XLSX.utils.book_append_sheet(workbook, wsTodos, 'Todos los Usuarios');
  
  // Generar archivo Excel
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Descargar el archivo Excel generado
 * @param {Blob} blob - Archivo Excel
 * @param {string} filename - Nombre del archivo
 */
export function downloadExcel(blob, filename = 'sincronizacion_wodbuster.xlsx') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Detectar columnas del Excel automáticamente
 * @param {Array} excelData - Datos del Excel
 * @returns {Object} Mapeo de columnas detectadas
 */
export function detectExcelColumns(excelData) {
  if (!excelData || excelData.length === 0) {
    return null;
  }
  
  const firstRow = excelData[0];
  const columns = Object.keys(firstRow);
  
  const mapping = {};
  
  // Detectar columna de email
  const emailPatterns = ['email', 'correo', 'e-mail', 'mail'];
  mapping.email = columns.find(col => 
    emailPatterns.some(pattern => col.toLowerCase().includes(pattern))
  ) || columns[0];
  
  // Detectar columna de nombre
  const nombrePatterns = ['nombre', 'name', 'first', 'primer'];
  mapping.nombre = columns.find(col => 
    nombrePatterns.some(pattern => col.toLowerCase().includes(pattern))
  );
  
  // Detectar columna de apellidos
  const apellidosPatterns = ['apellido', 'surname', 'last', 'segundo'];
  mapping.apellidos = columns.find(col => 
    apellidosPatterns.some(pattern => col.toLowerCase().includes(pattern))
  );
  
  // Detectar columna de teléfono
  const telefonoPatterns = ['telefono', 'teléfono', 'phone', 'movil', 'móvil', 'celular'];
  mapping.telefono = columns.find(col => 
    telefonoPatterns.some(pattern => col.toLowerCase().includes(pattern))
  );
  
  console.log('Columnas detectadas:', mapping);
  console.log('Columnas disponibles:', columns);
  
  return { mapping, columns };
}
