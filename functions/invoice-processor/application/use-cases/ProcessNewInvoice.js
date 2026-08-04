const { Invoice } = require('../../domain/entities');
const { DocumentId } = require('../../domain/value-objects');
const { InvoiceValidator } = require('../../domain/validators');

/**
 * Caso de uso: Procesar una nueva factura
 * Orquesta el flujo completo de procesamiento
 */
class ProcessNewInvoice {
  constructor({
    documentExtractor,
    documentParser,
    invoiceRepository,
    documentRepository,
    processingLogRepository,
    idempotencyService,
    logger,
  }) {
    this.documentExtractor = documentExtractor;
    this.documentParser = documentParser;
    this.invoiceRepository = invoiceRepository;
    this.documentRepository = documentRepository;
    this.processingLogRepository = processingLogRepository;
    this.idempotencyService = idempotencyService;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   * @param {Object} params - { driveFileId, userId }
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async execute({ driveFileId, userId }) {
    const startTime = Date.now();
    const context = { driveFileId, userId, operation: 'process-new-invoice' };

    this.logger.info('Iniciando procesamiento de factura', context);

    try {
      // 1. Descargar archivo de Drive
      this.logger.info('Descargando archivo de Drive', context);
      const fileBuffer = await this.documentExtractor.downloadFile(driveFileId);
      const fileMetadata = await this.documentExtractor.getFileMetadata(driveFileId);

      // 2. Generar ID de documento (idempotency key)
      const documentId = DocumentId.fromFileContent(fileBuffer, fileMetadata.name);
      context.documentId = documentId.value;

      // 3. Verificar idempotencia
      this.logger.info('Verificando idempotencia', context);
      const existingResult = await this.idempotencyService.check(documentId.value);
      if (existingResult) {
        this.logger.info('Documento ya procesado (idempotencia)', context);
        return {
          success: true,
          alreadyProcessed: true,
          result: existingResult,
        };
      }

      // 4. Guardar documento en repositorio
      const { Document } = require('../../domain/entities');
      const document = new Document({
        documentId,
        type: 'INVOICE',
        filename: fileMetadata.name,
        mimeType: fileMetadata.mimeType,
        size: fileMetadata.size,
        driveFileId,
        driveFilePath: fileMetadata.path || null,
        status: 'PROCESSING',
      });
      
      const documentDbId = await this.documentRepository.save(document);
      context.documentDbId = documentDbId;

      // 5. Parsear factura con IA
      this.logger.info('Parseando factura con IA', context);
      const extractedData = await this.documentParser.parseInvoice(fileBuffer, fileMetadata);

      // 6. Validar datos extraídos
      this.logger.info('Validando datos extraídos', context);
      InvoiceValidator.validateExtractedData(extractedData);

      // 7. Crear entidad Invoice
      const invoice = new Invoice({
        documentId,
        number: extractedData.number,
        issueDate: new Date(extractedData.issueDate),
        dueDate: extractedData.dueDate ? new Date(extractedData.dueDate) : null,
        supplierName: extractedData.supplierName,
        supplierTaxId: extractedData.supplierTaxId || null,
        supplierAddress: extractedData.supplierAddress || null,
        items: extractedData.items,
        subtotal: extractedData.subtotal,
        taxAmount: extractedData.taxAmount,
        total: extractedData.total,
        currency: extractedData.currency || 'EUR',
        notes: extractedData.notes || null,
        category: extractedData.category || 'GENERAL',
        driveFileId,
        driveFileName: fileMetadata.name,
      });

      // 8. Validar factura
      this.logger.info('Validando factura', context);
      InvoiceValidator.validate(invoice);
      await InvoiceValidator.validateNotDuplicate(invoice, this.invoiceRepository);

      // 9. Marcar factura como procesada
      invoice.markAsProcessed();

      // 10. Guardar en repositorio de facturas
      this.logger.info('Guardando factura', context);
      const invoiceId = await this.invoiceRepository.save(invoice);
      context.invoiceId = invoiceId;

      // 11. Guardar como gasto (expense)
      this.logger.info('Guardando como gasto', context);
      const expenseData = invoice.toExpenseFormat();
      const expenseId = await this.invoiceRepository.saveAsExpense(expenseData, userId);
      context.expenseId = expenseId;

      // 12. Actualizar documento como procesado
      await this.documentRepository.update(documentDbId, { status: 'PROCESSED' });

      // 13. Registrar resultado en log de procesamiento
      const { ProcessingResult } = require('../../domain/entities');
      const { ProcessingStatus } = require('../../domain/value-objects');
      const result = new ProcessingResult({
        documentId: documentId.value,
        status: ProcessingStatus.COMPLETED,
        data: {
          invoiceId,
          expenseId,
          invoiceNumber: invoice.number,
          supplier: invoice.supplierName,
          total: invoice.total.toString(),
        },
        duration: Date.now() - startTime,
        attemptCount: 1,
      });

      await this.processingLogRepository.save(result);

      // 14. Guardar en cache de idempotencia
      await this.idempotencyService.store(documentId.value, result);

      const duration = Date.now() - startTime;
      this.logger.info('Factura procesada exitosamente', { ...context, duration });

      return {
        success: true,
        invoiceId,
        expenseId,
        invoice: invoice.toJSON(),
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Error procesando factura', { 
        ...context, 
        error: error.message, 
        stack: error.stack,
        errorType: error.constructor.name,
        duration 
      });

      // Registrar error en log
      const { ProcessingResult } = require('../../domain/entities');
      const { ProcessingStatus } = require('../../domain/value-objects');
      const result = new ProcessingResult({
        documentId: context.documentId || 'unknown',
        status: ProcessingStatus.FAILED,
        errors: [{
          message: error.message,
          code: error.code || 'UNKNOWN',
          timestamp: new Date().toISOString(),
        }],
        duration,
        attemptCount: 1,
      });

      await this.processingLogRepository.save(result);

      throw error;
    }
  }
}

module.exports = { ProcessNewInvoice };
