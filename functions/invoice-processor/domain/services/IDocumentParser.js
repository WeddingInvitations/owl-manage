/**
 * Interfaz para parsear documentos con IA
 */
class IDocumentParser {
  /**
   * Parsea una factura
   * @param {Buffer} fileBuffer - Contenido del archivo
   * @param {Object} metadata - Metadata del archivo
   * @returns {Promise<Object>} Datos extraídos de la factura
   */
  async parseInvoice(fileBuffer, metadata) {
    throw new Error('Method not implemented');
  }

  /**
   * Valida que el documento es del tipo esperado
   * @param {Buffer} fileBuffer 
   * @returns {Promise<boolean>}
   */
  async validateDocumentType(fileBuffer) {
    throw new Error('Method not implemented');
  }
}

module.exports = { IDocumentParser };
