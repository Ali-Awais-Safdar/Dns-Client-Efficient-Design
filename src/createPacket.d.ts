/// <reference types="node" />
declare class DNSPacket {
    private header;
    private question;
    private buffer;
    constructor(domain: string, queryType: string);
    static generateIdentifier(): Buffer;
    getBuffer(): Buffer;
    static decodePacket(buffer: Buffer): {
        header: {
            transactionID: number;
            questionsCount: number;
            answersCount: number;
            authorityCount: number;
            additionalCount: number;
        };
        question: {
            domainName: string;
            type: number;
        };
        answer: {
            domainName: string;
            type: number;
            rdata: string;
            offset: number;
        };
    };
    get headerId(): Buffer;
}
export { DNSPacket };
