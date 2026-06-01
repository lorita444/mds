import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Resolve host dynamically to support physical devices, iOS simulators and Android emulators
const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3000/api`;
  }
  // Android emulator needs 10.0.2.2, iOS simulator / web needs localhost
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
};

export const API_URL = getApiUrl();
console.log('Resolving StudyVerse MySQL API at:', API_URL);

// Simple mock observer system for Supabase onAuthStateChange
const listeners = new Set<(event: string, session: any) => void>();

export const notifyAuthStateChange = (event: string, session: any) => {
  listeners.forEach(cb => {
    try { cb(event, session); } catch (e) { console.error(e); }
  });
};

export const supabase = {
  auth: {
    async getSession() {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const userJson = await AsyncStorage.getItem('auth_user');
        if (token && userJson) {
          const user = JSON.parse(userJson);
          return { data: { session: { access_token: token, user } }, error: null };
        }
      } catch (e) {
        console.error('Failed to get session from AsyncStorage', e);
      }
      return { data: { session: null }, error: null };
    },

    async signInWithPassword({ email, password }: any) {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        
        if (!res.ok) {
          return { data: { session: null, user: null }, error: { message: json.error || 'Login failed' } };
        }

        const session = json.session;
        const user = json.user;
        
        await AsyncStorage.setItem('auth_token', session.access_token);
        await AsyncStorage.setItem('auth_user', JSON.stringify(user));
        
        notifyAuthStateChange('SIGNED_IN', { access_token: session.access_token, user });
        return { data: { session: { access_token: session.access_token, user }, user }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error: { message: error.message || 'Network request failed' } };
      }
    },

    async signUp({ email, password, options }: any) {
      const username = options?.data?.username || email.split('@')[0];
      try {
        const res = await fetch(`${API_URL}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password }),
        });
        const json = await res.json();

        if (!res.ok) {
          return { data: { session: null, user: null }, error: { message: json.error || 'Signup failed' } };
        }

        const session = json.session;
        const user = json.user;

        await AsyncStorage.setItem('auth_token', session.access_token);
        await AsyncStorage.setItem('auth_user', JSON.stringify(user));

        notifyAuthStateChange('SIGNED_IN', { access_token: session.access_token, user });
        return { data: { session: { access_token: session.access_token, user }, user }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error: { message: error.message || 'Network request failed' } };
      }
    },

    async signOut() {
      try {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_user');
        notifyAuthStateChange('SIGNED_OUT', null);
      } catch (e) {
        console.error('Failed to sign out from AsyncStorage', e);
      }
      return { error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      listeners.add(callback);
      // Run once with current session
      this.getSession().then(({ data: { session } }) => {
        if (session) {
          callback('SIGNED_IN', session);
        } else {
          callback('SIGNED_OUT', null);
        }
      });

      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            },
          },
        },
      };
    },
  },

  // Mock channels for co-op real-time (we will stub it out)
  channel(name: string) {
    console.log(`Mocking Supabase Channel: ${name}`);
    return {
      on(event: string, opts: any, callback: any) {
        return this;
      },
      subscribe(statusCb: any) {
        if (statusCb) statusCb('SUBSCRIBED');
        return this;
      },
      send(payload: any) {
        console.log(`Mocking Channel Send:`, payload);
        return Promise.resolve('ok');
      },
      track(state: any) {
        return this;
      },
      untrack() {
        return this;
      }
    };
  },

  removeChannel(channel: any) {
    console.log('Mocking removeChannel');
  }
};
