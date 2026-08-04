/**
 * Configuración centralizada del módulo
 * Variables de entorno y parámetros del sistema
 */
class Config {
  constructor() {
    // Cargar configuración de producción como fallback
    const prodConfig = this._loadProductionConfig();
    
    // Google Drive
    this.drive = {
      invoicesFolderId: process.env.DRIVE_INVOICES_FOLDER_ID || prodConfig.drive?.invoicesFolderId || '',
      credentials: this._loadDriveCredentials(),
    };

    // Gemini AI
    this.gemini = {
      apiKey: process.env.GEMINI_API_KEY || prodConfig.gemini?.apiKey || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    };

    // Configuración del parser
    this.parser = {
      type: process.env.PARSER_TYPE || prodConfig.parser?.type || 'gemini', // 'gemini' | 'mock'
    };

    // Configuración de idempotencia
    this.idempotency = {
      ttlMinutes: parseInt(process.env.IDEMPOTENCY_TTL_MINUTES) || 10080, // 7 días
    };

    // Configuración de logging
    this.logging = {
      level: process.env.LOG_LEVEL || 'info',
    };

    // Configuración de reintentos
    this.retry = {
      maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
      delayMs: parseInt(process.env.RETRY_DELAY_MS) || 5000,
    };
  }

  _loadDriveCredentials() {
    // Cargar credenciales de service account desde variable de entorno
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (credsJson) {
      try {
        return JSON.parse(credsJson);
      } catch (error) {
        console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY:', error);
      }
    }
    
    // Intentar desde configuración de producción
    const prodConfig = this._loadProductionConfig();
    if (prodConfig.drive?.credentials) {
      return prodConfig.drive.credentials;
    }
    
    // O desde archivo (para desarrollo local)
    try {
      return require('../../../../service-account-key.json');
    } catch (error) {
      console.warn('No se encontraron credenciales de Drive');
      return null;
    }
  }

  _loadProductionConfig() {
    // Cargar configuración de producción si existe
    try {
      return require('./production');
    } catch (error) {
      // No hay problema si no existe, usará valores por defecto
      return {};
    }
  }

  validate() {
    const errors = [];

    if (!this.gemini.apiKey && this.parser.type === 'gemini') {
      errors.push('GEMINI_API_KEY is required when parser type is gemini');
    }

    if (!this.drive.credentials) {
      errors.push('Google Drive credentials not found');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }
  }
}

module.exports = { Config };
