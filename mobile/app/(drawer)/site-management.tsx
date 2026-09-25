import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import { useAuth } from '../../contexts/AuthContext';
import ScreenBackground from '../../components/ScreenBackground';

type Site = {
  id: number;
  name: string;
  location_description: string;
  latitude: string | number;
  longitude: string | number;
  river_section: string;
  assigned_officer_id: number | null;
  assigned_officer_name: string | null;
  status: 'active' | 'inactive';
};

type Officer = {
  id: number;
  name: string;
  role: 'admin' | 'field_officer';
};

const emptyForm = {
  name: '',
  location_description: '',
  latitude: '',
  longitude: '',
  river_section: '',
  assigned_officer_id: null as number | null,
  status: 'active' as 'active' | 'inactive',
};

export default function SiteManagementScreen() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [sites, setSites] = useState<Site[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sitesRes, officersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sites`),
        fetch(`${API_BASE_URL}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!sitesRes.ok || !officersRes.ok) throw new Error('Failed to load data');
      setSites(await sitesRes.json());
      setOfficers(await officersRes.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadData();
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setModalVisible(true);
  }

  function openEditModal(site: Site) {
    setEditingId(site.id);
    setForm({
      name: site.name,
      location_description: site.location_description || '',
      latitude: String(site.latitude ?? ''),
      longitude: String(site.longitude ?? ''),
      river_section: site.river_section || '',
      assigned_officer_id: site.assigned_officer_id,
      status: site.status,
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Missing info', 'Site name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        name: form.name,
        location_description: form.location_description,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        river_section: form.river_section,
        assigned_officer_id: form.assigned_officer_id,
        status: form.status,
      };

      const url = editingId
        ? `${API_BASE_URL}/api/sites/${editingId}`
        : `${API_BASE_URL}/api/sites`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save site');
      }

      setModalVisible(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save site');
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete(site: Site) {
    Alert.alert('Delete Site', `Delete ${site.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSite(site.id) },
    ]);
  }

  async function deleteSite(id: number) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete site');
      setSites((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not delete site');
    }
  }

  if (!isAdmin) {
    return (
      <ScreenBackground style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.restricted}>This section is only available to admins.</Text>
        </View>
      </ScreenBackground>
    );
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
      <View style={styles.headerRow}>
        <Text style={styles.header}>Site Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Text style={styles.addButtonText}>+ Add Site</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={sites}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEditModal(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.siteName}>{item.name}</Text>
              <View style={[styles.statusBadge, item.status === 'inactive' && styles.inactiveBadge]}>
                <Text style={styles.statusBadgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.detail}>{item.river_section}</Text>
            <Text style={styles.detail}>
              Officer: {item.assigned_officer_name || 'Unassigned'}
            </Text>

            <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(item)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.modalTitle}>{editingId ? 'Edit Site' : 'New Site'}</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
          />

          <Text style={styles.label}>Location Description</Text>
          <TextInput
            style={styles.input}
            value={form.location_description}
            onChangeText={(v) => setForm({ ...form, location_description: v })}
          />

          <Text style={styles.label}>River Section</Text>
          <TextInput
            style={styles.input}
            value={form.river_section}
            onChangeText={(v) => setForm({ ...form, river_section: v })}
          />

          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={form.latitude}
            onChangeText={(v) => setForm({ ...form, latitude: v })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={form.longitude}
            onChangeText={(v) => setForm({ ...form, longitude: v })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Assigned Officer</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, form.assigned_officer_id === null && styles.chipSelected]}
              onPress={() => setForm({ ...form, assigned_officer_id: null })}
            >
              <Text style={[styles.chipText, form.assigned_officer_id === null && styles.chipTextSelected]}>
                Unassigned
              </Text>
            </TouchableOpacity>
            {officers.map((officer) => (
              <TouchableOpacity
                key={officer.id}
                style={[styles.chip, form.assigned_officer_id === officer.id && styles.chipSelected]}
                onPress={() => setForm({ ...form, assigned_officer_id: officer.id })}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.assigned_officer_id === officer.id && styles.chipTextSelected,
                  ]}
                >
                  {officer.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Status</Text>
          <View style={styles.chipRow}>
            {(['active', 'inactive'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, form.status === s && styles.chipSelected]}
                onPress={() => setForm({ ...form, status: s })}
              >
                <Text style={[styles.chipText, form.status === s && styles.chipTextSelected]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  restricted: { fontSize: 15, color: '#666', textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  header: { fontSize: 22, fontWeight: 'bold' },
  addButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
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
  detail: { fontSize: 13, color: '#666', marginTop: 4 },
  statusBadge: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inactiveBadge: { backgroundColor: '#999' },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  deleteButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextSelected: { color: '#fff' },
  saveButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: { color: '#666', fontSize: 15 },
});