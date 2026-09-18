/**
 * LOOP — send-push
 *
 * Delivers nudges and due-date reminders to phones with Loop closed,
 * using Expo's push service. Runs on Supabase Edge Functions (Deno).
 *
 * Deploy:
 *   supabase functions deploy send-push
 *   supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
 *
 * Two ways in:
 *   POST { "userId": "...", "title": "...", "body": "..." }  → send now
 *   POST {} with the cron secret                             → drain push_queue
 *
 * Add the queue table (SQL editor) if you have not already:
 *   create table public.push_queue (
 *     id uuid primary key default gen_random_uuid(),
 *     user_id uuid not null references public.profiles on delete cascade,
 *     title text not null,
 *     body text not null,
 *     data jsonb,
 *     send_after timestamptz not null default now(),
 *     sent_at timestamptz
 *   );
 *   alter table public.push_queue enable row level security;
 *   create policy "own queue" on public.push_queue for all to authenticated
 *     using (user_id = auth.uid()) with check (user_id = auth.uid());
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

interface Message {
  to: string;
  title: string;
  body: string;
  data?: unknown;
  sound: "default";
  channelId: "loop";
}

/** Expo takes up to 100 messages per request. */
function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function tokensFor(userIds: string[]): Promise<Map<string, string[]>> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, push_token")
    .in("id", userIds)
    .not("push_token", "is", null);
  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const token = (row as { push_token: string }).push_token;
    if (!token.startsWith("ExponentPushToken") && !token.startsWith("ExpoPushToken")) continue;
    const id = (row as { id: string }).id;
    map.set(id, [...(map.get(id) ?? []), token]);
  }
  return map;
}

/** Sends, then clears tokens Expo tells us are dead so we stop retrying. */
async function send(messages: Message[]): Promise<{ sent: number; dropped: string[] }> {
  let sent = 0;
  const dropped: string[] = [];

  for (const batch of chunk(messages)) {
    const res = await fetch(EXPO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      console.error("expo rejected the batch", res.status, await res.text());
      continue;
    }

    const payload = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
    payload.data?.forEach((ticket, i) => {
      if (ticket.status === "ok") {
        sent += 1;
        return;
      }
      if (ticket.details?.error === "DeviceNotRegistered") dropped.push(batch[i].to);
      else console.error("push error", ticket.details?.error);
    });
  }

  if (dropped.length) {
    await admin.from("profiles").update({ push_token: null }).in("push_token", dropped);
  }
  return { sent, dropped };
}

function build(token: string, title: string, body: string, data?: unknown): Message {
  return { to: token, title, body, data, sound: "default", channelId: "loop" };
}

Deno.serve(async (req) => {
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    /* ---- direct send: one person, right now ---- */
    if (body.userId && body.title) {
      const tokens = (await tokensFor([body.userId])).get(body.userId) ?? [];
      if (!tokens.length) return Response.json({ sent: 0, reason: "no device registered" });
      const result = await send(tokens.map((t) => build(t, body.title, body.body ?? "", body.data)));
      return Response.json({ mode: "direct", ...result });
    }

    /* ---- queue drain: everything due, for everyone ---- */
    if (CRON_SECRET && req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
      return new Response("unauthorized", { status: 401 });
    }

    const { data: queue, error } = await admin
      .from("push_queue")
      .select("id, user_id, title, body, data")
      .is("sent_at", null)
      .lte("send_after", new Date().toISOString())
      .order("send_after")
      .limit(500);
    if (error) throw error;
    if (!queue?.length) return Response.json({ mode: "queue", processed: 0, sent: 0 });

    const rows = queue as Array<{ id: string; user_id: string; title: string; body: string; data: unknown }>;
    const byUser = await tokensFor([...new Set(rows.map((r) => r.user_id))]);

    const messages = rows.flatMap((row) =>
      (byUser.get(row.user_id) ?? []).map((token) => build(token, row.title, row.body, row.data)),
    );

    const result = await send(messages);
    await admin
      .from("push_queue")
      .update({ sent_at: new Date().toISOString() })
      .in("id", rows.map((r) => r.id));

    return Response.json({ mode: "queue", processed: rows.length, ...result });
  } catch (err) {
    console.error(err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
