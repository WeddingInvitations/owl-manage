const { google } = require('googleapis');

/**
 * Adaptador para Google Drive API
 * Encapsula la interacción con la API de Drive
 */
class GoogleDriveAdapter {
  constructor(credentials) {
    // credentials puede ser service account JSON o OAuth2
    this.auth = this._initializeAuth(credentials);
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  _initializeAuth(credentials) {
    if (credentials.type === 'service_account') {
      // Autenticación con Service Account
      return new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
    } else {
      // OAuth2 (si se usa en el futuro)
      throw new Error('OAuth2 not implemented yet');
    }
  }

  /**
   * Lista archivos de una carpeta
   */
  async listFiles(folderId, options = {}) {
    const query = [`'${folderId}' in parents`, 'trashed = false'];
    
    if (options.mimeTypes && options.mimeTypes.length > 0) {
      const mimeQuery = options.mimeTypes
        .map(mime => `mimeType='${mime}'`)
        .join(' or ');
      query.push(`(${mimeQuery})`);
    }

    const response = await this.drive.files.list({
      q: query.join(' and '),
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, parents)',
      pageSize: options.limit || 100,
    });

    return response.data.files;
  }

  /**
   * Descarga un archivo
   */
  async downloadFile(fileId) {
    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data);
  }

  /**
   * Obtiene metadata de un archivo
   */
  async getFileMetadata(fileId) {
    const response = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink',
    });

    return response.data;
  }

  /**
   * Busca archivos por nombre
   */
  async searchFiles(query, options = {}) {
    const response = await this.drive.files.list({
      q: `name contains '${query}' and trashed = false`,
      fields: 'files(id, name, mimeType, size)',
      pageSize: options.limit || 20,
    });

    return response.data.files;
  }

  /**
   * Lista subcarpetas de una carpeta
   */
  async listFolders(parentFolderId) {
    const response = await this.drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, createdTime, modifiedTime)',
      orderBy: 'name desc',
      pageSize: 100,
    });

    return response.data.files;
  }
}

module.exports = { GoogleDriveAdapter };
