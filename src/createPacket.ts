import * as crypto from 'crypto';

enum QueryType {
    A = 1,
    AAAA = 28,
    CNAME = 5,
    MX = 15,
}

class Offset {
    private offset: number;

    constructor(initialOffset: number) {
        this.offset = initialOffset;
    }

    get value(): number {
        return this.offset;
    }

    update(value: number) {
        this.offset = value;
    }

    increment(value: number) {
        this.offset += value;
    }
}

class DNSHeader {
    private flags: Buffer;
    private questionCount: Buffer;
    private answerRR: Buffer;
    private authorityRR: Buffer;
    private additionalRR: Buffer;

    constructor(private id: Buffer) {
        this.id = id;
        this.flags = Buffer.from([0x01, 0x00]); // Recursion desired flag
        this.questionCount = Buffer.from([0x00, 0x01]); // One question
        this.answerRR = Buffer.from([0x00, 0x00]); // No answer resource records
        this.authorityRR = Buffer.from([0x00, 0x00]); // No authority resource records
        this.additionalRR = Buffer.from([0x00, 0x00]); // No additional resource records
    }

    concatBuffers(): Buffer {
        return Buffer.concat([
            this.id,
            this.flags,
            this.questionCount,
            this.answerRR,
            this.authorityRR,
            this.additionalRR
        ]);
    }

    static decodeHeader(buffer: Buffer, offset: Offset) {
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

    get transactionID(): Buffer {
        return this.id;
    }
}

class DNSQuestion {
    private encodedDomain: Buffer;
    private type: Buffer;
    private classBuffer: Buffer;

    constructor(domain: string, queryType: string) {
        this.encodedDomain = DNSQuestion.encodeDomainName(domain); // Encoded domain name
        this.type = DNSQuestion.getQueryTypeBytes(queryType); // Query type
        this.classBuffer = Buffer.from([0x00, 0x01]); // Query class (IN)
    }

    concatBuffers(): Buffer {
        return Buffer.concat([
            this.encodedDomain,
            this.type,
            this.classBuffer
        ]);
    }

    static getQueryTypeBytes(queryType: string): Buffer {
        const queryTypes: { [key: string]: Buffer } = {
            'A': Buffer.from([0x00, 0x01]),
            'AAAA': Buffer.from([0x00, 0x1c]),
            'CNAME': Buffer.from([0x00, 0x05]),
            'MX': Buffer.from([0x00, 0x0f]), // Add MX record type
        };

        return queryTypes[queryType.toUpperCase()]; // Default to 0x0000 for unknown query types
    }

    static encodeDomainName(domain: string): Buffer {
        const parts = domain.split('.'); // Split the domain into its labels
        const buffers = parts.map((part) => {
            const length = Buffer.from([part.length]); // Create a buffer for the length
            const content = Buffer.from(part, 'ascii'); // Create a buffer for the label content
            return Buffer.concat([length, content]); // Combine length and content
        });

        // Combine all parts and add a null byte at the end to signify the end of the domain name
        return Buffer.concat([...buffers, Buffer.from([0])]);
    }

