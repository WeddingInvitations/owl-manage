/**
 * Interfaz para repositorio de documentos
 * Define el contrato que debe cumplir cualquier implementación
 */
class IDocumentRepository {
  /**
   * Guarda un documento
   * @param {Document} document 
   * @returns {Promise<string>} ID del documento guardado
   */
  async save(document) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca un documento por su ID
   * @param {string} id 
   * @returns {Promise<Document|null>}
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca un documento por su DocumentId (idempotency key)
   * @param {DocumentId} documentId 
   * @returns {Promise<Document|null>}
   */
  async findByDocumentId(documentId) {
    throw new Error('Method not implemented');
  }

  /**
   * Lista documentos con filtros
   * @param {Object} filters 
   * @returns {Promise<Document[]>}
   */
  async findAll(filters = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza un documento
   * @param {string} id 
   * @param {Object} updates 
   * @returns {Promise<void>}
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }
}

module.exports = { IDocumentRepository };
