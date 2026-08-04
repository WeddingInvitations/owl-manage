/**
 * Interfaz para enviar notificaciones
 */
class INotificationService {
  /**
   * Envía una notificación
   * @param {Object} notification 
   * @returns {Promise<void>}
   */
  async send(notification) {
    throw new Error('Method not implemented');
  }

  /**
   * Notifica procesamiento exitoso
   * @param {Object} data 
   * @returns {Promise<void>}
   */
  async notifySuccess(data) {
    throw new Error('Method not implemented');
  }

  /**
   * Notifica error en procesamiento
   * @param {Object} error 
   * @returns {Promise<void>}
   */
  async notifyError(error) {
    throw new Error('Method not implemented');
  }
}

module.exports = { INotificationService };
