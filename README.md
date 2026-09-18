# Loop

School and the rest of your life in one app: homework and chores, your weekly timetable, a focus timer, reminders before things are due, and friends who can see what you're working on, join a study room, and nudge you.

Expo + React Native, so one codebase runs on iOS and Android. Supabase for accounts, friends and live sync.

---

## 1. Run it on your phone (5 minutes)

```bash
npm install
npx expo start
```

Install **Expo Go** on your phone, scan the QR code, done. It works immediately with demo data and saves everything on the device — no account needed.

### No working npm on this computer?

You don't need one. Push this folder to a GitHub repo (public, or connect
GitHub to Snack for a private one), then on
[snack.expo.dev](https://snack.expo.dev) use **Import git repository**
with your repo's URL, branch `main`, and no folder path. Snack installs
everything on its own servers and gives you a QR code for Expo Go, same
as running it locally.

Snack's importer can't execute JavaScript, so it needs the plain
`app.json` in this folder (not `app.config.js`, which loads your `.env`
and only works with a real Node install) to recognize this as an Expo
project. Both files are included and kept in sync — see the comment at
the top of `app.config.js` for which one wins once you're doing real
local development.

## 2. Turn on accounts and real friends (20 minutes)

1. Make a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, run it. That creates every table, the security rules, and live updates.
3. In **Project settings → API**, copy the Project URL and the `anon` public key.
4. `cp .env.example .env` and paste them in.
5. Restart with `npx expo start -c`.

Now the **You** tab has a Sign in button. Make an account, pick an @handle, and friends can find you by it in **Crew → Find someone**. Once they accept, shared tasks, streaks, activity and study rooms sync between you in real time.

The `anon` key is safe to ship. Every table has row level security, so people can only read their own rows and their accepted friends' rows — nothing else is reachable even with the key.

## 3. Ship it to the stores

```bash
npm install -g eas-cli
eas login
eas build:configure

eas build -p android --profile preview      # APK you can send to friends today
eas build -p android --profile production
eas build -p ios --profile production       # needs an Apple Developer account, $99/yr
eas submit -p ios
eas submit -p android                       # Google Play, $25 once
```

Change `com.yourname.loop` in `app.config.js` to your own bundle ID first. If you are under 18, both stores need an adult's developer account — Expo Go and the preview APK are enough to share it with friends in the meantime.

---

## What's in the folder

| Path | What it does |
|---|---|
| `App.js` | Root, tab bar, screen switching, auth gate |
| `app.config.js` | App name, icons, bundle IDs, reads `.env` |
| `src/theme.js` | Colours and type scale — change the look here |
| `src/store.js` | All state. Edits apply locally first, then sync, so the UI never waits on the network |
| `src/supabase.js` | Auth, queries and the realtime subscription |
| `src/notifications.js` | Permissions, push token, due-date reminders |
| `src/ui.js` | Card, Pill, Button, screen header, empty states |
| `src/screens/index.js` | Today, List, Week, Focus, Crew |
| `src/screens/you.js` | Sign in / sign up, profile, streak board |
| `supabase/schema.sql` | Tables, row level security, realtime |
| `assets/` | Icon, adaptive icon, splash, notification icon |

## Features

- **Today** — your lessons, what's due, your streak, and what your crew just did.
- **List** — homework and life tasks together, with subject colours, due dates and priority. Tap a friend chip on a task to work on it together; they see it and get told when you finish.
- **Week** — add and delete lessons per weekday; it repeats.
- **Focus** — 15/25/50 minute timer. Finishing posts to the feed, earns a point a minute, and notifies you if you switched apps.
- **Crew** — find people by @handle, accept requests, see streaks and status, nudge someone, start or join a study room.
- **You** — name, @handle, status and animal, your totals, and a streak board across your crew.
- **Reminders** — the evening before and the morning of anything due, cancelled automatically when you tick it off.
- **Offline first** — everything works with no signal and syncs when you are back.

## Good next additions

- Photo attachments on tasks (Supabase Storage bucket plus `expo-image-picker`).
- A grades tracker per subject, averaged by weight.
- Home screen widgets via `expo-apple-targets`.
- Nudges that ring on a closed phone: the `push_token` column is already filled in, so you only need an Edge Function that posts to `https://exp.host/--/api/v2/push/send`.
