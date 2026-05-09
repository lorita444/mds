import { View, Text } from 'react-native';
import { colors, typography, spacing, radius } from '../../utils/theme';
import { Button } from './Button';

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  fullscreen?: boolean;
};

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  fullscreen = false,
}: ErrorStateProps) {
  return (
    <View
      style={{
        flex: fullscreen ? 1 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <View
        style={{
          backgroundColor: colors.status.errorFaint,
          borderRadius: radius.full,
          width: 64,
          height: 64,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 28 }}>⚠️</Text>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.bold,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: typography.sizes.base,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          {message}
        </Text>
      </View>

      {onRetry && (
        <Button label="Try again" variant="ghost" onPress={onRetry} size="sm" />
      )}
    </View>
  );
}
