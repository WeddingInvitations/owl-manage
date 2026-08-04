const { Money } = require('../value-objects/Money');

/**
 * Entidad que representa una línea de factura
 */
class InvoiceItem {
  constructor({
    id = null,
    description,
    quantity,
    unitPrice,
    taxRate = 0,
    total,
  }) {
    this.id = id || this._generateId();
    this.description = description;
    this.quantity = quantity;
    this.unitPrice = unitPrice instanceof Money ? unitPrice : new Money(unitPrice);
    this.taxRate = taxRate;
    this.total = total instanceof Money ? total : new Money(total);

    this._validate();
  }

  _generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _validate() {
    if (!this.description || this.description.trim().length === 0) {
      throw new Error('Description cannot be empty');
    }
    if (this.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    if (this.taxRate < 0 || this.taxRate > 100) {
      throw new Error('Tax rate must be between 0 and 100');
    }
  }

  calculateSubtotal() {
    return this.unitPrice.multiply(this.quantity);
  }

  calculateTax() {
    const subtotal = this.calculateSubtotal();
    return subtotal.multiply(this.taxRate / 100);
  }

  calculateTotal() {
    const subtotal = this.calculateSubtotal();
    const tax = this.calculateTax();
    return subtotal.add(tax);
  }

  toJSON() {
    return {
      id: this.id,
      description: this.description,
      quantity: this.quantity,
      unitPrice: this.unitPrice.toJSON(),
      taxRate: this.taxRate,
      total: this.total.toJSON(),
    };
  }

  static fromJSON(json) {
    return new InvoiceItem({
      id: json.id,
      description: json.description,
      quantity: json.quantity,
      unitPrice: Money.fromJSON(json.unitPrice),
      taxRate: json.taxRate,
      total: Money.fromJSON(json.total),
    });
  }
}

module.exports = { InvoiceItem };
