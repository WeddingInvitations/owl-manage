const { IDocumentParser } = require('../../../domain/services');

/**
 * Parser mock para testing
 * Retorna datos ficticios sin llamar a APIs externas
 */
class MockParser extends IDocumentParser {
  async parseInvoice(fileBuffer, metadata) {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      number: `INV-${Date.now()}`,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: null,
      supplierName: 'Proveedor Test',
      supplierTaxId: 'B12345678',
      supplierAddress: 'Calle Test 123',
      items: [
        {
          description: 'Producto Test',
          quantity: 1,
          unitPrice: 100,
          taxRate: 21,
          total: 121,
        }
      ],
      subtotal: 100,
      taxAmount: 21,
      total: 121,
      currency: 'EUR',
      notes: 'Factura de prueba',
      category: 'GENERAL',
    };
  }

  async validateDocumentType(fileBuffer) {
    return true;
  }
}

module.exports = { MockParser };
