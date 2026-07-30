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

**Art.** A build with no licensed packs is no longer broken — it bakes the
synthetic fixture pack and renders a complete city in flat colours. That is
what a Vercel Git build produces, and it is deliberately art-free (I-12).

To deploy the real art, run `npm run deploy:client` from a machine that has
`assets-src/`: it bakes with the licensed pack and uploads the built output
with `vercel deploy --prebuilt`. The packs never enter the repo or a Git build.

**Docker.** `docker-compose.yml` is not a third deployment target — it is
local parity for the pair above (and a self-host option), reusing the same
`bake:world`/`bake:agents`/`turbo build` commands Vercel and Railway run. See
the README section *Docker*.
