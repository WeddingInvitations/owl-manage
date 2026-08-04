const { InvoiceValidationError } = require('../errors');

/**
 * Validador de facturas
 * Contiene las reglas de negocio para validar facturas
 */
class InvoiceValidator {
  /**
   * Valida una factura completa
   * @param {Invoice} invoice 
   * @throws {InvoiceValidationError}
   */
  static validate(invoice) {
    const errors = [];

    // Validar número de factura
    if (!invoice.number || invoice.number.trim().length === 0) {
      errors.push({ field: 'number', message: 'El número de factura es obligatorio' });
    }

    // Validar proveedor
    if (!invoice.supplierName || invoice.supplierName.trim().length === 0) {
      errors.push({ field: 'supplierName', message: 'El nombre del proveedor es obligatorio' });
    }

    // Validar fecha
    if (!invoice.issueDate || isNaN(invoice.issueDate.getTime())) {
      errors.push({ field: 'issueDate', message: 'La fecha de emisión es inválida' });
    }

    // Validar que la fecha no sea futura
    if (invoice.issueDate > new Date()) {
      errors.push({ field: 'issueDate', message: 'La fecha de emisión no puede ser futura' });
    }

    // Validar fecha de vencimiento si existe
    if (invoice.dueDate && invoice.dueDate < invoice.issueDate) {
      errors.push({ field: 'dueDate', message: 'La fecha de vencimiento no puede ser anterior a la emisión' });
    }

    // Validar items
    if (!invoice.items || invoice.items.length === 0) {
      errors.push({ field: 'items', message: 'La factura debe tener al menos un item' });
    }

    // Validar total
    if (invoice.total.amount <= 0) {
      errors.push({ field: 'total', message: 'El total debe ser mayor a 0' });
    }

    // Validar coherencia de totales
    if (!invoice.validateTotals()) {
      errors.push({ 
        field: 'totals', 
        message: 'Los totales no coinciden con la suma de los items' 
      });
    }

    if (errors.length > 0) {
      throw new InvoiceValidationError('La factura no es válida', errors);
    }
  }

  /**
   * Valida que una factura no esté duplicada
   * @param {Invoice} invoice 
   * @param {IInvoiceRepository} repository 
   */
  static async validateNotDuplicate(invoice, repository) {
    const existing = await repository.findByNumber(invoice.number);
    if (existing) {
      throw new InvoiceValidationError(
        'Ya existe una factura con ese número',
        [{ field: 'number', message: `Factura ${invoice.number} ya existe` }]
      );
    }
  }

  /**
   * Valida datos extraídos por IA antes de crear entidad
   */
  static validateExtractedData(data) {
    const errors = [];

    if (!data.number) {
      errors.push({ field: 'number', message: 'No se pudo extraer el número de factura' });
    }

    if (!data.supplierName) {
      errors.push({ field: 'supplierName', message: 'No se pudo extraer el proveedor' });
    }

    if (!data.issueDate) {
      errors.push({ field: 'issueDate', message: 'No se pudo extraer la fecha' });
    }

    if (!data.total || data.total <= 0) {
      errors.push({ field: 'total', message: 'No se pudo extraer el total o es inválido' });
    }

    if (!data.items || data.items.length === 0) {
      errors.push({ field: 'items', message: 'No se pudieron extraer items de la factura' });
    }

    if (errors.length > 0) {
      throw new InvoiceValidationError('Los datos extraídos no son válidos', errors);
    }
  }
}

module.exports = { InvoiceValidator };
