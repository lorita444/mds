import { View, ScrollView, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../utils/theme';

type ScreenContainerProps = {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  padTop?: boolean;
  padBottom?: boolean;
};

export function ScreenContainer({
  children,
  scrollable = false,
  style,
  contentStyle,
  padTop = true,
  padBottom = true,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const paddingStyle: ViewStyle = {
    paddingTop: padTop ? insets.top + spacing.md : 0,
    paddingBottom: padBottom ? insets.bottom + spacing.lg : 0,
    paddingHorizontal: spacing.md,
  };

  if (scrollable) {
    return (
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.bg.primary }, style]}
        contentContainerStyle={[paddingStyle, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors.bg.primary },
        paddingStyle,
        style,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );
}
