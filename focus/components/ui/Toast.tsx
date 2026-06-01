import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, type Toast as ToastType } from '../../store/useAppStore';
import { colors, radius, spacing, typography } from '../../utils/theme';

const TYPE_STYLES: Record<ToastType['type'], { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(16,185,129,0.92)', border: 'rgba(16,185,129,0.6)', icon: '✓' },
  error: { bg: 'rgba(239,68,68,0.92)', border: 'rgba(239,68,68,0.6)', icon: '✕' },
  info: { bg: 'rgba(124,58,237,0.92)', border: 'rgba(124,58,237,0.6)', icon: 'ℹ' },
};

function ToastItem({ toast }: { toast: ToastType }) {
  const remove = useAppStore((s) => s.removeToast);
  const anim = useRef(new Animated.Value(0)).current;
  const style = TYPE_STYLES[toast.type];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
  }, []);

  const dismiss = () => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      remove(toast.id),
    );
  };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }}
    >
      <Pressable
        onPress={dismiss}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: style.bg,
          borderWidth: 1,
          borderColor: style.border,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 20,
        }}
      >
        <Text style={{ color: '#fff', fontSize: typography.sizes.sm, fontWeight: '700' }}>
          {style.icon}
        </Text>
        <Text
          style={{
            flex: 1,
            color: '#fff',
            fontSize: typography.sizes.sm,
            lineHeight: 18,
            fontWeight: '600',
          }}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: spacing.md,
        right: spacing.md,
        gap: spacing.xs,
        zIndex: 9999,
        pointerEvents: 'box-none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}
