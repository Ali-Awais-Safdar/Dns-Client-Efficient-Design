import { isValidDomain } from './validDomain';
import { DNSPacket } from './createPacket';
import { TransportLayer, ITransport } from './transportLayer';
import { PersistenceLayer, IPersistenceLayer } from './persistanceLayer';
import { CLIInputLayer, FileInputLayer, IInputLayer } from './inputLayer';
import { CLIOutputLayer, FileOutputLayer, IOutputLayer } from './outputLayer';
import * as fs from 'fs';
import * as path from 'path';

async function queryFlow(domain: string, queryType: string, transport: ITransport, persistence: IPersistenceLayer, outputLayer: IOutputLayer) {
    try {
        let packet = new DNSPacket(domain, queryType);
        let packetBuffer = packet.getBuffer();
        const transactionID = packet.headerId;
        persistence.storeTransactionID(transactionID.readUInt16BE(0));
        const msg = await transport.sendPacket(packetBuffer);
        await responseHandler(msg, persistence, outputLayer);
    } catch (error) {
        console.error(error);
    }
}

async function start() {
    const inputArg = process.argv.slice(2).join(' ');

    if (!inputArg) {
        console.log('Please provide a file name or a direct query.');
        process.exit(1);
    }

    const persistence = new PersistenceLayer();
    const transport = new TransportLayer();
    let inputLayer: IInputLayer;
    let outputLayer: IOutputLayer;

    if (fs.existsSync(path.resolve(__dirname, inputArg))) {
        inputLayer = new FileInputLayer(path.resolve(__dirname, inputArg));
        outputLayer = new FileOutputLayer('output.txt');
    } else {
        inputLayer = new CLIInputLayer();
        outputLayer = new CLIOutputLayer();
    }

    try {
        const queries = await inputLayer.getInput();

        for (const query of queries) {
            const [domain, queryType] = query.split(' ');

            if (!domain || !queryType) {
                outputLayer.displayOutput(`Invalid format for query: ${query}`);
                continue;
            }

            await validateQuery(domain, queryType, persistence, transport, outputLayer);
        }

        outputLayer.displayOutput('Final state of PersistenceLayer: ' + JSON.stringify(persistence.getResponses()));
    } catch (err) {
        console.error(`Error reading file or processing input '${inputArg}':`, err);
        process.exit(1);
    }

    process.exit(0);
}

async function validateQuery(domain: string, queryType: string, persistence: IPersistenceLayer, transport: ITransport, outputLayer: IOutputLayer) {
    let QUERY_TYPE: string;
    if (queryType === 'A' || queryType === 'AAAA' || queryType === 'CNAME' || queryType === 'MX') {
        QUERY_TYPE = queryType;
    } else {
        outputLayer.displayOutput(`Unsupported query type: ${queryType}`);
        return;
    }

    let DOMAIN_TO_RESOLVE: string = domain;

    if (!isValidDomain(DOMAIN_TO_RESOLVE)) {
        outputLayer.displayOutput(`Domain name format is invalid: ${DOMAIN_TO_RESOLVE}`);
        return;
    }

    if (DOMAIN_TO_RESOLVE.startsWith('www.')) {
        if (QUERY_TYPE === 'A') {
            outputLayer.displayOutput('The given domain has CNAME record. Use "CNAME" query type.');
            process.exit(1);
        }
    }

    outputLayer.displayOutput(`Querying ${DOMAIN_TO_RESOLVE} with type ${QUERY_TYPE}`);
    await queryFlow(DOMAIN_TO_RESOLVE, QUERY_TYPE, transport, persistence, outputLayer);
}

async function responseHandler(msg: any, persistence: IPersistenceLayer, outputLayer: IOutputLayer) {
    const response = DNSPacket.decodePacket(msg);
    const { header, question, answer } = response;

    const index = persistence.getTransactionIndex(header.transactionID);
    if (index !== undefined) {
        if (answer.rdata === '') {
            outputLayer.displayOutput('No records found.');
        } else {
            if (outputLayer instanceof FileOutputLayer) {
                await outputLayer.storeOutput(`\nTransaction ID: ${header.transactionID}\tQuestion: ${question.domainName} \tAnswer: ${answer.rdata}\n`);
                outputLayer.displayOutput('Current state of PersistenceLayer: ' + JSON.stringify(persistence.getResponses()));
            }else if (outputLayer instanceof CLIOutputLayer) {
                outputLayer.displayOutput(`Transaction ID: ${header.transactionID}`);
                outputLayer.displayOutput(`Question: ${question.domainName}`);
                outputLayer.displayOutput(`Answer: ${answer.rdata}`);
                outputLayer.displayOutput('Current state of PersistenceLayer: ' + JSON.stringify(persistence.getResponses()));
        }
    } 
}else {
    outputLayer.displayOutput(`No matching transaction ID found for response.`);
}
}

start();
