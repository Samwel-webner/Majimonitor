import { useEffect, useState } from 'react';
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
import Avatar from '../../components/Avatar';
import { useAuth } from '../../contexts/AuthContext';

type Site = {
  id: number;
  name: string;
  location_description: string;
  status: 'active' | 'inactive';
  assigned_officer_id: number | null;
  assigned_officer_name: string | null;
  assigned_officer_avatar: string | null;
};

export default function DashboardScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [openAlerts, setOpenAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [sitesRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/sites`),
          fetch(`${API_BASE_URL}/api/alerts?status=active,acknowledged`),
        ]);

        if (!sitesRes.ok || !alertsRes.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const sitesData = await sitesRes.json();
        const alertsData = await alertsRes.json();

        if (cancelled) return;
        setSites(sitesData);
        setOpenAlerts(alertsData);
        setError('');
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Something went wrong');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function handleRefresh() {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
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
      <View style={styles.greetingRow}>
        <Avatar userId={user?.id} avatar={user?.avatar} size={44} />
        <Text style={styles.greeting}>Hi, {user?.name}</Text>
      </View>

      <Text style={styles.header}>Monitoring Sites</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={sites}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => {
          const badge = getSiteBadge(item.id, openAlerts);
          const checkedBy = openAlerts.find(
            (a) => a.site_id === item.id && a.status === 'acknowledged'
          );
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
                <View style={styles.officerRow}>
                  <Avatar
                    userId={item.assigned_officer_id}
                    avatar={item.assigned_officer_avatar}
                    size={22}
                  />
                  <Text style={styles.officer}>Officer: {item.assigned_officer_name}</Text>
                </View>
              ) : null}
              {checkedBy ? (
                <View style={styles.checkingRow}>
                  <Avatar
                    userId={checkedBy.acknowledged_by ?? null}
                    avatar={checkedBy.acknowledged_by_avatar ?? null}
                    size={20}
                  />
                  <Text style={styles.checkingText}>
                    Being checked by {checkedBy.acknowledged_by_name ?? 'an officer'}
                  </Text>
                </View>
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
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  greeting: { fontSize: 18, fontWeight: '600', marginLeft: 12, flexShrink: 1 },
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
  officerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  officer: { fontSize: 12, color: '#999', marginLeft: 6 },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#DCE9E8',
  },
  checkingText: { fontSize: 12, color: '#234649', fontWeight: '500', marginLeft: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});