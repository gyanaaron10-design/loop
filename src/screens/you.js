import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { C, T } from '../theme';
import { Screen, Card, Pill, Button } from '../ui';
import { useStore } from '../store';

const pad = { paddingHorizontal: 20, paddingBottom: 120, gap: 12 };
const EMOJI = ['🦝', '🦊', '🐧', '🐢', '🐼', '🦉', '🐙', '🦎', '🐝', '🦩'];

/** Shown when you tap "Sign in" — also reachable from You. */
export function Auth({ close }) {
  const { signIn, signUp, cloudEnabled } = useStore();
  const [mode, setMode] = useState('in');
  const [f, setF] = useState({ email: '', pw: '', name: '', handle: '' });
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      if (mode === 'in') await signIn(f.email.trim(), f.pw);
      else await signUp(f.email.trim(), f.pw, f.name.trim() || 'Student', f.handle.trim() || f.email.split('@')[0]);
      close();
    } catch (e) {
      Alert.alert('That did not work', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen kicker={mode === 'in' ? 'Welcome back' : 'New here'} title="Loop" right={<Pressable onPress={close}><Pill label="Later" color={C.dim} /></Pressable>}>
      <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
        {!cloudEnabled && (
          <Card><Text style={T.body}>No backend keys set yet, so accounts are off. Add them to .env and restart — everything you made locally stays.</Text></Card>
        )}
        <Card style={{ gap: 10 }}>
          {mode === 'up' && (
            <>
              <TextInput value={f.name} onChangeText={(name) => setF({ ...f, name })} placeholder="Your name" placeholderTextColor={C.dim} style={s.input} />
              <TextInput value={f.handle} onChangeText={(handle) => setF({ ...f, handle })} placeholder="@handle friends search for" placeholderTextColor={C.dim} autoCapitalize="none" style={s.input} />
            </>
          )}
          <TextInput value={f.email} onChangeText={(email) => setF({ ...f, email })} placeholder="Email" placeholderTextColor={C.dim} autoCapitalize="none" keyboardType="email-address" style={s.input} />
          <TextInput value={f.pw} onChangeText={(pw) => setF({ ...f, pw })} placeholder="Password" placeholderTextColor={C.dim} secureTextEntry style={s.input} />
          <Button label={busy ? 'One sec…' : mode === 'in' ? 'Sign in' : 'Create account'} onPress={busy || !cloudEnabled ? () => {} : go} />
          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')}>
            <Text style={[T.small, { textAlign: 'center', paddingTop: 4 }]}>
              {mode === 'in' ? 'No account yet? Make one' : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </Card>
        <Text style={[T.small, { paddingHorizontal: 4 }]}>Your list works offline either way. Signing in is what lets friends see what you share.</Text>
      </ScrollView>
    </Screen>
  );
}

export function You({ openAuth }) {
  const { state, setProfile, signOut, cloud, syncing, refresh } = useStore();
  const { me, friends, tasks } = state;
  const board = [...friends, { ...me, name: me.name === 'You' ? 'You' : me.name }].sort((a, b) => b.streak - a.streak);
  const doneAll = tasks.filter((t) => t.done).length;

  return (
    <Screen
      kicker={cloud ? (syncing ? 'Syncing…' : 'Synced') : 'On this device only'}
      title="You"
      right={<Pressable onPress={cloud ? refresh : openAuth}><Pill label={cloud ? 'Refresh' : 'Sign in'} color={C.sky} filled={!cloud} /></Pressable>}
    >
      <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Text style={{ fontSize: 40 }}>{me.emoji}</Text>
            <View style={{ flex: 1 }}>
              <TextInput value={me.name} onChangeText={(name) => setProfile({ name })} style={[s.input, { fontWeight: '700' }]} />
              <Text style={[T.small, { paddingTop: 6 }]}>{me.handle}</Text>
            </View>
          </View>
          <TextInput
            value={me.status}
            onChangeText={(status) => setProfile({ status })}
            placeholder="What are you up to? Your crew sees this."
            placeholderTextColor={C.dim}
            style={s.input}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {EMOJI.map((e) => (
              <Pressable key={e} onPress={() => setProfile({ emoji: e })} style={[s.emoji, me.emoji === e && { borderColor: C.marker }]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}><Text style={s.big}>{me.streak}</Text><Text style={T.small}>day streak</Text></Card>
          <Card style={{ flex: 1 }}><Text style={[s.big, { color: C.sky }]}>{me.points}</Text><Text style={T.small}>points</Text></Card>
          <Card style={{ flex: 1 }}><Text style={[s.big, { color: C.marker }]}>{doneAll}</Text><Text style={T.small}>ticked off</Text></Card>
        </View>

        <Text style={[T.title, { marginTop: 8 }]}>Streak board</Text>
        {board.map((p, i) => (
          <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ ...T.title, width: 24, color: i === 0 ? C.mango : C.dim }}>{i + 1}</Text>
            <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
            <Text style={{ ...T.body, flex: 1, fontWeight: p.id === me.id ? '800' : '500' }}>{p.name}</Text>
            <Pill label={`${p.streak}d`} color={i === 0 ? C.mango : C.dim} />
          </Card>
        ))}

        {cloud && <Button label="Sign out" ghost onPress={signOut} />}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  input: { backgroundColor: C.surfaceAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.paper, fontSize: 15 },
  emoji: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 30, fontWeight: '800', color: C.mango },
});
