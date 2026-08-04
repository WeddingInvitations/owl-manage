const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DIContainer } = require('../../infrastructure/config');

/**
 * Cloud Function HTTP Callable
 * Procesa todas las facturas de una carpeta de Drive
 * 
 * Uso:
 * const result = await processFolderInvoices({ folderId: 'xxx' });
 */
exports.processFolderInvoices = functions.https.onCall(async (data, context) => {
  // Verificar autenticación y permisos
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticación requerida');
  }

  const userDoc = await admin.firestore()
    .collection('users')
    .doc(context.auth.uid)
    .get();

  const userData = userDoc.exists ? userDoc.data() : {};
  const userRole = userData.role || 'OWNER';

  if (userRole !== 'OWNER') {
    throw new functions.https.HttpsError('permission-denied', 'Solo OWNER puede procesar carpetas');
  }

  // Validar entrada
  const { folderId } = data;
  if (!folderId) {
    throw new functions.https.HttpsError('invalid-argument', 'folderId es requerido');
  }

  // Ejecutar caso de uso
  const container = new DIContainer(admin.firestore());
  const useCase = container.getProcessInvoicesFromFolderUseCase();
  const errorHandler = container.getErrorHandler();

  try {
    const result = await useCase.execute({
      folderId,
      userId: context.auth.uid,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    throw errorHandler.toHttpsError(error);
  }
});
