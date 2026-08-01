# Deployment

BotVille self-hosts as two Docker-packaged Node apps — the Express server
and the static Vite/Phaser client — the same shape as the platform's own
api/frontend pair (D-20). `docker-compose.yml` builds and runs both; see the
README's *Docker* section for the exact commands and the agent-roster shape.

**Server.** Any Node 24 host works; the Docker image (`Dockerfile.server`)
builds from the repo root with `turbo build --filter=@botville/server`, the
same command a bare-metal install would run. Set the variables from
[`packages/server/.env.production.example`](packages/server/.env.production.example)
in `packages/server/.env` — `docker compose up` reads it via the server
service's `env_file` (optional: absent is fine, `required: false`).
`ENCRYPTION_SECRET` and `SESSION_SECRET` must be two different random values
of at least 32 characters; the server refuses to start in production
otherwise. `CLIENT_ORIGIN` is an explicit comma-separated allowlist, never
`*`.

**Client.** A static Vite build, served by nginx (`Dockerfile.client`,
`nginx.conf`). If the client and the server end up on different origins, set
`COOKIE_SAMESITE=none` on the server so the session survives the cross-site
request.

**Embedding (frame-ancestors CSP).** The platform frontend embeds the town
in an iframe (`/botville`), so `nginx.conf` sends
`Content-Security-Policy: frame-ancestors …` — an explicit origin
allowlist, never `*`, mirroring the server's `CLIENT_ORIGIN` rule. The
nginx config has no env-substitution step (Dockerfile.client `COPY`s it
verbatim), so the checked-in value is the dev default
(`http://localhost:3000`, the platform frontend's dev origin); at deploy
time, edit the space-separated origin list in `nginx.conf` to the real
frontend origin(s) and rebuild the client image. Origins not on the list
are refused by the browser (the frame renders blank — check devtools for
the CSP violation when debugging).

**Art.** A build with no licensed packs is not broken — it bakes the
synthetic fixture pack and renders a complete city in flat colours. That is
what `docker compose build` produces with no environment set, and it is
deliberately art-free (I-12): `.dockerignore` excludes `assets-src/`, the
frozen legacy pipeline's vendor-named output, contact sheets (`contact/`),
and the per-cell pack inventory (`sources/*.index.json`) — every gitignored,
art-bearing path on disk, not just the obvious one — from every build
context, so a plain build cannot pick up licensed pixels even by accident.
`test/deploy-config.test.mjs` pins this list so a future path that should be
excluded and isn't fails the suite instead of riding along into a built
image quietly.

**Serving the real art.** Two ways, both requiring you to hold the LimeZu
licence yourself, and both meaning the resulting artifacts are yours to keep
private:

1. **Bake it into the image at build time.** Set `BOTVILLE_PACK=limezu` and
   `BOTVILLE_SRC_ROOT=assets-src`, and deliberately comment out the
   `assets-src` line in `.dockerignore` locally (never commit that change) so
   the build context actually contains the source pixels:
   ```bash
   BOTVILLE_PACK=limezu BOTVILLE_SRC_ROOT=assets-src docker compose build
   ```
   This bakes world geometry (tilesets, props, tilemaps) straight into the
   client image. Do not push these images to a public registry.

2. **Bake agent appearance sheets on the host, mount them in — no image
   rebuild, and Docker never sees `assets-src/`.** Run the batch bake
   directly with Node, outside Docker:
   ```bash
   node scripts/sync-assets.mjs limezu assets-src
   npm run bake:agents -- --pack limezu --src assets-src --roster roster/roster.json --out /path/on/host/baked
   ```
   then point the client service's volume at that host directory instead of
   the named `botville-baked` volume (edit the `volumes:` line under
   `client:` in `docker-compose.yml`, or add a
   `docker-compose.override.yml`). The running container serves whatever is
   in that directory; a sheet that isn't there yet falls back to a default
   (spec §8.3). This only covers per-agent appearance sheets — world
   geometry has no runtime mount today and still needs option 1.
