const { IDocumentParser } = require('../../../domain/services');
const { ParsingError } = require('../../../domain/errors');

/**
 * Parser de facturas usando Gemini
 */
class GeminiInvoiceParser extends IDocumentParser {
  constructor(geminiAdapter, logger) {
    super();
    this.gemini = geminiAdapter;
    this.logger = logger;
  }

  async parseInvoice(fileBuffer, metadata) {
    try {
      this.logger.info('Parseando factura con Gemini', { 
        filename: metadata.name,
        mimeType: metadata.mimeType 
      });

      const schema = {
        number: 'string - Número de factura',
        issueDate: 'string - Fecha de emisión (YYYY-MM-DD)',
        dueDate: 'string|null - Fecha de vencimiento (YYYY-MM-DD) o null',
        supplierName: 'string - Nombre del proveedor',
        supplierTaxId: 'string|null - NIF/CIF del proveedor',
        supplierAddress: 'string|null - Dirección del proveedor',
        items: [
          {
            description: 'string - Descripción del item',
            quantity: 'number - Cantidad',
            unitPrice: 'number - Precio unitario',
            taxRate: 'number - % de IVA (ej: 21)',
            total: 'number - Total del item',
          }
        ],
        subtotal: 'number - Subtotal sin IVA',
        taxAmount: 'number - Monto total de IVA',
        total: 'number - Total con IVA',
        currency: 'string - Moneda (EUR, USD, etc)',
        notes: 'string|null - Notas o comentarios',
        category: 'string - Categoría (GENERAL, SERVICIOS, MATERIAL, ALQUILER, etc)',
      };

      const extractedData = await this.gemini.extractJSON(
        fileBuffer,
        metadata.mimeType,
        schema
      );

      this.logger.info('Factura parseada exitosamente', {
        filename: metadata.name,
        invoiceNumber: extractedData.number,
      });

      // Validar y normalizar datos
      return this._normalizeData(extractedData);

    } catch (error) {
      this.logger.error('Error parseando factura', {
        filename: metadata.name,
        error: error.message,
        stack: error.stack,
        errorType: error.constructor.name,
      });
      throw new ParsingError(
        `Error parseando factura: ${error.message}`,
        { filename: metadata.name, originalError: error.message }
      );
    }
  }

  async validateDocumentType(fileBuffer) {
    try {
      const prompt = `¿Este documento es una factura? Responde solo con "SI" o "NO".`;
      const response = await this.gemini.processText('', prompt);
      return response.trim().toUpperCase().includes('SI');
    } catch (error) {
      this.logger.error('Error validando tipo de documento', { error: error.message });
      return false;
    }
  }

  _normalizeData(data) {
    return {
      number: String(data.number).trim(),
      issueDate: data.issueDate,
      dueDate: data.dueDate || null,
      supplierName: String(data.supplierName).trim(),
      supplierTaxId: data.supplierTaxId ? String(data.supplierTaxId).trim() : null,
      supplierAddress: data.supplierAddress || null,
      items: data.items.map(item => ({
        description: String(item.description).trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        total: Number(item.total),
      })),
      subtotal: Number(data.subtotal),
      taxAmount: Number(data.taxAmount),
      total: Number(data.total),
      currency: (data.currency || 'EUR').toUpperCase(),
      notes: data.notes || null,
      category: (data.category || 'GENERAL').toUpperCase(),
    };
  }
}

module.exports = { GeminiInvoiceParser };
