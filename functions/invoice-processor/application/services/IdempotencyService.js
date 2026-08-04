/**
 * Servicio para garantizar idempotencia en el procesamiento
 * Evita procesar el mismo documento múltiples veces
 */
class IdempotencyService {
  constructor({ processingLogRepository, ttlMinutes = 10080 }) { // 7 días por defecto
    this.processingLogRepository = processingLogRepository;
    this.ttlMinutes = ttlMinutes;
    this.cache = new Map(); // Cache en memoria (opcional)
  }

  /**
   * Verifica si un documento ya fue procesado
   * @param {string} documentId - ID único del documento
   * @returns {Promise<Object|null>} Resultado previo o null
   */
  async check(documentId) {
    // Primero buscar en cache local
    if (this.cache.has(documentId)) {
      return this.cache.get(documentId);
    }

    // Buscar en repositorio
    const result = await this.processingLogRepository.findByDocumentId(documentId);
    
    if (result && result.isSuccessful()) {
      // Guardar en cache
      this.cache.set(documentId, result);
      return result;
    }

    return null;
  }

  /**
   * Almacena el resultado de un procesamiento
   * @param {string} documentId 
   * @param {ProcessingResult} result 
   */
  async store(documentId, result) {
    // Guardar en cache
    this.cache.set(documentId, result);

    // Ya se guardó en el repositorio desde el use case
    // Este método es principalmente para la cache
  }

  /**
   * Limpia la cache local
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Limpia entradas antiguas del cache
   */
  evictOldEntries() {
    // En una implementación real, verificaríamos timestamps
    // Por simplicidad, limitamos el tamaño del cache
    if (this.cache.size > 1000) {
      const iterator = this.cache.keys();
      const toDelete = [];
      for (let i = 0; i < 100; i++) {
        toDelete.push(iterator.next().value);
      }
      toDelete.forEach(key => this.cache.delete(key));
    }
  }
}

module.exports = { IdempotencyService };
