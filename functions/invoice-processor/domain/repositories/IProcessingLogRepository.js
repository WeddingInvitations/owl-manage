/**
 * Interfaz para repositorio de logs de procesamiento
 */
class IProcessingLogRepository {
  /**
   * Guarda un log de procesamiento
   * @param {ProcessingResult} result 
   * @returns {Promise<string>}
   */
  async save(result) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca un log por documentId (para idempotencia)
   * @param {string} documentId 
   * @returns {Promise<ProcessingResult|null>}
   */
  async findByDocumentId(documentId) {
    throw new Error('Method not implemented');
  }

  /**
   * Lista logs con filtros
   * @param {Object} filters 
   * @returns {Promise<ProcessingResult[]>}
   */
  async findAll(filters = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza un log
   * @param {string} id 
   * @param {Object} updates 
   * @returns {Promise<void>}
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }
}

module.exports = { IProcessingLogRepository };
