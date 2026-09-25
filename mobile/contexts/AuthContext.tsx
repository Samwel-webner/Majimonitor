import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveAuth, getStoredToken, getStoredUser, clearAuth } from '../utils/authStorage';
import { API_BASE_URL } from '../constants/api';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  gender?: string;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      const storedToken = await getStoredToken();
      const storedUser = await getStoredUser();
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      }
      setIsLoading(false);
    }
    loadStoredAuth();
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

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
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