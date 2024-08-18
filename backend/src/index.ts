import { WsBase } from '../lib/Socc';
import { Example } from './controllers/websocket';
import { app } from './controllers/http';

const server = Bun.serve({
    fetch: app.fetch,
    websocket: WsBase.make(new Example()),
});

console.log('Live and alive @ ' + server.url);
