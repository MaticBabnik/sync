import { type } from 'arktype';
import { SafeWs, WsBody, WsTypeBuilder, WsBase, Socc, Ws } from '../../lib/Socc';

interface SyncCtx {
    id: number;
}

const sck = new WsTypeBuilder<SyncCtx>()
    .addRecv('test', type({ hello: 'string' }))
    .addSend<'test', { hello: number }>();

export type Sck = typeof sck; // export this for the client

@Socc(sck)
export class Example extends WsBase<Sck> implements SafeWs<Sck> {
    test(sock: Ws<SyncCtx>, body: WsBody<Sck, 'test'>) {
        console.log(`Socket ${sock.data.id} says hello to ${body.hello}`);
        this.send(sock, 'test', { hello: sock.data.id });
    }
}
