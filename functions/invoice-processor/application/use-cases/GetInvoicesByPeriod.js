/**
 * Caso de uso: Obtener facturas de un periodo
 */
class GetInvoicesByPeriod {
  constructor({ invoiceRepository, logger }) {
    this.invoiceRepository = invoiceRepository;
    this.logger = logger;
  }

  /**
   * Ejecuta la consulta
   * @param {Object} params - { startDate, endDate, supplier, status }
   */
  async execute({ startDate, endDate, supplier = null, status = null }) {
    const context = { startDate, endDate, operation: 'get-invoices-by-period' };
    
    this.logger.info('Consultando facturas por periodo', context);

    const filters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    if (supplier) {
      filters.supplier = supplier;
    }

    if (status) {
      filters.status = status;
    }

    const invoices = await this.invoiceRepository.findAll(filters);

    this.logger.info('Facturas obtenidas', { ...context, count: invoices.length });

    return {
      invoices: invoices.map(inv => inv.toJSON()),
      count: invoices.length,
      period: { startDate, endDate },
    };
  }
}

module.exports = { GetInvoicesByPeriod };
