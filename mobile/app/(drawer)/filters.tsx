import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl, Alert } from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import { getFilterStatus, filterStatusColor } from '../../utils/siteStatus';
import { useAuth } from '../../contexts/AuthContext';
import ScreenBackground from '../../components/ScreenBackground';

type FilterItem = {
  id: number;
  site_id: number;
  site_name: string;
  filter_type: string;
  installation_date: string;
  last_serviced_date: string;
  service_interval_days: number;
  notes: string | null;
};

export default function FiltersScreen() {
  const { token } = useAuth();
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters`);
      if (!res.ok) {
        console.log('FILTERS FETCH FAILED - status:', res.status);
        const body = await res.text();
        console.log('FILTERS FETCH FAILED - body:', body);
        throw new Error('Failed to load filters');
      }
      setFilters(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

 useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loadFilters is async; setState happens after fetch resolves, not synchronously in the effect
  loadFilters();
}, [loadFilters]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadFilters();
  }

  function confirmMarkServiced(id: number, siteName: string) {
    Alert.alert(
      'Mark as Serviced',
      `Confirm ${siteName}'s filter was serviced today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => markServiced(id) },
      ]
    );
  }

  async function markServiced(id: number) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/${id}/service`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update filter');
      }

      const updated = await res.json();
      setFilters((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update filter');
    }
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
      <Text style={styles.header}>Water Filters</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filters}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => {
          const status = getFilterStatus(item.last_serviced_date, item.service_interval_days);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.siteName}>{item.site_name}</Text>
                <View style={[styles.badge, { backgroundColor: filterStatusColor(status) }]}>
                  <Text style={styles.badgeText}>{status}</Text>
                </View>
              </View>
              <Text style={styles.detail}>Type: {item.filter_type}</Text>
              <Text style={styles.detail}>
                Last serviced: {new Date(item.last_serviced_date).toLocaleDateString()}
              </Text>
              <Text style={styles.detail}>
                Interval: every {item.service_interval_days} days
              </Text>
              {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

              <TouchableOpacity
                style={styles.serviceButton}
                onPress={() => confirmMarkServiced(item.id, item.site_name)}
              >
                <Text style={styles.serviceButtonText}>Mark as Serviced</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  siteName: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, color: '#555', marginTop: 4 },
  notes: { fontSize: 12, color: '#888', marginTop: 6, fontStyle: 'italic' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  serviceButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  serviceButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});