const { Money } = require('../value-objects/Money');
const { DocumentId } = require('../value-objects/DocumentId');
const { InvoiceItem } = require('./InvoiceItem');

/**
 * Entidad principal: Factura
 * Contiene la lógica de negocio de una factura
 */
class Invoice {
  constructor({
    id = null,
    documentId,
    number,
    issueDate,
    dueDate = null,
    supplierName,
    supplierTaxId = null,
    supplierAddress = null,
    items = [],
    subtotal,
    taxAmount,
    total,
    currency = 'EUR',
    notes = null,
    category = 'GENERAL',
    status = 'PENDING',
    driveFileId = null,
    driveFileName = null,
    createdAt = null,
    processedAt = null,
  }) {
    this.id = id;
    this.documentId = documentId instanceof DocumentId ? documentId : DocumentId.fromString(documentId);
    this.number = number;
    this.issueDate = issueDate instanceof Date ? issueDate : new Date(issueDate);
    this.dueDate = dueDate ? (dueDate instanceof Date ? dueDate : new Date(dueDate)) : null;
    this.supplierName = supplierName;
    this.supplierTaxId = supplierTaxId;
    this.supplierAddress = supplierAddress;
    this.items = items.map(item => item instanceof InvoiceItem ? item : new InvoiceItem(item));
    this.subtotal = subtotal instanceof Money ? subtotal : new Money(subtotal, currency);
    this.taxAmount = taxAmount instanceof Money ? taxAmount : new Money(taxAmount, currency);
    this.total = total instanceof Money ? total : new Money(total, currency);
    this.currency = currency;
    this.notes = notes;
    this.category = category;
    this.status = status;
    this.driveFileId = driveFileId;
    this.driveFileName = driveFileName;
    this.createdAt = createdAt || new Date();
    this.processedAt = processedAt;
  }

  /**
   * Marca la factura como procesada
   */
  markAsProcessed() {
    this.status = 'PROCESSED';
    this.processedAt = new Date();
  }

  /**
   * Calcula el total validando la coherencia
   */
  calculateTotal() {
    const calculatedSubtotal = this.items.reduce(
      (sum, item) => sum.add(item.calculateSubtotal()),
      new Money(0, this.currency)
    );

    const calculatedTax = this.items.reduce(
      (sum, item) => sum.add(item.calculateTax()),
      new Money(0, this.currency)
    );

    return {
      subtotal: calculatedSubtotal,
      taxAmount: calculatedTax,
      total: calculatedSubtotal.add(calculatedTax),
    };
  }

  /**
   * Valida la coherencia de los totales
   */
  validateTotals() {
    const calculated = this.calculateTotal();
    const subtotalMatch = Math.abs(calculated.subtotal.amount - this.subtotal.amount) < 0.01;
    const taxMatch = Math.abs(calculated.taxAmount.amount - this.taxAmount.amount) < 0.01;
    const totalMatch = Math.abs(calculated.total.amount - this.total.amount) < 0.01;

    return subtotalMatch && taxMatch && totalMatch;
  }

  /**
   * Convierte la factura a formato para gastos (expenses)
   */
  toExpenseFormat() {
    return {
      concept: `Factura ${this.number} - ${this.supplierName}`,
      amount: this.total.amount,
      date: this.issueDate.toISOString().split('T')[0], // YYYY-MM-DD
      invoiceNumber: this.number,
      supplier: this.supplierName,
      supplierTaxId: this.supplierTaxId,
      category: this.category,
      notes: this.notes,
      driveFileId: this.driveFileId,
      driveFileName: this.driveFileName,
      processedByAI: true,
      invoiceData: {
        subtotal: this.subtotal.amount,
        taxAmount: this.taxAmount.amount,
        total: this.total.amount,
        currency: this.currency,
        items: this.items.map(item => item.toJSON()),
      },
    };
  }

  toJSON() {
    return {
      id: this.id,
      documentId: this.documentId.value,
      number: this.number,
      issueDate: this.issueDate.toISOString(),
      dueDate: this.dueDate ? this.dueDate.toISOString() : null,
      supplierName: this.supplierName,
      supplierTaxId: this.supplierTaxId,
      supplierAddress: this.supplierAddress,
      items: this.items.map(item => item.toJSON()),
      subtotal: this.subtotal.toJSON(),
      taxAmount: this.taxAmount.toJSON(),
      total: this.total.toJSON(),
      currency: this.currency,
      notes: this.notes,
      category: this.category,
      status: this.status,
      driveFileId: this.driveFileId,
      driveFileName: this.driveFileName,
      createdAt: this.createdAt.toISOString(),
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
    };
  }

  static fromJSON(json) {
    return new Invoice({
      id: json.id,
      documentId: json.documentId,
      number: json.number,
      issueDate: json.issueDate,
      dueDate: json.dueDate,
      supplierName: json.supplierName,
      supplierTaxId: json.supplierTaxId,
      supplierAddress: json.supplierAddress,
      items: json.items.map(item => InvoiceItem.fromJSON(item)),
      subtotal: json.subtotal.amount,
      taxAmount: json.taxAmount.amount,
      total: json.total.amount,
      currency: json.currency,
      notes: json.notes,
      category: json.category,
      status: json.status,
      driveFileId: json.driveFileId,
      driveFileName: json.driveFileName,
      createdAt: json.createdAt,
      processedAt: json.processedAt,
    });
  }
}

module.exports = { Invoice };
