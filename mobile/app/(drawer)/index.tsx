import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import { getSiteBadge, badgeColor, Alert } from '../../utils/siteStatus';
import { useRouter } from 'expo-router';
import ScreenBackground from '../../components/ScreenBackground';

type Site = {
  id: number;
  name: string;
  location_description: string;
  status: 'active' | 'inactive';
  assigned_officer_name: string | null;
};

export default function DashboardScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [sitesRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sites`),
        fetch(`${API_BASE_URL}/api/alerts?status=active`),
      ]);

      if (!sitesRes.ok || !alertsRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const sitesData = await sitesRes.json();
      const alertsData = await alertsRes.json();

      setSites(sitesData);
      setActiveAlerts(alertsData);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadData();
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
      <Text style={styles.header}>Monitoring Sites</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={sites}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => {
          const badge = getSiteBadge(item.id, activeAlerts);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/site/[id]', params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.siteName}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: badgeColor(badge) }]}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              </View>
              <Text style={styles.location}>{item.location_description}</Text>
              {item.assigned_officer_name ? (
                <Text style={styles.officer}>Officer: {item.assigned_officer_name}</Text>
              ) : null}
            </TouchableOpacity>
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
  location: { fontSize: 13, color: '#666', marginTop: 4 },
  officer: { fontSize: 12, color: '#999', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});