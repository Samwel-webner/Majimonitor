import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert as RNAlert,
} from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import { badgeColor } from '../../utils/siteStatus';
import { useAuth } from '../../contexts/AuthContext';
import ScreenBackground from '../../components/ScreenBackground';

type AlertItem = {
  id: number;
  site_id: number;
  parameter_id: number;
  triggered_value: string | number;
  severity: 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  site_name: string;
  parameter_name: string;
  unit: string;
};

export default function AlertsScreen() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts?status=active`);
      if (!res.ok) throw new Error('Failed to load alerts');
      setAlerts(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAlerts();
  }, [loadAlerts]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadAlerts();
  }

  async function updateAlertStatus(id: number, status: 'acknowledged' | 'resolved') {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update alert');
      }

      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      RNAlert.alert('Error', err.message || 'Could not update alert');
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
      <Text style={styles.header}>Active Alerts</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No active alerts right now.</Text>
        }
        renderItem={({ item }) => {
          const badge = item.severity === 'critical' ? 'Critical' : 'Warning';
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.siteName}>{item.site_name}</Text>
                <View style={[styles.badge, { backgroundColor: badgeColor(badge) }]}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              </View>
              <Text style={styles.detail}>
                {item.parameter_name}: {item.triggered_value} {item.unit}
              </Text>
              <Text style={styles.time}>
                {new Date(item.created_at).toLocaleString()}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => updateAlertStatus(item.id, 'acknowledged')}
                >
                  <Text style={styles.actionText}>Acknowledge</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.resolveButton]}
                  onPress={() => updateAlertStatus(item.id, 'resolved')}
                >
                  <Text style={styles.actionText}>Resolve</Text>
                </TouchableOpacity>
              </View>
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
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
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
  detail: { fontSize: 14, color: '#333', marginTop: 6 },
  time: { fontSize: 12, color: '#999', marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionButton: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resolveButton: { backgroundColor: '#2e7d32' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});