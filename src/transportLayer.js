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
exports.TransportLayer = void 0;
const dgram = __importStar(require("dgram"));
const net = __importStar(require("net"));
const DNS_SERVER = '1.1.1.1';
const DNS_PORT = 53;
class Udp4Transport {
    socket;
    constructor() {
        this.socket = dgram.createSocket('udp4');
    }
    sendPacket(packetBuffer, serverAddress = DNS_SERVER, port = DNS_PORT) {
        return new Promise((resolve, reject) => {
            this.socket.send(packetBuffer, port, serverAddress, (err) => {
                if (err) {
                    reject(`Error sending packet: ${err.message}`);
                    return;
                }
                console.log(`Packet sent to ${serverAddress} (IPv4)`);
                this.socket.on('message', (msg) => {
                    try {
                        resolve(msg);
                    }
                    catch (decodeError) {
                        reject(`Error decoding response: ${decodeError}`);
                    }
                });
                this.socket.on('error', (error) => {
                    reject(`Socket error: ${error.message}`);
                });
            });
        });
    }
}
class Udp6Transport {
    socket;
    constructor() {
        this.socket = dgram.createSocket('udp6');
    }
    sendPacket(packetBuffer, serverAddress = DNS_SERVER, port = DNS_PORT) {
        return new Promise((resolve, reject) => {
            this.socket.send(packetBuffer, port, serverAddress, (err) => {
                if (err) {
                    reject(`Error sending packet: ${err.message}`);
                    return;
                }
                console.log(`Packet sent to ${serverAddress} (IPv6)`);
                this.socket.on('message', (msg) => {
                    try {
                        resolve(msg);
                    }
                    catch (decodeError) {
                        reject(`Error decoding response: ${decodeError}`);
                    }
                });
                this.socket.on('error', (error) => {
                    reject(`Socket error: ${error.message}`);
                });
            });
        });
    }
}
class TcpTransport {
    sendPacket(packetBuffer, serverAddress = DNS_SERVER, port = DNS_PORT) {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.connect(port, serverAddress, () => {
                console.log(`TCP connection established with ${serverAddress}`);
                // DNS over TCP prepends the packet with the length (2 bytes)
                const lengthBuffer = Buffer.alloc(2);
                lengthBuffer.writeUInt16BE(packetBuffer.length, 0);
                client.write(Buffer.concat([lengthBuffer, packetBuffer]));
            });
            client.on('data', (data) => {
                client.destroy(); // Kill the connection after receiving the response
                resolve(data.subarray(2)); // Remove the length prepended by TCP
            });
            client.on('error', (err) => {
                reject(`TCP error: ${err.message}`);
            });
            client.on('close', () => {
                console.log('TCP connection closed');
            });
        });
    }
}
class TransportLayer {
    udp4;
    udp6;
    tcp;
    constructor() {
        this.udp4 = new Udp4Transport();
        this.udp6 = new Udp6Transport();
        this.tcp = new TcpTransport();
    }
    sendPacket(packetBuffer, serverAddress = DNS_SERVER, port = DNS_PORT) {
        if (packetBuffer.byteLength > 64) { // 64 bytes = 512 bits
            console.log('Packet length exceeds 512 bits. Using TCP instead of UDP.');
            return this.tcp.sendPacket(packetBuffer, serverAddress, port);
        }
        else {
            const isIPv6 = serverAddress.includes(':');
            return isIPv6 ? this.udp6.sendPacket(packetBuffer, serverAddress, port) : this.udp4.sendPacket(packetBuffer, serverAddress, port);
        }
    }
}
exports.TransportLayer = TransportLayer;
