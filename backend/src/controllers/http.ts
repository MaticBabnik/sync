import { json, Router } from '../../lib/Routeher';

function makeCtx() {
    return {
        data: { id: ~~(Math.random() * 100000) },
    };
}

export const app = new Router<{ id: number }>();

app.get('/ws').action((r, s) =>
    s.upgrade(r.og, makeCtx())
        ? new Response()
        : new Response('upgrade failed', { status: 500 }),
);

app.get('/test/:name/hi').action((r, s) => {
    return json({ truth: `${r.params.name} is the 🐐` });
});
