import { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  type TextInputProps,
} from 'react-native';
import { colors, radius, typography, spacing } from '../../utils/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  rightIcon?: React.ReactNode;
  secure?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, rightIcon, secure = false, style, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const borderColor = error
    ? colors.status.error
    : focused
    ? colors.cosmic.purpleLight
    : colors.bg.cardBorder;

  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.medium,
            letterSpacing: typography.tracking.wide,
          }}
        >
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bg.input,
          borderWidth: 1,
          borderColor,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
        }}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={secure && !showSecret}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              flex: 1,
              color: colors.text.primary,
              fontSize: typography.sizes.base,
              paddingVertical: 14,
            },
            style as object,
          ]}
          {...props}
        />
        {secure && (
          <Pressable onPress={() => setShowSecret(!showSecret)} hitSlop={8}>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
              {showSecret ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        )}
        {rightIcon && !secure && rightIcon}
      </View>

      {error && (
        <Text style={{ color: colors.status.error, fontSize: typography.sizes.xs }}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
          {hint}
        </Text>
      )}
    </View>
  );
});
