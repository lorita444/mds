import { Component, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors, spacing, typography, radius } from '../../utils/theme';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.primary,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          padding: spacing.xl,
        }}
      >
        <Text style={{ fontSize: 40 }}>💫</Text>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.bold,
            textAlign: 'center',
          }}
        >
          Something went sideways
        </Text>
        <Text
          style={{
            color: colors.text.muted,
            fontSize: typography.sizes.sm,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {this.state.error?.message ?? 'An unexpected error occurred'}
        </Text>
        <Pressable
          onPress={this.reset}
          style={({ pressed }) => ({
            backgroundColor: colors.cosmic.purple,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.sm + 4,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.semibold,
            }}
          >
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }
}
