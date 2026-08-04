# 📄 Invoice Processor - Módulo de Procesamiento Automático de Facturas

Sistema robusto para procesamiento automático de facturas desde Google Drive utilizando IA (Gemini) y Firestore.

## 🏗️ Arquitectura

Este módulo sigue **Clean Architecture** y principios **SOLID**:

```
invoice-processor/
├── domain/              # Lógica de negocio pura (sin dependencias)
│   ├── entities/        # Entidades con lógica de negocio
│   ├── value-objects/   # Objetos inmutables
│   ├── repositories/    # Interfaces de persistencia
│   ├── services/        # Interfaces de servicios externos
│   ├── validators/      # Reglas de negocio
│   └── errors/          # Errores del dominio
│
├── application/         # Casos de uso y orquestación
│   ├── use-cases/       # Lógica de aplicación
│   ├── services/        # Servicios de aplicación (idempotencia)
│   └── dto/             # Objetos de transferencia
│
├── infrastructure/      # Detalles técnicos e implementaciones
│   ├── repositories/    # Implementaciones Firestore
│   ├── adapters/        # Adaptadores a APIs externas
│   ├── external-services/
│   │   ├── document-extractors/  # Google Drive
│   │   └── document-parsers/     # Gemini, OpenAI, etc.
│   ├── config/          # Configuración e inyección
│   └── middleware/      # Logger, ErrorHandler
│
└── presentation/        # Puntos de entrada (Cloud Functions)
    └── functions/       # Firebase Functions
```

## 🚀 Características

✅ **Procesamiento Automático Semanal**: Escanea carpeta de Drive cada semana  
✅ **Procesamiento Manual**: Procesa facturas individuales o carpetas completas  
✅ **Idempotencia**: Evita procesar la misma factura múltiples veces  
✅ **Validación Robusta**: Valida coherencia de totales e información  
✅ **Integración con Gastos**: Guarda automáticamente en la colección `expenses`  
✅ **Extensible**: Fácil cambiar de Gemini a otro LLM  
✅ **Manejo de Errores**: Sistema robusto de clasificación y logging  
✅ **Testing**: Arquitectura preparada para unit, integration y e2e tests  

## 📋 Requisitos Previos

1. **Google Drive API**
   - Service Account con acceso a la carpeta de facturas
   - Archivo JSON de credenciales

2. **Gemini API**
   - API Key de Google AI Studio

3. **Firebase**
   - Firestore configurado
   - Cloud Functions habilitadas

## ⚙️ Configuración

### 1. Credenciales de Google Drive

Descarga el archivo JSON de service account y:

**Opción A: Variable de entorno (Producción)**
```bash
firebase functions:config:set invoice.google_service_account_key="$(cat service-account-key.json)"
```

**Opción B: Archivo local (Desarrollo)**
Coloca `service-account-key.json` en la raíz del proyecto.

### 2. API Key de Gemini

```bash
firebase functions:config:set invoice.gemini_api_key="tu-api-key-aqui"
```

### 3. ID de la Carpeta de Drive

```bash
firebase functions:config:set invoice.drive_invoices_folder_id="ID-DE-TU-CARPETA"
```

Para obtener el ID de la carpeta:
1. Abre la carpeta en Drive
2. Copia el ID de la URL: `https://drive.google.com/drive/folders/[ESTE-ES-EL-ID]`

### 4. Variables de Entorno (.env para desarrollo local)

Crea `.env` en la carpeta `functions/`:

```env
GEMINI_API_KEY=tu-api-key-aqui
DRIVE_INVOICES_FOLDER_ID=id-de-carpeta-drive
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
PARSER_TYPE=gemini
LOG_LEVEL=info
```

### 5. Compartir Carpeta de Drive con Service Account

1. Abre tu service account JSON
2. Copia el valor de `client_email`
3. En Google Drive, comparte la carpeta de facturas con ese email
4. Dale permisos de "Viewer" o "Commenter"

## 📦 Instalación

```bash
cd functions
npm install
```

Esto instalará:
- `googleapis`: Google Drive API
- `@google/generative-ai`: Gemini API

## 🔄 Uso

### Cloud Functions Disponibles

#### 1. `processInvoice` (Callable)
Procesa una factura individual desde Drive.

```javascript
// Desde el frontend
const processInvoice = httpsCallable(functions, 'processInvoice');
const result = await processInvoice({ 
  driveFileId: 'ID-DEL-ARCHIVO-EN-DRIVE' 
});
```

#### 2. `processFolderInvoices` (Callable)
Procesa todas las facturas de una carpeta.

```javascript
const processFolderInvoices = httpsCallable(functions, 'processFolderInvoices');
const result = await processFolderInvoices({ 
  folderId: 'ID-DE-LA-CARPETA' 
});
```

#### 3. `processInvoicesWeekly` (Scheduled)
Se ejecuta automáticamente cada lunes a las 09:00 AM (Madrid).

