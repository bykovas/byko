# byko-app227

Farcaster mini-app for the 227-BYKO study, served at
`byko-app227.bykovas.lt`. A self-contained Cloudflare **Worker with static
assets** — deployed from this directory, completely separate from the Pages
project that serves `byko.bykovas.lt` (repo `/website` + `/functions`).

**Status: skeleton.** Every API route answers `501` with its own name, the
Durable Object is empty, the seven client screens render only their names,
the D1 schema exists but is never applied by automation. Nothing here can
break the main site: the Pages deploy uploads only `website/` + `functions/`
and does not see this directory.

## Layout

```
app227/
  wrangler.toml        worker config: assets, D1, KV, DO, queues, cron —
                       resource ids are <CREATE-ME> placeholders on purpose
  index.html           vite entry for the client
  public/.well-known/farcaster.json   manifest STUB — unsigned
  src/
    client/            hash-router + 7 stub screens (start, auth, profile,
                       checks, check, result, metrics)
    worker/
      index.ts         routing; queue + cron handlers (empty)
      routes/          auth, profile, advance, checks, metrics, webhook → 501
      do/fid-lock.ts   one DO per fid, serialises per-user actions (empty)
      db/schema.sql    D1 schema, applied by hand only
    shared/types.ts    Env + Claim (the /data/claims.json shape)
  .dev.vars.example    secret names for local dev, values never in the repo
```

## Local development

```bash
cd app227
npm install
npm run dev        # vite: client only, http://localhost:5173
npm run start      # build + wrangler dev: worker + assets together
```

`wrangler dev` reads local secrets from `.dev.vars` (copy
`.dev.vars.example`, fill values). D1/KV/DO/queues run on local simulators —
no cloud resources needed for the skeleton.

## Deploying (manual, never from CI)

1. Create the resources once (from `app227/`):
   ```bash
   wrangler d1 create byko-app227           # → database_id
   wrangler kv namespace create byko-app227 # → namespace id
   wrangler queues create byko-app227-jobs
   ```
2. Replace the `<CREATE-ME: …>` placeholders in `wrangler.toml` with the
   returned ids. wrangler refuses to deploy while they remain — intended.
3. Apply the schema by hand when the app grows real logic:
   ```bash
   wrangler d1 execute byko-app227 --remote --file=src/worker/db/schema.sql
   ```
4. Set production secrets: `wrangler secret put NEYNAR_API_KEY` etc.
   (the list mirrors `.dev.vars.example`).
5. `npm run deploy` — builds the client, deploys the worker. The custom
   domain `byko-app227.bykovas.lt` attaches on first deploy (the zone is
   already on Cloudflare).

## The claims feed

The app reads its facts from the main site:
`https://byko.bykovas.lt/data/claims.json` (CORS-open for exactly this
file). The feed is produced in the site's publish flow —
`website/content/claims.md` → `scripts/emit-claims.mjs` — and validated by
`scripts/test-claims.mjs` in the same CI step as the diary tests. The shape
is `shared/types.ts → Claim`.

## Farcaster manifest

`public/.well-known/farcaster.json` ships **unsigned**: `accountAssociation`
is empty. Before the app is announced it must be signed with the custody key
of the Farcaster account that owns it (@bykocoin), and the `miniapp` block
filled per the current spec — check the field name (`miniapp` vs legacy
`frame`) against the docs at signing time.
