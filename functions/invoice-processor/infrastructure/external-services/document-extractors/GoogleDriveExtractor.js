const { IDocumentExtractor } = require('../../../domain/services');
const { ExtractionError } = require('../../../domain/errors');

/**
 * Extractor de documentos desde Google Drive
 */
class GoogleDriveExtractor extends IDocumentExtractor {
  constructor(driveAdapter, logger) {
    super();
    this.drive = driveAdapter;
    this.logger = logger;
  }

  async extractFromFolder(folderId, options = {}) {
    try {
      this.logger.info('Extrayendo archivos de carpeta Drive', { folderId });
      
      const files = await this.drive.listFiles(folderId, options);
      
      this.logger.info('Archivos extraídos', { folderId, count: files.length });
      
      return files.map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: parseInt(file.size) || 0,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      }));
    } catch (error) {
      this.logger.error('Error extrayendo archivos de Drive', { 
        folderId, 
        error: error.message 
      });
      throw new ExtractionError(
        `Error extrayendo archivos: ${error.message}`,
        { folderId, originalError: error.message }
      );
    }
  }

  async downloadFile(fileId) {
    try {
      this.logger.info('Descargando archivo de Drive', { fileId });
      
      const buffer = await this.drive.downloadFile(fileId);
      
      this.logger.info('Archivo descargado', { fileId, size: buffer.length });
      
      return buffer;
    } catch (error) {
      this.logger.error('Error descargando archivo', { fileId, error: error.message });
      throw new ExtractionError(
        `Error descargando archivo: ${error.message}`,
        { fileId, originalError: error.message }
      );
    }
  }

  async getFileMetadata(fileId) {
    try {
      this.logger.info('Obteniendo metadata de archivo', { fileId });
      
      const metadata = await this.drive.getFileMetadata(fileId);
      
      return {
        id: metadata.id,
        name: metadata.name,
        mimeType: metadata.mimeType,
        size: parseInt(metadata.size) || 0,
        createdTime: metadata.createdTime,
        modifiedTime: metadata.modifiedTime,
        webViewLink: metadata.webViewLink,
        path: metadata.parents ? metadata.parents[0] : null,
      };
    } catch (error) {
      this.logger.error('Error obteniendo metadata', { fileId, error: error.message });
      throw new ExtractionError(
        `Error obteniendo metadata: ${error.message}`,
        { fileId, originalError: error.message }
      );
    }
  }
}

module.exports = { GoogleDriveExtractor };
