import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import ScreenBackground from '../../components/ScreenBackground';
import Avatar from '../../components/Avatar';
import { AVATARS, avatarFor } from '../../utils/avatars';
import { API_BASE_URL } from '../../constants/api';

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = avatarFor(user?.id, user?.avatar);

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }

  async function chooseAvatar(key: string | null) {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/avatar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: key }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your animal');
      await updateUser({ avatar: data.avatar });
      setPickerOpen(false);
    } catch (err: any) {
      Alert.alert('Could not save', err.message || 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenBackground style={styles.container}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.avatarWrap}>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change your animal"
        >
          <Avatar userId={user?.id} avatar={user?.avatar} size={96} />
        </TouchableOpacity>
        <Text style={styles.avatarHint}>{current.label} - tap to change</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>

        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{user?.role}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView>
              <Text style={styles.sheetTitle}>Choose your animal</Text>
              <View style={styles.grid}>
                {AVATARS.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    disabled={saving}
                    onPress={() => chooseAvatar(a.key)}
                    style={[styles.choice, a.key === user?.avatar && styles.choiceSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                  >
                    <Avatar avatar={a.key} size={56} />
                    <Text style={styles.choiceLabel}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {saving && <ActivityIndicator style={{ marginTop: 12 }} />}
              <TouchableOpacity disabled={saving} onPress={() => chooseAvatar(null)}>
                <Text style={styles.resetText}>Use my automatic animal</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={() => setPickerOpen(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  avatarWrap: { alignItems: 'center', marginBottom: 16 },
  avatarHint: { fontSize: 12, color: '#555', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  label: { fontSize: 12, color: '#999', marginTop: 10 },
  value: { fontSize: 16, color: '#222', marginTop: 2 },
  logoutButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  choice: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  choiceSelected: { borderColor: '#2F5D62' },
  choiceLabel: { fontSize: 11, color: '#444', marginTop: 4 },
  resetText: { textAlign: 'center', color: '#2F5D62', fontWeight: '600', marginTop: 16, padding: 8 },
  closeText: { textAlign: 'center', color: '#777', padding: 8 },
});