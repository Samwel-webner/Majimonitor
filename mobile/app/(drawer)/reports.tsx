import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../../constants/api';
import ScreenBackground from '../../components/ScreenBackground';

type TrendPoint = {
  date: string;
  critical: number;
  warning: number;
};

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export default function ReportsScreen() {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTrend = useCallback(async () => {
    try {
      const from = getDateNDaysAgo(30);
      const to = getDateNDaysAgo(0);
      const res = await fetch(`${API_BASE_URL}/api/alerts/trend?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Failed to load trend data');
      setTrend(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadTrend();
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const totalCritical = trend.reduce((sum, p) => sum + p.critical, 0);
  const totalWarning = trend.reduce((sum, p) => sum + p.warning, 0);

  const hasData = trend.length > 0;

  const chartData = {
    labels: trend.map((p) => p.date.slice(5)), // "MM-DD" instead of full date
    datasets: [
      {
        data: trend.map((p) => p.critical),
        color: () => '#d32f2f',
        strokeWidth: 2,
      },
      {
        data: trend.map((p) => p.warning),
        color: () => '#f9a825',
        strokeWidth: 2,
      },
    ],
    legend: ['Critical', 'Warning'],
  };

  return (
    <ScreenBackground style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <Text style={styles.header}>Alert Trend (Last 30 Days)</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: '#d32f2f' }]}>{totalCritical}</Text>
            <Text style={styles.summaryLabel}>Critical</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: '#f9a825' }]}>{totalWarning}</Text>
            <Text style={styles.summaryLabel}>Warning</Text>
          </View>
        </View>

        {hasData ? (
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: () => '#333',
              labelColor: () => '#666',
              propsForDots: { r: '3' },
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <Text style={styles.empty}>No alert data in this period.</Text>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  error: { color: '#d32f2f', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 20 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  summaryNumber: { fontSize: 28, fontWeight: 'bold' },
  summaryLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  chart: {
    borderRadius: 10,
    marginBottom: 16,
  },
});