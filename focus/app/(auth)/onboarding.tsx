import { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Button } from '../../components/ui/Button';
import {
  ONBOARDING_UNIVERSE,
  ONBOARDING_PORTFOLIO,
  ONBOARDING_AI,
  ONBOARDING_FOCUS,
  ONBOARDING_COOP,
} from '../../utils/assets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  visual: React.ReactNode;
  accentColor: string;
};

const SLIDES: Slide[] = [
  {
    id: 'universe',
    title: 'Grow Your\nAlien Universe',
    subtitle: 'Study to build a cosmos',
    body: 'Every focus session charges your universe with energy. Complete sessions to unlock planets, aliens, habitats, and cosmic structures.',
    visual: (
      <Image
        source={ONBOARDING_UNIVERSE}
        style={{ width: 240, height: 240 }}
        resizeMode="contain"
      />
    ),
    accentColor: colors.cosmic.purpleLight,
  },
  {
    id: 'portfolio',
    title: 'Build Your\nPortfolio',
    subtitle: 'Organize your study materials',
    body: 'Create subjects, add chapters, and upload your notes or PDFs. Your portfolio becomes the brain of your universe.',
    visual: (
      <Image
        source={ONBOARDING_PORTFOLIO}
        style={{ width: 240, height: 240 }}
        resizeMode="contain"
      />
    ),
    accentColor: colors.cosmic.tealLight,
  },
  {
    id: 'ai',
    title: 'AI-Powered\nLearning',
    subtitle: 'Your cosmic study assistant',
    body: 'Generate summaries, create flashcards, and get quizzed on your materials. The AI learns from your uploads.',
    visual: (
      <Image
        source={ONBOARDING_AI}
        style={{ width: 240, height: 240 }}
        resizeMode="contain"
      />
    ),
    accentColor: colors.cosmic.purpleLight,
  },
  {
    id: 'focus',
    title: 'Complete Focus\nSessions',
    subtitle: 'Time = cosmic rewards',
    body: 'Short sessions earn crystals. Long sessions unlock physical universe elements. The more you study, the rarer your rewards.',
    visual: (
      <Image
        source={ONBOARDING_FOCUS}
        style={{ width: 240, height: 240 }}
        resizeMode="contain"
      />
    ),
    accentColor: colors.crystal.primary,
  },
  {
    id: 'coop',
    title: 'Study Together,\nGrow Together',
    subtitle: 'Co-op sessions = bigger rewards',
    body: 'Invite friends to synchronized study rooms. If everyone completes the session, you all earn bonus rewards and exclusive universe elements.',
    visual: (
      <Image
        source={ONBOARDING_COOP}
        style={{ width: 240, height: 240 }}
        resizeMode="contain"
      />
    ),
    accentColor: colors.cosmic.tealLight,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(idx);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({
        x: (currentIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      router.push('/(auth)/login' as never);
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;
  const slide = SLIDES[currentIndex];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.primary,
        paddingBottom: insets.bottom + spacing.lg,
        paddingTop: insets.top,
      }}
    >
      {/* Skip button */}
      <Pressable
        onPress={() => router.push('/(auth)/login' as never)}
        style={({ pressed }) => ({
          alignSelf: 'flex-end',
          marginRight: spacing.md,
          marginTop: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs + 2,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.bg.cardBorder,
          backgroundColor: pressed ? colors.bg.elevated : 'transparent',
        })}
      >
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.medium,
          }}
        >
          Skip
        </Text>
      </Pressable>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View
            key={s.id}
            style={{
              width: SCREEN_WIDTH,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xxl,
              paddingHorizontal: spacing.lg,
            }}
          >
            {/* Visual */}
            <View style={{ minHeight: 240, alignItems: 'center', justifyContent: 'center' }}>
              {s.visual}
            </View>

            {/* Text */}
            <View style={{ gap: spacing.sm, alignItems: 'center' }}>
              <Text
                style={{
                  color: s.accentColor,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.semibold,
                  letterSpacing: typography.tracking.widest,
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                {s.subtitle}
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: typography.sizes.xxl,
                  fontWeight: typography.weights.heavy,
                  textAlign: 'center',
                  lineHeight: 38,
                }}
              >
                {s.title}
              </Text>
              <Text
                style={{
                  color: colors.text.secondary,
                  fontSize: typography.sizes.base,
                  textAlign: 'center',
                  lineHeight: 24,
                  paddingHorizontal: spacing.md,
                }}
              >
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Dots + CTA */}
      <View
        style={{
          gap: spacing.lg,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
        }}
      >
        {/* Dots */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {SLIDES.map((s, i) => (
            <View
              key={s.id}
              style={{
                width: i === currentIndex ? 24 : 6,
                height: 6,
                borderRadius: radius.full,
                backgroundColor:
                  i === currentIndex
                    ? slide.accentColor
                    : colors.text.dim,
              }}
            />
          ))}
        </View>

        <Button
          label={isLast ? 'Get Started' : 'Continue'}
          onPress={handleNext}
          fullWidth
          size="lg"
          variant={isLast ? 'primary' : 'secondary'}
        />

        {!isLast && (
          <Pressable onPress={() => router.push('/(auth)/login' as never)} style={{ paddingVertical: spacing.xs }}>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
              Already have an account?{' '}
              <Text style={{
                color: colors.text.accent,
                textDecorationLine: 'underline',
                textDecorationColor: colors.text.accent,
              }}>
                Sign in
              </Text>
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
