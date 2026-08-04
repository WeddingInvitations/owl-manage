/**
 * Error base del dominio
 * Todos los errores específicos del dominio heredan de esta clase
 */
class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR', metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      timestamp: this.timestamp,
    };
  }
}

module.exports = { DomainError };
