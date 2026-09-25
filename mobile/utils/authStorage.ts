import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'majimonitor_token';
const USER_KEY = 'majimonitor_user';

export async function saveAuth(token: string, user: object) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getStoredToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}