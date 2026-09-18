import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { C, T, R, SUBJECT_COLORS } from '../theme';
import { Screen, Card, Pill, Button, Empty } from '../ui';
import { useStore, todayKey } from '../store';

const pad = { paddingHorizontal: 20, paddingBottom: 120, gap: 12 };
const hue = (subject) => SUBJECT_COLORS[(subject || '').length % SUBJECT_COLORS.length];
const dayName = (n) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n];

/* ---------- Today ---------- */
export function Today({ go }) {
  const { state, toggleTask } = useStore();
  const { me, tasks, feed } = state;
  const day = new Date().getDay();
  const lessons = state.lessons.filter((l) => l.weekday === day).sort((a, b) => a.t.localeCompare(b.t));
  const due = tasks.filter((t) => t.due <= todayKey() && !t.done);
  const doneToday = tasks.filter((t) => t.done).length;

  return (
    <Screen kicker={dayName(day)} title={`Hey, ${me.name}`}>
      <ScrollView contentContainerStyle={pad}>
        <Card style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 40, fontWeight: '800', color: C.mango }}>{me.streak}</Text>
            <Text style={T.small}>day streak</Text>
          </View>
          <View style={{ width: 1, height: 40, backgroundColor: C.line }} />
          <View style={{ flex: 1 }}>
            <Text style={T.body}>
              {due.length ? `${due.length} thing${due.length > 1 ? 's' : ''} still due today.` : 'Nothing left for today. Go outside.'}
            </Text>
            <Text style={[T.small, { marginTop: 4 }]}>{doneToday} done · {me.points} pts</Text>
          </View>
        </Card>

        <Text style={[T.title, { marginTop: 8 }]}>Your day</Text>
        {lessons.length === 0 ? (
          <Empty line="No lessons saved for today. Add your timetable once and it repeats every week." action={<Button label="Open timetable" onPress={() => go('timetable')} />} />
        ) : (
          lessons.map((l, i) => (
            <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 4, height: 34, borderRadius: 2, backgroundColor: hue(l.name) }} />
              <Text style={{ ...T.body, fontWeight: '700', width: 56 }}>{l.t}</Text>
              <Text style={{ ...T.body, flex: 1 }}>{l.name}</Text>
              <Text style={T.small}>{l.room}</Text>
            </Card>
          ))
        )}

        <Text style={[T.title, { marginTop: 8 }]}>Due now</Text>
        {due.length === 0 ? (
          <Empty line="Clear. Anything you add lands here on its due date." action={<Button label="Add something" onPress={() => go('work')} />} />
        ) : (
          due.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggleTask(t.id)} />)
        )}

        <Text style={[T.title, { marginTop: 8 }]}>From your crew</Text>
        {feed.slice(0, 3).map((f) => (
          <Card key={f.id} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ ...T.body, flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.sky }}>{f.who} </Text>{f.text}
            </Text>
            <Text style={T.small}>{f.when}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

/* ---------- Work (school + life tasks) ---------- */
function TaskRow({ task, onToggle, onShare, friends }) {
  const overdue = task.due < todayKey() && !task.done;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onToggle} hitSlop={10} style={[s.box, task.done && { backgroundColor: C.marker, borderColor: C.marker }]}>
          {task.done && <Text style={{ color: C.ink, fontWeight: '900' }}>✓</Text>}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...T.body, fontWeight: '600', textDecorationLine: task.done ? 'line-through' : 'none', color: task.done ? C.dim : C.paper }}>
            {task.title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <Pill label={task.subject} color={hue(task.subject)} />
            <Pill label={overdue ? 'overdue' : task.due === todayKey() ? 'today' : task.due.slice(5)} color={overdue ? C.coral : C.dim} />
            {task.priority === 2 && <Pill label="big one" color={C.coral} filled />}
          </View>
        </View>
      </View>
      {!!friends && (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {friends.map((f) => (
            <Pressable key={f.id} onPress={() => onShare(f.id)}>
              <Pill label={`${f.emoji} ${f.name}`} color={C.sky} filled={task.sharedWith.includes(f.id)} />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

export function Work() {
  const { state, addTask, toggleTask, shareTask } = useStore();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [filter, setFilter] = useState('open');
  const list = state.tasks.filter((t) => (filter === 'open' ? !t.done : filter === 'done' ? t.done : true));

  const submit = () => {
    if (!title.trim()) return;
    addTask({ title: title.trim(), subject: subject.trim() || 'Life', due: todayKey(), priority: 1 });
    setTitle(''); setSubject('');
  };

  return (
    <Screen kicker="Homework and everything else" title="Your list">
      <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 10 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="What needs doing?" placeholderTextColor={C.dim} style={s.input} onSubmitEditing={submit} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={C.dim} style={[s.input, { flex: 1 }]} />
            <Button label="Add" onPress={submit} />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['open', 'done', 'all'].map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)}>
              <Pill label={f} color={C.marker} filled={filter === f} />
            </Pressable>
          ))}
        </View>

        {list.length === 0
          ? <Empty line={filter === 'done' ? 'Nothing ticked off yet today.' : 'List is empty. Add the thing you are avoiding.'} />
          : list.map((t) => (
            <TaskRow key={t.id} task={t} friends={state.friends} onToggle={() => toggleTask(t.id)} onShare={(fid) => shareTask(t.id, fid)} />
          ))}
        <Text style={[T.small, { paddingHorizontal: 4 }]}>Tap a friend on a task to work on it together. They see it in their crew feed.</Text>
      </ScrollView>
    </Screen>
  );
}

/* ---------- Timetable ---------- */
export function Timetable() {
  const { state, addLesson, removeLesson } = useStore();
  const [day, setDay] = useState(new Date().getDay());
  const [form, setForm] = useState({ t: '', name: '', room: '' });
  const lessons = state.lessons.filter((l) => l.weekday === day).sort((a, b) => a.t.localeCompare(b.t));

  const save = () => {
    if (!/^\d{1,2}:\d{2}$/.test(form.t) || !form.name.trim()) return;
    addLesson({ weekday: day, t: form.t.padStart(5, '0'), name: form.name.trim(), room: form.room.trim() });
    setForm({ t: '', name: '', room: '' });
  };

  return (
    <Screen kicker="Repeats every week" title="Timetable">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <Pressable key={d} onPress={() => setDay(d)}>
            <Pill label={dayName(d).slice(0, 3)} color={C.marker} filled={day === d} />
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
        {lessons.length === 0
          ? <Empty line={`Nothing on ${dayName(day)} yet. Add your first lesson below.`} />
          : lessons.map((l) => (
            <Card key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 4, height: 40, borderRadius: 2, backgroundColor: hue(l.name) }} />
              <Text style={{ ...T.title, width: 64 }}>{l.t}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ ...T.body, fontWeight: '700' }}>{l.name}</Text>
                <Text style={T.small}>{l.room || 'no room set'}</Text>
              </View>
              <Pressable onPress={() => removeLesson(l.id)} hitSlop={10}><Text style={{ color: C.dim, fontSize: 18 }}>×</Text></Pressable>
            </Card>
          ))}

        <Card style={{ gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={form.t} onChangeText={(t) => setForm({ ...form, t })} placeholder="08:40" placeholderTextColor={C.dim} style={[s.input, { width: 86 }]} />
            <TextInput value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Lesson" placeholderTextColor={C.dim} style={[s.input, { flex: 1 }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={form.room} onChangeText={(room) => setForm({ ...form, room })} placeholder="Room" placeholderTextColor={C.dim} style={[s.input, { flex: 1 }]} />
            <Button label={`Add to ${dayName(day).slice(0, 3)}`} onPress={save} />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

/* ---------- Focus ---------- */
export function Focus() {
  const { logFocus } = useStore();
  const [len, setLen] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const tick = useRef(null);

  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => setLeft((v) => {
        if (v <= 1) { clearInterval(tick.current); setRunning(false); logFocus(len); return len * 60; }
        return v - 1;
      }), 1000);
    }
    return () => clearInterval(tick.current);
  }, [running, len]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <Screen kicker="Phone down" title="Focus">
      <ScrollView contentContainerStyle={pad}>
        <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 34 }}>
          <Text style={{ fontSize: 68, fontWeight: '800', color: C.marker, letterSpacing: -2 }}>{mm}:{ss}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[15, 25, 50].map((m) => (
              <Pressable key={m} onPress={() => { setLen(m); setLeft(m * 60); setRunning(false); }}>
                <Pill label={`${m} min`} color={C.marker} filled={len === m} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label={running ? 'Pause' : 'Start'} onPress={() => setRunning(!running)} />
            <Button label="Reset" ghost onPress={() => { setRunning(false); setLeft(len * 60); }} />
          </View>
        </Card>
        <Text style={[T.small, { paddingHorizontal: 4 }]}>Finishing a session posts to your crew feed and adds a point per minute.</Text>
      </ScrollView>
    </Screen>
  );
}

