# Deployment

BotVille is a two-part deploy: the Node/Express server and the Vite/Phaser client.

**Server.** Any Node 24 host works. This repo ships a `railway.toml`, so on
Railway it is: point the service at the repo root (not `packages/server` — the
monorepo build fails from there), let Nixpacks run the build, and set the
variables from [`packages/server/.env.production.example`](packages/server/.env.production.example).
`ENCRYPTION_SECRET` and `SESSION_SECRET` must be two different random values of
at least 32 characters; the server refuses to start in production otherwise.
`CLIENT_ORIGIN` is an explicit comma-separated allowlist, never `*`.

**Client.** A static Vite build (`vercel.json` is included). If the client and
the server end up on different domains, set `COOKIE_SAMESITE=none` on the server
so the session survives the cross-site request.

**Art.** The LimeZu packs are not in this repo, so a build from a clean checkout
renders missing-texture placeholders. Add the packs before building if you want
the real world — see the README section *About the art*.
