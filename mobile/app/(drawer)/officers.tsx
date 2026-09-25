import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl, Alert } from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import { useAuth } from '../../contexts/AuthContext';
import ScreenBackground from '../../components/ScreenBackground';

type UserItem = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'field_officer';
};

export default function OfficersScreen() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  const loadUsers = useCallback(async () => {
    try {
  const res = await fetch(`${API_BASE_URL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load officers');
  setUsers(await res.json());
  setError('');
} catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loadUsers is async; setState happens after fetch resolves, not synchronously in the effect
  if (isAdmin) loadUsers();
}, [isAdmin, loadUsers]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadUsers();
  }

  function confirmDelete(item: UserItem) {
    if (item.id === user?.id) {
      Alert.alert('Not Allowed', 'You cannot delete your own account.');
      return;
    }
    Alert.alert('Remove Officer', `Remove ${item.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteUser(item.id) },
    ]);
  }

  async function deleteUser(id: number) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove officer');
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not remove officer');
    }
  }

  if (!isAdmin) {
    return (
      <ScreenBackground style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.restricted}>This section is only available to admins.</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScreenBackground style={styles.container}>
      <Text style={styles.header}>Officers</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name}</Text>
              <View style={[styles.roleBadge, item.role === 'admin' && styles.adminBadge]}>
                <Text style={styles.roleBadgeText}>
                  {item.role === 'admin' ? 'Admin' : 'Field Officer'}
                </Text>
              </View>
            </View>
            <Text style={styles.email}>{item.email}</Text>

            <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(item)}>
              <Text style={styles.deleteButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  restricted: { fontSize: 15, color: '#666', textAlign: 'center' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  error: { color: '#d32f2f', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 13, color: '#666', marginTop: 4 },
  roleBadge: {
    backgroundColor: '#607d8b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadge: { backgroundColor: '#0a7ea4' },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  deleteButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});