Configurado en el código:
```javascript
.schedule('every monday 09:00')
.timeZone('Europe/Madrid')
```

#### 4. `getInvoicesByPeriod` (Callable)
Consulta facturas de un periodo.

```javascript
const getInvoicesByPeriod = httpsCallable(functions, 'getInvoicesByPeriod');
const result = await getInvoicesByPeriod({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  supplier: 'Nombre Proveedor', // opcional
  status: 'PROCESSED' // opcional
});
```

## 🗄️ Colecciones de Firestore

### `invoices`
Almacena facturas procesadas con toda la información extraída.

```javascript
{
  documentId: "hash-unico-del-archivo",
  number: "FAC-2024-001",
  issueDate: "2024-01-15",
  supplierName: "Proveedor S.L.",
  supplierTaxId: "B12345678",
  items: [...],
  subtotal: 100,
  taxAmount: 21,
  total: 121,
  currency: "EUR",
  driveFileId: "...",
  status: "PROCESSED",
  createdAt: timestamp
}
```

### `expenses`
Se integra con la colección existente, añadiendo información de factura.

```javascript
{
  concept: "Factura FAC-2024-001 - Proveedor S.L.",
  amount: 121,
  date: "2024-01-15",
  invoiceNumber: "FAC-2024-001",
  supplier: "Proveedor S.L.",
  processedByAI: true,
  invoiceData: { subtotal, taxAmount, items... },
  createdAt: timestamp,
  createdBy: userId
}
```

### `documents`
Registro de todos los documentos procesados.

### `processing_logs`
Logs de procesamiento para auditoría e idempotencia.

## 🔧 Cambiar de LLM (Gemini → OpenAI u otros)

La arquitectura permite cambiar fácilmente de proveedor de IA:

1. **Crear nuevo parser**:
```javascript
// infrastructure/external-services/document-parsers/OpenAIInvoiceParser.js
class OpenAIInvoiceParser extends IDocumentParser {
  async parseInvoice(fileBuffer, metadata) {
    // Implementación con OpenAI
  }
}
```

2. **Registrar en ServiceFactory**:
```javascript
createDocumentParser() {
  switch (this.config.parser.type) {
    case 'gemini': return new GeminiInvoiceParser(...);
    case 'openai': return new OpenAIInvoiceParser(...);
    case 'claude': return new ClaudeInvoiceParser(...);
  }
}
```

3. **Configurar**:
```bash
firebase functions:config:set invoice.parser_type="openai"
```

## 🧪 Testing

```bash
# Unit tests
npm test

# Con coverage
npm run test:coverage
```

Usar `MockParser` para tests sin consumir API:
```javascript
// En config
PARSER_TYPE=mock
```

## 📊 Logging

Los logs son estructurados en JSON:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "context": "invoice-processor",
  "operation": "process-new-invoice",
  "message": "Factura procesada exitosamente",
  "invoiceId": "...",
  "duration": 1234
}
```

## 🚨 Manejo de Errores

Errores clasificados y manejados centralizadamente:

- `InvoiceValidationError`: Datos extraídos inválidos
- `ExtractionError`: Error descargando de Drive
- `ParsingError`: Error procesando con IA
- `StorageError`: Error almacenando archivos

## 🔐 Seguridad

- ✅ Solo usuarios con rol `OWNER` pueden procesar facturas
- ✅ Autenticación requerida en todas las funciones
- ✅ Reglas de Firestore configuradas
- ✅ Service Account con permisos mínimos necesarios

## 📈 Monitoreo

Ver logs en Firebase Console:
```
https://console.firebase.google.com/project/TU-PROYECTO/functions/logs
```

Filtrar por función:
```
resource.labels.function_name="processInvoice"
```

## 🔄 Flujo Completo

1. **Trigger**: Archivo subido a Drive o cron semanal
2. **Extracción**: Descarga archivo de Drive
3. **Idempotencia**: Verifica si ya fue procesado
4. **Parseo**: Gemini extrae datos estructurados
5. **Validación**: Valida coherencia de totales
6. **Persistencia**: Guarda en `invoices` y `expenses`
7. **Logging**: Registra resultado en `processing_logs`

## 🆘 Solución de Problemas

### Error: "Google Drive credentials not found"
- Verifica que el service account JSON esté configurado
- Comprueba que la variable de entorno esté correcta

### Error: "GEMINI_API_KEY is required"
- Configura el API key de Gemini
- Verifica que esté en las variables de entorno

### Las facturas no se procesan automáticamente
- Verifica que la función scheduled esté desplegada
- Revisa los logs de la función `processInvoicesWeekly`
- Comprueba que `DRIVE_INVOICES_FOLDER_ID` esté configurado

### Error: "Permission denied" al acceder a Drive
- Verifica que la carpeta esté compartida con el service account
- Comprueba el email en `client_email` del JSON

## 📝 Licencia

Uso interno - OwlManage

## 👥 Soporte

Para dudas o problemas, contactar al equipo de desarrollo.