/* ---------- Crew ---------- */
export function Crew() {
  const { state, nudge, joinRoom, createRoom, findPeople, addFriend, acceptRequest, cloud } = useStore();
  const [room, setRoom] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  return (
    <Screen kicker="Nobody grinds alone" title="Crew">
      <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 10 }}>
          <TextInput
            value={q}
            onChangeText={(v) => { setQ(v); v.length > 1 ? findPeople(v).then(setFound) : setFound([]); }}
            placeholder="Find someone by @handle"
            placeholderTextColor={C.dim}
            autoCapitalize="none"
            style={s.input}
          />
          {found.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
              <Text style={{ ...T.body, flex: 1 }}>{p.name} <Text style={T.small}>@{p.handle}</Text></Text>
              <Pressable onPress={() => { addFriend(p.id); setQ(''); setFound([]); }}><Pill label="Add" color={C.marker} /></Pressable>
            </View>
          ))}
          {!cloud && <Text style={T.small}>Sign in to search for real people. Until then you have the demo crew below.</Text>}
        </Card>

        {state.requests.map((r) => (
          <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
            <Text style={{ ...T.body, flex: 1 }}>{r.name} wants to be in your crew</Text>
            <Pressable onPress={() => acceptRequest(r.id)}><Pill label="Accept" color={C.marker} filled /></Pressable>
          </Card>
        ))}

        {state.friends.map((f) => (
          <Card key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Text style={{ fontSize: 30 }}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ ...T.body, fontWeight: '700' }}>{f.name} <Text style={{ color: C.mango }}>· {f.streak}d</Text></Text>
              <Text style={T.small}>{f.status}</Text>
            </View>
            <Pressable onPress={() => nudge(f)}><Pill label="Nudge" color={C.sky} /></Pressable>
          </Card>
        ))}

        <Text style={[T.title, { marginTop: 8 }]}>Study rooms</Text>
        <Card style={{ gap: 10 }}>
          <TextInput value={room} onChangeText={setRoom} placeholder="Name a session, e.g. French vocab" placeholderTextColor={C.dim} style={s.input} />
          <Button label="Start a room" tone={C.sky} onPress={() => { if (room.trim()) { createRoom(room.trim(), 'Tonight'); setRoom(''); } }} />
        </Card>
        {state.rooms.map((r) => (
          <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...T.body, fontWeight: '700' }}>{r.name}</Text>
              <Text style={T.small}>{r.host} · {r.at} · {r.members.length + 1} in</Text>
            </View>
            <Pressable onPress={() => joinRoom(r.id)}><Pill label={r.members.includes('me') ? 'Joined' : 'Join'} color={C.marker} filled={r.members.includes('me')} /></Pressable>
          </Card>
        ))}

        <Text style={[T.title, { marginTop: 8 }]}>Activity</Text>
        {state.feed.map((f) => (
          <Card key={f.id} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ ...T.body, flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.sky }}>{f.who} </Text>{f.text}
            </Text>
            <Text style={T.small}>{f.when}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: C.surfaceAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.paper, fontSize: 15 },
});
