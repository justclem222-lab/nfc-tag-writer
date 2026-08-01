# Supabase setup

Two separate things live behind Supabase here — set up whichever you need.

1. **Shared reminders** (sync across phones) — just the `logs` and `tasks`
   tables.
2. **Missed-task alerts** (push notification if something isn't logged by a
   set time) — needs (1) plus `push_subscriptions`, a deployed Edge
   Function, and a cron job. More setup, and the one part of this project
   that hasn't been tested against a real Supabase project — if a step
   below throws an error, paste it back and it can be fixed against the
   real message.

You can reuse the same Supabase project as the Swear Jar app for either.

## 1. Shared reminders only

1. Create a project at supabase.com if you don't have one.
2. Dashboard → SQL Editor → paste in `schema.sql` from this folder → Run.
3. Dashboard → Project Settings → API → copy the Project URL and the
   `anon` `public` key.
4. In `index.html`, find the `CONFIG` block near the top of the `<script>`
   and fill in:
   ```js
   const SUPABASE_URL = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```
5. Re-deploy (drag the folder onto Netlify Drop again, or push to GitHub).

That's enough for "Shared" reminders to sync and for the Reminders tab to
show today's status across phones.

## 2. Missed-task alerts (push notifications)

Needs the Supabase CLI installed and logged in (`npm install -g
supabase`, then `supabase login`).

### a. VAPID keys

Generate your own keypair when you're ready to do this step — don't reuse
any key shown earlier in chat, and don't commit the private half to this
repo (it's public on GitHub Pages):

```bash
npx web-push generate-vapid-keys
```

This prints a public and private key. Keep both handy for steps c and e —
the public key is safe to commit (it ends up in `index.html`, sent to every
browser anyway); the private key only ever goes into the `supabase secrets
set` command below, run locally, never saved to a file in this project.

### b. Deploy the Edge Function

From this folder:

```bash
supabase link --project-ref your-project-ref
supabase functions deploy check-reminders
```

### c. Set secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY=paste-your-public-key
supabase secrets set VAPID_PRIVATE_KEY=paste-your-private-key
supabase secrets set VAPID_SUBJECT=mailto:you@example.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to
every Edge Function automatically — no need to set those.

### d. Schedule it

Dashboard → Database → Extensions → enable `pg_cron` and `pg_net` if not
already on. Then SQL Editor → paste this, replacing `your-project-ref` and
`your-service-role-key` (Project Settings → API → `service_role` key):

```sql
select cron.schedule(
  'check-reminders-job',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/check-reminders',
    headers := '{"Authorization": "Bearer your-service-role-key", "Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

This runs the check every 15 minutes. The function itself skips anything
not yet due and anything already alerted today, so running it often is
fine.

### e. Add the public key to the app

In `index.html`'s `CONFIG` block:

```js
const VAPID_PUBLIC_KEY = 'paste-your-public-key';
```

Re-deploy the static site.

### f. Turn it on, on your phone

Reminders tab → a banner appears near the top → **Enable** → grant the
notification permission when Chrome asks. Do this on every phone you want
alerts to reach — there's no per-person targeting yet, every phone with
notifications on gets pinged for every missed "Shared" alert-enabled task.

Then edit (or create) a Shared reminder, tick **Remind me if not done by**,
set a time, save.

### Timezone

The Edge Function has `Australia/Sydney` hardcoded (`TIMEZONE` constant
near the top of `supabase/functions/check-reminders/index.ts`) and
`index.html` has a matching `TIMEZONE_LABEL` used only for the hint text.
If you move timezones, update both.
