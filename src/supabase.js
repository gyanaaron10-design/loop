import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const URL = extra.supabaseUrl;
const KEY = extra.supabaseAnonKey;

/** Loop runs fully offline until you add Supabase keys to .env. */
export const cloudEnabled = Boolean(URL && KEY);

export const supabase = cloudEnabled
  ? createClient(URL, KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

const ok = (r) => {
  if (r.error) throw r.error;
  return r.data;
};

/* ---------- auth ---------- */
export const auth = {
  session: async () => (cloudEnabled ? (await supabase.auth.getSession()).data.session : null),
  onChange: (cb) => (cloudEnabled ? supabase.auth.onAuthStateChange((_e, s) => cb(s)).data.subscription : { unsubscribe() {} }),
  signUp: async (email, password, name, handle) => {
    const data = ok(await supabase.auth.signUp({ email, password, options: { data: { name, handle } } }));
    return data.session;
  },
  signIn: async (email, password) => ok(await supabase.auth.signInWithPassword({ email, password })).session,
  signOut: () => supabase.auth.signOut(),
};

/* ---------- profile ---------- */
export const profiles = {
  me: async (id) => ok(await supabase.from('profiles').select('*').eq('id', id).single()),
  update: (id, patch) => supabase.from('profiles').update(patch).eq('id', id),
  search: async (handle) =>
    ok(await supabase.from('profiles').select('id,name,handle,emoji,streak').ilike('handle', `%${handle.replace('@', '')}%`).limit(8)),
};

/* ---------- tasks ---------- */
export const tasks = {
  list: async (uid) =>
    ok(await supabase.from('tasks').select('*, task_shares(friend_id)').or(`owner.eq.${uid},task_shares.friend_id.eq.${uid}`).order('due')),
  create: async (row) => ok(await supabase.from('tasks').insert(row).select().single()),
  update: (id, patch) => supabase.from('tasks').update(patch).eq('id', id),
  remove: (id) => supabase.from('tasks').delete().eq('id', id),
  share: (taskId, friendId) => supabase.from('task_shares').insert({ task_id: taskId, friend_id: friendId }),
  unshare: (taskId, friendId) => supabase.from('task_shares').delete().match({ task_id: taskId, friend_id: friendId }),
};

/* ---------- timetable ---------- */
export const lessons = {
  list: async (uid) => ok(await supabase.from('lessons').select('*').eq('owner', uid).order('starts_at')),
  create: (row) => supabase.from('lessons').insert(row),
  remove: (id) => supabase.from('lessons').delete().eq('id', id),
};

/* ---------- friends, feed, rooms ---------- */
export const social = {
  friends: async (uid) =>
    ok(await supabase.from('friendships').select('friend:profiles!friendships_friend_id_fkey(id,name,handle,emoji,streak,status)').eq('user_id', uid).eq('accepted', true))
      .map((r) => r.friend),
  requests: async (uid) =>
    ok(await supabase.from('friendships').select('id, requester:profiles!friendships_user_id_fkey(id,name,handle,emoji)').eq('friend_id', uid).eq('accepted', false)),
  add: (uid, friendId) => supabase.from('friendships').insert({ user_id: uid, friend_id: friendId, accepted: false }),
  accept: (id) => supabase.rpc('accept_friend', { request_id: id }),
  feed: async (uid) => ok(await supabase.from('feed_visible').select('*').limit(30)),
  post: (uid, text, kind = 'note') => supabase.from('activity').insert({ actor: uid, text, kind }),
  /** Queues a real push notification on their phone, via the send-push function. */
  nudge: (friendId, fromName) => supabase.rpc('nudge', { p_friend_id: friendId, p_from_name: fromName }),
  rooms: async () => ok(await supabase.from('rooms').select('*, room_members(user_id)').gte('at', new Date().toISOString()).order('at')),
  createRoom: (row) => supabase.from('rooms').insert(row),
  joinRoom: (roomId, uid) => supabase.from('room_members').insert({ room_id: roomId, user_id: uid }),
};

/** Live updates: fires cb whenever anything the user can see changes. */
export const subscribeAll = (uid, cb) => {
  if (!cloudEnabled) return () => {};
  const ch = supabase
    .channel('loop-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, cb)
    .subscribe();
  return () => supabase.removeChannel(ch);
};
