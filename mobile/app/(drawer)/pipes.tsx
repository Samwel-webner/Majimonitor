import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { API_BASE_URL } from '../../constants/api';
import ScreenBackground from '../../components/ScreenBackground';

const REFRESH_MS = 30000; // the backend answers slowly, so don't refresh too often

type Station = {
  site_id: number;
  name: string;
  flow: number | null;
  pressure: number | null;
  updated_at: string | null;
};

type Pipe = {
  id: number;
  name: string;
  length_m: number;
  condition_status: string;
  message: string;
  loss_percent: number | null;
  upstream: Station;
  downstream: Station;
};

type Level = 'ok' | 'warn' | 'bad';

// How each condition is shown: label for the badge, level for the colour
const STATUS_INFO: Record<string, { label: string; level: Level }> = {
  normal: { label: 'Normal', level: 'ok' },
  low_pressure: { label: 'Low pressure', level: 'warn' },
  high_pressure: { label: 'High pressure', level: 'warn' },
  leak: { label: 'Leak', level: 'warn' },
  burst: { label: 'Burst pipe', level: 'bad' },
  blockage: { label: 'Blockage', level: 'bad' },
  no_supply: { label: 'No supply', level: 'bad' },
};

// Same colours as the web Pipe Network page
const LEVEL_COLOR: Record<Level, string> = {
  ok: '#16a34a',
  warn: '#f59e0b',
  bad: '#dc2626',
};

// General guidance only. Replace with THIWASCO's own procedures when you have them.
const ACTIONS: Record<string, string> = {
  leak: 'Send a field team to inspect the pipe between the two stations. Look for wet ground and pressure drops. Schedule a repair, and isolate the section if the loss grows.',
  burst: 'Isolate the section by closing the valves at both stations. Dispatch an emergency repair crew and warn customers who may lose supply.',
  blockage: 'Check that the valves in this section are open. Inspect for debris or a stuck valve, and flush the line once it is cleared.',
  no_supply: 'Check the pump and the main valve at the source. Confirm there is power at the pump house and that the intake is not blocked.',
  low_pressure: 'Check pump output and the tank level. Look for unreported leaks or unusually heavy demand upstream.',
  high_pressure: 'Check the pressure-reducing valve and reduce pump output. Inspect joints and flanges for stress.',
};

function statusInfo(status: string) {
  return STATUS_INFO[status] || { label: status, level: 'warn' as Level };
}

function fmt(value: number | null, unit: string) {
  return value === null || value === undefined ? '--' : `${value} ${unit}`;
}

function StationBox({ role, station }: { role: string; station: Station }) {
  const updated = station.updated_at
    ? new Date(station.updated_at).toLocaleTimeString()
    : 'no data';

  return (
    <View style={styles.station}>
      <Text style={styles.stationRole}>{role}</Text>
      <Text style={styles.stationName}>{station.name}</Text>
      <Text style={styles.stationValue}>Flow: {fmt(station.flow, 'L/min')}</Text>
      <Text style={styles.stationValue}>Pressure: {fmt(station.pressure, 'bar')}</Text>
      <Text style={styles.stationTime}>Updated {updated}</Text>
    </View>
  );
}

export default function PipesScreen() {
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadPipes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/pipes`);
      if (!res.ok) throw new Error('Failed to load the pipe network');
      setPipes(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load when the screen comes into view, then refresh every 30 seconds while it stays open
  useFocusEffect(
    useCallback(() => {
      loadPipes();
      const timer = setInterval(loadPipes, REFRESH_MS);
      return () => clearInterval(timer);
    }, [loadPipes])
  );

  function handleRefresh() {
    setIsRefreshing(true);
    loadPipes();
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const faults = pipes.filter((p) => p.condition_status !== 'normal').length;
  const summary =
    pipes.length === 0
      ? ''
      : faults === 0
        ? `All ${pipes.length} pipe sections are operating normally`
        : `${faults} of ${pipes.length} pipe sections need attention`;

  return (
    <ScreenBackground style={styles.container}>
      <Text style={styles.header}>Pipe Network</Text>

      {summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={pipes}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error ? 'Pull down to try again.' : 'No pipe sections have been set up yet.'}
          </Text>
        }
        renderItem={({ item }) => {
          const info = statusInfo(item.condition_status);
          const color = LEVEL_COLOR[info.level];
          const loss = item.loss_percent === null ? '--' : `${item.loss_percent}%`;

          return (
            <View style={[styles.card, { borderLeftColor: color }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.pipeName}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: color }]}>
                  <Text style={styles.badgeText}>{info.label}</Text>
                </View>
              </View>

              <Text style={styles.message}>{item.message}</Text>

              <View style={styles.stations}>
                <StationBox role="From" station={item.upstream} />
                <StationBox role="To" station={item.downstream} />
              </View>

              <Text style={styles.meta}>
                Length {item.length_m} m · Flow lost between stations: {loss}
              </Text>

              {item.condition_status !== 'normal' ? (
                <View style={styles.advice}>
                  <Text style={styles.adviceTitle}>Suggested action</Text>
                  <Text style={styles.adviceText}>{ACTIONS[item.condition_status] || ''}</Text>
                  <Text style={styles.adviceNote}>
                    General guidance only. Follow THIWASCO procedures.
                  </Text>
                </View>
              ) : null}
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
  summary: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  summaryText: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  error: { color: '#d32f2f', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 6,
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
    gap: 8,
  },
  pipeName: { flex: 1, fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  message: { fontSize: 14, color: '#333', marginTop: 8 },
  stations: { flexDirection: 'row', gap: 8, marginTop: 12 },
  station: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10 },
  stationRole: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  stationName: { fontSize: 13, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  stationValue: { fontSize: 12, color: '#374151' },
  stationTime: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 10 },
  advice: { backgroundColor: '#eaf3fb', borderRadius: 8, padding: 10, marginTop: 10 },
  adviceTitle: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  adviceText: { fontSize: 13, color: '#374151', marginTop: 4 },
  adviceNote: { fontSize: 11, color: '#6b7280', marginTop: 6 },
});