/**
 * Cloud Function para listar subcarpetas de facturas
 */
const admin = require('firebase-admin');
const { DIContainer } = require('../../infrastructure/config');

/**
 * Lista las subcarpetas (meses) disponibles en la carpeta de facturas
 */
async function listInvoiceFolders(request, response) {
  try {
    const { folderId } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    // Verificar rol del usuario
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== 'OWNER') {
      throw new Error('Solo usuarios OWNER pueden listar carpetas de facturas');
    }

    // Inicializar contenedor
    const container = new DIContainer(admin.firestore());
    const driveAdapter = container.factory.createDriveAdapter();

    // Listar subcarpetas
    const folders = await driveAdapter.listFolders(folderId);

    return {
      success: true,
      folders: folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        createdTime: folder.createdTime,
        modifiedTime: folder.modifiedTime,
      })),
    };
  } catch (error) {
    console.error('Error listando carpetas:', error);
    throw new Error(`Error listando carpetas: ${error.message}`);
  }
}

module.exports = { listInvoiceFolders };
