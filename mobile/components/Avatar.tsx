import { View, Text, StyleSheet } from 'react-native';
import { avatarFor } from '../utils/avatars';

type Props = { userId?: number | null; avatar?: string | null; size?: number };

export default function Avatar({ userId, avatar, size = 40 }: Props) {
  const a = avatarFor(userId, avatar);
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: a.bg }]}
      accessibilityLabel={`${a.label} avatar`}
    >
      <Text style={{ fontSize: size * 0.55, lineHeight: Math.round(size * 0.7), includeFontPadding: false }}>
        {a.emoji}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});