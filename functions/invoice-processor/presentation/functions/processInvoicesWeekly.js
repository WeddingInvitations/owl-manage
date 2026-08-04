const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DIContainer } = require('../../infrastructure/config');

/**
 * Cloud Function Scheduled (Cron)
 * Procesa todas las facturas de la carpeta configurada semanalmente
 * 
 * Configuración en firebase.json o CLI:
 * schedule: 'every monday 09:00'
 * timeZone: 'Europe/Madrid'
 */
exports.processInvoicesWeekly = functions.pubsub
  .schedule('every monday 09:00')
  .timeZone('Europe/Madrid')
  .onRun(async (context) => {
    const container = new DIContainer(admin.firestore());
    const useCase = container.getProcessInvoicesFromFolderUseCase();
    const logger = container.getLogger();
    const config = container.getConfig();

    logger.info('Iniciando procesamiento semanal de facturas');

    try {
      const folderId = config.drive.invoicesFolderId;
      
      if (!folderId) {
        logger.error('DRIVE_INVOICES_FOLDER_ID no configurado');
        return null;
      }

      const result = await useCase.execute({
        folderId,
        userId: 'system', // Usuario del sistema para procesos automáticos
      });

      logger.info('Procesamiento semanal completado', { result });

      return {
        success: true,
        result,
      };
    } catch (error) {
      logger.error('Error en procesamiento semanal', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  });
