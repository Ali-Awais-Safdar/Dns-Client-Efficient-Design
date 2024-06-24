"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DNSPacket = void 0;
const crypto = __importStar(require("crypto"));
var QueryType;
(function (QueryType) {
    QueryType[QueryType["A"] = 1] = "A";
    QueryType[QueryType["AAAA"] = 28] = "AAAA";
    QueryType[QueryType["CNAME"] = 5] = "CNAME";
    QueryType[QueryType["MX"] = 15] = "MX";
})(QueryType || (QueryType = {}));
class Offset {
    offset;
    constructor(initialOffset) {
        this.offset = initialOffset;
    }
    get value() {
        return this.offset;
    }
    update(value) {
        this.offset = value;
    }
    increment(value) {
        this.offset += value;
    }
}
class DNSHeader {
    id;
    flags;
    questionCount;
    answerRR;
    authorityRR;
    additionalRR;
    constructor(id) {
        this.id = id;
        this.id = id;
        this.flags = Buffer.from([0x01, 0x00]); // Recursion desired flag
        this.questionCount = Buffer.from([0x00, 0x01]); // One question
        this.answerRR = Buffer.from([0x00, 0x00]); // No answer resource records
        this.authorityRR = Buffer.from([0x00, 0x00]); // No authority resource records
        this.additionalRR = Buffer.from([0x00, 0x00]); // No additional resource records
    }
    concatBuffers() {
        return Buffer.concat([
            this.id,
            this.flags,
            this.questionCount,
            this.answerRR,
            this.authorityRR,
            this.additionalRR
        ]);
    }
    static decodeHeader(buffer, offset) {
        if (buffer.length < 12) {
            throw new Error("Invalid DNS header length");
        }
        const header = {
            transactionID: buffer.readUInt16BE(offset.value),
            questionsCount: buffer.readUInt16BE(offset.value + 4),
            answersCount: buffer.readUInt16BE(offset.value + 6),
            authorityCount: buffer.readUInt16BE(offset.value + 8),
            additionalCount: buffer.readUInt16BE(offset.value + 10),
        };
        offset.increment(12); // Update offset after reading the header
        return header;
    }
    get transactionID() {
        return this.id;
    }
}
class DNSQuestion {
    encodedDomain;
    type;
    classBuffer;
    constructor(domain, queryType) {
        this.encodedDomain = DNSQuestion.encodeDomainName(domain); // Encoded domain name
        this.type = DNSQuestion.getQueryTypeBytes(queryType); // Query type
        this.classBuffer = Buffer.from([0x00, 0x01]); // Query class (IN)
    }
    concatBuffers() {
        return Buffer.concat([
            this.encodedDomain,
            this.type,
            this.classBuffer
        ]);
    }
    static getQueryTypeBytes(queryType) {
        const queryTypes = {
            'A': Buffer.from([0x00, 0x01]),
            'AAAA': Buffer.from([0x00, 0x1c]),
            'CNAME': Buffer.from([0x00, 0x05]),
            'MX': Buffer.from([0x00, 0x0f]), // Add MX record type
        };
        return queryTypes[queryType.toUpperCase()]; // Default to 0x0000 for unknown query types
    }
    static encodeDomainName(domain) {
        const parts = domain.split('.'); // Split the domain into its labels
        const buffers = parts.map((part) => {
            const length = Buffer.from([part.length]); // Create a buffer for the length
            const content = Buffer.from(part, 'ascii'); // Create a buffer for the label content
            return Buffer.concat([length, content]); // Combine length and content
        });
        // Combine all parts and add a null byte at the end to signify the end of the domain name
        return Buffer.concat([...buffers, Buffer.from([0])]);
    }
    static parseDomainName(buffer, offset) {
        let name = '';
        let hasEncounteredPointer = false;
        let originalOffset = offset.value;
        while (true) {
            const lengthByte = buffer[offset.value]; // This is the prefix byte indicating the length of the label
            if (isEndOfName(lengthByte)) {
                offset.increment(1); // Move past the null byte indicating the end of the name
                break;
            }
            if (isPointerIndicator(lengthByte)) {
                if (!hasEncounteredPointer) {
                    originalOffset = offset.value + 2; // Set originalOffset to position after the pointer
                    hasEncounteredPointer = true;
                }
                offset.update(calculatePointerOffset(lengthByte, buffer, offset.value));
                continue;
            }
            const label = readLabel(buffer, offset, lengthByte);
            name = name + label + '.'; // Append label and a dot to the name
            offset.increment(lengthByte + 1); // Update offset to the position after the current label
        }
        return {
            domainName: name,
            newOffset: hasEncounteredPointer ? originalOffset : offset.value,
        };
        function isEndOfName(lengthByte) {
            // The end of the domain name is indicated by a null byte (0x00).
            return lengthByte === 0;
        }
        function isPointerIndicator(lengthByte) {
            // A pointer is indicated by the first two bits being set (11).
            // Comparison is done using 0xC0
            return (lengthByte & 0xc0) === 0xc0;
        }
        function calculatePointerOffset(lengthByte, buffer, currentOffset) {
            // Masking the first two bits (11) and shifting left by 8 bits.
            // Shifting left by 8 bits means we now have 8 bits of zeros on the right.
            // 8 bits on the right is additional room to calculcate the offset.
            // A pointer is 16 bits (2 bytes) long, with the first two bits being 11.
            // The first two simply indicate that it is a pointer.
            return ((lengthByte & 0x3f) << 8) | buffer[currentOffset + 1];
        }
        function readLabel(buffer, offset, length) {
            // The offset points to the length byte of the label in the buffer.
            // Therefore, the actual label starts 1 byte after the offset.
            const startOfLabel = offset.value + 1;
            // The end of the label is calculated by adding the length of the label
            // to the starting position. The length specifies how many characters
            // the label has.
            const endOfLabel = startOfLabel + length;
            // Extracting the label from the buffer.
            // and 'end' positions in the buffer to an ASCII string.
            return buffer.toString('ascii', startOfLabel, endOfLabel);
        }
    }
    static decodeQuestion(buffer, offset) {
        const domainNameData = DNSQuestion.parseDomainName(buffer, offset);
        const type = Buffer.from([buffer[offset.value], buffer[offset.value + 1]]);
        offset.increment(4); // Update offset after reading the question
        return { domainName: domainNameData.domainName, type: type.readUInt16BE(0) };
    }
}
class DNSAnswer {
    static decodeAnswer(buffer, offset) {
        const domainNameData = DNSQuestion.parseDomainName(buffer, offset);
        offset.update(domainNameData.newOffset);
        const type = buffer.readUInt16BE(offset.value);
        offset.increment(2); // Move past the type field
        offset.increment(2); // Skip class field (2 bytes)
        offset.increment(4); // Skip TTL field (4 bytes)
        const dataLength = buffer.readUInt16BE(offset.value);
        offset.increment(2); // Move past the data length field
        let rdata;
        if (type === QueryType.CNAME) {
            const { domainName, newOffset } = DNSQuestion.parseDomainName(buffer, offset);
            offset.update(newOffset);
            rdata = domainName;
        }
        else if (type === QueryType.MX) {
            offset.increment(2); // Move past the preference field
            const { domainName, newOffset } = DNSQuestion.parseDomainName(buffer, offset);
            rdata = domainName;
            offset.update(newOffset);
        }
        else {
            const rdataBuffer = Buffer.from(buffer.subarray(offset.value, offset.value + dataLength));
            rdata = DNSAnswer.interpretRData(rdataBuffer, type);
            offset.increment(dataLength); // Update offset to the end of rdata
        }
        return { domainName: domainNameData.domainName, type, rdata, offset: offset.value };
    }
    static interpretRData(rdata, type) {
        switch (type) {
            case QueryType.A:
                return DNSAnswer.interpretIPv4Address(rdata);
            case QueryType.AAAA:
                return DNSAnswer.interpretIPv6Address(rdata);
            default:
                return '';
        }
    }
    static interpretIPv4Address(rdata) {
        return rdata.join('.');
    }
    static interpretIPv6Address(rdata) {
        const parts = [];
        for (let byteIndex = 0; byteIndex < rdata.length; byteIndex += 2) {
            const groupValue = rdata.readUInt16BE(byteIndex);
            const hexString = groupValue.toString(16);
            parts.push(hexString);
        }
        return parts.join(':');
    }
}
class DNSPacket {
    header;
    question;
    buffer;
    constructor(domain, queryType) {
        this.header = new DNSHeader(DNSPacket.generateIdentifier());
        this.question = new DNSQuestion(domain, queryType);
        this.buffer = Buffer.concat([
            this.header.concatBuffers(),
            this.question.concatBuffers()
        ]);
    }
    static generateIdentifier() {
        return crypto.randomBytes(2); // Generates a 2-byte (16-bit) buffer
    }
    getBuffer() {
        return this.buffer;
    }
    static decodePacket(buffer) {
        const offset = new Offset(0);
        const header = DNSHeader.decodeHeader(buffer, offset);
        const question = DNSQuestion.decodeQuestion(buffer, offset);
        const answer = DNSAnswer.decodeAnswer(buffer, offset);
        return { header, question, answer };
    }
    get headerId() {
        return this.header.transactionID;
    }
}
exports.DNSPacket = DNSPacket;
