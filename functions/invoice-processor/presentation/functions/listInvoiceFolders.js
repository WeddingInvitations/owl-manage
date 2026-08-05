/**
 * Cloud Function para listar subcarpetas de facturas
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DIContainer } = require('../../infrastructure/config');

/**
 * Lista las subcarpetas (meses) disponibles en la carpeta de facturas
 */
exports.listInvoiceFolders = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticción requerida');
  }

  // Verificar rol del usuario
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const userRole = userData.role || 'OWNER';

  if (userRole !== 'OWNER') {
    throw new functions.https.HttpsError('permission-denied', 'Solo OWNER puede listar carpetas');
  }

  // Validar entrada
  const { folderId } = data;
  if (!folderId) {
    throw new functions.https.HttpsError('invalid-argument', 'folderId es requerido');
  }

  try {
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
    throw new functions.https.HttpsError('internal', `Error listando carpetas: ${error.message}`);
  }
});
