import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { saveAuth, getStoredToken, getStoredUser, clearAuth } from '../utils/authStorage';
import { API_BASE_URL } from '../constants/api';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  gender?: string;
  avatar?: string | null;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (changes: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Reads the expiry time stored inside the login token. If anything goes wrong
// reading it, we say "not expired" so a bug here can never log someone out.
function isTokenExpired(token: string): boolean {
  try {
    let payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    payload += '='.repeat((4 - (payload.length % 4)) % 4);
    const data = JSON.parse((globalThis as any).atob(payload));
    return typeof data.exp === 'number' && data.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Lets the fetch watcher below call the latest logout, and stops the
  // "Session expired" message showing more than once
   const sessionEndedRef = useRef(false);
  const handleExpiredRef = useRef<() => void>(() => {});

  // Keep the ref pointing at the latest handler. This runs after render,
  // which is where React wants refs to be updated.
  useEffect(() => {
    handleExpiredRef.current = () => {
      if (sessionEndedRef.current) return;
      sessionEndedRef.current = true;
      logout();
      Alert.alert('Session expired', 'Please log in again.');
    };
  });

  useEffect(() => {
    async function loadStoredAuth() {
      const storedToken = await getStoredToken();
      const storedUser = await getStoredUser();
      if (storedToken && storedUser) {
        if (isTokenExpired(storedToken)) {
          await clearAuth();
        } else {
          setToken(storedToken);
          setUser(storedUser);
        }
      }
      setIsLoading(false);
    }
    loadStoredAuth();
  }, []);

  // Watch every request the app makes. If a request that carried a token comes
  // back 401 with a token message, the session has ended.
  useEffect(() => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: any, init?: any) => {
      const response = await originalFetch(input, init);

      try {
        const url = typeof input === 'string' ? input : input?.url ?? '';
        const sentToken = !!(init?.headers && (init.headers.Authorization || init.headers.authorization));

        if (response.status === 401 && sentToken && url.startsWith(API_BASE_URL)) {
          const body = await response.clone().json().catch(() => null);
          if (body && /token/i.test(String(body.error || ''))) {
            handleExpiredRef.current();
          }
        }
      } catch {
        // Never let the watcher break a normal request
      }

      return response;
    }) as typeof fetch;

    return () => {
      globalThis.fetch = originalFetch;
    };
  }, []);

  async function login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    sessionEndedRef.current = false;
    await saveAuth(data.token, data.user);
    setToken(data.token);
    setUser(data.user);

    // Register for push notifications, but don't block login if it fails
    registerForPushNotificationsAsync()
      .then((pushToken) => {
        if (pushToken) {
          fetch(`${API_BASE_URL}/api/auth/push-token`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${data.token}`,
            },
            body: JSON.stringify({ pushToken }),
          }).catch((err) => console.error('Failed to save push token:', err));
        }
      })
      .catch((err) => console.error('Push registration failed:', err));
  }

  async function logout() {
    await clearAuth();
    setToken(null);
    setUser(null);
  }

  async function updateUser(changes: Partial<User>) {
    if (!user || !token) return;
    const updated = { ...user, ...changes };
    await saveAuth(token, updated);
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}