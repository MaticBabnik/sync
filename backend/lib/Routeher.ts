// Route her???
// I hardly even know her!

import { escapeHTML, inspect, Server } from 'bun';
type Split<S extends string> = string extends S
    ? string[]
    : S extends ''
    ? []
    : S extends `${infer T}/${infer U}`
    ? [T, ...Split<U>]
    : [S];

type ExtractParams<S extends string> = {
    [K in Split<S>[number] as K extends `:${infer N}` ? N : never]: string;
};

type Path2 = ExtractParams<'/test/:id'>;

type StrictMethods =
    | 'GET'
    | 'HEAD'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'CONNECT'
    | 'OPTIONS'
    | 'TRACE'
    | 'PATCH';

type AllMethods = StrictMethods | (string & {});

interface BaseRq<
    Tmethod = AllMethods,
    Tparams = {},
    Tquery = URLSearchParams,
    Theaders = Headers,
    Thash = string | undefined,
> {
    readonly og: Request;

    readonly method: Tmethod;
    readonly headers: Theaders;

    readonly rawUrl: string;

    readonly params: Tparams;
    readonly query: Tquery;
    readonly hash: Thash;

    //todo: is this real?
    readonly signal: AbortSignal;
}

export interface Rq<
    Tmethod = AllMethods,
    Tparams = {},
    Tquery = URLSearchParams,
    Theaders = Headers,
    Thash = string | undefined,
    Tbody = {},
> extends BaseRq<Tmethod, Tparams, Tquery, Theaders, Thash> {
    body: Tbody;
}

export interface RqServer<T = undefined> {
    upgrade(
        request: Request,
        options?: {
            headers?: Bun.HeadersInit;
            data?: T;
        },
    ): boolean;
}

type MaybePromise<T> = Promise<T> | T;

class RouteBuilder<
    Tserv,
    Turl extends string,
    Tmethod extends string,
    Vpar,
    Vq,
    Vhead,
    Vhash,
    Vbody,
> {
    protected paramsv: ((x: any) => Vq) | undefined;
    protected queryv: ((x: any) => Vq) | undefined;
    protected headersv: ((x: any) => Vhead) | undefined;
    protected hashv: ((x: any) => Vhash) | undefined;
    protected bodyv: ((x: any) => Vbody) | undefined;

    constructor(
        protected router: Router<Tserv>,
        protected method: Tmethod,
        protected url: string,
    ) {}

    public params<Npar>(validator: (x: Vpar) => Npar) {
        if (this.paramsv) throw new Error('Validator already attached');
        this.paramsv = validator as any;
        return this as any as RouteBuilder<
            Tserv,
            Turl,
            Tmethod,
            Npar,
            Vq,
            Vhead,
            Vhash,
            Vbody
        >;
    }

    public query<Nq>(validator: (x: Vq) => Nq) {
        if (this.queryv) throw new Error('Validator already attached');
        this.queryv = validator as any;
        return this as any as RouteBuilder<
            Tserv,
            Turl,
            Tmethod,
            Vpar,
            Nq,
            Vhead,
            Vhash,
            Vbody
        >;
    }

    public headers<Nhead>(validator: (x: Vhead) => Nhead) {
        if (this.headersv) throw new Error('Validator already attached');
        this.headersv = validator as any;
        return this as any as RouteBuilder<
            Tserv,
            Turl,
            Tmethod,
            Vpar,
            Vq,
            Nhead,
            Vhash,
            Vbody
        >;
    }

    public hash<Nhash>(validator: (x: Vhash) => Nhash) {
        if (this.hashv) throw new Error('Validator already attached');
        this.hashv = validator as any;
        return this as any as RouteBuilder<
            Tserv,
            Turl,
            Tmethod,
            Vpar,
            Vq,
            Vhead,
            Nhash,
            Vbody
        >;
    }

    public body<Nbody>(validator: (x: Vbody) => Nbody) {
        if (this.bodyv) throw new Error('Validator already attached');
        this.bodyv = validator as any;
        return this as any as RouteBuilder<
            Tserv,
            Turl,
            Tmethod,
            Vpar,
            Vq,
            Vhead,
            Vhash,
            Nbody
        >;
    }

    public action<Tserv>(
        handler: (
            req: Rq<Tmethod, Vpar, Vq, Vhead, Vhash, Vbody>,
            server: RqServer<Tserv>,
        ) => MaybePromise<Response | void>,
    ): void {
        if (this.paramsv ?? this.queryv ?? this.hashv ?? this.bodyv) {
            this.router.register(
                this.method,
                this.url,
                (r: any, s: RqServer<Tserv>) => {
                    if (this.paramsv) r.params = this.paramsv(r.params);
                    if (this.queryv) r.query = this.queryv(r.query);
                    if (this.headersv) r.headers = this.headersv(r.headers);
                    if (this.hashv) r.hash = this.hashv(r.hash);
                    if (this.bodyv) r.body = this.bodyv(r.body);
                    handler(r, s);
                },
            );
            return;
        }

        this.router.register(this.method, this.url, handler as any);
    }
}

