import { useEffect, useState, useCallback } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { API_BASE_URL } from '../../constants/api';
import { classifyValue, badgeColor, ReadingWithThresholds } from '../../utils/siteStatus';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SiteDetail = {
  id: number;
  name: string;
  location_description: string;
  river_section: string;
  assigned_officer_name: string | null;
};

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [readings, setReadings] = useState<ReadingWithThresholds[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [siteRes, readingsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sites/${id}`),
        fetch(`${API_BASE_URL}/api/sites/${id}/readings/latest`),
      ]);

      if (!siteRes.ok || !readingsRes.ok) {
        throw new Error('Failed to load site details');
      }

      setSite(await siteRes.json());
      setReadings(await readingsRes.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadData();
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: site?.name || 'Site Detail' }} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {site && (
        <View style={styles.siteInfo}>
          <Text style={styles.location}>{site.location_description}</Text>
          <Text style={styles.section}>{site.river_section}</Text>
          {site.assigned_officer_name && (
            <Text style={styles.officer}>Officer: {site.assigned_officer_name}</Text>
          )}
        </View>
      )}

      <Text style={styles.header}>Latest Readings</Text>

      <FlatList
        data={readings}
        keyExtractor={(item) => item.parameter_id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => {
          const badge = classifyValue(item);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.paramName}>{item.parameter_name}</Text>
                <View style={[styles.badge, { backgroundColor: badgeColor(badge) }]}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              </View>
              <Text style={styles.value}>
                {item.value} {item.unit}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#d32f2f', marginBottom: 8 },
  siteInfo: { marginBottom: 16 },
  location: { fontSize: 14, color: '#444' },
  section: { fontSize: 13, color: '#777', marginTop: 2 },
  officer: { fontSize: 12, color: '#999', marginTop: 4 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
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
  paramName: { fontSize: 15, fontWeight: '600' },
  value: { fontSize: 20, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});