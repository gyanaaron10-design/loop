import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function setup() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('loop', {
      name: 'Loop reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#C6F24E',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  return status === 'granted';
}

/** Push token, so friends' nudges can reach you when the app is closed. */
export async function pushToken() {
  if (!Device.isDevice) return null;
  if (!(await setup())) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    return null;
  }
}

/** Reminder the evening before something is due, plus a morning-of nudge. */
export async function scheduleForTask(task) {
  if (!(await setup())) return [];
  const due = new Date(`${task.due}T00:00:00`);
  const slots = [
    { at: new Date(due.getTime() - 6 * 3600e3), body: `Due tomorrow: ${task.title}` },   // 18:00 the night before
    { at: new Date(due.getTime() + 7.5 * 3600e3), body: `Due today: ${task.title}` },    // 07:30 on the day
  ];
  const ids = [];
  for (const s of slots) {
    if (s.at <= new Date()) continue;
    ids.push(await Notifications.scheduleNotificationAsync({
      content: { title: task.subject || 'Loop', body: s.body, data: { taskId: task.id } },
      trigger: { date: s.at, channelId: 'loop' },
    }));
  }
  return ids;
}

export async function cancel(ids = []) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/** Fires when a focus session ends while the app is backgrounded. */
export async function focusDone(mins) {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Session done', body: `${mins} minutes in the bag. Stretch.` },
    trigger: { seconds: 1, channelId: 'loop' },
  });
}
