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
      errors: [], // Lista detallada de errores
    };

    // Procesar cada archivo
    for (const file of files) {
      try {
        this.logger.info('Procesando archivo', { ...context, fileId: file.id, filename: file.name });
        
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
          this.logger.info('Archivo ya procesado', { ...context, fileId: file.id, filename: file.name });
        } else {
          results.processed++;
          results.details.push({
            fileId: file.id,
            filename: file.name,
            status: 'success',
            invoiceId: result.invoiceId,
          });
          this.logger.info('Archivo procesado exitosamente', { ...context, fileId: file.id, filename: file.name });
        }
      } catch (error) {
        results.failed++;
        const errorDetail = {
          fileId: file.id,
          filename: file.name,
          status: 'error',
          error: error.message,
          errorType: error.constructor?.name || 'Error',
        };
        
        results.details.push(errorDetail);
        results.errors.push(errorDetail);
        
        this.logger.error('Error procesando archivo', {
          ...context,
          fileId: file.id,
          filename: file.name,
          error: error.message,
          stack: error.stack,
          errorType: error.constructor.name,
        });
        
        // IMPORTANTE: Continuar con el siguiente archivo, no propagar el error
      }
    }

    this.logger.info('Carpeta procesada', { ...context, results });

    return results;
  }
}

module.exports = { ProcessInvoicesFromFolder };
