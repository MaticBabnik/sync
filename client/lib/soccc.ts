import EventEmitter from "events";
import type TypedEmitter from "typed-emitter";
import type { EventMap } from "typed-emitter";

interface SocketClose {
    clean: boolean;
    code: number;
    reason: string;
}

interface SocketEvents extends EventMap {
    open: () => any;
    close: (c: SocketClose) => any;
}

enum SocketStatus {
    Connecting = 0,
    Open = 1,
    Closing = 2,
    Closed = 3,
}

export class WebSocc<
    Trecv extends Record<string, {}> = {},
    Tsend extends Record<string, {}> = {}
> extends (EventEmitter as any as {
    new <Ta extends EventMap>(): TypedEmitter<Ta>;
})<
    Omit<{ [P in keyof Tsend]: (body: Tsend[P]) => any }, "close" | "open"> &
        SocketEvents //
> {
    protected ws: WebSocket;

    public constructor(url: string | URL, protocols?: string[]) {
        super();
        this.ws = new WebSocket(url, protocols);

        this.ws.onopen = (x) => this.handleOpen(x);
        this.ws.onclose = (x) => this.handleClose(x);
        this.ws.onmessage = (x) => this.handleMessage(x);
    }

    public get status() {
        return this.ws.readyState as SocketStatus;
    }

    protected handleOpen(_ev: Event) {
        // @ts-ignore this seems to be a bug with typed-emitter
        this.emit("open");
    }

    protected handleClose({ wasClean, code, reason }: CloseEvent) {
        // @ts-ignore this seems to be a bug with typed-emitter
        this.emit("close", { clean: wasClean, code, reason });
    }

    protected handleMessage(ev: MessageEvent) {
        if (typeof ev.data !== "string") return;
        try {
            const obj = JSON.parse(ev.data);
            const type = obj["type"];
            if (typeof type !== "string") return;

            // @ts-ignore can't really secure this
            this.emit(type, obj);
        } catch (e) {
            console.error("Socc invalid message", e);
        }
    }

    public send<Tkey extends keyof Trecv>(type: Tkey, body: Trecv[Tkey]) {
        return this.ws.send(JSON.stringify({ type, ...body }));
    }

    public close(code: number, reason: string) {
        this.ws.close(code, reason);
    }
}
