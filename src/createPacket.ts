import * as crypto from 'crypto';

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

    // incrementQuestionCount() {
    //     let count = this.questionCount.readUInt16BE(0);
    //     count++;
    //     this.questionCount.writeUInt16BE(count, 0);
    // }

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

    static decodeHeader(buffer: Buffer) {
        if (buffer.length < 12) {
            throw new Error("Invalid DNS header length");
        }
        const header = {
            transactionID: buffer.readUInt16BE(0),
            questionsCount: buffer.readUInt16BE(4),
            answersCount: buffer.readUInt16BE(6),
            authorityCount: buffer.readUInt16BE(8),
            additionalCount: buffer.readUInt16BE(10),
        };

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

    static parseDomainName(buffer: Buffer, offset: number) {
        let name = ''
        let hasEncounteredPointer = false
        let originalOffset = offset
      
        while (true) {
          const lengthByte = buffer[offset] // This is the prefix byte indicating the length of the label
      
          if (isEndOfName(lengthByte)) {
            offset = offset + 1 // Move past the null byte indicating the end of the name
            break
          }
      
          if (isPointerIndicator(lengthByte)) {
            if (!hasEncounteredPointer) {
              originalOffset = offset + 2 // Set originalOffset to position after the pointer
              hasEncounteredPointer = true
            }
            offset = calculatePointerOffset(lengthByte, buffer, offset)
            continue
          }
      
          const label = readLabel(buffer, offset, lengthByte)
          name = name + label + '.' // Append label and a dot to the name
          offset = offset + lengthByte + 1 // Update offset to the position after the current label
        }
    
        return {
          domainName: name,
          newOffset: hasEncounteredPointer ? originalOffset : offset,
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
          function readLabel(buffer: Buffer, offset: number, length: number) {
            // The offset points to the length byte of the label in the buffer.
            // Therefore, the actual label starts 1 byte after the offset.
            const startOfLabel = offset + 1
          
            // The end of the label is calculated by adding the length of the label
            // to the starting position. The length specifies how many characters
            // the label has.
            const endOfLabel = startOfLabel + length
          
            // Extracting the label from the buffer.
            // and 'end' positions in the buffer to an ASCII string.
            return buffer.toString('ascii', startOfLabel, endOfLabel)
          }
    }

    static decodeQuestion(buffer: Buffer, offset: number) {
        const domainNameData = DNSQuestion.parseDomainName(buffer, offset);
        const type = Buffer.from([buffer[offset + domainNameData.domainName.length + 1], buffer[offset + domainNameData.domainName.length + 2]]);
        return { domainName: domainNameData.domainName, type: type.readUInt16BE(0)};
    }
}

class DNSAnswer {
    static decodeAnswer(buffer: Buffer, offset: number) {
        const domainNameData = DNSQuestion.parseDomainName(buffer, offset);
        offset = domainNameData.newOffset;
        const type = buffer.readUInt16BE(offset);
        offset += 2 // Move past the type field
        offset += 2 // Skip class field (2 bytes)
        offset += 4 // Skip TTL field (4 bytes)

        const dataLength = buffer.readUInt16BE(offset)
        offset += 2 // Move past the data length field

        let rdata: string

        if (type === 5) {
            const { domainName, newOffset } = DNSQuestion.parseDomainName(buffer, offset)
            offset = newOffset
            rdata = domainName
        }else if (type === 15) {
            // Handle MX record (type 15)
            offset += 2; // Move past the preference field
            const { domainName, newOffset } = DNSQuestion.parseDomainName(buffer, offset);
            rdata = domainName;
            offset = newOffset;
        } 
        else {
            const rdataBuffer = Buffer.from(buffer.subarray(offset, offset + dataLength));
            rdata = DNSAnswer.interpretRData(rdataBuffer, type)
            offset += dataLength // Update offset to the end of rdata
        }

        return { domainName: domainNameData.domainName, type, rdata , offset};
    }
    

    static interpretRData(rdata: Buffer, type: number): string {
        switch (type) {
            case 1:
                return DNSAnswer.interpretIPv4Address(rdata);
            case 28:
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
        return crypto.randomBytes(2) // Generates a 2-byte (16-bit) buffer
      }

    // constructor(domain: string, queryType: string) {
    //     this.header = new DNSHeader();
    //     this.questions = [new DNSQuestion(domain, queryType)];
    //     const identifier = DNSPacket.generateIdentifier();
    //     this.buffer = Buffer.concat([
    //         identifier,
    //         this.header.concatBuffers(),
    //         ...this.questions.map(question => question.concatBuffers())
    //     ]);
    // }

    // addQuestion(domain: string, queryType: string) {
    //     const newQuestion = new DNSQuestion(domain, queryType);
    //     this.questions.push(newQuestion);
    //     this.header.incrementQuestionCount();
    //     this.updateBuffer();
    // }

    // updateBuffer() {
    //     const identifier = this.buffer.slice(0, 2);
    //     this.buffer = Buffer.concat([
    //         identifier,
    //         this.header.concatBuffers(),
    //         ...this.questions.map(question => question.concatBuffers())
    //     ]);
    // }

    // static decodePacket(buffer: Buffer) {
    //     const header = DNSHeader.decodeHeader(buffer);
    //     const questions = [];
    //     let offset = 12; // After the header
    //     console.log(header)

    //     for (let i = 0; i < header.questionsCount; i++) {
    //         console.log(offset)
    //         const question = DNSQuestion.decodeQuestion(buffer, offset);
    //         console.log(question)
    //         questions.push(question);
    //         offset += question.domainName.length + 5; // Domain name length + type (2 bytes) + class (2 bytes)
    //     }
    //     console.log(questions)

    //     const answers = [];
    //     while (offset < buffer.length) {
    //         const answer = DNSAnswer.decodeAnswer(buffer, offset);
    //         answers.push(answer);
    //         offset = answer.offset;
    //     }

    //     return { header, questions, answers };
    // }
    //As even if we give 2 qs the server resolves only the first one im commenting out this functionality

    getBuffer(): Buffer {
        return this.buffer;
    }

    static calculateQuestionLength = (buffer : Buffer, offset : number) => {
        let length = 0;
        
        // Start from the offset
        let currentOffset = offset;
    
        // Read the domain name labels until a pointer (00) is encountered
        while (buffer[currentOffset] !== 0) {
            // Read the length of the label
            const labelLength = buffer[currentOffset];
            // Move to the next label
            currentOffset += labelLength + 1; // Length of label + 1 byte for the length field
            // Increment the total length
            length += labelLength + 1; // Length of label + 1 byte for the length field
        }
    
        // Skip the pointer (00) in the domain name
        length += 1;
    
        // Skip the type field (2 bytes) and class field (2 bytes)
        length += 4;
    
        return length;
    };

    static decodePacket(buffer: Buffer) {
        const header = DNSHeader.decodeHeader(buffer);
        const question = DNSQuestion.decodeQuestion(buffer, 12);
        const answer = DNSAnswer.decodeAnswer(buffer,DNSPacket.calculateQuestionLength(buffer, 12) + 12);
        return { header, question, answer };
    }

    get headerId() {
        return this.header.transactionID;
    }
}

export { DNSPacket }

