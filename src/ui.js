import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, T, R } from './theme';

export const Screen = ({ title, kicker, children, right }) => (
  <View style={{ flex: 1 }}>
    <View style={s.head}>
      <View style={{ flex: 1 }}>
        {!!kicker && <Text style={T.small}>{kicker}</Text>}
        <Text style={[T.hero, { marginTop: 2 }]}>{title}</Text>
      </View>
      {right}
    </View>
    {children}
  </View>
);

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

export const Pill = ({ label, color = C.marker, filled }) => (
  <View style={[s.pill, { borderColor: color }, filled && { backgroundColor: color }]}>
    <Text style={{ fontSize: 12, fontWeight: '700', color: filled ? C.ink : color }}>{label}</Text>
  </View>
);

export const Button = ({ label, onPress, tone = C.marker, ghost }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      s.btn,
      ghost ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line } : { backgroundColor: tone },
      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
    ]}
  >
    <Text style={{ fontWeight: '800', fontSize: 15, color: ghost ? C.paper : C.ink }}>{label}</Text>
  </Pressable>
);

export const Empty = ({ line, action }) => (
  <Card style={{ alignItems: 'flex-start', gap: 10 }}>
    <Text style={T.body}>{line}</Text>
    {action}
  </Card>
);

const s = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-end' },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 16, borderWidth: 1, borderColor: C.line },
  pill: { borderWidth: 1.5, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 },
  btn: { borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
});
