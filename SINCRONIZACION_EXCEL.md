# Sincronización de Usuarios WodBuster con Excel/CSV

## 📋 Descripción

Este módulo permite sincronizar los usuarios activos de WodBuster con un archivo Excel o CSV (BBDD_OWL), mapeando automáticamente los datos de nombre, apellidos y teléfono a partir del email como clave de identificación.

## 📄 Formatos soportados

El sistema acepta los siguientes formatos:
- **Excel**: .xlsx, .xls
- **CSV**: .csv (UTF-8 con codificación especial para caracteres con tildes, ñ, etc.)

## 🚀 Cómo usar

### 1. Preparar el archivo Excel/CSV (BBDD_OWL)

El archivo debe contener al menos las siguientes columnas:
- **Email/Correo**: Email del usuario (obligatorio para el mapeo)
- **Nombre**: Nombre del usuario
- **Apellidos**: Apellidos del usuario  
- **Teléfono/Telefono**: Número de teléfono del usuario

**Formato CSV recomendado:**
```csv
Nombre,Correo,Telefono
Juan Pérez García,juan.perez@example.com,612345678
María López,maria.lopez@example.com,698765432
```

**⚠️ Importante para archivos CSV:**
- Guardar siempre con codificación **UTF-8** para caracteres especiales (ñ, tildes, etc.)
- Si un campo contiene comas, debe estar entre comillas: `"López, María"`
- El sistema limpia automáticamente espacios extras y caracteres problemáticos

**Nota**: El sistema detecta automáticamente las columnas aunque tengan nombres diferentes (ej: "E-mail", "Correo electrónico", "Phone", "Móvil", etc.)

### 2. Cargar usuarios de WodBuster

1. Navega a la vista **"Usuarios WodBuster"** en el menú lateral
2. Haz clic en el botón **"🔄 Actualizar"** para cargar los usuarios activos desde WodBuster
3. Solo se cargarán usuarios que cumplan:
   - ✅ Estado activo (`esAlumno = true`)
   - ✅ Pago vigente hasta fin de mes actual
   - ✅ Tarifa asignada (`idTarifa` no null)

### 3. Sincronizar con Excel

1. Una vez cargados los usuarios, haz clic en **"📊 Sincronizar con Excel"**
2. Selecciona el archivo Excel (BBDD_OWL.xlsx o BBDD_OWL.xls)
3. El sistema procesará automáticamente:
   - 📖 Lectura del archivo Excel
   - 🔍 Detección automática de columnas
   - 🔄 Mapeo de usuarios por email
   - ✅ Sincronización de datos

### 4. Ver resultados

El modal de sincronización mostrará:
- **Resumen numérico**:
  - Total de usuarios WodBuster
  - Usuarios sincronizados ✅
  - Usuarios NO sincronizados ❌
  - Porcentaje de sincronización

- **Mapeo de columnas**: Muestra qué columnas del Excel se detectaron y utilizaron

- **Lista de usuarios NO sincronizados**: Si algún usuario de WodBuster no tiene email coincidente en el Excel

### 5. Descargar informe

Haz clic en **"📥 Descargar Informe Excel"** para obtener un archivo Excel con 3 hojas:

#### Hoja 1: Resumen
- Total de usuarios y estadísticas
- Lista de usuarios NO sincronizados con motivos

#### Hoja 2: Usuarios Sincronizados
Incluye todos los datos combinados de WodBuster y Excel:
- ID WodBuster
- Email
- Nombre
- Apellidos
- Nombre Completo
- Teléfono
- Estado (Activo/Inactivo)
- Pago Hasta
- ID Tarifa
- Fecha de Sincronización

#### Hoja 3: Todos los Usuarios
Lista completa con indicador de sincronización y observaciones.

## 🔧 Características técnicas

### Detección automática de columnas

El sistema detecta automáticamente columnas con estos patrones:

| Campo | Patrones detectados |
|-------|-------------------|
| Email | email, correo, e-mail, mail |
| Nombre | nombre, name, first, primer |
| Apellidos | apellido, surname, last, segundo |
| Teléfono | telefono, teléfono, phone, movil, móvil, celular |

### Normalización de emails

- Los emails se convierten a minúsculas
- Se eliminan espacios en blanco
- Comparación exacta para garantizar precisión

### Actualización en tiempo real

Después de la sincronización, la tabla de usuarios se actualiza automáticamente mostrando:
- Nombre completo sincronizado desde Excel
- Teléfono sincronizado desde Excel
- Datos originales de WodBuster como respaldo

## ⚠️ Consideraciones

1. **Usuarios activos**: Solo se incluyen usuarios de WodBuster que estén activos y con pago vigente
2. **Email como clave**: El email es el único campo usado para identificar usuarios entre WodBuster y Excel
3. **Datos faltantes**: Si un usuario de WodBuster no está en el Excel, se marca como "No sincronizado"
4. **Datos del Excel prioritarios**: Los datos del Excel (nombre, apellidos, teléfono) tienen prioridad sobre los de WodBuster

## 📁 Archivos del módulo

- **`public/js/syncExcel.js`**: Módulo principal de sincronización
  - Lectura de archivos Excel
  - Mapeo y sincronización de usuarios
  - Generación de informes Excel
  
- **`public/js/wodbuster.js`**: Integración con vista de WodBuster
  - Event handlers para sincronización
  - Renderizado de usuarios sincronizados
  - Gestión del modal de resultados

- **`public/index.html`**: Interfaz de usuario
  - Botón de sincronización
  - Modal de progreso y resultados
  - Input de archivo Excel

## 🐛 Solución de problemas

### El botón "Sincronizar con Excel" no funciona
- ✅ Asegúrate de haber cargado primero los usuarios con "🔄 Actualizar"
- ✅ Verifica que haya usuarios activos cargados

### No se detectan las columnas correctamente
- ✅ Verifica que la primera fila del Excel contenga los encabezados
- ✅ Usa nombres de columnas estándar (email, nombre, apellidos, telefono)
- ✅ Revisa el mapeo detectado en el modal de resultados

### Porcentaje de sincronización muy bajo
- ✅ Verifica que los emails en ambos sistemas coincidan exactamente
- ✅ Revisa la lista de usuarios NO sincronizados
- ✅ Comprueba que no haya emails con espacios o caracteres especiales

### Error al leer el archivo Excel
- ✅ Asegúrate de que el archivo sea .xlsx o .xls
- ✅ Verifica que el archivo no esté corrupto
- ✅ Prueba a abrirlo en Excel antes de subirlo

## 📞 Soporte

Si encuentras algún problema, revisa la consola del navegador (F12 > Console) para ver mensajes de error detallados.
