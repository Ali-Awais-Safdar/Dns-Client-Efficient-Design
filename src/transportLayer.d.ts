/// <reference types="node" />
interface ITransport {
    sendPacket(packetBuffer: Buffer, serverAddress?: string, port?: number): Promise<any>;
}
declare class TransportLayer implements ITransport {
    private udp4;
    private udp6;
    private tcp;
    constructor();
    sendPacket(packetBuffer: Buffer, serverAddress?: string, port?: number): Promise<any>;
}
export { TransportLayer, ITransport };