type RouterCallback = (
    r: Rq,
    s: RqServer<any>,
) => MaybePromise<Response | void>;

interface RouterNode {
    index?: RouterCallback;
    paramNames?: string[];

    children: Record<string, RouterNode>;
    paramChild?: RouterNode;
}

export class Router<T> {
    protected root: Record<string, RouterNode> = {};

    public register(method: string, url: string, cb: RouterCallback) {
        const methodRoot =
            this.root[method] ?? (this.root[method] = { children: {} });

        const framgents = url.split('/').filter((x) => x.length > 1);

        const params = [];

        let currentNode = methodRoot;

        for (let frag of framgents) {
            if (frag.startsWith(':')) {
                params.push(frag.slice(1));
                currentNode =
                    currentNode.paramChild ??
                    (currentNode.paramChild = { children: {} });
                continue;
            }

            currentNode =
                currentNode.children[frag] ??
                (currentNode.children[frag] = { children: {} });
        }

        if (currentNode.index)
            throw new Error(`Callback already set for ${framgents.join('/')}`);

        if (params.length > 0) currentNode.paramNames = params;
        currentNode.index = cb;
    }

    private resolveRoute(method: string, url: string) {
        let node = this.root[method];
        if (!node) return undefined;

        const pa: string[] = [];
        const frags = url.split('/').filter((x) => x.length > 0);

        for (const frag of frags) {
            node = node.children[frag] ?? (pa.push(frag), node.paramChild);
            if (!node) return undefined;
        }

        if (pa.length) {
            return {
                node,
                params: pa.reduce(
                    (p, x, i) => ((p[node.paramNames![i]] = x), p),
                    {} as Record<string, string>,
                ),
            };
        }

        return { node, params: pa };
    }

    protected async _fetch(req: Request, srv: Server): Promise<Response> {
        const url = new URL(req.url, srv.url);
        const route = this.resolveRoute(req.method, url.pathname);

        if (!route || !route.node.index)
            return new Response('Not found', { status: 404 });

        const rq: Rq = {
            og: req,
            method: req.method,
            rawUrl: url.toString(),
            params: route.params,
            hash: url.hash,
            headers: req.headers,
            query: url.searchParams,
            // TODO: fix body handling
            body: req.bodyUsed ? await req.json() : undefined,
            signal: req.signal,
        };

        try {
            const response = await route.node.index!(rq, srv);

            return (
                response ??
                new Response('Handler returned nothing', { status: 500 })
            );
        } catch (e: unknown) {
            if (e instanceof HTTPError) {
                return e.response;
            }

            if (srv.development)
                return new Response(
                    `<h1>Internal server error</h2>
                    <pre>${escapeHTML((e as any).toString?.() ?? e)}</pre>`,
                    { status: 500 },
                );
            else return new Response('Internal server error', { status: 500 });
        }
    }

    public get fetch() {
        return this._fetch.bind(this);
    }

    public get<Turl extends string>(url: Turl) {
        return new RouteBuilder<
            T,
            Turl,
            'GET',
            ExtractParams<Turl>,
            URLSearchParams,
            Headers,
            string | undefined,
            unknown
        >(this, 'GET', url);
    }

    public head<Turl extends string>(url: Turl) {
        return new RouteBuilder<
            T,
            Turl,
            'HEAD',
            ExtractParams<Turl>,
            URLSearchParams,
            Headers,
            string | undefined,
            unknown
        >(this, 'HEAD', url);
    }

    public post<Turl extends string>(url: Turl) {
        return new RouteBuilder<
            T,
            Turl,
            'POST',
            ExtractParams<Turl>,
            URLSearchParams,
            Headers,
            string | undefined,
            unknown
        >(this, 'POST', url);
    }

    public put<Turl extends string>(url: Turl) {
        return new RouteBuilder<
            T,
            Turl,
            'PUT',
            ExtractParams<Turl>,
            URLSearchParams,
            Headers,
            string | undefined,
            unknown
        >(this, 'PUT', url);
    }

    public delete<Turl extends string>(url: Turl) {
        return new RouteBuilder<
            T,
            Turl,
            'DELETE',
            ExtractParams<Turl>,
            URLSearchParams,
            Headers,
            string | undefined,
            unknown
        >(this, 'DELETE', url);
    }
}

export function json(
    json: any,
    status = 200,
    headers: Record<string, string> = {},
) {
    return new Response(JSON.stringify(json), {
        status,
        headers: {
            ...headers,
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}

export class HTTPError extends Error {
    constructor(
        public readonly status: number,
        public readonly error: object | string,
    ) {
        super(status.toString());
    }

    public get response() {
        if (typeof this.error == 'object') {
            return json(this.error, this.status);
        }
        return new Response(this.error, { status: this.status });
    }
}
