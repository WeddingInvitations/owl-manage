const { GoogleDriveAdapter, GeminiAdapter } = require('../adapters');
const { GoogleDriveExtractor } = require('../external-services/document-extractors');
const { GeminiInvoiceParser, MockParser } = require('../external-services/document-parsers');
const {
  FirestoreInvoiceRepository,
  FirestoreDocumentRepository,
  FirestoreProcessingLogRepository,
} = require('../repositories');
const { Logger, ErrorHandler } = require('../middleware');

/**
 * Factory para crear servicios con las dependencias correctas
 * Implementa el patrón Factory
 */
class ServiceFactory {
  constructor(config, firestore) {
    this.config = config;
    this.firestore = firestore;
    this.logger = new Logger('invoice-processor');
    this.errorHandler = new ErrorHandler(this.logger);
  }

  // Adapters
  createDriveAdapter() {
    if (!this._driveAdapter) {
      this._driveAdapter = new GoogleDriveAdapter(this.config.drive.credentials);
    }
    return this._driveAdapter;
  }

  createGeminiAdapter() {
    if (!this._geminiAdapter) {
      this._geminiAdapter = new GeminiAdapter(
        this.config.gemini.apiKey,
        this.config.gemini.model
      );
    }
    return this._geminiAdapter;
  }

  // Extractors
  createDocumentExtractor() {
    const driveAdapter = this.createDriveAdapter();
    return new GoogleDriveExtractor(driveAdapter, this.logger);
  }

  // Parsers - permite cambiar entre Gemini y otros LLMs
  createDocumentParser() {
    switch (this.config.parser.type) {
      case 'gemini':
        const geminiAdapter = this.createGeminiAdapter();
        return new GeminiInvoiceParser(geminiAdapter, this.logger);
      
      case 'mock':
        return new MockParser();
      
      // Fácil agregar más parsers:
      // case 'openai':
      //   return new OpenAIInvoiceParser(...);
      
      default:
        throw new Error(`Unknown parser type: ${this.config.parser.type}`);
    }
  }

  // Repositories
  createInvoiceRepository() {
    if (!this._invoiceRepository) {
      this._invoiceRepository = new FirestoreInvoiceRepository(this.firestore);
    }
    return this._invoiceRepository;
  }

  createDocumentRepository() {
    if (!this._documentRepository) {
      this._documentRepository = new FirestoreDocumentRepository(this.firestore);
    }
    return this._documentRepository;
  }

  createProcessingLogRepository() {
    if (!this._processingLogRepository) {
      this._processingLogRepository = new FirestoreProcessingLogRepository(this.firestore);
    }
    return this._processingLogRepository;
  }

  // Middleware
  getLogger() {
    return this.logger;
  }

  getErrorHandler() {
    return this.errorHandler;
  }
}

module.exports = { ServiceFactory };
