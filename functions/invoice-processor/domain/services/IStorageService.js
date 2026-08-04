/**
 * Interfaz para almacenar archivos
 */
class IStorageService {
  /**
   * Sube un archivo
   * @param {Buffer} fileBuffer 
   * @param {string} path 
   * @param {Object} metadata 
   * @returns {Promise<string>} URL o ID del archivo
   */
  async uploadFile(fileBuffer, path, metadata = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Descarga un archivo
   * @param {string} path 
   * @returns {Promise<Buffer>}
   */
  async downloadFile(path) {
    throw new Error('Method not implemented');
  }

  /**
   * Elimina un archivo
   * @param {string} path 
   * @returns {Promise<void>}
   */
  async deleteFile(path) {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene URL pública de un archivo
   * @param {string} path 
   * @returns {Promise<string>}
   */
  async getPublicUrl(path) {
    throw new Error('Method not implemented');
  }
}

module.exports = { IStorageService };
