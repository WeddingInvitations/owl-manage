const { DomainError } = require('./DomainError');

/**
 * Error de validación de factura
 * Se lanza cuando una factura no cumple las reglas de negocio
 */
class InvoiceValidationError extends DomainError {
  constructor(message, validationErrors = []) {
    super(message, 'INVOICE_VALIDATION_ERROR', { validationErrors });
    this.validationErrors = validationErrors;
  }
}

module.exports = { InvoiceValidationError };
