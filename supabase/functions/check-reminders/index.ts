// Runs on a schedule (see SUPABASE_SETUP.md for the pg_cron job that calls
// this). For each "Shared" reminder task with alerts turned on, checks
// whether it's been logged today (in TIMEZONE) by its alert_time — if not,
// and it hasn't already alerted today, sends a Web Push notification to
// every subscribed device.
//
// NOTE: this file hasn't been run against a live Supabase project — it's
// written against web-push's documented API, but Deno/npm-specifier
// behaviour can only be confirmed by actually deploying it. If `supabase
// functions deploy` or the scheduled run errors, paste the error back and
// it can be fixed against the real message.

import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:you@example.com";

// Baked in rather than configurable — change here if you move timezones.
const TIMEZONE = "Australia/Sydney";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

function getWallTime(now: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return `${parts.hour}:${parts.minute}`;
}

function getDateString(now: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getTimeZoneOffsetMinutes(now: Date, timeZone: string): number {
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes);
}

function startOfTodayUtcIso(now: Date, timeZone: string): string {
  const dateStr = getDateString(now, timeZone);
  const [y, m, d] = dateStr.split("-").map(Number);
  const offsetMin = getTimeZoneOffsetMinutes(now, timeZone);
  const utcMidnightGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(utcMidnightGuess - offsetMin * 60_000).toISOString();
}

Deno.serve(async () => {
  const now = new Date();
  const todayStr = getDateString(now, TIMEZONE);
  const wallTime = getWallTime(now, TIMEZONE);
  const todayStartUtc = startOfTodayUtcIso(now, TIMEZONE);

  const tasksRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tasks?alert_enabled=eq.true&or=(last_alerted_date.is.null,last_alerted_date.neq.${todayStr})`,
    { headers: restHeaders },
  );
  if (!tasksRes.ok) {
    return new Response(await tasksRes.text(), { status: 500 });
  }
  const tasks: {
    id: string;
    label: string;
    emoji: string | null;
    alert_time: string;
  }[] = await tasksRes.json();

  const due = tasks.filter((t) => t.alert_time && t.alert_time.slice(0, 5) <= wallTime);

  if (due.length === 0) {
    return new Response(JSON.stringify({ checked: tasks.length, due: 0, alerted: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
    headers: restHeaders,
  });
  const subs: { id: string; endpoint: string; p256dh: string; auth: string }[] =
    await subsRes.json();

  let alerted = 0;

  for (const task of due) {
    const logsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/logs?task_id=eq.${encodeURIComponent(task.id)}` +
        `&logged_at=gte.${encodeURIComponent(todayStartUtc)}&limit=1`,
      { headers: restHeaders },
    );
    const logs = await logsRes.json();
    if (Array.isArray(logs) && logs.length > 0) continue; // already done today

    const payload = JSON.stringify({
      title: `${task.emoji ?? "⏰"} ${task.label}`,
      body: "Not logged yet today",
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked — remove it so future runs skip it.
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: "DELETE",
            headers: restHeaders,
          });
        }
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      headers: restHeaders,
      body: JSON.stringify({ last_alerted_date: todayStr }),
    });
    alerted++;
  }

  return new Response(JSON.stringify({ checked: tasks.length, due: due.length, alerted }), {
    headers: { "Content-Type": "application/json" },
  });
});
