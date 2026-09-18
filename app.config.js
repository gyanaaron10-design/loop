/**
 * Loop also ships a static app.json with the same settings, so tools
 * that can't execute JavaScript — like Expo Snack's "Import from
 * GitHub" — can still read the app's config and preview it.
 *
 * The two can conflict: some Expo CLI versions use app.json instead of
 * merging it with this file, rather than layering them. So once you're
 * doing real local development with Supabase keys, delete app.json (or
 * rename it) so this dynamic file — the one that actually reads your
 * .env — takes over. See README.md.
 */
import 'dotenv/config';

export default {
  expo: {
    name: 'Loop',
    slug: 'loop-school',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'loop',
    userInterfaceStyle: 'dark',
    backgroundColor: '#17132B',
    icon: './assets/icon.png',
    splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#17132B' },
    assetBundlePatterns: ['**/*'],
    ios: {
      bundleIdentifier: 'com.yourname.loop',
      supportsTablet: true,
      infoPlist: { UIBackgroundModes: ['remote-notification'] },
    },
    android: {
      package: 'com.yourname.loop',
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#17132B' },
      permissions: ['NOTIFICATIONS'],
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      ['expo-notifications', { icon: './assets/notification-icon.png', color: '#C6F24E' }],
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      eas: { projectId: process.env.EAS_PROJECT_ID || '' },
    },
  },
};
