/**
 * Logger estructurado
 * Registra logs en formato JSON para mejor análisis
 */
class Logger {
  constructor(context = 'invoice-processor') {
    this.context = context;
  }

  _log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...data,
    };

    // En producción, esto iría a Cloud Logging
    // Por ahora, console.log formateado
    const consoleMethod = level === 'error' ? console.error : console.log;
    consoleMethod(JSON.stringify(logEntry));

    return logEntry;
  }

  info(message, data = {}) {
    return this._log('info', message, data);
  }

  warn(message, data = {}) {
    return this._log('warn', message, data);
  }

  error(message, data = {}) {
    return this._log('error', message, data);
  }

  debug(message, data = {}) {
    return this._log('debug', message, data);
  }

  /**
   * Crea un logger hijo con contexto adicional
   */
  child(childContext) {
    return new Logger(`${this.context}.${childContext}`);
  }
}

module.exports = { Logger };
