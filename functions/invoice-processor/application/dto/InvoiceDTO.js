/**
 * DTO para transferir datos de factura
 */
class InvoiceDTO {
  constructor(invoice) {
    this.id = invoice.id;
    this.number = invoice.number;
    this.issueDate = invoice.issueDate.toISOString().split('T')[0];
    this.supplier = invoice.supplierName;
    this.total = invoice.total.amount;
    this.currency = invoice.currency;
    this.status = invoice.status;
  }

  static fromEntity(invoice) {
    return new InvoiceDTO(invoice);
  }

  static fromEntities(invoices) {
    return invoices.map(inv => new InvoiceDTO(inv));
  }
}

module.exports = { InvoiceDTO };
