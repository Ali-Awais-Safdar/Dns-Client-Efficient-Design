import * as dgram from 'dgram';
import * as net from 'net';

interface ITransport {
  sendPacket(packetBuffer: Buffer, serverAddress?: string, port?: number): Promise<any>;
}

const DNS_SERVER = '1.1.1.1';
const DNS_PORT = 53;

class Udp4Transport implements ITransport {
  private socket: dgram.Socket;

  constructor() {
    this.socket = dgram.createSocket('udp4');
  }

  sendPacket(packetBuffer: Buffer, serverAddress: string = DNS_SERVER, port: number = DNS_PORT): Promise<any> {
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
          } catch (decodeError) {
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

class Udp6Transport implements ITransport {
  private socket: dgram.Socket;

  constructor() {
    this.socket = dgram.createSocket('udp6');
  }

  sendPacket(packetBuffer: Buffer, serverAddress: string = DNS_SERVER, port: number = DNS_PORT): Promise<any> {
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
          } catch (decodeError) {
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

class TcpTransport implements ITransport {
  sendPacket(packetBuffer: Buffer, serverAddress: string = DNS_SERVER, port: number = DNS_PORT): Promise<any> {
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

class TransportLayer implements ITransport {
  private udp4: Udp4Transport;
  private udp6: Udp6Transport;
  private tcp: TcpTransport;

  constructor() {
    this.udp4 = new Udp4Transport();
    this.udp6 = new Udp6Transport();
    this.tcp = new TcpTransport();
  }

  sendPacket(packetBuffer: Buffer, serverAddress: string = DNS_SERVER, port: number = DNS_PORT): Promise<any> {
    if (packetBuffer.byteLength > 64) { // 64 bytes = 512 bits
      console.log('Packet length exceeds 512 bits. Using TCP instead of UDP.');
      return this.tcp.sendPacket(packetBuffer, serverAddress, port);
    } else {
      const isIPv6 = serverAddress.includes(':');
      return isIPv6 ? this.udp6.sendPacket(packetBuffer, serverAddress, port) : this.udp4.sendPacket(packetBuffer, serverAddress, port);
    }
  }
}

export { TransportLayer, ITransport };

