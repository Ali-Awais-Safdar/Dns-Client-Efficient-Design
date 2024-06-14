"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceLayer = void 0;
class PersistenceLayer {
    transactions;
    constructor() {
        this.transactions = [];
    }
    storeTransactionID(transactionID) {
        // Store the transaction ID with a new index
        const index = this.transactions.length + 1;
        this.transactions.push({ index, transactionID });
        return index;
    }
    getTransactionIndex(transactionID) {
        // Find the index for the given transaction ID
        const transaction = this.transactions.find((t) => t.transactionID === transactionID);
        return transaction ? transaction.index : undefined;
    }
    getResponses() {
        return this.transactions;
    }
}
exports.PersistenceLayer = PersistenceLayer;
