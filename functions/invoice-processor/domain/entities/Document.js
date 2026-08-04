const { DocumentId } = require('../value-objects/DocumentId');

/**
 * Entidad genérica de documento
 * Base para facturas, albaranes, etc.
 */
class Document {
  constructor({
    id = null,
    documentId,
    type,
    filename,
    mimeType,
    size,
    driveFileId,
    driveFilePath,
    status = 'PENDING',
    metadata = {},
    createdAt = null,
  }) {
    this.id = id;
    this.documentId = documentId instanceof DocumentId ? documentId : DocumentId.fromString(documentId);
    this.type = type; // 'INVOICE', 'DELIVERY_NOTE', etc.
    this.filename = filename;
    this.mimeType = mimeType;
    this.size = size;
    this.driveFileId = driveFileId;
    this.driveFilePath = driveFilePath;
    this.status = status;
    this.metadata = metadata;
    this.createdAt = createdAt || new Date();
  }

  isProcessed() {
    return this.status === 'PROCESSED';
  }

  isPending() {
    return this.status === 'PENDING';
  }

  isFailed() {
    return this.status === 'FAILED';
  }

  markAsProcessed() {
    this.status = 'PROCESSED';
  }

  markAsFailed() {
    this.status = 'FAILED';
  }

  toJSON() {
    return {
      id: this.id,
      documentId: this.documentId.value,
      type: this.type,
      filename: this.filename,
      mimeType: this.mimeType,
      size: this.size,
      driveFileId: this.driveFileId,
      driveFilePath: this.driveFilePath,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

module.exports = { Document };
