import { View, Text, ActivityIndicator } from 'react-native';
import { colors, typography, spacing } from '../../utils/theme';

type LoadingStateProps = {
  message?: string;
  fullscreen?: boolean;
};

export function LoadingState({
  message = 'Loading...',
  fullscreen = true,
}: LoadingStateProps) {
  return (
    <View
      style={{
        flex: fullscreen ? 1 : undefined,
        backgroundColor: fullscreen ? colors.bg.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <ActivityIndicator size="large" color={colors.cosmic.purpleLight} />
      <Text
        style={{
          color: colors.text.secondary,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.medium,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
