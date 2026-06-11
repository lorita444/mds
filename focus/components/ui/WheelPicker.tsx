import { useRef, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { colors, typography, radius } from '../../utils/theme';

const ITEM_H = 52;
const VISIBLE = 5;

type WheelPickerProps = {
  values: (string | number)[];
  selectedIndex: number;
  onChangeIndex: (i: number) => void;
  width: number;
};

export function WheelPicker({ values, selectedIndex, onChangeIndex, width }: WheelPickerProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true });
  }, [selectedIndex]);

  const handleEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onChangeIndex(Math.max(0, Math.min(values.length - 1, idx)));
  };

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      {/* Selection band */}
      <View
        style={{
          position: 'absolute',
          top: ITEM_H * 2,
          left: 6,
          right: 6,
          height: ITEM_H,
          borderRadius: radius.md,
          backgroundColor: colors.cosmic.purpleFaint,
          borderWidth: 1,
          borderColor: colors.cosmic.purpleGlow,
        }}
        pointerEvents="none"
      />

      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {values.map((v, i) => {
          const dist = Math.abs(i - selectedIndex);
          return (
            <View
              key={i}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: dist === 0 ? colors.text.primary : colors.text.muted,
                  fontSize: dist === 0 ? typography.sizes.xxl : typography.sizes.lg,
                  fontWeight: dist === 0 ? typography.weights.bold : typography.weights.regular,
                  opacity: dist === 0 ? 1 : dist === 1 ? 0.5 : 0.2,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {v}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Top fade overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: ITEM_H * 2,
          backgroundColor: colors.bg.primary,
          opacity: 0.6,
        }}
        pointerEvents="none"
      />
      {/* Bottom fade overlay */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: ITEM_H * 2,
          backgroundColor: colors.bg.primary,
          opacity: 0.6,
        }}
        pointerEvents="none"
      />
    </View>
  );
}
