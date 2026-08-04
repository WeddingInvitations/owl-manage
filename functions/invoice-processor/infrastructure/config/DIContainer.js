const { Config } = require('./config');
const { ServiceFactory } = require('./ServiceFactory');
const { ProcessNewInvoice, ProcessInvoicesFromFolder, GetInvoicesByPeriod } = require('../../application/use-cases');
const { IdempotencyService } = require('../../application/services');

/**
 * Contenedor de inyección de dependencias
 * Ensambla todo el sistema siguiendo el principio de inversión de dependencias
 */
class DIContainer {
  constructor(firestore) {
    this.config = new Config();
    this.config.validate(); // Valida configuración al inicializar
    
    this.factory = new ServiceFactory(this.config, firestore);
    this._useCases = {};
  }

  // Servicios de infraestructura
  getDocumentExtractor() {
    return this.factory.createDocumentExtractor();
  }

  getDocumentParser() {
    return this.factory.createDocumentParser();
  }

  getInvoiceRepository() {
    return this.factory.createInvoiceRepository();
  }

  getDocumentRepository() {
    return this.factory.createDocumentRepository();
  }

  getProcessingLogRepository() {
    return this.factory.createProcessingLogRepository();
  }

  getLogger() {
    return this.factory.getLogger();
  }

  getErrorHandler() {
    return this.factory.getErrorHandler();
  }

  // Servicios de aplicación
  getIdempotencyService() {
    if (!this._idempotencyService) {
      this._idempotencyService = new IdempotencyService({
        processingLogRepository: this.getProcessingLogRepository(),
        ttlMinutes: this.config.idempotency.ttlMinutes,
      });
    }
    return this._idempotencyService;
  }

  // Casos de uso
  getProcessNewInvoiceUseCase() {
    if (!this._useCases.processNewInvoice) {
      this._useCases.processNewInvoice = new ProcessNewInvoice({
        documentExtractor: this.getDocumentExtractor(),
        documentParser: this.getDocumentParser(),
        invoiceRepository: this.getInvoiceRepository(),
        documentRepository: this.getDocumentRepository(),
        processingLogRepository: this.getProcessingLogRepository(),
        idempotencyService: this.getIdempotencyService(),
        logger: this.getLogger(),
      });
    }
    return this._useCases.processNewInvoice;
  }

  getProcessInvoicesFromFolderUseCase() {
    if (!this._useCases.processFolder) {
      this._useCases.processFolder = new ProcessInvoicesFromFolder({
        documentExtractor: this.getDocumentExtractor(),
        processNewInvoice: this.getProcessNewInvoiceUseCase(),
        logger: this.getLogger(),
      });
    }
    return this._useCases.processFolder;
  }

  getGetInvoicesByPeriodUseCase() {
    if (!this._useCases.getInvoicesByPeriod) {
      this._useCases.getInvoicesByPeriod = new GetInvoicesByPeriod({
        invoiceRepository: this.getInvoiceRepository(),
        logger: this.getLogger(),
      });
    }
    return this._useCases.getInvoicesByPeriod;
  }

  // Método para obtener la configuración
  getConfig() {
    return this.config;
  }
}

module.exports = { DIContainer };
