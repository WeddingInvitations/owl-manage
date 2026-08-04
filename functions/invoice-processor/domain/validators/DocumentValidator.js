/**
 * Validador de documentos genéricos
 */
class DocumentValidator {
  static ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  static MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Valida que el archivo sea procesable
   */
  static validate(document) {
    const errors = [];

    // Validar tipo MIME
    if (!this.ALLOWED_MIME_TYPES.includes(document.mimeType)) {
      errors.push({
        field: 'mimeType',
        message: `Tipo de archivo no permitido: ${document.mimeType}. Permitidos: PDF, JPG, PNG`,
      });
    }

    // Validar tamaño
    if (document.size > this.MAX_FILE_SIZE) {
      errors.push({
        field: 'size',
        message: `Archivo demasiado grande: ${document.size} bytes. Máximo: ${this.MAX_FILE_SIZE} bytes`,
      });
    }

    // Validar nombre
    if (!document.filename || document.filename.trim().length === 0) {
      errors.push({
        field: 'filename',
        message: 'El nombre del archivo es obligatorio',
      });
    }

    if (errors.length > 0) {
      const { DomainError } = require('../errors');
      throw new DomainError('Documento no válido', 'DOCUMENT_VALIDATION_ERROR', { errors });
    }
  }

  /**
   * Valida que el filename tenga extensión válida
   */
  static validateFilename(filename) {
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const hasValidExtension = validExtensions.some(ext => 
      filename.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return false;
    }

    return true;
  }
}

module.exports = { DocumentValidator };
