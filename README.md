# NFC Tags

A single web page for programming NFC stickers for two kinds of small tasks:

- **Messages** — write a preset text message to a tag. Tap it, Messages
  opens pre-filled, ready to send.
- **Reminders** — write a tag for something you want a physical record of
  doing (fed the cat, took a pill, took a supplement). Tap it and the tap
  itself is the log — no app to open, no box to tick.

No app install. Runs in Chrome on Android using the Web NFC API.

## Why this exists

IFTTT and most NFC apps can trigger settings toggles or open apps from a tag,
but they can't hand the Messages app a pre-filled body, and they don't give
you a habit log tied to an actual physical action — this does both directly.

## Requirements

- An Android phone with NFC, using Chrome (Web NFC isn't supported in
  Safari/iOS, or in Firefox).
- Web NFC only runs over HTTPS (or `localhost`), so this needs to be hosted
  somewhere — it won't work opened as a local `file://` page.

## Hosting it (pick one)

**Netlify Drop (no git, 2 minutes)**
1. Go to https://app.netlify.com/drop in a browser.
2. Drag this whole `nfc-tag-writer` folder onto the page.
3. It gives you a URL like `random-name.netlify.app` — open that on your
   phone in Chrome.

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → deploy from the branch/folder containing
   `index.html`.
3. Open the resulting `https://<user>.github.io/<repo>/` URL on your phone.

## Using it — Messages

1. Open the hosted URL in Chrome on your phone, **Messages** tab.
2. Tap **+**, give the preset a name, optionally a phone number (leave blank
   to pick the recipient yourself when the tag is tapped later), and the
   message text. Save.
3. Tap **Write to tag**, then hold a blank NFC sticker to the back of your
   phone until it confirms "Written!".
4. Tap the sticker any time — it opens Messages with that text ready to send.

## Using it — Reminders

1. **Reminders** tab → tap **+** → give it an emoji and a name (e.g. "Fed
   the cat"), and choose:
   - **Shared** — any phone that taps the tag logs to the same place, so you
     can see it from your phone even if your daughter's the one who tapped.
     Requires Supabase (see below) — without it, "shared" tasks just behave
     as this-device-only.
   - **This device only** — stays entirely on the phone that taps it, never
     leaves the device.
2. Tap **Write to tag**, hold a blank sticker to your phone until it
   confirms "Written!". Stick it somewhere physical — the cat food bin, a
   pill box.
3. From then on, tapping the sticker with any phone (Chrome, NFC on) opens
   the page straight to a confirmation screen: logs the time, shows when it
   was last done, no further taps needed. Tap **Done** to go back.
4. The Reminders tab shows, per task, whether it's been logged today and at
   what time — glance at it any time without needing to tap anything.
5. Optional — tick **Remind me if not done by** on a Shared task and set a
   time: if nobody's tapped that tag by then, every phone with notifications
   turned on gets a push alert. See "Missed-task alerts" below to set this up.

### Enabling "Shared" (optional)

Shared reminders need a Supabase project to sync across phones. Full steps
are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — short version: run
`schema.sql` against a Supabase project, paste the project URL and anon key
into the `CONFIG` block in `index.html`, re-deploy.

Without this, everything still works — "Shared" tasks just fall back to
logging locally on whichever device taps them, same as "This device only".

### Missed-task alerts (optional, bigger setup)

A genuine "you haven't taken your pill by 9pm" push notification — not just
a checklist you have to remember to glance at. This needs Shared reminders
already set up, plus a scheduled Supabase Edge Function and each phone
subscribing to Web Push. Full steps, including a ready-made VAPID keypair,
are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md). This is the one part of the
project that hasn't been run against a live Supabase project — if a step
errors, share the error and it can be fixed against the real message.

Add to your home screen (Chrome menu → *Add to Home screen*) for one-tap
access instead of reopening the browser each time.
