import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '../../contexts/AuthContext';

type NavItem = {
  name: string;
  title: string;
  icon: any;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { name: 'index', title: 'Home', icon: 'house.fill' },
  { name: 'Alerts', title: 'Alerts', icon: 'bell.fill' },
  { name: 'filters', title: 'Water Filters', icon: 'line.3.horizontal.decrease' },
  { name: 'sensors', title: 'Sensor Unit', icon: 'sensor.fill' },
  { name: 'reports', title: 'Reports & Analytics', icon: 'chart.bar.fill' },
  { name: 'officers', title: 'Officers', icon: 'person.2.fill', adminOnly: true },
  { name: 'site-management', title: 'Site Management', icon: 'mappin.and.ellipse', adminOnly: true },
  { name: 'profile', title: 'Profile', icon: 'person.fill' },
  { name: 'help', title: 'Help Center', icon: 'questionmark.circle.fill' },
];

function CustomDrawerContent({ closeDrawer }: { closeDrawer: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.logoEmoji}>💧</Text>
        <Text style={styles.logoText}>MajiMonitor</Text>
      </View>

      {navItems
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const routePath = item.name === 'index' ? '/' : `/${item.name}`;
          const isActive = pathname === routePath;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.item, isActive && styles.itemActive]}
              onPress={() => {
                router.push(routePath as any);
                closeDrawer();
              }}
            >
              <IconSymbol size={22} name={item.icon} color={isActive ? '#0a7ea4' : '#555'} />
              <Text style={[styles.itemText, isActive && styles.itemTextActive]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
    </ScrollView>
  );
}

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerShown: true,
          drawerActiveTintColor: '#0a7ea4',
        }}
        drawerContent={(props: any) => (
          <CustomDrawerContent closeDrawer={() => props?.navigation?.closeDrawer?.()} />
        )}
      >
        <Drawer.Screen name="index" options={{ title: 'Home' }} />
        <Drawer.Screen name="Alerts" options={{ title: 'Alerts' }} />
        <Drawer.Screen name="filters" options={{ title: 'Water Filters' }} />
        <Drawer.Screen name="sensors" options={{ title: 'Sensor Unit' }} />
        <Drawer.Screen name="reports" options={{ title: 'Reports & Analytics' }} />
        <Drawer.Screen name="officers" options={{ title: 'Officers' }} />
        <Drawer.Screen name="profile" options={{ title: 'Profile' }} />
        <Drawer.Screen name="site-management" options={{ title: 'Site Management' }} />
        <Drawer.Screen name="help" options={{ title: 'Help Center' }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  logoEmoji: { fontSize: 28, marginRight: 10 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#0a7ea4' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemActive: { backgroundColor: '#e8f4f8' },
  itemText: { marginLeft: 16, fontSize: 15, color: '#333' },
  itemTextActive: { color: '#0a7ea4', fontWeight: '600' },
});