import { View, Text, ScrollView, Image, StyleSheet, DimensionValue } from 'react-native';
import ScreenBackground from '../../components/ScreenBackground';

type Marker = { number: number; top: DimensionValue; left: DimensionValue };

const markers: Marker[] = [
  { number: 1, top: '8%', left: '52%' },
  { number: 2, top: '12%', left: '70%' },
  { number: 3, top: '27%', left: '50%' },
  { number: 4, top: '47%', left: '62%' },
  { number: 5, top: '67%', left: '67%' },
  { number: 6, top: '58%', left: '56%' },
  { number: 7, top: '80%', left: '58%' },
  { number: 8, top: '94%', left: '59%' },
];

const legend = [
  { number: 1, title: 'Solar panel', text: "Charges the unit's battery from sunlight" },
  { number: 2, title: 'Antenna', text: 'Sends readings via WiFi/cellular' },
  { number: 3, title: 'Control enclosure', text: 'Houses the ESP32 and electronics' },
  { number: 4, title: 'Mounting clamp', text: 'Secures the unit to the pole' },
  { number: 5, title: 'Waterproof cable', text: 'Carries power and data to the probe' },
  { number: 6, title: 'Probe housing', text: 'Waterproof casing for the sensors' },
  { number: 7, title: 'Sensor array', text: 'Six parameter sensors (see below)' },
  { number: 8, title: 'Protective tip', text: 'Directs water flow across the sensors' },
];

const parameters = [
  { name: 'pH', text: 'Measures acidity/alkalinity of the water' },
  { name: 'Turbidity', text: 'Measures water clarity/cloudiness' },
  { name: 'TDS', text: 'Measures total dissolved solids' },
  { name: 'Temperature', text: "Measures the water's temperature" },
  { name: 'Conductivity', text: 'Measures electrical conductivity/salinity' },
  { name: 'Dissolved Oxygen', text: 'Measures oxygen available in the water' },
];

const maintenanceChecklist = [
  { freq: 'Weekly', task: 'Inspect probe housing for cracks, corrosion, or algae/silt buildup' },
  { freq: 'Weekly', task: 'Clean sensor windows with a soft cloth or approved solution' },
  { freq: 'Monthly', task: 'Check the cable and cable gland for wear or water ingress' },
  { freq: 'Monthly', task: 'Ensure the solar panel is clean and gets full sunlight' },
  { freq: 'Monthly', task: 'Confirm readings are reaching the dashboard as expected' },
  { freq: 'Monthly', task: 'Inspect the mounting bracket and pole for looseness' },
  { freq: 'Quarterly', task: 'Calibrate pH and dissolved oxygen sensors against a reference solution' },
  { freq: 'Quarterly', task: 'Check the battery and solar charging system health' },
  { freq: 'Annually', task: 'Follow manufacturer guidance on sensor replacement/recalibration' },
];

export default function SensorsScreen() {
  return (
    <ScreenBackground style={styles.container}>
      <ScrollView>
        <Text style={styles.pageTitle}>Sensor Unit</Text>
        <Text style={styles.pageSubtitle}>What it is and how to maintain it</Text>

        <View style={styles.imageWrapper}>
          <Image
            source={require('../../assets/images/sensor-unit.png')}
            style={styles.image}
            resizeMode="contain"
          />
          {markers.map((m) => (
            <View key={m.number} style={[styles.marker, { top: m.top, left: m.left }]}>
              <Text style={styles.markerText}>{m.number}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parts</Text>
          {legend.map((item) => (
            <View key={item.number} style={styles.legendRow}>
              <View style={styles.legendNumber}>
                <Text style={styles.legendNumberText}>{item.number}</Text>
              </View>
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendTitle}>{item.title}</Text>
                <Text style={styles.legendText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parameters Measured</Text>
          {parameters.map((p) => (
            <View key={p.name} style={styles.paramRow}>
              <Text style={styles.paramName}>{p.name}</Text>
              <Text style={styles.paramText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { marginBottom: 32 }]}>
          <Text style={styles.sectionTitle}>Maintenance Checklist</Text>
          {maintenanceChecklist.map((item, i) => (
            <View key={i} style={styles.checklistRow}>
              <View style={styles.freqBadge}>
                <Text style={styles.freqBadgeText}>{item.freq}</Text>
              </View>
              <Text style={styles.checklistText}>{item.task}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  pageTitle: { fontSize: 22, fontWeight: 'bold' },
  pageSubtitle: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
  imageWrapper: {
    width: '100%',
    aspectRatio: 0.68,
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  image: { width: '100%', height: '100%' },
  marker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  legendRow: { flexDirection: 'row', marginBottom: 12 },
  legendNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  legendNumberText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  legendTextContainer: { flex: 1 },
  legendTitle: { fontSize: 14, fontWeight: '600' },
  legendText: { fontSize: 12, color: '#666', marginTop: 2 },
  paramRow: { marginBottom: 12 },
  paramName: { fontSize: 14, fontWeight: '600', color: '#0a7ea4' },
  paramText: { fontSize: 13, color: '#555', marginTop: 2 },
  checklistRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  freqBadge: {
    backgroundColor: '#eef6f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  freqBadgeText: { fontSize: 11, fontWeight: '600', color: '#0a7ea4' },
  checklistText: { fontSize: 13, color: '#444', flex: 1, lineHeight: 18 },
});