import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cloudEnabled, auth, profiles, tasks as T, lessons as L, social, subscribeAll } from './supabase';
import * as notify from './notifications';

const KEY = 'loop.state.v2';
const uid = () => Math.random().toString(36).slice(2, 10);
export const todayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return todayKey(d); };

/* Demo content, used until you sign in. Everything here is editable in-app. */
const seed = () => ({
  me: { id: 'me', name: 'You', handle: '@you', emoji: '🦝', points: 120, streak: 3, lastDone: null, status: '' },
  tasks: [
    { id: uid(), title: 'Biology worksheet p.42', subject: 'Biology', due: todayKey(), done: false, priority: 2, sharedWith: [] },
    { id: uid(), title: 'Read Act II of Macbeth', subject: 'English', due: todayKey(), done: false, priority: 1, sharedWith: ['mia'] },
    { id: uid(), title: 'Take the bins out', subject: 'Life', due: todayKey(), done: true, priority: 0, sharedWith: [] },
    { id: uid(), title: 'Maths mock revision', subject: 'Maths', due: addDays(2), done: false, priority: 2, sharedWith: ['sam', 'mia'] },
  ],
  lessons: [
    { id: uid(), weekday: 1, t: '08:40', name: 'Maths', room: 'B12' },
    { id: uid(), weekday: 1, t: '10:00', name: 'Biology', room: 'Lab 3' },
    { id: uid(), weekday: 1, t: '13:00', name: 'English', room: 'A7' },
    { id: uid(), weekday: 2, t: '09:00', name: 'History', room: 'C1' },
    { id: uid(), weekday: 2, t: '11:00', name: 'PE', room: 'Gym' },
    { id: uid(), weekday: 3, t: '08:40', name: 'Maths', room: 'B12' },
    { id: uid(), weekday: 3, t: '12:00', name: 'Art', room: 'Studio' },
    { id: uid(), weekday: 4, t: '09:00', name: 'Biology', room: 'Lab 3' },
    { id: uid(), weekday: 4, t: '14:00', name: 'English', room: 'A7' },
    { id: uid(), weekday: 5, t: '08:40', name: 'Maths', room: 'B12' },
    { id: uid(), weekday: 5, t: '10:00', name: 'Music', room: 'M2' },
  ],
  friends: [
    { id: 'mia', name: 'Mia', handle: '@mia', emoji: '🦊', streak: 6, status: 'In the library till 5' },
    { id: 'sam', name: 'Sam', handle: '@sam', emoji: '🐧', streak: 2, status: 'Free after football' },
    { id: 'noor', name: 'Noor', handle: '@noor', emoji: '🐢', streak: 11, status: 'Focusing — 25 min' },
  ],
  requests: [],
  feed: [
    { id: uid(), who: 'Noor', emoji: '🐢', text: 'finished a 25 min focus session', when: 'just now' },
    { id: uid(), who: 'Mia', emoji: '🦊', text: 'shared "Read Act II of Macbeth" with you', when: '20m' },
    { id: uid(), who: 'Sam', emoji: '🐧', text: 'hit a 2 day streak', when: '1h' },
  ],
  rooms: [{ id: uid(), name: 'Maths mock cram', host: 'Mia', at: 'Today 17:00', members: ['mia', 'sam'] }],
  reminders: {},   // taskId -> [notificationId]
});

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export function StoreProvider({ children }) {
  const [state, setState] = useState(null);
  const [session, setSession] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const cloud = cloudEnabled && !!session;
  const stateRef = useRef(null);
  stateRef.current = state;

  /* load local cache first so the app opens instantly */
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => setState(raw ? JSON.parse(raw) : seed())).catch(() => setState(seed()));
    if (!cloudEnabled) return;
    auth.session().then(setSession);
    const sub = auth.onChange(setSession);
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => { if (state) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); }, [state]);

  /* pull everything from the server */
  const pull = useCallback(async () => {
    if (!cloud) return;
    setSyncing(true);
    try {
      const id = session.user.id;
      const [me, rows, ls, fr, rq, fd, rm] = await Promise.all([
        profiles.me(id), T.list(id), L.list(id), social.friends(id), social.requests(id), social.feed(id), social.rooms(),
      ]);
      setState((s) => ({
        ...s,
        me: { id, name: me.name, handle: `@${me.handle}`, emoji: me.emoji, points: me.points, streak: me.streak, lastDone: me.last_done, status: me.status },
        tasks: rows.map((r) => ({ id: r.id, title: r.title, subject: r.subject, due: r.due, done: r.done, priority: r.priority, owner: r.owner, sharedWith: (r.task_shares || []).map((x) => x.friend_id) })),
        lessons: ls.map((l) => ({ id: l.id, weekday: l.weekday, t: l.starts_at, name: l.name, room: l.room })),
        friends: fr,
        requests: rq.map((r) => ({ id: r.id, ...r.requester })),
        feed: fd.map((f) => ({ id: f.id, who: f.who, emoji: f.emoji, text: f.text, when: ago(f.created_at) })),
        rooms: rm.map((r) => ({ id: r.id, name: r.name, host: r.host, at: new Date(r.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }), members: (r.room_members || []).map((m) => m.user_id) })),
      }));
    } catch (e) {
      console.warn('sync failed, staying on the local copy', e.message);
    } finally {
      setSyncing(false);
    }
  }, [cloud, session]);

  useEffect(() => {
    if (!cloud) return;
    pull();
    notify.pushToken().then((tk) => tk && profiles.update(session.user.id, { push_token: tk }));
    return subscribeAll(session.user.id, pull);
  }, [cloud, pull]);

  /* local edit + optional server write, so the UI never waits on the network */
  const edit = (fn) => setState((s) => fn(s));
  const push = (fn) => { if (cloud) Promise.resolve(fn(session.user.id)).catch((e) => console.warn(e.message)); };

  const api = useMemo(() => ({
    state, session, cloud, cloudEnabled, syncing, refresh: pull,

    /* auth */
    signIn: (email, pw) => auth.signIn(email, pw),
    signUp: (email, pw, name, handle) => auth.signUp(email, pw, name, handle.replace('@', '')),
    signOut: async () => { await auth.signOut(); await AsyncStorage.removeItem(KEY); setState(seed()); },

    /* profile */
    setProfile: (patch) => {
      edit((s) => ({ ...s, me: { ...s.me, ...patch } }));
      push((id) => profiles.update(id, patch));
    },

    /* tasks */
    addTask: async (t) => {
      const local = { id: uid(), done: false, sharedWith: [], priority: 1, due: todayKey(), subject: 'Life', ...t };
      const ids = await notify.scheduleForTask(local).catch(() => []);
      edit((s) => ({ ...s, tasks: [local, ...s.tasks], reminders: { ...s.reminders, [local.id]: ids } }));
      push(async (owner) => {
        const row = await T.create({ owner, title: local.title, subject: local.subject, due: local.due, priority: local.priority });
        edit((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === local.id ? { ...x, id: row.id } : x)) }));
      });
    },
    removeTask: (id) => {
      notify.cancel(stateRef.current?.reminders?.[id]);
      edit((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      push(() => T.remove(id));
    },
    toggleTask: (id) => {
      edit((s) => {
        const list = s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
        const t = list.find((x) => x.id === id);
        let me = s.me;
        let feed = s.feed;
        if (t.done) {
          const today = todayKey();
          const first = me.lastDone !== today;
          me = { ...me, points: me.points + 10, streak: first ? me.streak + 1 : me.streak, lastDone: today };
          if (t.sharedWith.length) feed = [{ id: uid(), who: 'You', emoji: s.me.emoji, text: `finished "${t.title}"`, when: 'just now' }, ...feed];
          notify.cancel(s.reminders[id]);
          push((actor) => { profiles.update(actor, { points: me.points, streak: me.streak, last_done: today }); if (t.sharedWith.length) social.post(actor, `finished "${t.title}"`, 'task'); });
        }
        push(() => T.update(id, { done: t.done }));
        return { ...s, tasks: list, me, feed };
      });
    },
    shareTask: (id, friendId) => {
      edit((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id
          ? { ...t, sharedWith: t.sharedWith.includes(friendId) ? t.sharedWith.filter((f) => f !== friendId) : [...t.sharedWith, friendId] }
          : t)),
      }));
      const had = stateRef.current.tasks.find((t) => t.id === id)?.sharedWith.includes(friendId);
      push(() => (had ? T.unshare(id, friendId) : T.share(id, friendId)));
    },

    /* timetable */
    addLesson: (l) => {
      const row = { id: uid(), ...l };
      edit((s) => ({ ...s, lessons: [...s.lessons, row].sort((a, b) => a.t.localeCompare(b.t)) }));
      push((owner) => L.create({ owner, weekday: l.weekday, starts_at: l.t, name: l.name, room: l.room }));
    },
    removeLesson: (id) => {
      edit((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== id) }));
      push(() => L.remove(id));
    },

    /* social */
    findPeople: (q) => (cloud ? profiles.search(q) : Promise.resolve([])),
    addFriend: (friendId) => push((me) => social.add(me, friendId)),
    acceptRequest: (reqId) => { edit((s) => ({ ...s, requests: s.requests.filter((r) => r.id !== reqId) })); push(() => social.accept(reqId)); },
    nudge: (friend) => {
      edit((s) => ({ ...s, feed: [{ id: uid(), who: 'You', emoji: s.me.emoji, text: `nudged ${friend.name}`, when: 'just now' }, ...s.feed].slice(0, 30) }));
      push((actor) => {
        social.post(actor, `nudged ${friend.name}`, 'nudge');
        if (friend.id) social.nudge(friend.id, stateRef.current.me.name);
      });
    },
    logFocus: (mins) => {
      edit((s) => ({
        ...s,
        me: { ...s.me, points: s.me.points + mins },
        feed: [{ id: uid(), who: 'You', emoji: s.me.emoji, text: `finished a ${mins} min focus session`, when: 'just now' }, ...s.feed].slice(0, 30),
      }));
      notify.focusDone(mins).catch(() => {});
      push((actor) => { social.post(actor, `finished a ${mins} min focus session`, 'focus'); profiles.update(actor, { points: (stateRef.current.me.points || 0) + mins }); });
    },
    createRoom: (name, when) => {
      edit((s) => ({ ...s, rooms: [{ id: uid(), name, host: s.me.name, at: when, members: [] }, ...s.rooms] }));
      push((host) => social.createRoom({ host, name, at: new Date(Date.now() + 3 * 3600e3).toISOString() }));
    },
    joinRoom: (id) => {
      edit((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, members: [...new Set([...r.members, 'me'])] } : r)) }));
      push((me) => social.joinRoom(id, me));
    },
  }), [state, session, cloud, syncing, pull]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