    static parseDomainName(buffer: Buffer, offset: Offset) {
        let name = ''
        let hasEncounteredPointer = false
        let originalOffset = offset.value
      
        while (true) {
          const lengthByte = buffer[offset.value] // This is the prefix byte indicating the length of the label
      
          if (isEndOfName(lengthByte)) {
            offset.increment(1); // Move past the null byte indicating the end of the name
            break
          }
      
          if (isPointerIndicator(lengthByte)) {
            if (!hasEncounteredPointer) {
              originalOffset = offset.value + 2; // Set originalOffset to position after the pointer
              hasEncounteredPointer = true
            }
            offset.update(calculatePointerOffset(lengthByte, buffer, offset.value))
            continue
          }
      
          const label = readLabel(buffer, offset, lengthByte)
          name = name + label + '.' // Append label and a dot to the name
          offset.increment(lengthByte + 1); // Update offset to the position after the current label
        }
    
        return {
          domainName: name,
          newOffset: hasEncounteredPointer ? originalOffset : offset.value,
        }
        function isEndOfName(lengthByte: number) {
            // The end of the domain name is indicated by a null byte (0x00).
            return lengthByte === 0
          }
        function isPointerIndicator(lengthByte: number) {
            // A pointer is indicated by the first two bits being set (11).
            // Comparison is done using 0xC0
            return (lengthByte & 0xc0) === 0xc0
        }
        function calculatePointerOffset(
            lengthByte: number,
            buffer: Buffer,
            currentOffset: number
          ) {
            // Masking the first two bits (11) and shifting left by 8 bits.
            // Shifting left by 8 bits means we now have 8 bits of zeros on the right.
            // 8 bits on the right is additional room to calculcate the offset.
            // A pointer is 16 bits (2 bytes) long, with the first two bits being 11.
            // The first two simply indicate that it is a pointer.
            return ((lengthByte & 0x3f) << 8) | buffer[currentOffset + 1]
          }
          function readLabel(buffer: Buffer, offset: Offset, length: number) {
            // The offset points to the length byte of the label in the buffer.
            // Therefore, the actual label starts 1 byte after the offset.
            const startOfLabel = offset.value + 1
          
            // The end of the label is calculated by adding the length of the label
            // to the starting position. The length specifies how many characters
            // the label has.
            const endOfLabel = startOfLabel + length
          
            // Extracting the label from the buffer.
            // and 'end' positions in the buffer to an ASCII string.
            return buffer.toString('ascii', startOfLabel, endOfLabel)
          }
    }

    static decodeQuestion(buffer: Buffer, offset: Offset) {
        const domainNameData = DNSQuestion.parseDomainName(buffer, offset);
        const type = Buffer.from([buffer[offset.value], buffer[offset.value + 1]]);
        offset.increment(4); // Update offset after reading the question
        return { domainName: domainNameData.domainName, type: type.readUInt16BE(0)};
    }
}

class DNSAnswer {
    static decodeAnswer(buffer: Buffer, offset: Offset) {
        const domainNameData = DNSQuestion.parseDomainName(buffer, offset);
        offset.update(domainNameData.newOffset);
        const type = buffer.readUInt16BE(offset.value);
        offset.increment(2); // Move past the type field
        offset.increment(2); // Skip class field (2 bytes)
        offset.increment(4); // Skip TTL field (4 bytes)

        const dataLength = buffer.readUInt16BE(offset.value);
        offset.increment(2); // Move past the data length field

        let rdata: string;

        if (type === QueryType.CNAME) {
            const { domainName, newOffset } = DNSQuestion.parseDomainName(buffer, offset);
            offset.update(newOffset);
            rdata = domainName;
        } else if (type === QueryType.MX) {
            offset.increment(2); // Move past the preference field
            const { domainName, newOffset } = DNSQuestion.parseDomainName(buffer, offset);
            rdata = domainName;
            offset.update(newOffset);
        } else {
            const rdataBuffer = Buffer.from(buffer.subarray(offset.value, offset.value + dataLength));
            rdata = DNSAnswer.interpretRData(rdataBuffer, type);
            offset.increment(dataLength); // Update offset to the end of rdata
        }

        return { domainName: domainNameData.domainName, type, rdata, offset: offset.value };
    }

    static interpretRData(rdata: Buffer, type: number): string {
        switch (type) {
            case QueryType.A:
                return DNSAnswer.interpretIPv4Address(rdata);
            case QueryType.AAAA:
                return DNSAnswer.interpretIPv6Address(rdata);
            default:
                return '';
        }
    }

    static interpretIPv4Address(rdata: Buffer): string {
        return rdata.join('.');
    }

    static interpretIPv6Address(rdata: Buffer): string {
        const parts: Array<string> = [];
        for (let byteIndex = 0; byteIndex < rdata.length; byteIndex += 2) {
            const groupValue = rdata.readUInt16BE(byteIndex);
            const hexString = groupValue.toString(16);
            parts.push(hexString);
        }
        return parts.join(':');
    }
}

class DNSPacket {
    private header: DNSHeader;
    private question: DNSQuestion;
    private buffer: Buffer;

    constructor(domain: string, queryType: string) {
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

    getBuffer(): Buffer {
        return this.buffer;
    }

    static decodePacket(buffer: Buffer) {
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

export { DNSPacket }
