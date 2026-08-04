/**
 * Caso de uso: Procesar múltiples facturas de una carpeta
 */
class ProcessInvoicesFromFolder {
  constructor({
    documentExtractor,
    processNewInvoice,
    logger,
  }) {
    this.documentExtractor = documentExtractor;
    this.processNewInvoice = processNewInvoice;
    this.logger = logger;
  }

  /**
   * Procesa todas las facturas de una carpeta
   * @param {Object} params - { folderId, userId }
   */
  async execute({ folderId, userId }) {
    const context = { folderId, operation: 'process-folder' };
    
    this.logger.info('Procesando carpeta de facturas', context);

    // Extraer archivos de la carpeta
    const files = await this.documentExtractor.extractFromFolder(folderId, {
      mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    });

    this.logger.info('Archivos encontrados', { ...context, count: files.length });

    const results = {
      total: files.length,
      processed: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    // Procesar cada archivo
    for (const file of files) {
      try {
        const result = await this.processNewInvoice.execute({
          driveFileId: file.id,
          userId,
        });

        if (result.alreadyProcessed) {
          results.skipped++;
          results.details.push({
            fileId: file.id,
            filename: file.name,
            status: 'skipped',
            reason: 'Already processed',
          });
        } else {
          results.processed++;
          results.details.push({
            fileId: file.id,
            filename: file.name,
            status: 'success',
            invoiceId: result.invoiceId,
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          fileId: file.id,
          filename: file.name,
          status: 'error',
          error: error.message,
        });
        
        this.logger.error('Error procesando archivo', {
          ...context,
          fileId: file.id,
          error: error.message,
          stack: error.stack,
          errorType: error.constructor.name,
        });
      }
    }

    this.logger.info('Carpeta procesada', { ...context, results });

    return results;
  }
}

module.exports = { ProcessInvoicesFromFolder };
