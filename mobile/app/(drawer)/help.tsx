import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import ScreenBackground from '../../components/ScreenBackground';

type Parameter = {
  id: number;
  name: string;
  unit: string;
  safe_min: string | number;
  safe_max: string | number;
  warning_min: string | number;
  warning_max: string | number;
};

const quickStartSteps = [
  {
    title: 'Check the Dashboard',
    text: 'The Dashboard shows a live overview of every monitoring site — color-coded green (safe), yellow (warning), or red (critical) based on the latest sensor readings.',
  },
  {
    title: 'Open a Site',
    text: 'Tap any site card to see its individual parameter readings.',
  },
  {
    title: 'Respond to Alerts',
    text: "Visit the Alerts section to see everything that's breached a safe threshold. Acknowledge an alert once you're aware of it, and Resolve it once the issue is fixed.",
  },
  {
    title: 'Water Filters',
    text: 'The Water Filters section tracks physical filter servicing — mark a filter as serviced once maintenance is done.',
  },
];

const faqs = [
  {
    q: 'What do the severity colors mean?',
    a: "Green means the reading is within the safe range. Yellow (warning) means it's outside safe but not yet dangerous. Red (critical) means it's outside even the warning range and needs urgent attention.",
  },
  {
    q: "Why didn't I get an alert email?",
    a: 'MajiMonitor only sends emails for critical alerts, to avoid flooding your inbox. Warning-level alerts are visible on the dashboard and Alerts screen but don\'t trigger an email.',
  },
  {
    q: 'I forgot my password. What do I do?',
    a: 'On the login screen, tap "Forgot Password?" and enter your email. You\'ll receive a reset link valid for 30 minutes.',
  },
  {
    q: 'Can I add a new monitoring site myself?',
    a: 'Only admin accounts can add or deactivate sites, via Site Management. Contact your administrator if you need a new site added.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity style={styles.faqItem} onPress={() => setExpanded(!expanded)}>
      <View style={styles.faqQuestionRow}>
        <Text style={styles.faqQuestion}>{q}</Text>
        <Text style={styles.faqChevron}>{expanded ? '−' : '+'}</Text>
      </View>
      {expanded ? <Text style={styles.faqAnswer}>{a}</Text> : null}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/parameters`)
      .then((res) => res.json())
      .then(setParameters)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ScreenBackground style={styles.container}>
      <ScrollView>
        <Text style={styles.pageTitle}>Help Center</Text>
        <Text style={styles.pageSubtitle}>Everything you need to know about using MajiMonitor</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Start Guide</Text>
          {quickStartSteps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {faqs.map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Alert Status Is Determined</Text>
          <Text style={styles.bodyText}>
            Each water quality parameter has two threshold bands: a safe range and a wider warning
            range.
          </Text>

          <View style={styles.statusRow}>
            <Text style={[styles.statusIcon, { color: '#2e7d32' }]}>✓ Safe</Text>
            <Text style={styles.statusDesc}>Within the ideal safe range.</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusIcon, { color: '#f9a825' }]}>! Warning</Text>
            <Text style={styles.statusDesc}>Outside safe, still within the warning range.</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusIcon, { color: '#d32f2f' }]}>✕ Critical</Text>
            <Text style={styles.statusDesc}>Outside even the warning range.</Text>
          </View>

          <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: 16 }]}>
            Current Thresholds
          </Text>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.3 }]}>Parameter</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Safe</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Warning</Text>
              </View>
              {parameters.map((p) => (
                <View key={p.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.3 }]}>
                    {p.name} ({p.unit})
                  </Text>
                  <Text style={styles.tableCell}>
                    {p.safe_min}–{p.safe_max}
                  </Text>
                  <Text style={styles.tableCell}>
                    {p.warning_min}–{p.warning_max}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footnote}>
            A site&apos;s overall status badge reflects its single worst active alert — for
            example, a site with one critical parameter shows as &quot;Critical&quot; even if
            every other parameter is safe.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:+254700000000')}>
            <Text style={styles.contactLine}>📞 +254 700 000 000</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:support@thiwasco.co.ke')}>
            <Text style={styles.contactLine}>✉️ support@thiwasco.co.ke</Text>
          </TouchableOpacity>
          <Text style={styles.contactLine}>📍 THIWASCO Head Office, Thika</Text>
        </View>

        <View style={[styles.section, { marginBottom: 32 }]}>
          <Text style={styles.sectionTitle}>About MajiMonitor</Text>
          <Text style={styles.bodyText}>
            MajiMonitor is a real-time water quality monitoring system built for THIWASCO, tracking
            pH, turbidity, dissolved oxygen, conductivity, temperature, and TDS across monitoring
            sites along the Thika River basin. It automatically flags unsafe readings, notifies
            staff by email, and keeps a full historical record for reporting and compliance.
          </Text>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  pageTitle: { fontSize: 22, fontWeight: 'bold' },
  pageSubtitle: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
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
  stepRow: { flexDirection: 'row', marginBottom: 14 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumberText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  stepTextContainer: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '600' },
  stepText: { fontSize: 13, color: '#666', marginTop: 2 },
  faqItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  faqQuestionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: 14, fontWeight: '600', flex: 1 },
  faqChevron: { fontSize: 18, color: '#0a7ea4', marginLeft: 8 },
  faqAnswer: { fontSize: 13, color: '#666', marginTop: 8, lineHeight: 19 },
  bodyText: { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusIcon: { fontWeight: 'bold', width: 90, fontSize: 13 },
  statusDesc: { fontSize: 13, color: '#666', flex: 1 },
  table: { marginTop: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tableHeaderRow: { backgroundColor: '#f5f5f5' },
  tableCell: { flex: 1, fontSize: 12, color: '#333' },
  tableHeaderText: { fontWeight: '600', color: '#555' },
  footnote: { fontSize: 12, color: '#999', marginTop: 12, lineHeight: 17 },
  contactLine: { fontSize: 14, color: '#0a7ea4', marginBottom: 10 },
});