/**
 * Value Object para representar dinero
 * Inmutable y con validaciones
 */
class Money {
  constructor(amount, currency = 'EUR') {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Amount must be a valid number');
    }
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    
    this._amount = Math.round(amount * 100) / 100; // 2 decimales
    this._currency = currency.toUpperCase();
    Object.freeze(this);
  }

  get amount() {
    return this._amount;
  }

  get currency() {
    return this._currency;
  }

  add(other) {
    if (this._currency !== other._currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other) {
    if (this._currency !== other._currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    return new Money(this._amount - other._amount, this._currency);
  }

  multiply(factor) {
    return new Money(this._amount * factor, this._currency);
  }

  equals(other) {
    return this._amount === other._amount && this._currency === other._currency;
  }

  toString() {
    return `${this._amount.toFixed(2)} ${this._currency}`;
  }

  toJSON() {
    return {
      amount: this._amount,
      currency: this._currency,
    };
  }

  static fromJSON(json) {
    return new Money(json.amount, json.currency);
  }
}

module.exports = { Money };
