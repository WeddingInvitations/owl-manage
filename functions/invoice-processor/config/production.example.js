/**
 * Configuración de producción para el procesador de facturas
 * 
 * INSTRUCCIONES:
 * 1. Copia este archivo como production.js
 * 2. Reemplaza los valores de ejemplo con tus credenciales reales
 * 3. NUNCA subas production.js a Git (está en .gitignore)
 * 
 * IMPORTANTE: Este archivo es solo un template. NO contiene credenciales reales.
 */

module.exports = {
  gemini: {
    apiKey: 'YOUR_GEMINI_API_KEY_HERE'
  },
  drive: {
    invoicesFolderId: 'YOUR_DRIVE_FOLDER_ID_HERE',
    credentials: {
      "type": "service_account",
      "project_id": "your-project-id",
      "private_key_id": "your-private-key-id",
      "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
      "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
      "client_id": "your-client-id",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    }
  },
  parser: {
    type: 'gemini'
  },
  logging: {
    level: 'info'
  }
};
