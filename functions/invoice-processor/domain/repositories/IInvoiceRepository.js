/**
 * Interfaz para repositorio de facturas
 */
class IInvoiceRepository {
  /**
   * Guarda una factura
   * @param {Invoice} invoice 
   * @returns {Promise<string>} ID de la factura guardada
   */
  async save(invoice) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca una factura por ID
   * @param {string} id 
   * @returns {Promise<Invoice|null>}
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca una factura por número
   * @param {string} number 
   * @returns {Promise<Invoice|null>}
   */
  async findByNumber(number) {
    throw new Error('Method not implemented');
  }

  /**
   * Lista facturas con filtros
   * @param {Object} filters - { startDate, endDate, supplier, status }
   * @returns {Promise<Invoice[]>}
   */
  async findAll(filters = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Guarda una factura como gasto en la colección expenses
   * @param {Object} expense - Datos del gasto
   * @param {string} userId - ID del usuario que crea el gasto
   * @returns {Promise<string>} ID del gasto creado
   */
  async saveAsExpense(expense, userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Actualiza una factura
   * @param {string} id 
   * @param {Object} updates 
   * @returns {Promise<void>}
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }
}

module.exports = { IInvoiceRepository };
