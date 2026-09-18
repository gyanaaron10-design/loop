import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { Today, Work, Timetable, Focus, Crew } from './src/screens';
import { Auth, You } from './src/screens/you';
import { C } from './src/theme';

const TABS = [
  { key: 'today', label: 'Today', icon: '◉' },
  { key: 'work', label: 'List', icon: '☰' },
  { key: 'timetable', label: 'Week', icon: '▤' },
  { key: 'focus', label: 'Focus', icon: '◐' },
  { key: 'crew', label: 'Crew', icon: '✦' },
  { key: 'you', label: 'You', icon: '☺' },
];

function Shell() {
  const { state } = useStore();
  const [tab, setTab] = useState('today');
  const [auth, setAuth] = useState(false);

  if (!state) return <View style={[st.fill, st.center]}><ActivityIndicator color={C.marker} /></View>;

  if (auth) {
    return <SafeAreaView style={st.fill} edges={['top', 'bottom']}><Auth close={() => setAuth(false)} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={st.fill} edges={['top', 'bottom']}>
      {tab === 'today' && <Today go={setTab} />}
      {tab === 'work' && <Work />}
      {tab === 'timetable' && <Timetable />}
      {tab === 'focus' && <Focus />}
      {tab === 'crew' && <Crew />}
      {tab === 'you' && <You openAuth={() => setAuth(true)} />}

      <View style={st.bar}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={st.tab} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: on }}>
              <Text style={{ fontSize: 18, color: on ? C.marker : C.dim }}>{t.icon}</Text>
              <Text style={{ fontSize: 10, marginTop: 3, fontWeight: on ? '800' : '500', color: on ? C.paper : C.dim }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <StoreProvider><Shell /></StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute', left: 12, right: 12, bottom: 16,
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 26, borderWidth: 1, borderColor: C.line, paddingVertical: 10,
  },
  tab: { flex: 1, alignItems: 'center' },
});
