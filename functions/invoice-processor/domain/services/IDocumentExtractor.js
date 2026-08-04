/**
 * Interfaz para extraer documentos de un origen (Drive, S3, etc.)
 */
class IDocumentExtractor {
  /**
   * Extrae archivos de una carpeta
   * @param {string} folderId - ID de la carpeta
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de archivos
   */
  async extractFromFolder(folderId, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Descarga un archivo específico
   * @param {string} fileId 
   * @returns {Promise<Buffer>} Contenido del archivo
   */
  async downloadFile(fileId) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene metadata de un archivo
   * @param {string} fileId 
   * @returns {Promise<Object>}
   */
  async getFileMetadata(fileId) {
    throw new Error('Method not implemented');
  }
}

module.exports = { IDocumentExtractor };
