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
const validDomain_1 = require("./validDomain");
const createPacket_1 = require("./createPacket");
const transportLayer_1 = require("./transportLayer");
const persistanceLayer_1 = require("./persistanceLayer");
const inputLayer_1 = require("./inputLayer");
const outputLayer_1 = require("./outputLayer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function queryFlow(domain, queryType, transport, persistence, outputLayer) {
    try {
        let packet = new createPacket_1.DNSPacket(domain, queryType);
        let packetBuffer = packet.getBuffer();
        const transactionID = packet.headerId;
        persistence.storeTransactionID(transactionID.readUInt16BE(0));
        const msg = await transport.sendPacket(packetBuffer);
        await responseHandler(msg, persistence, outputLayer);
    }
    catch (error) {
        console.error(error);
    }
}
async function start() {
    const inputArg = process.argv.slice(2).join(' ');
    if (!inputArg) {
        console.log('Please provide a file name or a direct query.');
        process.exit(1);
    }
    const persistence = new persistanceLayer_1.PersistenceLayer();
    const transport = new transportLayer_1.TransportLayer();
    let inputLayer;
    let outputLayer;
    if (fs.existsSync(path.resolve(__dirname, inputArg))) {
        inputLayer = new inputLayer_1.FileInputLayer(path.resolve(__dirname, inputArg));
        outputLayer = new outputLayer_1.FileOutputLayer('output.txt');
    }
    else {
        inputLayer = new inputLayer_1.CLIInputLayer();
        outputLayer = new outputLayer_1.CLIOutputLayer();
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
    }
    catch (err) {
        console.error(`Error reading file or processing input '${inputArg}':`, err);
        process.exit(1);
    }
    process.exit(0);
}
async function validateQuery(domain, queryType, persistence, transport, outputLayer) {
    let QUERY_TYPE;
    if (queryType === 'A' || queryType === 'AAAA' || queryType === 'CNAME' || queryType === 'MX') {
        QUERY_TYPE = queryType;
    }
    else {
        outputLayer.displayOutput(`Unsupported query type: ${queryType}`);
        return;
    }
    let DOMAIN_TO_RESOLVE = domain;
    if (!(0, validDomain_1.isValidDomain)(DOMAIN_TO_RESOLVE)) {
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
async function responseHandler(msg, persistence, outputLayer) {
    const response = createPacket_1.DNSPacket.decodePacket(msg);
    const { header, question, answer } = response;
    const index = persistence.getTransactionIndex(header.transactionID);
    if (index !== undefined) {
        if (answer.rdata === '') {
            outputLayer.displayOutput('No records found.');
        }
        else {
            if (outputLayer instanceof outputLayer_1.FileOutputLayer) {
                await outputLayer.storeOutput(`\nTransaction ID: ${header.transactionID}\tQuestion: ${question.domainName} \tAnswer: ${answer.rdata}\n`);
                outputLayer.displayOutput('Current state of PersistenceLayer: ' + JSON.stringify(persistence.getResponses()));
            }
            else if (outputLayer instanceof outputLayer_1.CLIOutputLayer) {
                outputLayer.displayOutput(`Transaction ID: ${header.transactionID}`);
                outputLayer.displayOutput(`Question: ${question.domainName}`);
                outputLayer.displayOutput(`Answer: ${answer.rdata}`);
                outputLayer.displayOutput('Current state of PersistenceLayer: ' + JSON.stringify(persistence.getResponses()));
            }
        }
    }
    else {
        outputLayer.displayOutput(`No matching transaction ID found for response.`);
    }
}
start();
