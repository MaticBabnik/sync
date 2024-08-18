// socc - sockets that succ

import type { Type } from 'arktype';
import { ServerWebSocket, WebSocketHandler } from 'bun';

/**
 * A tiny class to make building socket APIs nicer
 */
export class WsTypeBuilder<
    Tctx = {},
    Trecv extends Record<string, {}> = {},
    Tsend extends Record<string, {}> = {},
> {
    protected validators: Record<string, Type> = {};

    addRecv<Tkey extends string, Tval>(key: Tkey, value: Type<Tval>) {
        this.validators[key] = value;
        return this as unknown as Tval extends { type: any }
            ? never //disallow key "type" on root
            : WsTypeBuilder<
                  Tctx,
                  Trecv & {
                      [P in Tkey]: Tval;
                  },
                  Tsend
              >;
    }

    addSend<Tkey extends string, Tval>() {
        return this as unknown as WsTypeBuilder<
            Tctx,
            Trecv,
            Tsend & { [P in Tkey]: Tval }
        >;
    }

    toValidators() {
        return this.validators;
    }

    get tRecv(): Trecv {
        throw new Error();
    }

    get tSend(): Tsend {
        throw new Error();
    }
}

/**
 * A subset of the real Socket interface that ensures no unsafe messages can be sent
 */
export interface Ws<Tctx = undefined> {
    close(code?: number, reason?: string): void;
    terminate(): void;
    ping(data?: string | BufferSource): number;
    pong(data?: string | BufferSource): number;
    subscribe(topic: string): void;
    unsubscribe(topic: string): void;
    isSubscribed(topic: string): boolean;
    readonly remoteAddress: string;
    readonly readyState: 0 | 1 | 2 | 3;
    binaryType?: 'nodebuffer' | 'arraybuffer' | 'uint8array';
    data: Tctx;
}

/**
 * A semi-nice way to get the body type
 */
export type WsBody<
    T extends WsTypeBuilder,
    Tkey extends keyof (T extends WsTypeBuilder<any, infer Trecv, any>
        ? Trecv
        : never),
> = T extends WsTypeBuilder<any, infer Trecv, any>
    ? Trecv extends Record<Tkey, any>
        ? Trecv[Tkey]
        : never
    : never;

/**
 * Implement this interface to make sure your handlers are type safe
 */
export type SafeWs<T extends WsTypeBuilder> = T extends WsTypeBuilder<
    infer Tctx,
    infer Trecv,
    any
>
    ? {
          [P in keyof Trecv]: (sock: Ws<Tctx>, body: Trecv[P]) => any;
      }
    : never;

export class WsBase<T extends WsTypeBuilder> {
    public static make<T extends WsTypeBuilder>(
        x: WsBase<T>,
    ): WebSocketHandler<T extends WsTypeBuilder<infer Tctx> ? Tctx : never> {
        // TODO(mbabnik): make this less bad
        return x as any;
    }

    public message(
        ws: ServerWebSocket<
            T extends WsTypeBuilder<infer Tctx, any, any> ? Tctx : never
        >,
        body: string | ArrayBufferLike,
    ) {
        throw new Error('DID YOU FORGET TO APPLY THE DECORATOR?');
    }

    public send<
        Tkey extends T extends WsTypeBuilder<any, any, infer Tsend>
            ? keyof Tsend
            : never,
    >(
        sock: Ws<any>,
        type: Tkey,
        obj: T extends WsTypeBuilder<any, any, infer Tsend>
            ? Tsend[Tkey]
            : never,
    ) {
        (sock as unknown as ServerWebSocket).send(
            JSON.stringify({ type, ...obj }),
        );
    }

    public publish<
        Tkey extends T extends WsTypeBuilder<any, any, infer Tsend>
            ? keyof Tsend
            : never,
    >(
        sock: Ws<any>,
        topic: string,
        type: Tkey,
        obj: T extends WsTypeBuilder<any, any, infer Tsend>
            ? Tsend[Tkey]
            : never,
    ) {
        (sock as unknown as ServerWebSocket).publish(
            topic,
            JSON.stringify({ type, ...obj }),
        );
    }

    public open(sock: Ws<T extends WsTypeBuilder<infer Tctx> ? Tctx : never>) {}

    public close(
        sock: Ws<T extends WsTypeBuilder<infer Tctx> ? Tctx : never>,
        code: number,
        reason: string,
    ) {}
}

/**
 * Real and true
 * @param b the builder instance
 * @returns ???
 */
export function Socc<Tctx extends {}, Trecv extends {}, Tsend extends {}>(
    b: WsTypeBuilder<Tctx, Trecv, Tsend>,
) {
    return function <
        Tproto extends new (...args: any[]) => WsBase<
            WsTypeBuilder<Tctx, Trecv, Tsend>
        >,
    >(og: Tproto): any {
        return class extends og {
            constructor(...args: any[]) {
                const validators = b.toValidators();
                super(...args);
                this.message = (ws: ServerWebSocket<any>, body: unknown) => {
                    if (typeof body !== 'string') return;
                    try {
                        const obj = JSON.parse(body);
                        const type = obj['type'];
                        if (typeof type !== 'string') return;
                        if (!(type in validators) || !(type in this)) return;
                        const validator = validators[type];
                        validator.assert(obj);
                        //@ts-ignore
                        this[type](ws, obj);
                    } catch (error) {
                        return;
                    }
                };
            }
        };
    };
}
