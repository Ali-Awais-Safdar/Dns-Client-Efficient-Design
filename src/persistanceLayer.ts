interface IPersistenceLayer {
  storeTransactionID(transactionID: number): number;
  getTransactionIndex(transactionID: number): number | undefined;
  getResponses(): Array<{ index: number, transactionID: number }>;
}

class PersistenceLayer implements IPersistenceLayer {
  private transactions: Array<{ index: number, transactionID: number }>;

  constructor() {
      this.transactions = [];
  }

  storeTransactionID(transactionID: number): number {
      // Store the transaction ID with a new index
      const index = this.transactions.length + 1;
      this.transactions.push({ index, transactionID });
      return index;
  }

  getTransactionIndex(transactionID: number): number | undefined {
      // Find the index for the given transaction ID
      const transaction = this.transactions.find((t) => t.transactionID === transactionID);
      return transaction ? transaction.index : undefined;
  }

  getResponses() {
      return this.transactions;
  }
}

export { PersistenceLayer, IPersistenceLayer };
