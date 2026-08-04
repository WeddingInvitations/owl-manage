/**
 * Caso de uso: Reintentar procesamiento fallido
 */
class RetryFailedProcessing {
  constructor({
    processingLogRepository,
    processNewInvoice,
    logger,
  }) {
    this.processingLogRepository = processingLogRepository;
    this.processNewInvoice = processNewInvoice;
    this.logger = logger;
  }

  /**
   * Ejecuta el reintento
   * @param {string} documentId 
   * @param {string} userId 
   */
  async execute({ documentId, userId }) {
    const context = { documentId, operation: 'retry-processing' };
    
    this.logger.info('Reintentando procesamiento', context);

    // Obtener el log de procesamiento fallido
    const log = await this.processingLogRepository.findByDocumentId(documentId);
    
    if (!log) {
      throw new Error(`No se encontró log de procesamiento para ${documentId}`);
    }

    if (!log.canRetry()) {
      throw new Error('No se puede reintentar este procesamiento');
    }

    // Incrementar contador de intentos
    log.incrementAttempt();
    await this.processingLogRepository.update(log.id, {
      attemptCount: log.attemptCount,
      lastAttemptAt: log.lastAttemptAt,
    });

    // Reintentar procesamiento
    try {
      const result = await this.processNewInvoice.execute({
        driveFileId: log.metadata.driveFileId,
        userId,
      });

      this.logger.info('Reintento exitoso', context);
      return result;
    } catch (error) {
      this.logger.error('Reintento fallido', { ...context, error: error.message });
      throw error;
    }
  }
}

module.exports = { RetryFailedProcessing };
