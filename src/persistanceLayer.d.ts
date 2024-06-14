interface IPersistenceLayer {
    storeTransactionID(transactionID: number): number;
    getTransactionIndex(transactionID: number): number | undefined;
    getResponses(): Array<{
        index: number;
        transactionID: number;
    }>;
}
declare class PersistenceLayer implements IPersistenceLayer {
    private transactions;
    constructor();
    storeTransactionID(transactionID: number): number;
    getTransactionIndex(transactionID: number): number | undefined;
    getResponses(): {
        index: number;
        transactionID: number;
    }[];
}
export { PersistenceLayer, IPersistenceLayer };
